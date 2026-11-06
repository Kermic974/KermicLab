import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { construireInventaire } from "./ux-inventaire.mjs";
import { normaliserSource, verifierReference } from "./ux-sources.mjs";

const racine = fileURLToPath(new URL("../", import.meta.url));
const dossier = path.join(racine, "docs/ux");
const depot = "https://github.com/Kermic974/trigoLab";
const site = "https://kermiclab.online/";
const definitions = {
  "index.html": {
    sources: ["web", "catalogue", "gabarit/jeux/trophees.js", "scripts/lib/trophees.mjs", "scripts/roadmap.mjs"],
    vues: [
      ["premiere-visite", "", "Première visite : nouveau navigateur, dialogue de pseudo"],
      ["accueil", "#accueil", "Accueil"],
      ["labs", "#labs", "Labs : applications autonomes"],
      ["jeux", "#jeux", "Jeux : cartes et recherche"],
      ["progression", "#progression", "Progression : écran dédié"],
      ["catalogue", "", "Notions : cliquer sur Notions pour ouvrir le panneau"],
      ["conversation", "", "Conversation : poser une question"],
      ["bulle", "", "Bulle Lab : ouvrir une notion du catalogue"],
      ["defi", "#defi", "Défi express : écran dédié"],
      ["badges", "#badges", "Mes trophées : écran dédié"],
      ["profil", "#profil", "Configuration : interrupteur d'utilisation de l'IA"],
      ["profil-dialogue", "", "Profil : cliquer sur la carte du profil ou l'avatar mobile"],
      ["support", "", "Support : cliquer sur Signaler un problème"],
      ["famille", "#famille", "Espace famille : écran dédié, masqué tant que connexionActive vaut false"],
      ["comptes", null, "Type de profil : dialogue Profil, bloc masqué tant que connexionActive vaut false"]
    ]
  },
  "notion.html": {
    sources: ["gabarit", "catalogue"],
    vues: [["explication", "maquette:pythagore", "Gabarit commun : Pythagore, onglets Explication / Mémo / S'entraîner / Défi"],
      ["thales", "maquette:thales", "Lab Thalès : curseur du rapport de réduction et triangles semblables"],
      ["cercle-catalogue", "maquette:trigo-cercle", "Notion cercle : Explication / Application / Défi"]]
  },
  "cercle.html": {
    sources: ["src"],
    vues: [["explorer", "cercle/?mode=explore", "Explorer"], ["apprendre", "cercle/?mode=learn", "Apprendre"], ["jouer", "cercle/?mode=play", "Jouer"]]
  },
  "jeux.html": {
    sources: ["catalogue", "gabarit/jeux"],
    vues: ["2048", "belote", "demineur", "echecs", "mots-croises", "mots-fleches", "pendu", "poker-texas-holdem", "sudoku"]
      .map((id) => [`jeu-${id}`, `maquette:${id}`, id])
  },
  "editorial.html": {
    sources: ["web/feuille-de-route.html", "web/confidentialite.html", "web/mentions-legales.html", "scripts/roadmap.mjs"],
    vues: ["feuille-de-route", "confidentialite", "mentions-legales"].map((id) => [id, `${id}.html`, id])
  },
  "inventaire.html": {
    sources: ["web", "catalogue", "gabarit", "src", "scripts/ux-inventaire.mjs", "scripts/ux-sources.mjs", "scripts/roadmap.mjs"],
    vues: [[null, "", "Site actif : point d'entrée de tous les parcours"]]
  }
};
const echapper = (texte) => String(texte).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const hash = (texte) => createHash("sha256").update(texte).digest("hex");
const lire = (fichier) => readFile(path.join(racine, fichier), "utf8");
export const sansSuivi = (html) => html.replace(/^[ \t]*<!-- ux:suivi:debut -->[\s\S]*?<!-- ux:suivi:fin -->\r?\n?/gm, "");
const avecSuivi = (html, bloc) => html.replace(/^[ \t]*<\/header>/m, (fermeture) => `${bloc}\n${fermeture}`);

async function fichiersSources(chemin) {
  if (!(await stat(path.join(racine, chemin))).isDirectory()) return [chemin];
  const enfants = await readdir(path.join(racine, chemin));
  return (await Promise.all(enfants.map((nom) => fichiersSources(`${chemin}/${nom}`)))).flat();
}

async function empreinteSources(sources) {
  const fichiers = [...new Set((await Promise.all(sources.map(fichiersSources))).flat())].sort();
  const empreinte = createHash("sha256");
  for (const fichier of fichiers) {
    empreinte.update(fichier).update("\0")
      .update(normaliserSource(fichier, await readFile(path.join(racine, fichier)))).update("\0");
  }
  return empreinte.digest("hex");
}

function blocSuivi(fichier, entree, api) {
  const lien = (url, texte) => `<a href="${echapper(url)}" target="_blank" rel="noopener noreferrer" data-lien-actif>${echapper(texte)}</a>`;
  const def = definitions[fichier];
  return `<!-- ux:suivi:debut -->
<aside data-suivi-ux style="border:1px dashed #777;padding:1rem;margin:1rem 0;background:#eee;overflow-wrap:anywhere">
  <strong>Squelette v${echapper(entree.version)} · ${echapper(entree.date)}</strong>
  <p>Référence source : ${lien(`${depot}/tree/${entree.revision}`, entree.revision.slice(0, 7))}.
  ${lien(`${depot}/commits/main/${def.sources[0]}`, "Historique des sources")} · ${lien(`${depot}/blob/main/docs/ux/${fichier}`, "Dernier squelette sur main")}</p>
  <details><summary>Comparer avec les vues actives et les sources</summary>
    <p>Les liens ouvrent le site dans un nouvel onglet, uniquement sur clic. Ils suivent les vues actives, pas une version déployée certifiée. Un dialogue sans URL directe nécessite l'action indiquée. Aucun compte masqué n'est ouvert artificiellement.</p>
    <ul>${def.vues.map(([ancre, route, texte]) => {
    const url = route === null ? null : route.startsWith("maquette:")
      ? `${api}/maquettes/${encodeURIComponent(route.slice(9))}?lang=fr` : new URL(route, site).href;
    return `<li>${ancre ? `<a href="#${echapper(ancre)}">Squelette</a> ↔ ` : ""}${url ? lien(url, texte) : echapper(texte)}</li>`;
  }).join("\n")}</ul>
    <p>Sources liées : ${def.sources.map((s) => lien(`${depot}/tree/main/${s}`, s)).join(" · ")}</p>
    <p>Empreinte des sources : <code>${entree.sourcesSha256}</code><br>Empreinte du squelette hors cartouche : <code>${entree.squeletteSha256}</code></p>
    <p>Registre et journal : docs/ux/suivi.json. Mise à jour : <code>node scripts/ux-suivi.mjs --version=X.Y.Z</code>. Contrôle sans modification : <code>node scripts/ux-suivi.mjs --check</code>.</p>
  </details>
</aside>
<!-- ux:suivi:fin -->`;
}

const versionValide = (v) => typeof v === "string" && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(v) &&
  v.split(".").every((n) => Number.isSafeInteger(Number(n)));
const versionSuperieure = (a, b) => {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  const i = x.findIndex((n, k) => n !== y[k]);
  return i >= 0 && x[i] > y[i];
};

async function chargerRegistre() {
  try { return JSON.parse(await readFile(path.join(dossier, "suivi.json"), "utf8")); }
  catch (erreur) {
    if (erreur.code !== "ENOENT") throw erreur;
    return null;
  }
}

export async function verifierSuivi() {
  const registre = await chargerRegistre();
  assert.ok(registre, "Registre UX absent : lancer scripts/ux-suivi.mjs --version=X.Y.Z");
  assert.ok(versionValide(registre.version), "Version UX invalide");
  const { apiUrl } = JSON.parse(await lire("web/config.json"));
  assert.equal(registre.site, site);
  assert.equal(registre.api, apiUrl);
  assert.deepEqual(Object.keys(registre.artefacts).sort(), Object.keys(definitions).sort());
  for (const [fichier, def] of Object.entries(definitions)) {
    const html = await readFile(path.join(dossier, fichier), "utf8");
    const entree = registre.artefacts[fichier];
    assert.match(entree.revision, /^[a-f0-9]{40}$/, `${fichier} : commit source invalide`);
    await verifierReference(def.sources, entree.revision);
    assert.ok(versionValide(entree.version), `${fichier} : version invalide`);
    assert.equal(entree.squeletteSha256, hash(sansSuivi(html)), `${fichier} : squelette modifié sans nouvelle version`);
    assert.equal(entree.sourcesSha256, await empreinteSources(def.sources), `${fichier} : sources modifiées, relire et versionner`);
    assert.equal(html, avecSuivi(sansSuivi(html), blocSuivi(fichier, entree, apiUrl)),
      `${fichier} : cartouche de suivi ou liens actifs périmés`);
  }
}

async function actualiser(version) {
  assert.ok(versionValide(version), "Utiliser --version=X.Y.Z (SemVer sans préversion)");
  const ancien = await chargerRegistre();
  if (ancien) assert.ok(versionSuperieure(version, ancien.version), `La version doit dépasser ${ancien.version}`);
  await verifierReference([...new Set(Object.values(definitions).flatMap((d) => d.sources))]);
  const { apiUrl } = JSON.parse(await lire("web/config.json"));
  const date = new Date().toISOString().slice(0, 10);
  const artefacts = {}, sorties = [], modifies = [];
  for (const [fichier, def] of Object.entries(definitions)) {
    const actuel = await readFile(path.join(dossier, fichier), "utf8");
    const html = sansSuivi(fichier === "inventaire.html" ? await construireInventaire() : actuel);
    const squeletteSha256 = hash(html), sourcesSha256 = await empreinteSources(def.sources);
    const precedent = ancien?.artefacts[fichier];
    const liensChanges = precedent && actuel !== avecSuivi(sansSuivi(actuel), blocSuivi(fichier, precedent, apiUrl));
    const change = !precedent || precedent.squeletteSha256 !== squeletteSha256 || precedent.sourcesSha256 !== sourcesSha256 ||
      ancien.api !== apiUrl || ancien.site !== site || liensChanges;
    const revision = execFileSync("git", ["log", "-1", "--format=%H", "--", ...def.sources], { cwd: racine, encoding: "utf8" }).trim();
    assert.match(revision, /^[a-f0-9]{40}$/, "Commit source introuvable");
    artefacts[fichier] = change ? { version, date, revision, squeletteSha256, sourcesSha256 } : precedent;
    if (change) modifies.push(fichier);
    sorties.push([fichier, avecSuivi(html, blocSuivi(fichier, artefacts[fichier], apiUrl))]);
  }
  assert.ok(modifies.length, "Aucun squelette ni source modifié : pas de nouvelle version nécessaire");
  const registre = {
    version, site, api: apiUrl, artefacts,
    historique: [...(ancien?.historique ?? []), { version, date, modifies,
      precedente: ancien?.version ?? null,
      artefacts: Object.fromEntries(modifies.map((fichier) => [fichier, artefacts[fichier]])) }]
  };
  for (const [fichier, html] of sorties) await writeFile(path.join(dossier, fichier), html);
  await writeFile(path.join(dossier, "suivi.json"), `${JSON.stringify(registre, null, 2)}\n`);
  await verifierSuivi();
  console.log(`UX v${version} : ${modifies.join(", ")}. Relire le diff avant commit.`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.includes("--check")) {
    await verifierSuivi();
    console.log("Suivi UX OK : versions, empreintes et liens actifs à jour.");
  } else {
    const version = process.argv.find((arg) => arg.startsWith("--version="))?.slice(10);
    await actualiser(version ?? "");
  }
}
