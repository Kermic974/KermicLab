import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

// require() respecte NODE_PATH (Playwright préinstallé globalement) ; en CI il est installé par le workflow.
const { chromium } = createRequire(import.meta.url)("playwright");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

/** Petit serveur statique pour les tests de rendu. */
export async function servir(dossier) {
  const serveur = createServer(async (req, res) => {
    const chemin = path.join(dossier, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
    if (!chemin.startsWith(dossier)) { res.writeHead(403).end(); return; }
    try {
      const contenu = await readFile(chemin);
      res.writeHead(200, { "content-type": TYPES[path.extname(chemin)] ?? "application/octet-stream" }).end(contenu);
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
  const erreurs = [];
  page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text()); });
  page.on("pageerror", (e) => erreurs.push(e.message));
  return { page, contexte, erreurs };
}

export const racine = new URL("../..", import.meta.url).pathname;
