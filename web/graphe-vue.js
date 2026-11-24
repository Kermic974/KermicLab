// Vue 3D du graphe du référentiel (ADR 0040) : rendu sur <canvas> 2D avec projection en perspective, sans
// bibliothèque (la CSP du site n'autorise que les scripts de même origine). La disposition est calculée au build ;
// le navigateur ne fait que tourner, zoomer, filtrer et dessiner.

const PALETTE = ["#4f7cff", "#16a085", "#e08a1e", "#d6457a", "#8b5cf6", "#0ea5c6", "#e0533f", "#7cb518", "#c2410c", "#6366f1", "#0d9488", "#c026d3", "#ca8a04", "#2563eb", "#9333ea", "#15803d"];
export const COULEUR_TRANS = "#f5b700";
/** Couleur des nœuds et relations de la couche métiers (chantier Métiers, lot 4). */
export const COULEUR_METIER = "#e11d48";

/** Couleur stable d'une discipline, d'après son rang dans la liste triée. */
export function couleurs(disciplines) {
  return new Map(disciplines.map((d, i) => [d, PALETTE[i % PALETTE.length]]));
}

/**
 * Crée la vue dans `canvas`. `etat()` renvoie { visibles, liens, chemin:Set, selection, couleurs, entoures?:Set,
 * nommerNotions?:bool, nommerMicroskills?:bool } à chaque image (`entoures` : nœuds cerclés sans estomper les autres ;
 * `nommer*` : étiquettes toujours affichées, pour un petit graphe, ADR 0041) ;
 * `onSelection(i | null)` est appelé au clic. Renvoie { dessiner, centrer, tourner, zoomer, rotationAuto, detruire }.
 */
export function creerVue(canvas, graphe, { etat, onSelection }) {
  const ctx = canvas.getContext("2d");
  const camera = { lacet: 0.6, tangage: -0.25, distance: 1400, cible: [0, 0, 0] };
  let largeur = 0, hauteur = 0, ratio = 1, image = 0, auto = false, projetes = [];
  // Cadrage automatique en cours (posé par centrer, levé par un zoom ou un « viser ») : refait quand le cadre change de
  // taille, sinon un graphe cadré en portrait déborderait une fois le téléphone tourné.
  let cadreAuto = false;
  // Côté de l'étiquette de chaque nœud à l'image précédente : gardé tant qu'il reste libre, pour que les étiquettes ne
  // sautent pas d'un côté à l'autre pendant une rotation.
  const cotes = new Map();
  const reduit = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const style = () => getComputedStyle(canvas);
  function dimensionner() {
    const r = canvas.getBoundingClientRect();
    ratio = globalThis.devicePixelRatio || 1;
    largeur = Math.max(1, r.width); hauteur = Math.max(1, r.height);
    canvas.width = Math.round(largeur * ratio); canvas.height = Math.round(hauteur * ratio);
  }

  function projeter(n) {
    const x0 = n.x - camera.cible[0], y0 = n.y - camera.cible[1], z0 = n.z - camera.cible[2];
    const cl = Math.cos(camera.lacet), sl = Math.sin(camera.lacet), ct = Math.cos(camera.tangage), st = Math.sin(camera.tangage);
    const x1 = x0 * cl - z0 * sl, z1 = x0 * sl + z0 * cl;
    const y2 = y0 * ct - z1 * st, z2 = y0 * st + z1 * ct;
    const profondeur = camera.distance + z2;
    if (profondeur < 20) return null;
    const f = (Math.min(largeur, hauteur) * 0.9) / profondeur;
    return { sx: largeur / 2 + x1 * f, sy: hauteur / 2 + y2 * f, f, profondeur };
  }

  function dessiner() {
    if (!largeur) dimensionner();
    const { visibles, liens, chemin, selection, couleurs: teintes, entoures = new Set(), nommerNotions = false, nommerMicroskills = false } = etat();
    const s = style();
    const texte = s.getPropertyValue("--texte").trim() || "#141833";
    const doux = s.getPropertyValue("--doux").trim() || "#5f6585";
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, largeur, hauteur);
    projetes = new Array(graphe.noeuds.length);
    for (const i of visibles) projetes[i] = projeter(graphe.noeuds[i]);
    const enChemin = chemin.size > 0;
    // Liens : prérequis plus marqués que les rattachements notion → MicroSkill.
    ctx.lineCap = "round";
    for (const k of liens) {
      const l = graphe.liens[k], a = projetes[l.a], b = projetes[l.b];
      if (!a || !b) continue;
      const surChemin = enChemin && chemin.has(l.a) && chemin.has(l.b);
      const relie = selection !== null && (l.a === selection || l.b === selection);
      ctx.globalAlpha = surChemin || relie ? 0.95 : enChemin ? 0.06 : l.type === "prerequis" ? 0.5 : l.type === "metier" ? 0.1 : 0.16;
      ctx.strokeStyle = surChemin ? texte : l.type === "metier" ? COULEUR_METIER : l.transdisciplinaire ? COULEUR_TRANS : teintes.get(graphe.noeuds[l.b].disciplines[0]) ?? doux;
      ctx.lineWidth = surChemin ? 3 : l.type === "prerequis" ? 1.2 : 0.6;
      ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
      if (l.type === "prerequis" && (surChemin || relie || !enChemin) && a.f > 0.35) {
        // Flèche vers la notion qui demande le prérequis.
        const ang = Math.atan2(b.sy - a.sy, b.sx - a.sx), r = 7 * b.f + 2, t = 5 * Math.min(1.4, b.f + 0.4);
        const px = b.sx - Math.cos(ang) * r, py = b.sy - Math.sin(ang) * r;
        ctx.beginPath(); ctx.moveTo(px, py);
        ctx.lineTo(px - Math.cos(ang - 0.45) * t, py - Math.sin(ang - 0.45) * t);
        ctx.lineTo(px - Math.cos(ang + 0.45) * t, py - Math.sin(ang + 0.45) * t);
        ctx.closePath(); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
      }
    }
    // Nœuds du plus lointain au plus proche.
    const ordre = [...visibles].filter((i) => projetes[i]).sort((i, j) => projetes[j].profondeur - projetes[i].profondeur);
    for (const i of ordre) {
      const n = graphe.noeuds[i], p = projetes[i];
      const base = n.type === "notion" ? 7 : n.type === "metier" ? 6 : n.transdisciplinaire ? 4.5 : 3;
      const r = Math.max(1.2, base * p.f);
      p.r = r;
      ctx.globalAlpha = enChemin && !chemin.has(i) ? 0.18 : n.type === "microskill" ? 0.8 : 0.95;
      ctx.fillStyle = n.type === "metier" ? COULEUR_METIER : n.transdisciplinaire ? COULEUR_TRANS : teintes.get(n.disciplines[0]) ?? doux;
      ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2); ctx.fill();
      if (chemin.has(i) || i === selection || entoures.has(i)) {
        ctx.globalAlpha = 1; ctx.lineWidth = 2.5; ctx.strokeStyle = texte;
        ctx.beginPath(); ctx.arc(p.sx, p.sy, r + 3, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // Étiquettes : la sélection, le chemin, et les notions proches de la caméra.
    ctx.globalAlpha = 1; ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif"; ctx.textBaseline = "middle";
    const etiquetees = ordre.filter((i) => i === selection || chemin.has(i) || (graphe.noeuds[i].type !== "microskill" && (nommerNotions || (projetes[i].f > 0.95 && ordre.length < 900))));
    for (const i of etiquetees.slice(-60)) {
      const p = projetes[i], t = graphe.noeuds[i].libelle;
      ctx.lineWidth = 3; ctx.strokeStyle = s.getPropertyValue("--surface").trim() || "#fff"; ctx.fillStyle = texte;
      ctx.strokeText(t, p.sx + p.r + 4, p.sy); ctx.fillText(t, p.sx + p.r + 4, p.sy);
    }
  }

  const planifier = () => { if (!image) image = requestAnimationFrame(() => { image = 0; if (auto) { camera.lacet += 0.0035; planifier(); } dessiner(); }); };

  /**
   * Cadre la caméra sur les nœuds visibles, tels qu'ils apparaissent sous l'angle de vue courant : centre de leur
   * emprise à l'écran (et non moyenne 3D) et distance qui fait tenir cette emprise dans la largeur et la hauteur du
   * cadre. Quand les étiquettes sont toujours affichées, une marge à droite leur est réservée.
   */
  function centrer() {
    if (!largeur) dimensionner();
    const { visibles, nommerNotions = false, nommerMicroskills = false } = etat();
    const pts = [...visibles].map((i) => graphe.noeuds[i]);
    if (!pts.length) { planifier(); return; }
    const cl = Math.cos(camera.lacet), sl = Math.sin(camera.lacet), ct = Math.cos(camera.tangage), st = Math.sin(camera.tangage);
    // Coordonnées dans le repère de la caméra (rotation seule), puis 95 % central de chaque axe : un nœud isolé ne
    // rapetisse pas tout le graphe.
    const vues = pts.map((n) => {
      const x1 = n.x * cl - n.z * sl, z1 = n.x * sl + n.z * cl;
      return [x1, n.y * ct - z1 * st, n.y * st + z1 * ct];
    });
    const borne = (k) => {
      const v = vues.map((p) => p[k]).sort((a, b) => a - b), q = Math.floor((v.length - 1) * 0.025);
      return [v[q], v[v.length - 1 - q]];
    };
    const [[x0, x1], [y0, y1], [z0, z1]] = [0, 1, 2].map(borne);
    const K = Math.min(largeur, hauteur) * 0.9;
    const reserve = nommerNotions || nommerMicroskills ? Math.min(140, largeur * 0.14) : 0;
    const demiX = Math.max(30, (x1 - x0) / 2), demiY = Math.max(30, (y1 - y0) / 2);
    const distance = Math.max((demiX * K) / ((largeur - reserve) * 0.45), (demiY * K) / (hauteur * 0.43)) + (z1 - z0) / 4;
    // Centre de l'emprise, décalé vers la droite de la moitié de la marge des étiquettes (le graphe glisse à gauche).
    const u = (x0 + x1) / 2 + ((reserve / 2) * distance) / K, v = (y0 + y1) / 2, w = (z0 + z1) / 2;
    const y = v * ct + w * st, zr = -v * st + w * ct;
    camera.cible = [u * cl + zr * sl, y, -u * sl + zr * cl];
    camera.distance = Math.max(80, Math.min(6000, distance));
    cadreAuto = true;
    planifier();
  }
  function viser(i) {
    const n = graphe.noeuds[i];
    camera.cible = [n.x, n.y, n.z]; camera.distance = Math.min(camera.distance, 420);
    cadreAuto = false;
    planifier();
  }
  const tourner = (dl, dt) => { camera.lacet += dl; camera.tangage = Math.max(-1.45, Math.min(1.45, camera.tangage + dt)); planifier(); };
  const zoomer = (facteur) => { camera.distance = Math.max(80, Math.min(6000, camera.distance * facteur)); cadreAuto = false; planifier(); };

  function noeudSous(x, y) {
    let meilleur = null, dist = Infinity;
    for (const i of etat().visibles) {
      const p = projetes[i];
      if (!p) continue;
      const d = Math.hypot(p.sx - x, p.sy - y);
      if (d <= Math.max(8, (p.r ?? 3) + 4) && (d < dist || (d === dist && p.profondeur < projetes[meilleur].profondeur))) { meilleur = i; dist = d; }
    }
    return meilleur;
  }

  // Pointeur : glisser pour tourner (un doigt), pincer pour zoomer (deux doigts), clic pour choisir.
  const pointeurs = new Map();
  let depart = null, ecartInitial = 0;
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const surBas = (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    pointeurs.set(e.pointerId, local(e));
    depart = { pos: local(e), bouge: false };
    if (pointeurs.size === 2) { const [a, b] = [...pointeurs.values()]; ecartInitial = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  };
  const surMouvement = (e) => {
    if (!pointeurs.has(e.pointerId)) {
      const i = noeudSous(...local(e));
      canvas.style.cursor = i === null ? "grab" : "pointer";
      canvas.title = i === null ? "" : `${graphe.noeuds[i].libelle} · ${graphe.noeuds[i].id}`;
      return;
    }
    const avant = pointeurs.get(e.pointerId), maintenant = local(e);
    pointeurs.set(e.pointerId, maintenant);
    if (pointeurs.size === 2) {
      const [a, b] = [...pointeurs.values()], ecart = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (ecartInitial) zoomer(ecartInitial / ecart);
      ecartInitial = ecart;
    } else tourner((maintenant[0] - avant[0]) * 0.006, (maintenant[1] - avant[1]) * 0.006);
    if (depart && Math.hypot(maintenant[0] - depart.pos[0], maintenant[1] - depart.pos[1]) > 4) depart.bouge = true;
  };
  const surHaut = (e) => {
    pointeurs.delete(e.pointerId);
    if (pointeurs.size < 2) ecartInitial = 0;
    if (depart && !depart.bouge && pointeurs.size === 0) onSelection(noeudSous(...local(e)));
    if (pointeurs.size === 0) depart = null;
  };
  const surMolette = (e) => { e.preventDefault(); zoomer(e.deltaY > 0 ? 1.12 : 1 / 1.12); };
  const surClavier = (e) => {
    const pas = 0.12, actions = { ArrowLeft: () => tourner(-pas, 0), ArrowRight: () => tourner(pas, 0), ArrowUp: () => tourner(0, -pas), ArrowDown: () => tourner(0, pas), "+": () => zoomer(1 / 1.2), "=": () => zoomer(1 / 1.2), "-": () => zoomer(1.2) };
    if (actions[e.key]) { e.preventDefault(); actions[e.key](); }
  };
  canvas.addEventListener("pointerdown", surBas);
  canvas.addEventListener("pointermove", surMouvement);
  canvas.addEventListener("pointerup", surHaut);
  canvas.addEventListener("pointercancel", surHaut);
  canvas.addEventListener("wheel", surMolette, { passive: false });
  canvas.addEventListener("keydown", surClavier);
  const observateur = typeof ResizeObserver === "function" ? new ResizeObserver(() => { dimensionner(); if (cadreAuto) centrer(); else planifier(); }) : null;
  observateur?.observe(canvas);

  return {
    dessiner: planifier, centrer, viser, tourner, zoomer,
    rotationAuto(actif) { auto = !!actif && !reduit; planifier(); return auto; },
    detruire() { auto = false; observateur?.disconnect(); if (image) cancelAnimationFrame(image); }
  };
}
