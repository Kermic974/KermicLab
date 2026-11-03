// Mini-lab du tableau de bord : cercle trigonométrique manipulable (curseur, glisser le point, angles remarquables).
// Aucun texte en dur : les libellés passent par `t` (i18n). Compatible avec la CSP du chat (pas de style en ligne
// dans le HTML : seules des propriétés CSSOM sont modifiées).

const NS = "http://www.w3.org/2000/svg";
const R = 100;
const ANGLES = [0, 30, 45, 60, 90, 180, 270];
const EXACTES = [[0, "0"], [0.5, "1/2"], [Math.SQRT2 / 2, "√2/2"], [Math.sqrt(3) / 2, "√3/2"], [1, "1"]];

function svg(balise, attributs, parent) {
  const n = document.createElementNS(NS, balise);
  for (const [k, v] of Object.entries(attributs)) n.setAttribute(k, v);
  parent?.append(n);
  return n;
}

function texte(parent, x, y, contenu, classe = "c-txt") {
  const n = svg("text", { x, y, class: classe }, parent);
  n.textContent = contenu;
  return n;
}

/** Angle en radians sous forme de fraction de π quand c'est possible (π/4, 3π/2…). */
export function enRadians(deg, nombre) {
  if (deg === 0) return "0";
  for (const d of [1, 2, 3, 4, 6]) {
    const k = (deg * d) / 180;
    if (Math.abs(k - Math.round(k)) < 1e-9) {
      const num = `${Math.round(k) === 1 ? "" : Math.round(k)}π`;
      return d === 1 ? num : `${num}/${d}`;
    }
  }
  return nombre((deg * Math.PI) / 180, 2);
}

/** Valeur exacte pour les angles remarquables (√2/2…), sinon chaîne vide. */
export function valeurExacte(v, deg) {
  if (deg % 30 !== 0 && deg % 45 !== 0) return "";
  const trouvee = EXACTES.find(([x]) => Math.abs(Math.abs(v) - x) < 1e-9);
  if (!trouvee || trouvee[1] === "0" || trouvee[1] === "1") return "";
  return `${v < 0 ? "−" : ""}${trouvee[1]}`;
}

/**
 * Monte le mini-lab dans `racine` (contient [data-cercle], input[type=range], [data-angles] et [data-sortie=…]).
 * `options.t` traduit, `options.langue()` donne la langue courante.
 */
export function monterCercle(racine, { t, langue }) {
  const hote = racine.querySelector("[data-cercle]");
  const curseur = racine.querySelector("input[type=range]");
  const zoneAngles = racine.querySelector("[data-angles]");
  const sorties = (nom) => racine.querySelectorAll(`[data-sortie="${nom}"]`);
  const ecrire = (nom, valeur) => sorties(nom).forEach((n) => { n.textContent = valeur; });
  const nombre = (v, chiffres = 3) => new Intl.NumberFormat(langue(), { minimumFractionDigits: chiffres, maximumFractionDigits: chiffres })
    .format(Math.abs(v) < 0.0005 ? 0 : v).replace("-", "−");

  const dessin = svg("svg", { viewBox: "-142 -142 284 284", role: "img" }, hote);
  svg("circle", { r: R / 2, class: "c-grille" }, dessin);
  svg("circle", { r: R, class: "c-unite" }, dessin);
  svg("line", { x1: -128, y1: 0, x2: 128, y2: 0, class: "c-axe" }, dessin);
  svg("line", { x1: 0, y1: 128, x2: 0, y2: -128, class: "c-axe" }, dessin);
  svg("path", { d: "M134 0 126 -4 126 4z", class: "c-fleche" }, dessin);
  svg("path", { d: "M0 -134 -4 -126 4 -126z", class: "c-fleche" }, dessin);
  for (const [x, y] of [[R, 0], [-R, 0]]) svg("line", { x1: x, y1: -4, x2: x, y2: 4, class: "c-axe" }, dessin);
  for (const [x, y] of [[0, R], [0, -R]]) svg("line", { x1: -4, y1: y, x2: 4, y2: y, class: "c-axe" }, dessin);
  texte(dessin, R + 4, 15, "1"); texte(dessin, -R - 15, 15, "−1"); texte(dessin, 7, -R - 5, "1"); texte(dessin, 7, R + 13, "−1");
  texte(dessin, 128, -8, "x"); texte(dessin, 8, -128, "y"); texte(dessin, -12, 13, "O");
  const arc = svg("path", { class: "c-arc" }, dessin);
  const guideY = svg("line", { class: "c-guide" }, dessin);
  const guideX = svg("line", { class: "c-guide" }, dessin);
  const sinAxe = svg("line", { class: "c-sin-axe" }, dessin);
  const cosTrait = svg("line", { class: "c-cos" }, dessin);
  const sinTrait = svg("line", { class: "c-sin" }, dessin);
  const rayon = svg("line", { x1: 0, y1: 0, class: "c-rayon" }, dessin);
  const halo = svg("circle", { r: 15, class: "c-halo" }, dessin);
  const point = svg("circle", { r: 7.5, class: "c-point" }, dessin);
  const etiquetteCos = texte(dessin, 0, 0, "cos θ", "c-et-cos"); etiquetteCos.setAttribute("text-anchor", "middle");
  const etiquetteSin = texte(dessin, 0, 0, "sin θ", "c-et-sin");
  const etiquetteTheta = texte(dessin, 0, 0, "θ", "c-et-theta"); etiquetteTheta.setAttribute("text-anchor", "middle");

  const boutons = ANGLES.map((v) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "angle"; b.textContent = `${v}°`; b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => regler(v));
    zoneAngles.append(b);
    return b;
  });

  let angle = 0;
  const poser = (n, attributs) => { for (const [k, v] of Object.entries(attributs)) n.setAttribute(k, v); };

  function regler(deg) {
    angle = Math.max(0, Math.min(360, Math.round(deg)));
    const th = (angle * Math.PI) / 180;
    const c = Math.abs(Math.cos(th)) < 1e-12 ? 0 : Math.cos(th);
    const s = Math.abs(Math.sin(th)) < 1e-12 ? 0 : Math.sin(th);
    const x = R * c, y = -R * s, ra = 30;
    arc.setAttribute("d", angle === 0 ? "" : angle === 360
      ? `M${ra} 0 A${ra} ${ra} 0 1 0 ${-ra} 0 A${ra} ${ra} 0 1 0 ${ra} 0Z`
      : `M0 0 L${ra} 0 A${ra} ${ra} 0 ${angle > 180 ? 1 : 0} 0 ${(ra * c).toFixed(2)} ${(-ra * s).toFixed(2)}Z`);
    poser(cosTrait, { x1: 0, y1: 0, x2: x, y2: 0 });
    poser(sinTrait, { x1: x, y1: 0, x2: x, y2: y });
    poser(sinAxe, { x1: 0, y1: 0, x2: 0, y2: y });
    poser(guideY, { x1: x, y1: y, x2: 0, y2: y });
    poser(guideX, { x1: x, y1: y, x2: x, y2: 0 });
    poser(rayon, { x2: x, y2: y });
    poser(point, { cx: x, cy: y });
    poser(halo, { cx: x, cy: y });
    etiquetteCos.style.display = Math.abs(c) > 0.22 ? "" : "none";
    poser(etiquetteCos, { x: x / 2, y: s >= 0 ? 16 : -8 });
    etiquetteSin.style.display = Math.abs(s) > 0.18 ? "" : "none";
    poser(etiquetteSin, { x: x + (c >= 0 ? 7 : -7), y: y / 2 + 4, "text-anchor": c >= 0 ? "start" : "end" });
    etiquetteTheta.style.display = angle >= 14 ? "" : "none";
    poser(etiquetteTheta, { x: (44 * Math.cos(th / 2)).toFixed(1), y: (-44 * Math.sin(th / 2) + 4).toFixed(1) });

    if (Number(curseur.value) !== angle) curseur.value = String(angle);
    curseur.style.setProperty("--p", `${(angle / 360) * 100}%`);
    const resume = t("cercleValeur", { deg: angle, sin: nombre(s), cos: nombre(c) });
    curseur.setAttribute("aria-valuetext", resume);
    dessin.setAttribute("aria-label", resume);
    ecrire("deg", String(angle));
    ecrire("theta", `${angle}°`);
    ecrire("rad", `${enRadians(angle, nombre)} rad`);
    ecrire("sin", nombre(s));
    ecrire("cos", nombre(c));
    ecrire("sinx", valeurExacte(s, angle) && `= ${valeurExacte(s, angle)}`);
    ecrire("cosx", valeurExacte(c, angle) && `= ${valeurExacte(c, angle)}`);
    boutons.forEach((b, i) => b.setAttribute("aria-pressed", String(ANGLES[i] === angle)));
  }

  curseur.addEventListener("input", () => regler(Number(curseur.value)));

  // Glisser le point directement sur le cercle, avec aimantation douce tous les 15°.
  let glisse = false;
  function depuis(ev) {
    const m = dessin.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
    if (Math.hypot(p.x, p.y) < 6) return;
    let deg = (Math.atan2(-p.y, p.x) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    const aimant = Math.round(deg / 15) * 15;
    if (Math.abs(deg - aimant) < 2.5) deg = aimant;
    if (angle >= 330 && deg < 3) deg = 360;
    regler(deg);
  }
  dessin.addEventListener("pointerdown", (ev) => {
    glisse = true; hote.classList.add("glisse");
    try { dessin.setPointerCapture(ev.pointerId); } catch { /* capture indisponible */ }
    depuis(ev); ev.preventDefault();
  });
  dessin.addEventListener("pointermove", (ev) => { if (glisse) depuis(ev); });
  const arreter = () => { glisse = false; hote.classList.remove("glisse"); };
  dessin.addEventListener("pointerup", arreter);
  dessin.addEventListener("pointercancel", arreter);

  regler(Number(curseur.value));
  return { regler, rafraichir: () => regler(angle) };
}
