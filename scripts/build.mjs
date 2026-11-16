// Construit : 1) l'index du catalogue + pages pour le Worker, 2) le site statique dist/ publié sur Cloudflare Pages :
//    le tableau de bord élève (avec le chat) à la racine et l'application autonome du cercle trigonométrique sous /cercle/.
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { appliquerCsp, chargerCatalogue, indicateurReferentiel, indicateurRelecture } from "./lib/catalogue.mjs";
import { collectionTrophees } from "./lib/trophees.mjs";
import { ajouterBoiteIdees } from "./lib/idees.mjs";
import { articlesPublies, chargerArticles, construireBlog } from "./lib/blog.mjs";
import { appliquerMetadonnees, genererSeoStatique } from "./lib/seo.mjs";

const racine = new URL("..", import.meta.url).pathname;
const { version } = JSON.parse(await readFile(`${racine}package.json`, "utf8"));
const { sources, ...catalogue } = await chargerCatalogue([`${racine}catalogue`, `${racine}catalogue-prive`]);

// Les pages sources restent lisibles hors ligne : on y réécrit les hashes CSP à jour.
for (const s of sources) if (!s.aJour) { await writeFile(s.fichier, s.html); console.log(`CSP mise à jour : ${s.fichier}`); }
const fichierIndex = `${racine}index.html`;
const sourceIndex = await readFile(fichierIndex, "utf8");
const indexCsp = appliquerCsp(sourceIndex, { styles: true });
const index = appliquerMetadonnees(indexCsp, "/cercle/");
if (sourceIndex !== index) { await writeFile(fichierIndex, index); console.log(`Index HTML statique mis à jour : ${fichierIndex}`); }

await mkdir(`${racine}worker/src/generated`, { recursive: true });
await writeFile(
  `${racine}worker/src/generated/catalogue.js`,
  `// Fichier généré par scripts/build.mjs — ne pas modifier.\nexport const CATALOGUE = ${JSON.stringify(catalogue)};\n`
);
await writeFile(`${racine}worker/src/generated/catalogue-index.json`, `${JSON.stringify(catalogue.index, null, 2)}\n`);

await rm(`${racine}dist`, { recursive: true, force: true });
await cp(`${racine}web`, `${racine}dist`, { recursive: true });
// Module partagé des jeux (révisions de Leitner, ADR 0015) servi aussi au tableau de bord comme module ES (issue #187) :
// une seule source, gabarit/jeux/progression.js, pas de second moteur.
await writeFile(`${racine}dist/progression-jeux.js`,
  `${await readFile(`${racine}gabarit/jeux/progression.js`, "utf8")}\nexport { ProgressionJeux };\n`);
for (const fichier of (await readdir(`${racine}dist`)).filter((f) => f.endsWith(".html"))) {
  const chemin = `${racine}dist/${fichier}`;
  await writeFile(chemin, ajouterBoiteIdees(await readFile(chemin, "utf8"), { page: fichier, version, externe: true }));
}
await ecrireContenus(`${racine}dist/contenus`, [`${racine}catalogue`, `${racine}catalogue-prive`], catalogue.index);
await writeFile(`${racine}dist/trophees.json`, `${JSON.stringify(collectionTrophees(catalogue))}\n`);
await versionnerRessources(`${racine}dist`);
// Blog (issue #277) : écrit après la boîte à idées et le versionnement, qui ne parcourent que les pages de la racine
// de dist/. Une page par dossier (blog/<slug>/index.html) : Pages la sert à /blog/<slug>/ sans réécriture.
const blog = await construireBlog(`${racine}blog`, `${racine}dist/blog`);
// Inventaire des articles publiés, lu par le back-office (ADR 0026) : titre, auteur et date, déjà publics.
await writeFile(`${racine}dist/blog/index.json`, `${JSON.stringify({
  articles: articlesPublies(await chargerArticles(`${racine}blog`)).map(({ slug, titre, auteur, date }) => ({ slug, titre, auteur, date }))
})}\n`);
// Back-office : même empreinte de contenu que le site pour ses propres fichiers (cache du navigateur).
{
  const empreinte = async (fichier) => createHash("sha256").update(await readFile(`${racine}dist/${fichier}`)).digest("hex").slice(0, 10);
  const versions = { "admin.css": await empreinte("admin/admin.css"), "admin.js": await empreinte("admin/admin.js"), "../style.css": await empreinte("style.css") };
  const page = `${racine}dist/admin/index.html`;
  await writeFile(page, (await readFile(page, "utf8")).replace(/(href|src)="(admin\.css|admin\.js|\.\.\/style\.css)"/g, (tout, attribut, fichier) => `${attribut}="${fichier}?v=${versions[fichier]}"`));
}
// Le chat (Pages) appelle l'API du Worker kermiclab-api ; KERMICLAB_API_URL permet de pointer ailleurs (CI, local).
const API_PAR_DEFAUT = "https://kermiclab-api.kermic.workers.dev";
const apiUrl = (process.env.KERMICLAB_API_URL ?? API_PAR_DEFAUT).replace(/\/$/, "");
// Application autonome (index.html racine, générée depuis src/) servie sous /cercle/.
await mkdir(`${racine}dist/cercle`, { recursive: true });
await writeFile(`${racine}dist/cercle/index.html`, index);
const langues = (await readdir(`${racine}web/i18n`)).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", "")).sort();
await writeFile(`${racine}dist/config.json`, `${JSON.stringify({ apiUrl, langues, connexionActive: false, testRolesTemporaire: true }, null, 2)}\n`);
const apiOrigine = apiUrl ? ` ${new URL(apiUrl).origin}` : "";
await writeFile(`${racine}dist/_headers`, `/*
  Content-Security-Policy: default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; img-src 'self' data:; connect-src 'self'${apiOrigine} https://cloudflareinsights.com; frame-src 'self'${apiOrigine}; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/cercle/*
  ! Content-Security-Policy
`);
// L'ancienne maquette /dashboard/ est devenue l'accueil : les liens existants y mènent.
// Ne pas réécrire /equipe vers equipe.html : Pages sert déjà chaque page.html à l'adresse sans
// extension et renvoie l'adresse avec extension vers elle. Une réécriture 200 boucle (308).
await writeFile(`${racine}dist/_redirects`, "/dashboard/* / 301\n/dashboard / 301\n");
// L'application autonome porte sa propre CSP (meta, hashes des scripts et styles en ligne) : celle du chat,
// sans 'unsafe-inline', la bloquerait ; on la retire donc pour /cercle/*.

// Génère les métadonnées des pages publiées, le fichier robots.txt et le sitemap XML.
await genererSeoStatique(`${racine}dist`);

console.log(`Catalogue : ${catalogue.index.maquettes.map((m) => `${m.id}@${m.version}`).join(", ")}`);
const referentiel = indicateurReferentiel(catalogue.index.maquettes);
console.log(`Référentiel : prérequis renseignés pour ${referentiel.avecPrerequis} notion(s) sur ${referentiel.notions}.`);
console.log(`Indices gradués : ${catalogue.indices.avecIndice} exercice(s) sur ${catalogue.indices.exercices} ont au moins un indice, ${catalogue.indices.complets} en ont 3.`);
const relecture = indicateurRelecture(catalogue.index.maquettes);
console.log(`Relecture : ${relecture.relues} notion(s) relue(s) sur ${relecture.notions}, ${relecture.aRevoir} à revoir (version modifiée depuis la relecture).`);
console.log(`Relecture des jeux : ${relecture.jeux.relus} jeu(x) relu(s) sur ${relecture.jeux.total}, ${relecture.jeux.aRevoir} à revoir.`);
console.log(`Blog : ${blog.publies.length} article(s) publié(s) sous /blog/${blog.ignores.length ? `, ${blog.ignores.length} non validé(s) ignoré(s)` : ""}.`);
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
  const modules = ["progression.js", "profil.js", "comptes.js", "compte-local.js", "demo-famille.js", "contributions.js", "demo-contributions.js", "cercle.js", "trophees.js", "evenements.js", "recommandation.js", "fichier-progression.js", "cahier-vacances.js", "progression-jeux.js", "experiences.js", "temps-actif.js", "theme.js", "parcours.js"];
  for (const fichier of [...modules, "style.css"]) versions[fichier] = empreinte(await readFile(`${dossier}/${fichier}`));
  const appSource = await readFile(`${dossier}/app.js`, "utf8");
  let app = appSource;
  for (const module of modules) {
    const avant = app;
    app = app.replaceAll(`from "./${module}"`, `from "./${module}?v=${versions[module]}"`);
    if (app === avant) throw new Error(`versionnerRessources : import de ${module} introuvable dans app.js`);
  }
  await writeFile(`${dossier}/app.js`, app);
  versions["app.js"] = empreinte(app);
  for (const page of (await readdir(dossier)).filter((f) => f.endsWith(".html"))) {
    const source = await readFile(`${dossier}/${page}`, "utf8");
    const html = source.replace(/(href|src)="(style\.css|app\.js)"/g, (tout, attribut, fichier) => `${attribut}="${fichier}?v=${versions[fichier]}"`);
    await writeFile(`${dossier}/${page}`, html);
  }
}

/**
 * Contenus des notions du gabarit (`contenu.json`) pour le formulaire de contribution (ADR 0023) : `contenus/index.json`
 * (id, titre, version, matière) et `contenus/<id>.json`. Ce sont les textes déjà publiés dans les pages ; rien d'autre n'est copié.
 */
async function ecrireContenus(sortie, dossiers, index) {
  await mkdir(sortie, { recursive: true });
  const notions = [];
  for (const dossier of dossiers) {
    let noms;
    try { noms = (await readdir(dossier)).sort(); } catch { continue; }
    for (const nom of noms) {
      const fiche = index.maquettes.find((m) => m.id === nom);
      if (!fiche) continue;
      // Lecture directe (sans vérification préalable de l'existence) : un dossier sans contenu.json est ignoré.
      let source;
      try { source = await readFile(`${dossier}/${nom}/contenu.json`, "utf8"); } catch (e) { if (e.code === "ENOENT" || e.code === "ENOTDIR") continue; throw e; }
      await writeFile(`${sortie}/${nom}.json`, `${JSON.stringify(JSON.parse(source))}\n`);
      notions.push({ id: nom, titre: fiche.titre, version: fiche.version, matiere: String(fiche.sujet ?? "").split("/")[0] || "autres" });
    }
  }
  notions.sort((a, b) => a.titre.localeCompare(b.titre, "fr"));
  await writeFile(`${sortie}/index.json`, `${JSON.stringify({ notions })}\n`);
}
