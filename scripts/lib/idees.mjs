import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

const racine = new URL("../../", import.meta.url);
const script = await readFile(new URL("web/boite-idees.js", racine), "utf8");
const style = await readFile(new URL("web/boite-idees.css", racine), "utf8");
/** Seuls le libellé et l'infobulle voyagent dans les pages : le formulaire vit dans le tableau de bord. */
const CLES = ["ideeAction", "ideeAvertissement"];
export const SITE = "https://www.kermiclab.online/";
const textes = {};
for (const fichier of await readdir(new URL("web/i18n/", racine))) {
  if (!fichier.endsWith(".json")) continue;
  const traduction = JSON.parse(await readFile(new URL(`web/i18n/${fichier}`, racine), "utf8"));
  textes[fichier.slice(0, -5)] = Object.fromEntries(Object.entries(traduction).filter(([cle]) => CLES.includes(cle)));
}
const empreinte = (contenu) => createHash("sha256").update(contenu).digest("hex").slice(0, 10);

/** Un seul composant pour le site et les fichiers autonomes, traductions incluses hors ligne. */
export function ajouterBoiteIdees(html, { page, version, externe = false }) {
  if (html.includes('id="boite-idees-config"')) return html;
  if (!html.includes("</body>")) throw new Error(`boîte à idées : </body> absent de ${page}`);
  const config = JSON.stringify({ page, version, site: SITE, textes }).replace(/</g, "\\u003c");
  const ressources = externe
    ? `<link rel="stylesheet" href="boite-idees.css?v=${empreinte(style)}">\n<script type="module" src="boite-idees.js?v=${empreinte(script)}"></script>`
    : `<style>${style}</style>\n<script>${script}</script>`;
  return html.replace("</body>", `<script type="application/json" id="boite-idees-config">${config}</script>\n${ressources}\n</body>`);
}
