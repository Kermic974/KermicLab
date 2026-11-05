import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { navigateur, racine } from "./outils.mjs";

const fichiers = ["index.html", "notion.html", "cercle.html", "jeux.html"];
const dossier = new URL("docs/ux/", pathToFileURL(racine));

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

      const liens = await page.locator("a[href]").evaluateAll((elements) => elements.map((e) => e.getAttribute("href")));
      for (const lien of liens) {
        const cible = new URL(lien, url);
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
      const volet = page.locator("details").last();
      await volet.locator("summary").click();
      assert.equal(await volet.getAttribute("open"), "", `${fichier} : volet natif ouvrable`);
    }

    await page.goto(new URL("index.html", dossier).href);
    await page.getByRole("link", { name: "Page de notion", exact: true }).click();
    assert.equal(new URL(page.url()).pathname, new URL("notion.html", dossier).pathname);
    assert.deepEqual(reseau, [], "aucune requête HTTP, même en mode hors ligne");
    assert.deepEqual(erreurs, [], "aucune erreur de script ou CSP");
  } finally {
    await contexte.close();
    await nav.close();
  }
});
