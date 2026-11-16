// SEO statique du site publié sur Cloudflare Pages.
// L'origine suit l'architecture publiée documentée dans README.fr.md (kermiclab.online).
import { readdir, readFile, writeFile } from "node:fs/promises";

export const ORIGINE_PUBLIQUE = "https://www.kermiclab.online";

export function echapperXml(valeur) {
  return String(valeur).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Convertit un fichier HTML statique en route Cloudflare Pages, en omettant les zones privées et erreurs. */
export function routeDepuisFichier(fichier) {
  const chemin = String(fichier).replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = chemin.split("/");
  if (segments.includes("admin") || chemin.toLowerCase() === "404.html" || !chemin.toLowerCase().endsWith(".html")) return null;
  if (segments.at(-1).toLowerCase() === "index.html") {
    segments.pop();
    return `/${segments.length ? `${segments.join("/")}/` : ""}`;
  }
  segments[segments.length - 1] = segments.at(-1).slice(0, -5);
  return `/${segments.join("/")}`.replace(/\/{2,}/g, "/");
}

export function genererRobotsTxt(originen = ORIGINE_PUBLIQUE) {
  return `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${originen.replace(/\/$/, "")}/sitemap.xml\n`;
}

export function genererSitemapXml(routes, originen = ORIGINE_PUBLIQUE) {
  const base = originen.replace(/\/$/, "");
  const uniques = [...new Set(routes)].filter((route) => route?.startsWith("/") && !route.includes("?") && !route.includes("#")).sort();
  const urls = uniques.map((route) => `  <url><loc>${echapperXml(`${base}${route}`)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function echapperAttribut(valeur) {
  return String(valeur).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function titreEtDescription(html) {
  const titre = html.match(/<title>([^]*?)<\/title>/i)?.[1]?.trim() || "KermicLab";
  const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["'][^>]*>/i)?.[1]?.trim() || titre;
  return { titre, description };
}

function definirMeta(html, attribut, cle, valeur) {
  const motif = new RegExp("<meta\\s+" + attribut + "=[\\"']" + cle + "[\\"'][^>]*>", "i");
  const contenu = 'content="' + echapperAttribut(valeur) + '"';
  if (motif.test(html)) {
    return html.replace(motif, (ancien) => {
      const contenuExistant = /\scontent=["'][^"']*["']/i;
      return contenuExistant.test(ancien)
        ? ancien.replace(/content=["'][^"']*["']/i, contenu)
        : ancien.replace(/\s*\/?>$/, " " + contenu + ">");
    });
  }
  return html.replace("</head>", '<meta ' + attribut + '="' + cle + '" ' + contenu + '>\n</head>');
}

/** Ajoute ou remplace canonical, Open Graph et Twitter à partir des balises réelles de chaque page. */
export function appliquerMetadonnees(html, route, originen = ORIGINE_PUBLIQUE) {
  const canonique = `${originen.replace(/\/$/, "")}${route}`;
  const { titre, description } = titreEtDescription(html);
  const titreSocial = titre.replace(/\s+[–—-]\s+Blog KermicLab$/i, "");
  const lienCanonique = `<link rel="canonical" href="${echapperAttribut(canonique)}">`;
  let resultat = html.includes('rel="canonical"')
    ? html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, lienCanonique)
    : html.replace("</head>", lienCanonique + "\n</head>");
  for (const [cle, valeur] of [["og:type", "website"], ["og:title", titreSocial], ["og:description", description], ["og:url", canonique], ["twitter:title", titreSocial], ["twitter:description", description]]) {
    resultat = definirMeta(resultat, "property", cle, valeur);
  }
  resultat = definirMeta(resultat, "name", "twitter:card", "summary");
  return resultat;
}

async function listerHtml(dossier, prefixe = "") {
  const resultats = [];
  for (const entree of await readdir(dossier, { withFileTypes: true })) {
    const relatif = prefixe ? `${prefixe}/${entree.name}` : entree.name;
    if (entree.isDirectory()) resultats.push(...await listerHtml(`${dossier}/${entree.name}`, relatif));
    else if (entree.isFile() && entree.name.toLowerCase().endsWith(".html")) resultats.push(relatif);
  }
  return resultats;
}

export async function genererSeoStatique(dossierDist, originen = ORIGINE_PUBLIQUE) {
  const routes = [];
  for (const fichier of await listerHtml(dossierDist)) {
    const route = routeDepuisFichier(fichier);
    if (!route) continue;
    const chemin = `${dossierDist}/${fichier}`;
    const html = await readFile(chemin, "utf8");
    await writeFile(chemin, appliquerMetadonnees(html, route, originen));
    routes.push(route);
  }
  await writeFile(`${dossierDist}/robots.txt`, genererRobotsTxt(originen));
  await writeFile(`${dossierDist}/sitemap.xml`, genererSitemapXml(routes, originen));
  return routes;
}
