import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

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

/** Simule le Worker kermiclab-api (API et maquettes) à l'adresse configurée dans dist/config.json. */
export async function simulerApiKermiclab(page, { origine, api, htmlMaquette, jeux = false }) {
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
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(sinus
        ? { type: "maquette", texte: "Voici la page.", suggestions: ["Que vaut sin(30°) ?"], maquette: { id: "trigo-cercle", titre: "Le cercle trigonométrique", version: "1.0.0", langue: "fr", url: `${api}/maquettes/trigo-cercle?lang=fr` } }
        : /volcan/i.test(corps.message)
          ? { type: "hors-catalogue", texte: "Pas encore de page.", suggestions: ["C'est quoi le sinus ?"] }
          : { type: "reponse", texte: "Réponse simple." })
    });
  });
  return requetes;
}
