import { readFile } from "node:fs/promises";
import vm from "node:vm";

const sourceProgression = await readFile(new URL("../../gabarit/jeux/progression.js", import.meta.url), "utf8");
const progression = vm.runInNewContext(`${sourceProgression}\nProgressionJeux`, {}, { timeout: 1000 });
const donnees = (html, id) => {
  const texte = html.match(new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`))?.[1];
  return texte ? JSON.parse(texte) : null;
};

/** Collection disponible, sans état utilisateur ni ouverture des pages dans le navigateur. */
export function collectionTrophees(catalogue) {
  const modules = [];
  for (const notion of catalogue.index.maquettes) {
    const html = catalogue.pages[notion.id].fr;
    const contenu = donnees(html, "kermiclab-contenu");
    const parcours = donnees(html, `parcours-${notion.id}`);
    let initial;
    if (contenu) {
      initial = { genre: "notions", etat: [], etoiles: 0,
        etoilesTotal: (contenu.application?.exercices.length ?? 0) + (contenu.situation?.etapes.length ?? 0), badges: [] };
    } else if (parcours && html.includes('data-inclure="gabarit/jeux/academie.js"')) {
      const p = progression.creer(parcours), etat = p.etatInitial();
      const leconsTotal = parcours.grades.reduce((s, g) => s + g.lecons.length, 0);
      initial = { genre: "jeux", etat, xp: 0, niveau: 1, etoiles: 0, etoilesTotal: leconsTotal * 3,
        lecons: 0, leconsTotal, grades: 0, gradesTotal: parcours.grades.length,
        serie: 0, revisions: 0, victoires: 0, badges: p.badges(etat) };
    } else if (notion.id === "sudoku" || notion.id === "2048") {
      // Ces deux moteurs sont du code pur du dépôt, comme le moteur de progression partagé.
      const source = html.match(new RegExp(`<script id="moteur-${notion.id}">([\\s\\S]*?)</script>`))?.[1];
      if (!source) throw new Error(`trophées : moteur ${notion.id} absent`);
      const sudoku = notion.id === "sudoku";
      const moteur = vm.runInNewContext(`${source}\n${sudoku ? "MoteurSudoku" : "Moteur2048"}`, {}, { timeout: 1000 });
      const etapes = sudoku ? moteur.ETAPES : moteur.NIVEAUX;
      initial = { genre: "jeux", etat: sudoku ? { ouvert: 0 } : { debloque: 0, record: 0, meilleureTuile: 0 },
        ...(sudoku ? { grades: 0, gradesTotal: etapes.length } : { record: 0 }),
        badges: etapes.map((e, i) => ({ id: sudoku ? String(i) : String(e.cible), nom: e.nom,
          description: sudoku ? e.description : String(e.cible), icone: sudoku ? e.icone : "🏆",
          actuel: 0, cible: sudoku ? 1 : e.cible, obtenu: false })) };
    } else if (notion.id === "trigo-cercle") {
      initial = { genre: "labs", etat: { record: 0 }, record: 0, badges: [] };
    }
    if (initial) modules.push({ id: notion.id, titre: notion.titre, progression: initial });
  }
  modules.push({ id: "mini-cercle", progression: { genre: "labs", etat: { angles: [], cible: false }, etoiles: 0, etoilesTotal: 2, badges: [] } });
  return { modules };
}
