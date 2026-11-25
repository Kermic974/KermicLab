import { readFile } from "node:fs/promises";
import path from "node:path";
import { appliquerCsp, lireFrontMatter } from "./catalogue.mjs";

const lire = async (racine, fichier) => JSON.parse(await readFile(path.join(racine, fichier), "utf8"));

/** Résout les identifiants partagés et extrait les mémos publiés, sans appel réseau. */
export async function referencesRemediation(racine, origineApi) {
  const donnees = await lire(racine, "Sample/lab/remediation-tdah-microskills.json");
  const api = origineApi ?? (await lire(racine, "web/config.json")).apiUrl;
  if (!/^https?:\/\//.test(api)) throw new Error("Origine des notions invalide");
  const notions = [];
  for (const n of donnees.notions) {
    const canonique = await lire(racine, n.fichierCanonique);
    if (canonique.id !== n.reference || canonique.type !== "notion") throw new Error(`Notion inconnue : ${n.reference}`);
    const fiche = lireFrontMatter(await readFile(path.join(racine, `catalogue/${n.id}/fiche.md`), "utf8"));
    if (`notion.${fiche.sujet.replace("/", ".")}` !== n.reference) throw new Error(`Correspondance incorrecte : ${n.id}`);
    const contenu = await lire(racine, `catalogue/${n.id}/contenu.json`);
    notions.push({ id: n.id, reference: n.reference, titre: fiche.titre, niveau: fiche.niveau,
      source: `catalogue/${n.id}/contenu.json`,
      retenir: contenu.niveaux.map((niveau, index) => ({ index, titre: niveau.titre, texte: niveau.aRetenir })),
      url: `${api.replace(/\/$/, "")}/maquettes/${encodeURIComponent(n.id)}?lang=fr` });
  }
  const microskills = [];
  for (const m of donnees.microskills) {
    const canonique = await lire(racine, m.fichierCanonique);
    if (canonique.id !== m.id || canonique.type !== "microskill") throw new Error(`Micro-skill inconnu : ${m.id}`);
    for (const lien of m.connexions) {
      const voisin = await lire(racine, lien.fichierCanonique);
      if (voisin.id !== lien.microskill || voisin.type !== "microskill") throw new Error(`Micro-skill connexe inconnu : ${lien.microskill}`);
      const notion = notions.find(n => n.id === lien.notion);
      if (!notion?.retenir[lien.niveau]?.texte) throw new Error(`Mémo absent : ${lien.notion}`);
    }
    microskills.push({ ...m, label: canonique.label, statut: canonique.status, version: canonique.version });
  }
  return { version: donnees.version, notion: donnees.notion, skill: donnees.skill, microskills, notions };
}

export async function lierReferencesRemediation(html, racine, origineApi) {
  const references = await referencesRemediation(racine, origineApi);
  const json = JSON.stringify(references, null, 2).replaceAll("<", "\\u003c");
  const balise = `<script type="application/json" id="remediation-microskills">${json}</script>`;
  let page = html.replace(/\s*<script type="application\/json" id="remediation-microskills">[\s\S]*?<\/script>\s*/g, "\n");
  page = page.replace(/(<script type="application\/json" id="kermiclab-meta">)([\s\S]*?)(<\/script>)\s*/,
    (_, ouverture, contenu, fermeture) => {
      const meta = JSON.parse(contenu);
      meta.version = "1.1.0";
      meta.onglets = [...new Set([...meta.onglets, "memo"])];
      meta.microskills = references.microskills.map(m => m.id);
      return ouverture + JSON.stringify(meta, null, 2) + fermeture + "\n" + balise + "\n";
    });
  return appliquerCsp(page);
}
