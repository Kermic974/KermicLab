// Blog de KermicLab (issue #277) : articles Markdown de blog/ → pages statiques de dist/blog/.
// Aucune dépendance : en-tête et Markdown sont lus par un convertisseur volontairement restreint, qui échappe
// tout le HTML de la source (aucune balise brute n'est recopiée). Pages sans script ni style en ligne : la CSP
// du site (default-src 'self' ; style-src 'self') s'applique telle quelle, la feuille de style est blog/blog.css,
// copiée dans dist/blog/.
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";

/** Seul statut publié : l'article a été validé par Mickael. Tout autre statut (brouillon…) reste hors de dist/. */
export const STATUT_PUBLIE = "validé";
export const CHAMPS_OBLIGATOIRES = ["titre", "auteur", "date", "statut"];
export const SUPERVISEUR = "Mickael Kerbidi";

/** Les auteurs du blog : des assistants IA (agents Grok), supervisés par le propriétaire du projet. */
export const AUTEURS = [
  { nom: "Émile Grok", ia: "assistant IA", role: "Orchestrateur : coordonne l'équipe et les priorités." },
  { nom: "Chloé Grok", ia: "assistante IA", role: "Rédactrice en chef : contenus et tunnel de découverte." },
  { nom: "Hugo Grok", ia: "assistant IA", role: "Code et synchronisation GitHub : construit et publie le site." },
  { nom: "Paul Grok", ia: "assistant IA", role: "Documentation : tient la documentation du projet à jour." },
  { nom: "Inès Grok", ia: "assistante IA", role: "Auditrice : relit et vérifie chaque article et le travail des autres agents." },
  { nom: "Manon Grok", ia: "assistante IA", role: "Veille : observe l'éducation et les outils numériques pour l'école." }
];

const NOM_SITE = "KermicLab";

/** Échappe le texte pour l'insérer dans du HTML (contenu ou valeur d'attribut entre guillemets). */
export function echapper(texte) {
  return String(texte)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Lit l'en-tête (front matter) d'un article : bloc `---` … `---` de lignes `clé: valeur`, valeurs entre guillemets
 * facultatives. Renvoie `{ entete, corps }`. Sans en-tête : erreur (un article doit toujours en avoir un).
 */
export function lireEntete(source, fichier = "article") {
  const texte = String(source).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const bloc = texte.match(/^---\n([^]*?)\n---[ \t]*(?:\n|$)/);
  if (!bloc) throw new Error(`blog : en-tête « --- » absent dans ${fichier}`);
  const entete = {};
  for (const [i, ligne] of bloc[1].split("\n").entries()) {
    if (!ligne.trim() || ligne.trim().startsWith("#")) continue;
    const m = ligne.match(/^([A-Za-zÀ-ÿ_-]+)\s*:\s*(.*)$/);
    if (!m) throw new Error(`blog : ligne ${i + 2} de l'en-tête illisible dans ${fichier}`);
    let valeur = m[2].trim();
    const guillemets = valeur.match(/^"((?:[^"\\]|\\.)*)"$|^'((?:[^']|'')*)'$/);
    if (guillemets) valeur = guillemets[1] !== undefined ? guillemets[1].replace(/\\(["\\])/g, "$1") : guillemets[2].replace(/''/g, "'");
    entete[m[1].toLowerCase()] = valeur.normalize("NFC");
  }
  return { entete, corps: texte.slice(bloc[0].length) };
}

/** Vérifie l'en-tête d'un article à publier : champs obligatoires, date AAAA-MM-JJ valide. */
export function validerEntete(entete, fichier = "article") {
  for (const champ of CHAMPS_OBLIGATOIRES) if (!entete[champ]) throw new Error(`blog : champ « ${champ} » manquant dans ${fichier}`);
  const date = entete.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const jour = date && new Date(Date.UTC(+date[1], +date[2] - 1, +date[3]));
  if (!date || jour.getUTCMonth() !== +date[2] - 1 || jour.getUTCDate() !== +date[3]) {
    throw new Error(`blog : date « ${entete.date} » invalide dans ${fichier} (attendu AAAA-MM-JJ)`);
  }
}

/** L'adresse d'un article vient du nom de son fichier : minuscules, chiffres et tirets seulement. */
export function slugDepuisFichier(fichier) {
  const slug = fichier.replace(/^.*\//, "").replace(/\.md$/, "");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`blog : nom de fichier « ${fichier} » invalide (minuscules, chiffres et tirets)`);
  if (slug === "auteurs") throw new Error("blog : « auteurs » est réservé à la page des auteurs");
  return slug;
}

/** Adresse de lien acceptée : http(s), mailto, chemin du site ou ancre. Tout le reste (javascript:, data:…) est refusé. */
export function lienSur(url) {
  return /^(https?:\/\/|mailto:|\/(?!\/)|#|\.{1,2}\/)/i.test(url) || /^[a-z0-9][a-z0-9/._-]*(#[\w-]*)?$/i.test(url);
}

/** Gras et italique sur du texte déjà échappé. */
function emphase(html) {
  return html
    .replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+?)__/g, "<strong>$1</strong>")
    .replace(/\*([^*\s][^*]*?)\*/g, "<em>$1</em>")
    .replace(/(^|[^\p{L}\p{N}_])_([^_\s][^_]*?)_(?![\p{L}\p{N}_])/gu, "$1<em>$2</em>");
}

/**
 * Texte en ligne : code, liens, gras, italique. Le texte est échappé avant toute mise en forme ; le code et les
 * liens sont mis de côté pendant la mise en forme pour que leurs adresses et leur contenu restent intacts.
 */
export function enLigne(texte) {
  const reserves = [];
  const reserver = (html) => `\u0000${reserves.push(html) - 1}\u0000`;
  let html = String(texte).replace(/\u0000/g, "").replace(/`([^`]+)`/g, (_, code) => reserver(`<code>${echapper(code)}</code>`));
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (tout, libelle, url) => {
    if (!lienSur(url)) return libelle;
    const externe = /^https?:\/\//i.test(url) ? ' rel="noopener"' : "";
    return reserver(`<a href="${echapper(url)}"${externe}>${emphase(echapper(libelle))}</a>`);
  });
  html = emphase(echapper(html));
  // Les réservations peuvent contenir d'autres réservations (code dans un libellé de lien).
  for (let n = 0; n < 3 && html.includes("\u0000"); n++) html = html.replace(/\u0000(\d+)\u0000/g, (_, i) => reserves[+i]);
  return html;
}

/**
 * Markdown → HTML (sous-ensemble) : titres, paragraphes, listes à puces et numérotées, citations, blocs de code,
 * séparateurs, gras, italique, liens, code en ligne. Les titres sont décalés de `decalage` niveaux (plafonnés à h6).
 */
export function markdownEnHtml(markdown, { decalage = 0 } = {}) {
  const lignes = String(markdown).replace(/\r\n?/g, "\n").split("\n");
  const sortie = [];
  let i = 0;
  const debutBloc = (l) => /^(#{1,6})\s|^```|^\s*([-*+]|\d+[.)])\s|^>|^(\*\s*){3,}$|^(-\s*){3,}$/.test(l);
  while (i < lignes.length) {
    const ligne = lignes[i];
    if (!ligne.trim()) { i++; continue; }
    let m;
    if ((m = ligne.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))) {
      const niveau = Math.min(6, m[1].length + decalage);
      sortie.push(`<h${niveau}>${enLigne(m[2])}</h${niveau}>`);
      i++;
    } else if (/^```/.test(ligne)) {
      const code = [];
      i++;
      while (i < lignes.length && !/^```/.test(lignes[i])) code.push(lignes[i++]);
      i++;
      sortie.push(`<pre><code>${echapper(code.join("\n"))}</code></pre>`);
    } else if (/^(\*\s*){3,}$|^(-\s*){3,}$|^(_\s*){3,}$/.test(ligne.trim())) {
      sortie.push("<hr>");
      i++;
    } else if (/^>/.test(ligne)) {
      const cite = [];
      while (i < lignes.length && /^>/.test(lignes[i])) cite.push(lignes[i++].replace(/^>\s?/, ""));
      sortie.push(`<blockquote>${markdownEnHtml(cite.join("\n"), { decalage })}</blockquote>`);
    } else if ((m = ligne.match(/^\s*([-*+]|\d+[.)])\s+/))) {
      const ordonnee = /\d/.test(m[1]);
      const motif = ordonnee ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
      const elements = [];
      while (i < lignes.length) {
        const e = lignes[i].match(motif);
        if (e) { elements.push(e[1]); i++; continue; }
        // Ligne de continuation indentée d'un élément.
        if (elements.length && /^\s{2,}\S/.test(lignes[i])) { elements[elements.length - 1] += ` ${lignes[i].trim()}`; i++; continue; }
        break;
      }
      const balise = ordonnee ? "ol" : "ul";
      sortie.push(`<${balise}>\n${elements.map((e) => `<li>${enLigne(e)}</li>`).join("\n")}\n</${balise}>`);
    } else {
      const paragraphe = [];
      while (i < lignes.length && lignes[i].trim() && !(paragraphe.length && debutBloc(lignes[i]))) paragraphe.push(lignes[i++].trim());
      sortie.push(`<p>${enLigne(paragraphe.join(" "))}</p>`);
    }
  }
  return sortie.join("\n");
}

/** Retire un premier titre de niveau 1 identique au titre de l'en-tête (évite de l'afficher deux fois). */
export function retirerTitreDouble(corps, titre) {
  const normaliser = (t) => t.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
  return corps.replace(/^\s*#\s+(.+?)\s*#*\s*(?:\n|$)/, (tout, h1) => (normaliser(h1) === normaliser(titre) ? "" : tout));
}

/** Lit un article : en-tête, adresse, statut. Ne valide les champs que des articles publiés. */
export function lireArticle(source, fichier) {
  const { entete, corps } = lireEntete(source, fichier);
  const slug = slugDepuisFichier(fichier);
  const publie = entete.statut === STATUT_PUBLIE;
  if (publie) validerEntete(entete, fichier);
  return { slug, fichier, publie, ...entete, corps };
}

/** Fuseau de référence de la publication programmée : un article sort à sa date, heure de La Réunion. */
export const FUSEAU_PUBLICATION = "Indian/Reunion";

/**
 * Jour de publication (`AAAA-MM-JJ`) : `KERMICLAB_BLOG_JOUR` s'il est renseigné (build reproductible, tests),
 * sinon la date du jour à La Réunion. Une valeur mal formée est refusée plutôt qu'ignorée.
 */
export function jourDePublication(maintenant = new Date(), env = process.env) {
  const impose = env.KERMICLAB_BLOG_JOUR;
  if (impose) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(impose)) throw new Error(`KERMICLAB_BLOG_JOUR invalide : « ${impose} » (attendu : AAAA-MM-JJ)`);
    return impose;
  }
  // Le format « en-CA » donne directement AAAA-MM-JJ.
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU_PUBLICATION, year: "numeric", month: "2-digit", day: "2-digit" }).format(maintenant);
}

/** Article validé dont la date est postérieure à `jour` : fusionné à l'avance, il attend sa date (issue #312). */
export const estProgramme = (article, jour) => Boolean(article.publie && jour && article.date > jour);

/**
 * Articles publiés seulement (statut « validé »), du plus récent au plus ancien. Avec `jour`, les articles datés
 * après ce jour sont écartés : ils sortiront au premier build fait à leur date ou après.
 */
export function articlesPublies(articles, { jour } = {}) {
  return articles.filter((a) => a.publie && !estProgramme(a, jour)).sort((a, b) => b.date.localeCompare(a.date) || a.titre.localeCompare(b.titre, "fr"));
}

/** Date lisible en français, sans dépendre du fuseau de la machine de build. */
export function dateLisible(date) {
  const [a, m, j] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, j)));
}

/** Gabarit commun des pages du blog : `lang="fr"`, un seul h1 (dans `contenu`), aucune ressource externe. */
function page({ titre, description, contenu, css }) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echapper(titre)}</title>
<meta name="description" content="${echapper(description)}">
<link rel="stylesheet" href="${css}">
</head>
<body>
<header class="blog-entete">
<nav aria-label="Navigation du blog"><a href="/">${NOM_SITE}</a> · <a href="/blog/">Blog</a> · <a href="/blog/auteurs/">Les auteurs</a></nav>
</header>
<main class="blog">
${contenu}
</main>
<footer class="blog-pied">
<p>Les articles de ce blog sont écrits par des assistants IA, puis relus et validés par ${SUPERVISEUR} avant publication. <a href="/blog/auteurs/">En savoir plus sur les auteurs</a>.</p>
</footer>
</body>
</html>
`;
}

// Mention « auteur IA » visible sur chaque article et dans la liste (exigence de relecture d'Inès).
const mentionIa = (a) => `<p class="blog-auteur"><strong>Auteur IA</strong> : ${echapper(a.auteur)} · relu et validé par ${SUPERVISEUR} · <time datetime="${echapper(a.date)}">${dateLisible(a.date)}</time></p>`;

/** Page d'un article. */
export function pageArticle(article, { css = "/blog/blog.css" } = {}) {
  const texte = retirerTitreDouble(article.corps, article.titre);
  // Un seul h1 par page (le titre) : si le texte contient encore des titres « # », tous ses titres descendent d'un niveau.
  const decalage = /^#\s/m.test(texte.replace(/^```[^]*?^```/gm, "")) ? 1 : 0;
  const corps = markdownEnHtml(texte, { decalage });
  const jour = article.jour ? `<p class="blog-jour">${echapper(article.jour)}</p>\n` : "";
  return page({
    titre: `${article.titre} – Blog ${NOM_SITE}`,
    description: article.resume || article.titre,
    css,
    contenu: `<article>
${jour}<h1>${enLigne(article.titre)}</h1>
${mentionIa(article)}
${corps}
</article>
<p><a href="/blog/">← Tous les articles</a></p>`
  });
}

/** Page de liste : les articles publiés, du plus récent au plus ancien. */
export function pageListe(articles, { css = "/blog/blog.css" } = {}) {
  const publies = articlesPublies(articles);
  const elements = publies.map((a) => `<li>
<h2><a href="/blog/${a.slug}/">${enLigne(a.titre)}</a></h2>
${mentionIa(a)}
${a.resume ? `<p>${enLigne(a.resume)}</p>\n` : ""}</li>`).join("\n");
  return page({
    titre: `Blog – ${NOM_SITE}`,
    description: `Le blog de ${NOM_SITE} : la vie du projet, écrite par des assistants IA et validée par un humain.`,
    css,
    contenu: `<h1>Le blog de ${NOM_SITE}</h1>
<p class="blog-avertissement">Les articles sont écrits par des <strong>assistants IA</strong> et publiés après validation par ${SUPERVISEUR}. <a href="/blog/auteurs/">Qui sont les auteurs ?</a></p>
${publies.length ? `<ul class="blog-liste">\n${elements}\n</ul>` : "<p>Aucun article publié pour le moment.</p>"}`
  });
}

/** Page des auteurs : tous sont des assistants IA, supervisés par le propriétaire du projet. */
export function pageAuteurs({ css = "/blog/blog.css" } = {}) {
  const liste = AUTEURS.map((a) => `<li><strong>${echapper(a.nom)}</strong> (${a.ia}) : ${echapper(a.role)}</li>`).join("\n");
  return page({
    titre: `Les auteurs – Blog ${NOM_SITE}`,
    description: `Les auteurs du blog ${NOM_SITE} sont des assistants IA supervisés par ${SUPERVISEUR}.`,
    css,
    contenu: `<h1>Les auteurs du blog</h1>
<p class="blog-avertissement"><strong>Tous les auteurs de ce blog sont des assistants IA</strong> (des agents Grok). Aucun d'eux n'est une personne.</p>
<p>Ils préparent les articles ; ${SUPERVISEUR}, qui porte le projet ${NOM_SITE}, les supervise. Il relit et valide chaque article, puis le publie lui-même : un article = une demande de fusion (pull request) sur le dépôt du projet, et l'article est en ligne quand il la fusionne.</p>
<h2>L'équipe</h2>
<ul>
${liste}
</ul>
<p><a href="/blog/">← Tous les articles</a></p>`
  });
}

/** Lit tous les articles de `dossier` (fichiers `.md`, sauf README.md et les fichiers commençant par « _ »). */
export async function chargerArticles(dossier) {
  let noms;
  try { noms = (await readdir(dossier)).sort(); } catch (e) { if (e.code === "ENOENT") return []; throw e; }
  const articles = [];
  for (const nom of noms) {
    if (!nom.endsWith(".md") || nom === "README.md" || nom.startsWith("_")) continue;
    articles.push(lireArticle(await readFile(`${dossier}/${nom}`, "utf8"), nom));
  }
  return articles;
}

/**
 * Construit le blog dans `sortie` : `index.html` (liste), `<slug>/index.html` (un dossier par article, servi à
 * `/blog/<slug>/` sans réécriture `_redirects`), `auteurs/index.html` et `blog.css`. Seuls les articles validés
 * sont écrits ; avec `jour`, ceux datés après ce jour restent hors du site (`programmes`). Renvoie les adresses
 * publiées, programmées et ignorées.
 */
export async function construireBlog(dossier, sortie, { feuilleDeStyle, jour } = {}) {
  const articles = await chargerArticles(dossier);
  const publies = articlesPublies(articles, { jour });
  const style = feuilleDeStyle ?? await readFile(`${dossier}/blog.css`, "utf8");
  const css = `/blog/blog.css?v=${createHash("sha256").update(style).digest("hex").slice(0, 10)}`;
  await mkdir(`${sortie}/auteurs`, { recursive: true });
  await writeFile(`${sortie}/blog.css`, style);
  await writeFile(`${sortie}/index.html`, pageListe(publies, { css }));
  await writeFile(`${sortie}/auteurs/index.html`, pageAuteurs({ css }));
  for (const a of publies) {
    await mkdir(`${sortie}/${a.slug}`, { recursive: true });
    await writeFile(`${sortie}/${a.slug}/index.html`, pageArticle(a, { css }));
  }
  return {
    publies: publies.map((a) => a.slug),
    programmes: articles.filter((a) => estProgramme(a, jour)).map((a) => a.slug).sort(),
    ignores: articles.filter((a) => !a.publie).map((a) => a.slug)
  };
}
