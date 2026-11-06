// Figure « thales » du gabarit des notions (docs/gabarit.md).
// scripts/lib/gabarit.mjs l'insère dans le moteur (gabarit/moteur.js) des seules pages dont
// application.figure.type vaut « thales ». Outils du moteur disponibles : h, s, riche, paragraphe,
// nombreFr, exact, pgcd, curseur, tuile.

/** Triangles semblables : le rapport de réduction est le même sur les trois côtés. */
FIGURES.thales = function thales(conf) {
  const svg = s("svg", { viewBox: "0 0 320 260", role: "img", "aria-label": "Deux triangles semblables : M est sur AB, N est sur AC et MN est parallèle à BC" });
  const valeurs = h("div", { classe: "tuiles", "aria-live": "polite" });
  const ab = conf.ab ?? 10, ac = conf.ac ?? 8, angle = conf.angle ?? 60;
  let rapport = conf.rapport ?? 0.5;
  const dessiner = () => {
    svg.replaceChildren();
    const theta = angle * Math.PI / 180;
    const dx = ac * Math.sin(theta), dy = ac * Math.cos(theta);
    const bc = Math.hypot(dx, dy - ab);
    const bas = Math.min(0, dy), haut = Math.max(ab, dy);
    const echelle = Math.min(205 / (haut - bas), 235 / Math.abs(dx));
    const A = { x: 42, y: 26 - bas * echelle };
    const B = { x: A.x, y: A.y + ab * echelle };
    const C = { x: A.x + dx * echelle, y: A.y + dy * echelle };
    const M = { x: A.x + rapport * (B.x - A.x), y: A.y + rapport * (B.y - A.y) };
    const N = { x: A.x + rapport * (C.x - A.x), y: A.y + rapport * (C.y - A.y) };
    const longueur = (P, Q) => Math.hypot(Q.x - P.x, Q.y - P.y) / echelle;
    const rapports = [longueur(A, M) / ab, longueur(A, N) / ac, longueur(M, N) / bc];
    const ligne = (P, Q, classe) => s("line", { x1: P.x, y1: P.y, x2: Q.x, y2: Q.y, class: classe }, svg);
    const point = (P, nom, dx, dy) => {
      s("circle", { cx: P.x, cy: P.y, r: 4, class: "point" }, svg);
      const label = s("text", { x: P.x + dx, y: P.y + dy, class: "etiquette sommet" }, svg);
      label.textContent = nom;
    };
    ligne(A, B, "cote");
    ligne(A, C, "cote");
    ligne(B, C, "cote");
    ligne(M, N, "parallele");
    point(A, "A", -13, -8);
    point(B, "B", -13, 16);
    point(C, "C", 12, 4);
    point(M, "M", -14, 2);
    point(N, "N", 12, 2);
    valeurs.replaceChildren(
      tuile("AB", nombreFr(ab)),
      tuile("AC", nombreFr(ac)),
      tuile("BC", `≈ ${nombreFr(bc)}`),
      tuile("AM / AB", nombreFr(rapports[0])),
      tuile("AN / AC", nombreFr(rapports[1])),
      tuile("MN / BC", nombreFr(rapports[2]))
    );
  };
  const curseurRapport = curseur("Rapport de réduction k (AM / AB)", 0.1, 0.9, 0.1, rapport, (v) => { rapport = v; dessiner(); });
  curseurRapport.maj();
  return h("div", { classe: "figure" }, svg, h("p", { classe: "bulle-info" }, "Les droites (MN) et (BC) sont parallèles : les triangles AMN et ABC sont semblables."), curseurRapport.element, valeurs);
};
