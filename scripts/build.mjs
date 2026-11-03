// Construit : 1) l'index du catalogue + pages pour le Worker, 2) le site statique dist/ publié sur Cloudflare Pages :
//    le chat à la racine, l'application autonome du cercle trigonométrique sous /cercle/ et la maquette du
//    tableau de bord élève sous /dashboard/.
import { createHash } from "node:crypto";
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
// Maquette du tableau de bord élève (web/dashboard/) : page autonome avec sa propre CSP, hash du script tenu à jour.
const fichierDashboard = `${racine}web/dashboard/index.html`;
const sourceDashboard = await readFile(fichierDashboard, "utf8");
const dashboard = appliquerCsp(sourceDashboard);
if (sourceDashboard !== dashboard) { await writeFile(fichierDashboard, dashboard); console.log(`CSP mise à jour : ${fichierDashboard}`); }

await mkdir(`${racine}worker/src/generated`, { recursive: true });
await writeFile(
  `${racine}worker/src/generated/catalogue.js`,
  `// Fichier généré par scripts/build.mjs — ne pas modifier.\nexport const CATALOGUE = ${JSON.stringify(catalogue)};\n`
);
await writeFile(`${racine}worker/src/generated/catalogue-index.json`, `${JSON.stringify(catalogue.index, null, 2)}\n`);

await rm(`${racine}dist`, { recursive: true, force: true });
await cp(`${racine}web`, `${racine}dist`, { recursive: true });
await versionnerRessources(`${racine}dist`);
// Le chat (Pages) appelle l'API du Worker kermiclab-api ; KERMICLAB_API_URL permet de pointer ailleurs (CI, local).
const API_PAR_DEFAUT = "https://kermiclab-api.kermic.workers.dev";
const apiUrl = (process.env.KERMICLAB_API_URL ?? API_PAR_DEFAUT).replace(/\/$/, "");
// Application autonome (index.html racine, générée depuis src/) servie sous /cercle/.
await mkdir(`${racine}dist/cercle`, { recursive: true });
await writeFile(`${racine}dist/cercle/index.html`, index);
const langues = (await readdir(`${racine}web/i18n`)).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", "")).sort();
await writeFile(`${racine}dist/config.json`, `${JSON.stringify({ apiUrl, langues, connexionActive: false }, null, 2)}\n`);
const apiOrigine = apiUrl ? ` ${new URL(apiUrl).origin}` : "";
await writeFile(`${racine}dist/_headers`, `/*
  Content-Security-Policy: default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; img-src 'self' data:; connect-src 'self'${apiOrigine} https://cloudflareinsights.com; frame-src 'self'${apiOrigine}; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/cercle/*
  ! Content-Security-Policy

/dashboard/*
  ! Content-Security-Policy
`);
// L'application autonome porte sa propre CSP (meta, hashes des scripts et styles en ligne) : celle du chat,
// sans 'unsafe-inline', la bloquerait ; on la retire donc pour /cercle/* et /dashboard/* (maquette, CSP en meta).

console.log(`Catalogue : ${catalogue.index.maquettes.map((m) => `${m.id}@${m.version}`).join(", ")}`);
console.log(`Site statique : dist/ (chat à la racine, application sous /cercle/ ; API ${apiUrl || "même origine"})`);

/**
 * Ajoute l'empreinte du contenu aux URL des CSS et JS du chat (`style.css?v=…`). Cloudflare Pages les met en cache
 * 4 h dans le navigateur alors que le HTML est revalidé à chaque visite : sans empreinte, une nouvelle page HTML
 * pouvait s'afficher avec l'ancien CSS ou l'ancien JS. Les modules importés passent d'abord, pour que l'empreinte
 * d'app.js change aussi quand seul un module change.
 */
async function versionnerRessources(dossier) {
  const empreinte = (texte) => createHash("sha256").update(texte).digest("hex").slice(0, 10);
  const versions = {};
  for (const fichier of ["progression.js", "style.css"]) versions[fichier] = empreinte(await readFile(`${dossier}/${fichier}`));
  const appSource = await readFile(`${dossier}/app.js`, "utf8");
  const app = appSource.replace(/from "\.\/progression\.js"/g, `from "./progression.js?v=${versions["progression.js"]}"`);
  if (app === appSource) throw new Error("versionnerRessources : import de progression.js introuvable dans app.js");
  await writeFile(`${dossier}/app.js`, app);
  versions["app.js"] = empreinte(app);
  for (const page of (await readdir(dossier)).filter((f) => f.endsWith(".html"))) {
    const source = await readFile(`${dossier}/${page}`, "utf8");
    const html = source.replace(/(href|src)="(style\.css|app\.js)"/g, (tout, attribut, fichier) => `${attribut}="${fichier}?v=${versions[fichier]}"`);
    await writeFile(`${dossier}/${page}`, html);
  }
}
