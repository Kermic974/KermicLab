// Construit : 1) l'index du catalogue + pages pour le Worker, 2) le site statique dist/ pour Cloudflare Pages.
import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { chargerCatalogue } from "./lib/catalogue.mjs";

const racine = new URL("..", import.meta.url).pathname;
const { sources, ...catalogue } = await chargerCatalogue([`${racine}catalogue`, `${racine}catalogue-prive`]);

// Les pages sources restent lisibles hors ligne : on y réécrit les hashes CSP à jour.
for (const s of sources) if (!s.aJour) { await writeFile(s.fichier, s.html); console.log(`CSP mise à jour : ${s.fichier}`); }

await mkdir(`${racine}worker/src/generated`, { recursive: true });
await writeFile(
  `${racine}worker/src/generated/catalogue.js`,
  `// Fichier généré par scripts/build.mjs — ne pas modifier.\nexport const CATALOGUE = ${JSON.stringify(catalogue)};\n`
);
await writeFile(`${racine}worker/src/generated/catalogue-index.json`, `${JSON.stringify(catalogue.index, null, 2)}\n`);

await rm(`${racine}dist`, { recursive: true, force: true });
await cp(`${racine}web`, `${racine}dist`, { recursive: true });
const apiUrl = process.env.KERMICLAB_API_URL || "http://localhost:8787";
const langues = (await readdir(`${racine}web/i18n`)).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", "")).sort();
await writeFile(`${racine}dist/config.json`, `${JSON.stringify({ apiUrl, langues, connexionActive: false }, null, 2)}\n`);
const apiOrigine = new URL(apiUrl).origin;
await writeFile(`${racine}dist/_headers`, `/*
  Content-Security-Policy: default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; img-src 'self' data:; connect-src 'self' ${apiOrigine} https://cloudflareinsights.com; frame-src ${apiOrigine}; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`);

console.log(`Catalogue : ${catalogue.index.maquettes.map((m) => `${m.id}@${m.version}`).join(", ")}`);
console.log(`Site statique : dist/ (API ${apiUrl})`);
