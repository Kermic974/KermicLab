// Figure « proportion » du gabarit des notions (docs/gabarit.md).
// scripts/lib/gabarit.mjs l'insère dans le moteur (gabarit/moteur.js) des seules pages dont
// application.figure.type vaut « proportion ». Outils du moteur disponibles : h, s, riche, paragraphe,
// nombreFr, exact, pgcd, curseur, tuile.

/** Situation de proportionnalité : tableau, droite passant par l'origine, coefficient. */
FIGURES.proportion = function proportion(conf) {
  const svg = s("svg", { viewBox: "0 0 300 200", role: "img", "aria-label": `Graphique : ${conf.libelleY} en fonction de ${conf.libelleX}` });
  const table = h("table", { classe: "tableau" });
  const valeurs = h("div", { classe: "tuiles", "aria-live": "polite" });
  const xMax = conf.xMax ?? 10;
  let k = conf.coefficient ?? 1.2, x = conf.x ?? 3;
  const dessiner = () => {
    svg.replaceChildren();
    const yMax = (conf.coefficientMax ?? 3) * xMax * 1.05;
    const px = (v) => 30 + (v / xMax) * 260, py = (v) => 180 - (v / yMax) * 170;
    s("line", { x1: 30, y1: 180, x2: 295, y2: 180, class: "axe" }, svg);
    s("line", { x1: 30, y1: 180, x2: 30, y2: 5, class: "axe" }, svg);
    for (let i = 0; i <= xMax; i++) s("line", { x1: px(i), y1: 180, x2: px(i), y2: 184, class: "axe" }, svg);
    const texte = (x0, y0, contenu, ancre) => { s("text", { x: x0, y: y0, class: "legende", "text-anchor": ancre }, svg).textContent = contenu; };
    texte(26, 184, "0", "end");
    texte(px(xMax), 197, `${conf.libelleX} : de 0 à ${nombreFr(xMax)}`, "end");
    texte(36, 14, conf.libelleY, "start");
    s("line", { x1: px(0), y1: py(0), x2: px(xMax), y2: py(k * xMax), class: "droite" }, svg);
    s("line", { x1: px(x), y1: 180, x2: px(x), y2: py(k * x), class: "repere" }, svg);
    s("line", { x1: 30, y1: py(k * x), x2: px(x), y2: py(k * x), class: "repere" }, svg);
    s("circle", { cx: px(x), cy: py(k * x), r: 6, class: "point" }, svg);
    const lignes = [1, 2, 5, 10].filter((v) => v <= xMax);
    table.replaceChildren(
      h("tr", null, h("th", { scope: "row" }, conf.libelleX), ...lignes.map((v) => h("td", null, nombreFr(v))), h("td", { classe: "actif" }, nombreFr(x))),
      h("tr", null, h("th", { scope: "row" }, conf.libelleY), ...lignes.map((v) => h("td", null, nombreFr(k * v))), h("td", { classe: "actif" }, nombreFr(k * x)))
    );
    valeurs.replaceChildren(
      tuile("coefficient", `× ${nombreFr(k)}`),
      tuile(conf.libelleY, `${nombreFr(x)} × ${nombreFr(k)} = ${nombreFr(k * x)}${conf.unite ? ` ${conf.unite}` : ""}`)
    );
  };
  const ck = curseur(conf.libelleCoefficient ?? "Coefficient", conf.coefficientMin ?? 0.5, conf.coefficientMax ?? 3, conf.pas ?? 0.1, k, (v) => { k = v; dessiner(); });
  const cx = curseur(conf.libelleX, 0, xMax, 1, x, (v) => { x = v; dessiner(); });
  ck.maj(); cx.maj();
  return h("div", { classe: "figure" }, svg, h("div", { classe: "curseurs" }, ck.element, cx.element), h("div", { classe: "defile" }, table), valeurs);
};
