// Graphe du référentiel (ADR 0040) : notions, MicroSkills et prérequis de `referentiel/projection-v0.json`, vus comme
// un graphe. Fonctions pures, sans DOM ni dépendance : partagées par le build (qui calcule la disposition une fois,
// de façon déterministe, et l'écrit dans `dist/admin/referentiel-graphe.json`) et par l'écran du back-office.

export const VERSION_GRAPHE = 1;
/** Types de relation, dans l'ordre de leur code compact (0, 1) dans le fichier publié. */
export const TYPES_LIEN = Object.freeze(["prerequis", "microskill"]);

/** Discipline d'un identifiant canonique `notion.<discipline>.<slug>` ou `microskill.<discipline>.<slug>`. */
export function disciplineDe(id) {
  const parties = String(id ?? "").split(".");
  return parties.length > 2 ? parties[1] : "non-classe";
}
export const typeDe = (id) => (String(id).startsWith("microskill.") ? "microskill" : "notion");
/** Libellé lisible d'un identifiant ou d'un slug : « notion.mathematiques.cercle-trigo » → « Cercle trigo ». */
export function libelleDe(id) {
  const slug = String(id ?? "").replace(/^(notion|microskill)\.[^.]+\./, "").replace(/[-_]+/g, " ").trim();
  return slug ? slug[0].toUpperCase() + slug.slice(1) : "";
}

/**
 * Construit le graphe à partir de la configuration de projection. Une MicroSkill est « transdisciplinaire » quand des
 * notions d'au moins deux disciplines la mobilisent. Les références inconnues (prérequis absent) sont ignorées et
 * comptées dans `ignores`.
 */
export function construireGraphe(projection) {
  const notions = Object.entries(projection?.notions ?? {});
  const idParSlug = new Map(notions);
  const idCompetence = new Map(Object.entries(projection?.competences ?? {}).map(([id, slug]) => [slug, id]));
  const noeuds = new Map();
  const ajouter = (id) => {
    if (!noeuds.has(id)) noeuds.set(id, { id, type: typeDe(id), disciplines: new Set([disciplineDe(id)]) });
    return noeuds.get(id);
  };
  for (const [, id] of notions) ajouter(id);
  const liens = [];
  const vus = new Set();
  let ignores = 0;
  const lier = (source, cible, type) => {
    const cle = `${source}>${cible}>${type}`;
    if (source === cible || vus.has(cle)) return;
    vus.add(cle);
    liens.push({ source, cible, type });
  };
  for (const [slug, fiche] of Object.entries(projection?.fiches ?? {})) {
    const notion = idParSlug.get(slug);
    if (!notion) { ignores++; continue; }
    const discipline = disciplineDe(notion);
    for (const p of fiche?.prerequis ?? []) {
      if (idParSlug.has(p)) lier(idParSlug.get(p), notion, "prerequis");
      else ignores++;
    }
    for (const c of fiche?.competences ?? []) {
      const id = idCompetence.get(c) ?? `microskill.${discipline}.${c}`;
      ajouter(id).disciplines.add(discipline);
      lier(notion, id, "microskill");
    }
  }
  const liste = [...noeuds.values()]
    .map((n) => ({ id: n.id, type: n.type, disciplines: [...n.disciplines].sort() }))
    .sort((a, b) => (a.type === b.type ? a.id.localeCompare(b.id) : a.type === "notion" ? -1 : 1));
  for (const n of liste) n.transdisciplinaire = n.type === "microskill" && n.disciplines.length > 1;
  return { noeuds: liste, liens, ignores };
}

/** Générateur pseudo-aléatoire déterministe (mulberry32) : la même entrée donne toujours la même disposition. */
function aleatoire(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Disposition 3D par forces (ressorts sur les liens, répulsion locale par grille, attraction de chaque notion vers le
 * centre de sa discipline). Déterministe ; calculée au build, pas dans le navigateur. Renvoie des [x, y, z] entiers,
 * dans l'ordre de `graphe.noeuds`.
 */
export function disposer(graphe, { iterations = 160, graine = 974 } = {}) {
  const n = graphe.noeuds.length;
  const hasard = aleatoire(graine);
  const index = new Map(graphe.noeuds.map((noeud, i) => [noeud.id, i]));
  const disciplines = [...new Set(graphe.noeuds.map((noeud) => noeud.disciplines[0]))].sort();
  // Centres des disciplines répartis sur une sphère (spirale de Fibonacci).
  const R = 140 + 70 * Math.sqrt(disciplines.length);
  const centres = new Map(disciplines.map((d, i) => {
    const y = 1 - (2 * (i + 0.5)) / disciplines.length;
    const r = Math.sqrt(1 - y * y);
    const phi = i * Math.PI * (3 - Math.sqrt(5));
    return [d, [R * r * Math.cos(phi), R * y, R * r * Math.sin(phi)]];
  }));
  const pos = new Float64Array(n * 3);
  const vit = new Float64Array(n * 3);
  const premierParent = new Map();
  for (const l of graphe.liens) if (l.type === "microskill" && !premierParent.has(l.cible)) premierParent.set(l.cible, l.source);
  const boule = (rayon) => {
    const u = hasard() * 2 - 1, t = hasard() * 2 * Math.PI, r = rayon * Math.cbrt(hasard());
    const s = Math.sqrt(1 - u * u);
    return [r * s * Math.cos(t), r * u, r * s * Math.sin(t)];
  };
  graphe.noeuds.forEach((noeud, i) => {
    if (noeud.type !== "notion") return;
    const c = centres.get(noeud.disciplines[0]);
    const d = boule(110);
    for (let k = 0; k < 3; k++) pos[i * 3 + k] = c[k] + d[k];
  });
  graphe.noeuds.forEach((noeud, i) => {
    if (noeud.type === "notion") return;
    const parent = index.get(premierParent.get(noeud.id));
    const d = boule(28);
    for (let k = 0; k < 3; k++) pos[i * 3 + k] = (parent === undefined ? centres.get(noeud.disciplines[0])[k] : pos[parent * 3 + k]) + d[k];
  });
  const liens = graphe.liens.map((l) => [index.get(l.source), index.get(l.cible), l.type === "prerequis" ? 70 : 26, l.type === "prerequis" ? 0.03 : 0.12]);
  const cellule = 48;
  for (let it = 0; it < iterations; it++) {
    const alpha = 1 - it / iterations;
    // Répulsion entre voisins proches seulement (grille spatiale) : O(n) au lieu de O(n²).
    const grille = new Map();
    for (let i = 0; i < n; i++) {
      const cle = `${Math.floor(pos[i * 3] / cellule)},${Math.floor(pos[i * 3 + 1] / cellule)},${Math.floor(pos[i * 3 + 2] / cellule)}`;
      if (!grille.has(cle)) grille.set(cle, []);
      grille.get(cle).push(i);
    }
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(pos[i * 3] / cellule), cy = Math.floor(pos[i * 3 + 1] / cellule), cz = Math.floor(pos[i * 3 + 2] / cellule);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        for (const j of grille.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
          if (j <= i) continue;
          let x = pos[i * 3] - pos[j * 3], y = pos[i * 3 + 1] - pos[j * 3 + 1], z = pos[i * 3 + 2] - pos[j * 3 + 2];
          let d2 = x * x + y * y + z * z;
          if (d2 < 0.01) { x = hasard() - 0.5; y = hasard() - 0.5; z = hasard() - 0.5; d2 = 0.5; }
          if (d2 > cellule * cellule * 4) continue;
          const f = (alpha * 260) / d2;
          vit[i * 3] += x * f; vit[i * 3 + 1] += y * f; vit[i * 3 + 2] += z * f;
          vit[j * 3] -= x * f; vit[j * 3 + 1] -= y * f; vit[j * 3 + 2] -= z * f;
        }
      }
    }
    for (const [a, b, repos, raideur] of liens) {
      const x = pos[b * 3] - pos[a * 3], y = pos[b * 3 + 1] - pos[a * 3 + 1], z = pos[b * 3 + 2] - pos[a * 3 + 2];
      const d = Math.sqrt(x * x + y * y + z * z) || 1;
      const f = (raideur * alpha * (d - repos)) / d;
      vit[a * 3] += x * f; vit[a * 3 + 1] += y * f; vit[a * 3 + 2] += z * f;
      vit[b * 3] -= x * f; vit[b * 3 + 1] -= y * f; vit[b * 3 + 2] -= z * f;
    }
    graphe.noeuds.forEach((noeud, i) => {
      if (noeud.type !== "notion") return;
      const c = centres.get(noeud.disciplines[0]);
      for (let k = 0; k < 3; k++) vit[i * 3 + k] += (c[k] - pos[i * 3 + k]) * 0.012 * alpha;
    });
    for (let i = 0; i < n * 3; i++) {
      vit[i] = Math.max(-30, Math.min(30, vit[i] * 0.55));
      pos[i] += vit[i];
    }
  }
  return graphe.noeuds.map((_, i) => [Math.round(pos[i * 3]), Math.round(pos[i * 3 + 1]), Math.round(pos[i * 3 + 2])]);
}

/** Forme compacte publiée par le build : nœuds [id, x, y, z, disciplines?] et liens [source, cible, type]. */
export function compacter(graphe, positions) {
  const index = new Map(graphe.noeuds.map((n, i) => [n.id, i]));
  return {
    version: VERSION_GRAPHE,
    noeuds: graphe.noeuds.map((n, i) => {
      const ligne = [n.id, ...positions[i]];
      // Les disciplines ne sont écrites que si elles diffèrent de celle de l'identifiant (MicroSkill partagée).
      if (n.disciplines.length !== 1 || n.disciplines[0] !== disciplineDe(n.id)) ligne.push(n.disciplines);
      return ligne;
    }),
    liens: graphe.liens.map((l) => [index.get(l.source), index.get(l.cible), TYPES_LIEN.indexOf(l.type)])
  };
}

/** Relit la forme compacte : nœuds enrichis (libellé, type, position) et liens par indices. */
export function decompacter(donnees) {
  if (donnees?.version !== VERSION_GRAPHE || !Array.isArray(donnees.noeuds) || !Array.isArray(donnees.liens)) throw new Error("graphe-invalide");
  const noeuds = donnees.noeuds.map(([id, x, y, z, disciplines], i) => {
    const ds = Array.isArray(disciplines) ? disciplines : [disciplineDe(id)];
    const type = typeDe(id);
    return { i, id, type, libelle: libelleDe(id), disciplines: ds, transdisciplinaire: type === "microskill" && ds.length > 1, x, y, z };
  });
  const liens = donnees.liens
    .filter(([a, b]) => noeuds[a] && noeuds[b])
    .map(([a, b, t]) => ({ a, b, type: TYPES_LIEN[t] ?? "microskill", transdisciplinaire: TYPES_LIEN[t] === "microskill" && noeuds[b].transdisciplinaire }));
  const voisins = noeuds.map(() => []);
  liens.forEach((l, k) => { voisins[l.a].push(k); voisins[l.b].push(k); });
  return { noeuds, liens, voisins };
}

/** Indicateurs par discipline et globaux (pour les tuiles et le tableau de l'écran). */
export function indicateurs(graphe) {
  const parDiscipline = new Map();
  const ligne = (d) => {
    if (!parDiscipline.has(d)) parDiscipline.set(d, { discipline: d, notions: 0, microskills: 0, prerequis: 0, sansPrerequis: 0, sansMicroskill: 0 });
    return parDiscipline.get(d);
  };
  const entrants = new Set(), avecMicroskill = new Set();
  for (const l of graphe.liens) {
    if (l.type === "prerequis") { entrants.add(l.b); ligne(graphe.noeuds[l.b].disciplines[0]).prerequis++; }
    else avecMicroskill.add(l.a);
  }
  for (const n of graphe.noeuds) {
    if (n.type === "notion") {
      const d = ligne(n.disciplines[0]);
      d.notions++;
      if (!entrants.has(n.i)) d.sansPrerequis++;
      if (!avecMicroskill.has(n.i)) d.sansMicroskill++;
    } else for (const d of n.disciplines) ligne(d).microskills++;
  }
  return {
    notions: graphe.noeuds.filter((n) => n.type === "notion").length,
    microskills: graphe.noeuds.filter((n) => n.type === "microskill").length,
    transdisciplinaires: graphe.noeuds.filter((n) => n.transdisciplinaire).length,
    prerequis: graphe.liens.filter((l) => l.type === "prerequis").length,
    disciplines: [...parDiscipline.values()].sort((a, b) => a.discipline.localeCompare(b.discipline))
  };
}

/**
 * Nœuds visibles selon les filtres. Une recherche garde les nœuds qui correspondent et leurs voisins directs ;
 * l'isolement garde un nœud et ses voisins.
 */
export function filtrer(graphe, { discipline = "", masquees = new Set(), recherche = "", microskills = true, prerequis = true, transSeules = false, isole = null } = {}) {
  const q = recherche.trim().toLowerCase();
  const typeOk = (n) => (microskills || n.type !== "microskill") && (!transSeules || n.type !== "microskill" || n.transdisciplinaire);
  const lienOk = (l) => (prerequis || l.type !== "prerequis") && (microskills || l.type !== "microskill");
  const autour = isole === null ? null : new Set([isole, ...graphe.voisins[isole].map((k) => (graphe.liens[k].a === isole ? graphe.liens[k].b : graphe.liens[k].a))]);
  const visibles = new Set();
  for (const n of graphe.noeuds) {
    const dOk = !discipline || n.disciplines.includes(discipline);
    const affichee = n.disciplines.some((d) => !masquees.has(d));
    const texte = !q || `${n.libelle} ${n.id}`.toLowerCase().includes(q);
    if (dOk && affichee && typeOk(n) && texte && (!autour || autour.has(n.i))) visibles.add(n.i);
  }
  if (q) for (const i of [...visibles]) for (const k of graphe.voisins[i]) {
    const l = graphe.liens[k], autre = l.a === i ? l.b : l.a;
    if (lienOk(l) && typeOk(graphe.noeuds[autre]) && (!autour || autour.has(autre))) visibles.add(autre);
  }
  const liens = [];
  graphe.liens.forEach((l, k) => { if (visibles.has(l.a) && visibles.has(l.b) && lienOk(l)) liens.push(k); });
  return { noeuds: visibles, liens };
}

/** Plus court chemin (en nombre de relations, sens ignoré) entre deux nœuds : liste d'indices, vide si aucun. */
export function cheminLePlusCourt(graphe, depart, arrivee) {
  if (depart === arrivee) return [depart];
  const precedent = new Map([[depart, -1]]);
  const file = [depart];
  for (let t = 0; t < file.length; t++) {
    const i = file[t];
    for (const k of graphe.voisins[i]) {
      const l = graphe.liens[k], j = l.a === i ? l.b : l.a;
      if (precedent.has(j)) continue;
      precedent.set(j, i);
      if (j === arrivee) {
        const chemin = [j];
        for (let p = i; p !== -1; p = precedent.get(p)) chemin.unshift(p);
        return chemin;
      }
      file.push(j);
    }
  }
  return [];
}

/**
 * Sous-graphe centré sur des notions (identifiants canoniques) : ces notions, leurs MicroSkills et leurs prérequis
 * directs (Espace Métiers, ADR 0041). Même forme que `filtrer` : { noeuds: Set d'indices, liens: indices de liens }.
 */
export function sousEnsemble(graphe, ids, { prerequis = true, microskills = true } = {}) {
  const index = new Map(graphe.noeuds.map((n) => [n.id, n.i]));
  const centres = new Set([...ids].map((id) => index.get(id)).filter((i) => i !== undefined));
  const visibles = new Set(centres);
  for (const i of centres) for (const k of graphe.voisins[i]) {
    const l = graphe.liens[k];
    if (l.type === "microskill" && microskills && l.a === i) visibles.add(l.b);
    if (l.type === "prerequis" && prerequis && l.b === i) visibles.add(l.a);
  }
  const liens = [];
  graphe.liens.forEach((l, k) => {
    if (!visibles.has(l.a) || !visibles.has(l.b)) return;
    if (l.type === "microskill" && !centres.has(l.a)) return;
    liens.push(k);
  });
  return { noeuds: visibles, liens, centres };
}

/**
 * Graphe autonome du sous-ensemble centré sur des notions, avec sa propre disposition (déterministe) : les notions
 * d'une même sélection restent lisibles ensemble au lieu de garder leurs places, éloignées, dans le graphe complet.
 * Renvoie { graphe (forme de `decompacter`), centres : Set d'indices dans ce graphe }.
 */
export function sousGraphe(graphe, ids, options = {}) {
  const { noeuds, liens, centres } = sousEnsemble(graphe, ids, options);
  const local = {
    noeuds: [...noeuds].sort((a, b) => a - b).map((i) => ({ id: graphe.noeuds[i].id, type: graphe.noeuds[i].type, disciplines: graphe.noeuds[i].disciplines })),
    liens: liens.map((k) => ({ source: graphe.noeuds[graphe.liens[k].a].id, cible: graphe.noeuds[graphe.liens[k].b].id, type: graphe.liens[k].type }))
  };
  const resultat = decompacter(compacter(local, disposer(local, { iterations: 120 })));
  const index = new Map(resultat.noeuds.map((n) => [n.id, n.i]));
  return { graphe: resultat, centres: new Set([...centres].map((i) => index.get(graphe.noeuds[i].id))) };
}
