import { fileURLToPath } from "node:url";
// Mesure d'audience Google Analytics soumise au consentement (ADR 0027) : logique pure de web/audience.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as Audience from "../../web/audience.js";

const racine = fileURLToPath(new URL("../..", import.meta.url));
const stockage = (initial = {}) => {
  const donnees = { ...initial };
  return { getItem: (c) => donnees[c] ?? null, setItem: (c, v) => { donnees[c] = String(v); }, donnees };
};

test("identifiant de mesure : seul le format G-XXXXXXXXXX active la mesure", () => {
  assert.equal(Audience.idValide("G-7ZGW294NN8"), true);
  for (const id of ["", undefined, null, "UA-12345-1", "G-", "g-7zgw294nn8", "G-7ZGW294NN8\"><script>", 42]) {
    assert.equal(Audience.idValide(id), false, String(id));
  }
});

test("choix : rien par défaut, seules les valeurs connues sont lues et écrites", () => {
  const s = stockage();
  assert.equal(Audience.lireChoix(s), null);
  assert.equal(Audience.ecrireChoix(s, "peut-etre"), false);
  assert.equal(Audience.lireChoix(s), null);
  assert.equal(Audience.ecrireChoix(s, "accepte"), true);
  assert.equal(Audience.lireChoix(s), "accepte");
  assert.equal(Audience.lireChoix(stockage({ [Audience.CLE_CHOIX]: "oui" })), null);
});

test("choix : un stockage indisponible vaut absence de choix, sans exception", () => {
  const bloque = { getItem() { throw new Error("bloqué"); }, setItem() { throw new Error("bloqué"); } };
  assert.equal(Audience.lireChoix(bloque), null);
  assert.equal(Audience.ecrireChoix(bloque, "refuse"), false);
});

test("refus après accord : les cookies _ga sont effacés sur l'hôte et ses domaines parents, les autres sont gardés", () => {
  assert.deepEqual(Audience.domainesCookies("www.kermiclab.online"), ["www.kermiclab.online", "kermiclab.online"]);
  assert.deepEqual(Audience.domainesCookies("localhost"), []);
  assert.deepEqual(Audience.domainesCookies("127.0.0.1"), []);
  const effacements = Audience.cookiesAEffacer("kermiclab_memoire=1; _ga=GA1.1.1.2; _ga_7ZGW294NN8=GS1.1; _gat=1", "www.kermiclab.online");
  assert.deepEqual(effacements, [
    "_ga=; Max-Age=0; Path=/; SameSite=Lax",
    "_ga=; Max-Age=0; Path=/; SameSite=Lax; Domain=.www.kermiclab.online",
    "_ga=; Max-Age=0; Path=/; SameSite=Lax; Domain=.kermiclab.online",
    "_ga_7ZGW294NN8=; Max-Age=0; Path=/; SameSite=Lax",
    "_ga_7ZGW294NN8=; Max-Age=0; Path=/; SameSite=Lax; Domain=.www.kermiclab.online",
    "_ga_7ZGW294NN8=; Max-Age=0; Path=/; SameSite=Lax; Domain=.kermiclab.online"
  ]);
  assert.deepEqual(Audience.cookiesAEffacer("", "www.kermiclab.online"), []);
});

test("réglages envoyés à Google : pas de signaux publicitaires, adresse sans fragment ni paramètres", () => {
  const reglages = Audience.reglagesMesure(new URL("https://www.kermiclab.online/confidentialite.html?x=1#idee=%7B%22page%22%7D"));
  assert.deepEqual(reglages, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: "https://www.kermiclab.online/confidentialite.html"
  });
});

test("le site construit porte l'identifiant de mesure et autorise Google dans la CSP ; les pages autonomes ne le chargent pas", async () => {
  const lire = (f) => readFile(`${racine}${f}`, "utf8");
  const [config, entetes, chat, confidentialite, autonome, gabarit] = await Promise.all(
    ["dist/config.json", "dist/_headers", "dist/index.html", "dist/confidentialite.html", "index.html", "gabarit/page.html"].map(lire));
  const { mesureGoogle } = JSON.parse(config);
  const csp = entetes.match(/Content-Security-Policy: (.*)/)[1];
  if (mesureGoogle) {
    assert.ok(Audience.idValide(mesureGoogle));
    assert.match(csp, /script-src 'self' https:\/\/static\.cloudflareinsights\.com https:\/\/\*\.googletagmanager\.com;/);
    assert.match(csp, /connect-src [^;]*https:\/\/\*\.google-analytics\.com/);
  } else {
    assert.doesNotMatch(csp, /google/);
  }
  assert.doesNotMatch(csp, /unsafe-inline|doubleclick/);
  for (const page of [chat, confidentialite]) {
    assert.match(page, /<aside id="bandeau-audience"[^>]* hidden>/);
    assert.match(page, /<script type="module" src="audience\.js\?v=[0-9a-f]{10}"><\/script>/);
    // Aucun chargement direct : seul audience.js, après accord, insère le script de Google.
    assert.doesNotMatch(page, /googletagmanager|gtag\(/);
  }
  for (const page of [autonome, gabarit]) assert.doesNotMatch(page, /audience\.js|googletagmanager|google-analytics/);
});

test("le bandeau est traduit dans chaque langue", async () => {
  for (const l of ["fr", "en"]) {
    const textes = JSON.parse(await readFile(`${racine}web/i18n/${l}.json`, "utf8"));
    for (const cle of ["audienceTitre", "audienceTexte", "audienceEnSavoirPlus", "audienceRefuser", "audienceAccepter", "audienceGerer"]) {
      assert.ok(textes[cle], `clé « ${cle} » absente de ${l}.json`);
    }
  }
});
