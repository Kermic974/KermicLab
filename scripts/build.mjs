// Construit : 1) l'index du catalogue + pages pour le Worker, 2) le site statique dist/ servi par le même Worker.
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { appliquerCsp, chargerCatalogue } from "./lib/catalogue.mjs";

const racine = new URL("..", import.meta.url).pathname;
const { sources, ...catalogue } = await chargerCatalogue([`${racine}catalogue`, `${racine}catalogue-prive`]);

// Les pages sources restent lisibles hors ligne : on y réécrit les hashes CSP à jour.
for (const s of sources) if (!s.aJour) { await writeFile(s.fichier, s.html); console.log(`CSP mise à jour : ${s.fichier}`); }
const fichierIndex = `${racine}index.html`;
const sourceIndex = await readFile(fichierIndex, "utf8");
const index = appliquerCsp(sourceIndex, { styles: true });
if (sourceIndex !== index) { await writeFile(fichierIndex, index); console.log(`CSP mise à jour : ${fichierIndex}`); }

await mkdir(`${racine}worker/src/generated`, { recursive: true });
await writeFile(
  `${racine}worker/src/generated/catalogue.js`,
  `// Fichier généré par scripts/build.mjs — ne pas modifier.\nexport const CATALOGUE = ${JSON.stringify(catalogue)};\n`
);
await writeFile(`${racine}worker/src/generated/catalogue-index.json`, `${JSON.stringify(catalogue.index, null, 2)}\n`);

await rm(`${racine}dist`, { recursive: true, force: true });
await cp(`${racine}web`, `${racine}dist`, { recursive: true });
// Vide = même origine (le Worker sert le chat et l'API). KERMICLAB_API_URL seulement pour une API séparée.
const apiUrl = (process.env.KERMICLAB_API_URL || "").replace(/\/$/, "");
const langues = (await readdir(`${racine}web/i18n`)).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", "")).sort();
await writeFile(`${racine}dist/config.json`, `${JSON.stringify({ apiUrl, langues, connexionActive: false }, null, 2)}\n`);
const apiOrigine = apiUrl ? ` ${new URL(apiUrl).origin}` : "";
await writeFile(`${racine}dist/_headers`, `/*
  Content-Security-Policy: default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; img-src 'self' data:; connect-src 'self'${apiOrigine} https://cloudflareinsights.com; frame-src 'self'${apiOrigine}; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`);

console.log(`Catalogue : ${catalogue.index.maquettes.map((m) => `${m.id}@${m.version}`).join(", ")}`);
console.log(`Site statique : dist/ (API ${apiUrl || "même origine"})`);
