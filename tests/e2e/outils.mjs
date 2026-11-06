import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { configurationPublique } from "../../worker/src/configuration.js";

// require() respecte NODE_PATH (Playwright préinstallé globalement) ; en CI il est installé par le workflow.
const { chromium } = createRequire(import.meta.url)("playwright");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

/** Petit serveur statique pour les tests de rendu. */
export async function servir(dossier, { headers = {} } = {}) {
  const serveur = createServer(async (req, res) => {
    const chemin = path.join(dossier, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
    if (!chemin.startsWith(dossier)) { res.writeHead(403).end(); return; }
    try {
      const contenu = await readFile(chemin);
      res.writeHead(200, { "content-type": TYPES[path.extname(chemin)] ?? "application/octet-stream", ...headers }).end(contenu);
    } catch { res.writeHead(404).end("introuvable"); }
  });
  await new Promise((ok) => serveur.listen(0, "127.0.0.1", ok));
  return { url: `http://127.0.0.1:${serveur.address().port}`, fermer: () => new Promise((ok) => serveur.close(ok)) };
}

export async function navigateur() {
  return chromium.launch();
}

/** Ouvre une page en collectant les erreurs console (dont violations CSP). */
export async function ouvrir(nav, url, options = {}) {
  const contexte = await nav.newContext(options);
  const page = await contexte.newPage();
  // Mesure d'audience Cloudflare : neutralisée dans les tests (pas de réseau, pas de comptage).
  await page.route("https://static.cloudflareinsights.com/**", (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
  const erreurs = [];
  page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text()); });
  page.on("pageerror", (e) => erreurs.push(e.message));
  return { page, contexte, erreurs };
}

export const racine = new URL("../..", import.meta.url).pathname;

/**
 * Capture d'écran pour la documentation, uniquement si KERMICLAB_CAPTURES désigne un dossier
 * (`npm run test:captures`, et la CI qui publie l'artefact « captures ») : sinon, aucun coût.
 * Les noms sont normalisés (lettres, chiffres, tirets) ; un même nom écrase la capture précédente.
 */
export async function capturer(page, nom, { pleinePage = false } = {}) {
  const dossier = process.env.KERMICLAB_CAPTURES;
  if (!dossier) return null;
  const fichier = String(nom).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const chemin = path.resolve(racine, dossier, `${fichier}.png`);
  await page.waitForTimeout(250); // fin des animations d'apparition
  await page.screenshot({ path: chemin, fullPage: pleinePage, animations: "disabled" });
  return chemin;
}

/** Simule le Worker kermiclab-api (API et maquettes) à l'adresse configurée dans dist/config.json. */
/** Lot de défis tel que le renvoie `/api/defi` (ADR 0018) ; `n` défis valides, la page complète avec sa banque. */
export function defisIa(api, n = 5) {
  return Array.from({ length: n }, (_, i) => ({
    notion: i % 2 ? "fractions" : "pythagore", titre: i % 2 ? "Les fractions" : "Le théorème de Pythagore",
    format: i === 1 ? "vrai-faux" : "qcm", enonce: `Défi inédit ${i + 1} ?`,
    choix: i === 1 ? ["Vrai", "Faux"] : [`Réponse A${i + 1}`, `Réponse B${i + 1}`, `Réponse C${i + 1}`],
    bonne: i === 1 ? 0 : 2, explication: `Explication ${i + 1}.`,
    url: `${api}/maquettes/${i % 2 ? "fractions" : "pythagore"}?lang=fr`
  }));
}

export async function simulerApiKermiclab(page, { origine, api, htmlMaquette, jeux = false, llmActif = true, defi = null }) {
  const requetes = [];
  await page.route(`${api}/auth/me`, (route) => route.fulfill({
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": origine,
      "access-control-allow-credentials": "true"
    },
    body: JSON.stringify({ connecte: false })
  }));
  await page.route(`${api}/maquettes/**`, (route) => route.fulfill({ contentType: "text/html", body: htmlMaquette }));
  await page.route(`${api}/api/llm/status`, (route) => route.fulfill({
    contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({
      actif: llmActif, defi: { ia: llmActif, generationsParJour: 3 },
      skills: { tuteur: llmActif, "cadrage-idee": llmActif, "defi-express": llmActif },
      configuration: configurationPublique({ LLM_ACTIF: String(llmActif), DEFI_GENERATIONS_JOUR: "3" })
    })
  }));
  await page.route(`${api}/api/defi`, async (route) => {
    const corps = route.request().postDataJSON();
    requetes.push({ defi: corps });
    const reponse = defi ? defi(corps) : { source: "banque", raison: "ia-inactive", defis: [], quota: { limite: 3, utilisees: 0, restantes: 3 } };
    return route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": origine, "access-control-allow-credentials": "true" },
      body: JSON.stringify(reponse)
    });
  });
  await page.route(`${api}/api/suggestions**`, (route) => route.fulfill({
    contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ suggestions: ["C'est quoi le sinus ?", "Je ne comprends pas les radians"] })
  }));
  await page.route(`${api}/api/catalogue`, (route) => route.fulfill({
    contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ notions: [
      { id: "fractions", titre: "Les fractions", version: "1.0.0", niveau: "college" },
      { id: "pythagore", titre: "Le théorème de Pythagore", version: "1.0.0", niveau: "college" },
      { id: "trigo-cercle", titre: "Le cercle trigonométrique", version: "1.0.0", niveau: "seconde" },
      { id: "derivation", titre: "La dérivation", version: "1.0.0", niveau: "premiere" },
      { id: "electricite", titre: "Circuits électriques et loi d'Ohm", version: "1.0.0", niveau: "college", matiere: "physique-chimie" },
      { id: "art", titre: "L'art", version: "1.0.0", niveau: "terminale", matiere: "philosophie" },
      ...(jeux ? [{ id: "echecs", titre: "Les échecs", version: "1.0.0", niveau: "autres", matiere: "jeux" }] : [])
    ].map((n) => ({ matiere: "mathematiques", ...n })) })
  }));
  await page.route(`${api}/api/chat`, async (route) => {
    const corps = route.request().postDataJSON();
    requetes.push(corps);
    const sinus = /sinus|sine/i.test(corps.message);
    return route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": origine, "access-control-allow-credentials": "true" },
      body: JSON.stringify(sinus
        ? { type: "maquette", texte: "Voici la page.", suggestions: ["Que vaut sin(30°) ?"], maquette: { id: "trigo-cercle", titre: "Le cercle trigonométrique", version: "1.0.0", langue: "fr", url: `${api}/maquettes/trigo-cercle?lang=fr` } }
        : /volcan/i.test(corps.message)
          ? { type: "hors-catalogue", texte: "Pas encore de page.", suggestions: ["C'est quoi le sinus ?"] }
          : { type: "reponse", texte: "Réponse simple." })
    });
  });
  return requetes;
}
