// Figure « des » du gabarit des notions (docs/gabarit.md).
// scripts/lib/gabarit.mjs l'insère dans le moteur (gabarit/moteur.js) des seules pages dont
// application.figure.type vaut « des ». Outils du moteur disponibles : h, s, riche, paragraphe,
// nombreFr, exact, pgcd, curseur, tuile.

/** Lancers d'un dé équilibré : les fréquences se rapprochent de 1/6 quand le nombre de lancers augmente. */
FIGURES.des = function des() {
  const svg = s("svg", { viewBox: "0 0 300 170", role: "img", "aria-label": "Diagramme des fréquences de chaque face du dé" });
  const valeurs = h("div", { classe: "tuiles", "aria-live": "polite" });
  const effectifs = [0, 0, 0, 0, 0, 0];
  let total = 0, dernier = null;
  const dessiner = () => {
    svg.replaceChildren();
    const hauteur = (f) => (Math.min(f, 0.35) / 0.35) * 130;
    effectifs.forEach((n, i) => {
      const f = total ? n / total : 0;
      s("rect", { x: 20 + i * 46, y: 145 - hauteur(f), width: 34, height: hauteur(f), class: `barre${dernier === i + 1 ? " derniere" : ""}` }, svg);
      s("text", { x: 37 + i * 46, y: 162, class: "legende", "text-anchor": "middle" }, svg).textContent = String(i + 1);
    });
    s("line", { x1: 10, y1: 145 - hauteur(1 / 6), x2: 295, y2: 145 - hauteur(1 / 6), class: "repere" }, svg);
    s("text", { x: 295, y: 141 - hauteur(1 / 6), class: "legende", "text-anchor": "end" }, svg).textContent = "1/6 ≈ 0,167";
    s("line", { x1: 10, y1: 145, x2: 295, y2: 145, class: "axe" }, svg);
    valeurs.replaceChildren(
      tuile("lancers", nombreFr(total)),
      tuile("dernier lancer", dernier ? String(dernier) : "—"),
      tuile("fréquence du 6", total ? nombreFr(effectifs[5] / total, 3) : "—"),
      tuile("probabilité du 6", "1/6 ≈ 0,167")
    );
  };
  const lancer = (n) => {
    for (let i = 0; i < n; i++) { dernier = 1 + Math.floor(Math.random() * 6); effectifs[dernier - 1] += 1; total += 1; }
    dessiner();
  };
  const boutons = h("div", { classe: "boutons" },
    ...[1, 10, 100, 1000].map((n) => { const b = h("button", { type: "button", classe: "action" }, `Lancer ${n === 1 ? "1 fois" : `${n} fois`}`); b.addEventListener("click", () => lancer(n)); return b; }),
    (() => { const b = h("button", { type: "button", classe: "lien" }, "Recommencer"); b.addEventListener("click", () => { effectifs.fill(0); total = 0; dernier = null; dessiner(); }); return b; })());
  dessiner();
  return h("div", { classe: "figure" }, svg, boutons, valeurs);
};
