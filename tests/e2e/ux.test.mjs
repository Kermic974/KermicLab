import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { navigateur, racine } from "./outils.mjs";
import { chargerCatalogue } from "../../scripts/lib/catalogue.mjs";
import { construireInventaire } from "../../scripts/ux-inventaire.mjs";
import { sansSuivi, verifierSuivi } from "../../scripts/ux-suivi.mjs";

const fichiers = ["index.html", "notion.html", "cercle.html", "jeux.html", "editorial.html", "inventaire.html"];
const dossier = new URL("docs/ux/", pathToFileURL(racine));

test("l'inventaire UX correspond exactement aux sources publiques actuelles", async () => {
  assert.equal(sansSuivi(await readFile(new URL("inventaire.html", dossier), "utf8")), await construireInventaire(),
    "Relire les squelettes puis régénérer avec node scripts/ux-suivi.mjs --version=X.Y.Z");
  await verifierSuivi();
});

test("le versioning UX refuse une version invalide, identique ou antérieure sans modifier les artefacts", async () => {
  const registre = await readFile(new URL("suivi.json", dossier), "utf8");
  const { version } = JSON.parse(registre);
  const avant = await Promise.all(fichiers.map((f) => readFile(new URL(f, dossier), "utf8")));
  for (const valeur of ["incorrecte", "1.0", "0.0.0", version]) {
    assert.throws(() => execFileSync(process.execPath, ["scripts/ux-suivi.mjs", `--version=${valeur}`],
      { cwd: racine, stdio: "pipe" }), (erreur) => {
      assert.match(erreur.stderr.toString(), /Utiliser --version|version doit dépasser/);
      return true;
    });
  }
  assert.equal(await readFile(new URL("suivi.json", dossier), "utf8"), registre);
  assert.deepEqual(await Promise.all(fichiers.map((f) => readFile(new URL(f, dossier), "utf8"))), avant);
});

test("le suivi UX versionne uniquement les vues affectées et conserve les instantanés précédents", async () => {
  const temporaire = await mkdtemp(path.join(tmpdir(), "trigolab-ux-test-"));
  const lancer = (...args) => execFileSync(process.execPath, ["scripts/ux-suivi.mjs", ...args],
    { cwd: temporaire, stdio: "pipe" });
  const registre = async () => JSON.parse(await readFile(path.join(temporaire, "docs/ux/suivi.json"), "utf8"));
  try {
    for (const nom of ["docs/ux", "scripts", "web", "catalogue", "gabarit", "src"]) {
      await cp(path.join(racine, nom), path.join(temporaire, nom), { recursive: true });
    }
    execFileSync("git", ["init", "-q"], { cwd: temporaire, stdio: "pipe" });
    execFileSync("git", ["add", "."], { cwd: temporaire, stdio: "pipe" });
    execFileSync("git", ["-c", "user.name=UX fixture", "-c", "user.email=ux@example.invalid",
      "commit", "-qm", "Fixture UX\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"],
    { cwd: temporaire, stdio: "pipe" });
    const initial = await registre();
    const [majeure, mineure, corrective] = initial.version.split(".").map(Number);
    const correction = `${majeure}.${mineure}.${corrective + 1}`;
    const evolution = `${majeure}.${mineure + 1}.0`;
    const liens = `${majeure}.${mineure + 1}.1`;
    lancer("--check");
    const accueil = path.join(temporaire, "docs/ux/index.html");
    await writeFile(accueil, (await readFile(accueil, "utf8")).replace("<h1>", "<h1>Édition UX · "));
    assert.throws(() => lancer("--check"));
    lancer(`--version=${correction}`);
    const apresCorrection = await registre();
    assert.deepEqual(apresCorrection.historique.at(-1).modifies, ["index.html"]);
    assert.equal(apresCorrection.artefacts["index.html"].version, correction);
    assert.deepEqual(apresCorrection.artefacts["notion.html"], initial.artefacts["notion.html"]);
    assert.deepEqual(apresCorrection.historique.slice(0, -1), initial.historique);
    assert.throws(() => lancer(`--version=${evolution}`), /Command failed/);
    assert.deepEqual(await registre(), apresCorrection, "pas de version vide");

    const source = path.join(temporaire, "src/index.template.html");
    await writeFile(source, `${await readFile(source, "utf8")}\n`);
    assert.throws(() => lancer("--check"));
    lancer(`--version=${evolution}`);
    assert.deepEqual((await registre()).historique.at(-1).modifies, ["cercle.html", "inventaire.html"]);

    const outil = path.join(temporaire, "scripts/ux-suivi.mjs");
    await writeFile(outil, (await readFile(outil, "utf8")).replace("Historique des sources", "Historique des vues sources"));
    assert.throws(() => lancer("--check"));
    lancer(`--version=${liens}`);
    assert.deepEqual((await registre()).historique.at(-1).modifies, fichiers);
    lancer("--check");
  } finally {
    await rm(temporaire, { recursive: true, force: true });
  }
});

test("les squelettes UX restent autonomes, navigables hors ligne et lisibles sur mobile", async () => {
  const nav = await navigateur();
  const contexte = await nav.newContext({ offline: true });
  const page = await contexte.newPage();
  const erreurs = [];
  const reseau = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text()); });
  page.on("request", (r) => { if (/^https?:/.test(r.url())) reseau.push(r.url()); });
  try {
    for (const fichier of fichiers) {
      const url = new URL(fichier, dossier);
      await page.goto(url.href);
      assert.equal(await page.locator("html").getAttribute("lang"), "fr");
      assert.equal(await page.locator("h1").count(), 1);
      assert.ok(await page.locator("[data-ecran]").count() >= 3, fichier);
      assert.equal(await page.locator("script, link[rel=stylesheet], iframe, form").count(), 0, fichier);
      const ids = await page.locator("[id]").evaluateAll((elements) => elements.map((e) => e.id));
      assert.equal(new Set(ids).size, ids.length, `${fichier} : identifiants uniques`);

      assert.equal(await page.locator("[data-suivi-ux]").count(), 1, `${fichier} : cartouche de version unique`);
      const suivi = page.locator("[data-suivi-ux] details");
      await suivi.locator("summary").click();
      assert.equal(await suivi.getAttribute("open"), "", `${fichier} : liens de suivi accessibles`);
      const liens = await page.locator("a[href]").evaluateAll((elements) => elements.map((e) => ({
        href: e.getAttribute("href"), actif: e.hasAttribute("data-lien-actif"), cible: e.target, rel: e.rel
      })));
      for (const { href: lien, actif, cible: fenetre, rel } of liens) {
        const cible = new URL(lien, url);
        if (actif) {
          assert.equal(cible.protocol, "https:", `${fichier} : vue active HTTPS`);
          assert.ok(["github.com", "kermiclab.online", "kermiclab-api.kermic.workers.dev"].includes(cible.hostname),
            `${fichier} : hôte de la vue active connu`);
          assert.equal(fenetre, "_blank");
          assert.ok(rel.split(" ").includes("noopener"));
          continue;
        }
        assert.equal(cible.protocol, "file:", `${fichier} : lien local ${lien}`);
        assert.ok(fichiers.includes(cible.pathname.split("/").at(-1)), `${fichier} : fichier cible ${lien}`);
        const html = await readFile(cible, "utf8");
        if (cible.hash) {
          const present = await page.evaluate(({ html, id }) =>
            Boolean(new DOMParser().parseFromString(html, "text/html").getElementById(id)),
          { html, id: decodeURIComponent(cible.hash.slice(1)) });
          assert.ok(present, `${fichier} : ancre existante ${lien}`);
        }
      }

      for (const largeur of [360, 768, 1440]) {
        await page.setViewportSize({ width: largeur, height: 900 });
        const dimensions = await page.evaluate(() => ({
          contenu: document.documentElement.scrollWidth,
          fenetre: window.innerWidth
        }));
        assert.ok(dimensions.contenu <= dimensions.fenetre, `${fichier} : pas de débordement à ${largeur}px`);
      }
      const volet = page.locator("main details").last();
      await volet.locator("summary").click();
      assert.equal(await volet.getAttribute("open"), "", `${fichier} : volet natif ouvrable`);
    }

    await page.goto(new URL("index.html", dossier).href);
    const source = await readFile(new URL("web/index.html", pathToFileURL(racine)), "utf8");
    for (const [, id] of source.matchAll(/<dialog id="([^"]+)"/g)) {
      assert.equal(await page.locator(`[data-source="web/index.html:${id}"]`).count(), 1, `dialogue ${id}`);
    }
    for (const nav of new Set([...source.matchAll(/data-nav="([^"]+)"/g)].map((m) => m[1]))) {
      assert.ok(await page.locator(`[data-nav="${nav}"]`).count() > 0, `navigation ${nav}`);
    }
    await page.getByRole("link", { name: "Page de notion", exact: true }).click();
    assert.equal(new URL(page.url()).pathname, new URL("notion.html", dossier).pathname);

    const catalogue = await chargerCatalogue([new URL("catalogue/", pathToFileURL(racine)).pathname]);
    await page.goto(new URL("inventaire.html", dossier).href);
    assert.deepEqual((await page.locator("[data-notion]").evaluateAll((e) => e.map((n) => n.dataset.notion))).sort(),
      catalogue.index.maquettes.map((n) => n.id).sort(), "chaque page publique inventoriée exactement une fois");
    await page.goto(new URL("jeux.html", dossier).href);
    const jeux = catalogue.index.maquettes.filter((n) => n.sujet.startsWith("jeux/"));
    assert.deepEqual((await page.locator("[data-jeu]").evaluateAll((e) => e.map((n) => n.dataset.jeu))).sort(),
      jeux.map((n) => n.id).sort(), "chaque jeu possède son squelette");
    for (const jeu of jeux) {
      const bloc = page.locator(`[data-jeu="${jeu.id}"]`);
      const onglets = [...catalogue.pages[jeu.id].fr.matchAll(/enregistrerOnglet\(\{\s*id:\s*"([^"]+)"[^}]*?titre:\s*"([^"]+)"/g)]
        .filter((m) => m[1] !== "self-test");
      assert.deepEqual(await bloc.locator("[data-onglet]").evaluateAll((e) => e.map((n) => n.dataset.onglet)),
        onglets.map((m) => m[1]), `${jeu.id} : tous les onglets actifs, dans l'ordre du registre rendu`);
      for (const [, id, titre] of onglets) {
        assert.ok((await bloc.locator(`[data-onglet="${id}"] h3`).textContent()).startsWith(titre),
          `${jeu.id}/${id} : titre réel de l'onglet`);
      }
    }
    assert.deepEqual(reseau, [], "aucune requête HTTP, même en mode hors ligne");
    assert.deepEqual(erreurs, [], "aucune erreur de script ou CSP");
  } finally {
    await contexte.close();
    await nav.close();
  }
});
