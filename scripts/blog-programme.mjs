// Publication programmée du blog (issue #312), appelée par l'exécution quotidienne de ci.yml :
//   node scripts/blog-programme.mjs
// Compare les articles publiables aujourd'hui (heure de La Réunion) avec ceux du site en ligne (`/blog/index.json`)
// et écrit `a_publier=true|false` en sortie d'étape GitHub. Lecture seule : rien n'est construit ni déployé ici.
// Un site injoignable ou une liste illisible valent « à publier » : le déploiement, protégé par son test de fumée
// et son retour arrière, est sans effet si rien n'a changé.
import { appendFile } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";
import { articlesPublies, chargerArticles, jourDePublication } from "./lib/blog.mjs";

/** Adresses présentes d'un seul côté : à ajouter au site, ou à en retirer (article dépublié ou renommé). */
export function ecartPublication(locaux, enLigne) {
  const a = new Set(locaux), b = new Set(enLigne);
  return { aAjouter: [...a].filter((s) => !b.has(s)).sort(), aRetirer: [...b].filter((s) => !a.has(s)).sort() };
}

/** Adresses des articles du site en ligne, ou `null` si la liste est injoignable ou mal formée. */
export async function articlesEnLigne(site, { fetch: f = fetch } = {}) {
  try {
    const reponse = await f(`${site}/blog/index.json`, { headers: { "cache-control": "no-cache", "user-agent": "kermiclab-publication-programmee (CI)" } });
    if (!reponse.ok) return null;
    const { articles } = await reponse.json();
    if (!Array.isArray(articles) || articles.some((a) => typeof a?.slug !== "string")) return null;
    return articles.map((a) => a.slug);
  } catch { return null; }
}

/** Décision du jour : faut-il construire et déployer ? Renvoie aussi le motif, affiché dans le journal. */
export async function deciderPublication({ dossier, site, jour, fetch: f }) {
  const locaux = articlesPublies(await chargerArticles(dossier), { jour }).map((a) => a.slug);
  const enLigne = await articlesEnLigne(site, { fetch: f });
  if (!enLigne) return { aPublier: true, motif: `liste des articles en ligne illisible (${site}/blog/index.json) : déploiement par précaution` };
  const { aAjouter, aRetirer } = ecartPublication(locaux, enLigne);
  if (!aAjouter.length && !aRetirer.length) return { aPublier: false, motif: `blog à jour au ${jour} (${locaux.length} article(s))` };
  const details = [aAjouter.length && `à publier : ${aAjouter.join(", ")}`, aRetirer.length && `à retirer : ${aRetirer.join(", ")}`].filter(Boolean);
  return { aPublier: true, motif: `${details.join(" ; ")} (au ${jour})` };
}

async function main() {
  const racine = fileURLToPath(new URL("..", import.meta.url));
  const site = String(process.env.KERMICLAB_SITE_URL ?? "").replace(/\/$/, "");
  if (!site) throw new Error("KERMICLAB_SITE_URL est requis");
  const { aPublier, motif } = await deciderPublication({ dossier: `${racine}blog`, site, jour: jourDePublication() });
  console.log(`Publication programmée : ${motif}.`);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `a_publier=${aPublier}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => { console.error(`::error::${e.message}`); process.exit(1); });
}
