import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as navigation from "../../web/navigation.js";

test("navigation : « Mon tableau de bord » juste sous l'Accueil par défaut", () => {
  assert.deepEqual(navigation.ORDRE_NAVIGATION_DEFAUT.slice(0, 2), ["accueil", "tableau-de-bord"]);
  assert.deepEqual(navigation.ordreNavigation(undefined), [...navigation.ORDRE_NAVIGATION_DEFAUT]);
  assert.deepEqual(navigation.ordreNavigation([]), [...navigation.ORDRE_NAVIGATION_DEFAUT]);
  assert.deepEqual(navigation.ordreNavigation("accueil"), [...navigation.ORDRE_NAVIGATION_DEFAUT]);
});

test("navigation : ordre configuré, identifiants inconnus et doublons écartés", () => {
  assert.deepEqual(navigation.ordreNavigation(["jeux", "accueil", "inconnu", 3, "jeux", "contributions"]), ["jeux", "accueil", "contributions"]);
  assert.deepEqual(navigation.ordreNavigation(["inconnu"]), [...navigation.ORDRE_NAVIGATION_DEFAUT]);
});

test("navigation : config.json déclare un ordre valide qui place le tableau de bord sous l'Accueil", async () => {
  const config = JSON.parse(await readFile("web/config.json", "utf8"));
  const ordre = navigation.ordreNavigation(config.navigation);
  assert.deepEqual(ordre, config.navigation, "chaque identifiant de config.json est connu");
  assert.equal(ordre.indexOf("tableau-de-bord"), ordre.indexOf("accueil") + 1);
});

test("navigation : chaque entrée connue existe dans la page, une seule fois par barre", async () => {
  const html = await readFile("web/index.html", "utf8");
  for (const groupe of ["barre", "mobile"]) {
    const ids = [...html.matchAll(new RegExp(`data-nav-groupe="${groupe}" data-nav-id="([^"]+)"`, "g"))].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `pas de doublon dans la barre ${groupe}`);
    for (const id of ids) assert.ok(navigation.ENTREES_NAVIGATION.includes(id), `${id} est déclaré dans ENTREES_NAVIGATION`);
    for (const id of navigation.ORDRE_NAVIGATION_DEFAUT) assert.ok(ids.includes(id), `${id} présent dans la barre ${groupe}`);
  }
});

test("navigation : vue ouverte par « Mon tableau de bord »", () => {
  const tout = ["profil", "compte", "contributions", "suivi", "classes", "eleves"];
  assert.equal(navigation.vueTableauDeBord(), "profil");
  assert.equal(navigation.vueTableauDeBord({ disponibles: tout, prof: true }), "suivi");
  assert.equal(navigation.vueTableauDeBord({ disponibles: ["profil", "compte"], prof: true }), "profil");
  assert.equal(navigation.vueTableauDeBord({ derniere: "classes", disponibles: tout, prof: true }), "classes");
  assert.equal(navigation.vueTableauDeBord({ derniere: "espace-famille", disponibles: ["profil", "compte"] }), "profil", "vue plus proposée : défaut");
});
