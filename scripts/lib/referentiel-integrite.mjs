const noeuds = new Set(["notion", "microskill", "skill"]);
export const typesRelation = new Set(["teaches", "contributesTo", "requires", "supports", "extends", "relatedTo", "equivalentTo"]);
const symetriques = new Set(["relatedTo", "equivalentTo"]);
const transitions = new Set(["draft:review", "review:draft", "review:validated", "validated:deprecated"]);
const rangs = new Map(["cycle-2", "cycle-3", "cycle-4", "seconde", "premiere", "terminale"].map((code, i) => [code, i]));
const contrat = (o) => typesRelation.has(o.type) ? "relation" : o.type;
const cle = (...valeurs) => JSON.stringify(valeurs);

function canonique(v) {
  if (Array.isArray(v)) return v.map(canonique);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map(k => [k, canonique(v[k])]));
  return v;
}

function verifierRevisions(index, historique, signaler) {
  const vus = new Map();
  let precedent = new Map();
  for (const etat of [...historique, new Map([...index].map(([id, e]) => [id, e.objet]))]) {
    for (const [id, objet] of etat) {
      const ancien = vus.get(id);
      const entree = index.get(id);
      if (ancien && entree) {
        if (!precedent.has(id) || ancien.type !== objet.type) signaler(entree, "S4-ID-REUTILISE", "ID réutilisé après suppression ou changement de type.");
        if (cle(canonique(ancien)) !== cle(canonique(objet)) && objet.version <= ancien.version) {
          signaler(entree, "S4-REVISION", "Une modification exige une version strictement supérieure.");
        }
        if (ancien.status !== objet.status && !transitions.has(ancien.status + ":" + objet.status)) {
          signaler(entree, "S4-TRANSITION", "Transition de statut interdite.");
        }
      }
      vus.set(id, objet);
    }
    precedent = etat;
  }
}

function referenceAncienne(historique, objet, champ, cible) {
  let ancienne = false;
  for (const etat of historique) {
    const statut = etat.get(cible.id)?.status;
    if (etat.get(objet.id)?.[champ] !== cible.id || statut === undefined) ancienne = false;
    else if (statut === "validated") ancienne = true;
  }
  return ancienne;
}

function verifierReferences(index, historique, signaler) {
  const champs = { source: noeuds, target: noeuds, object: noeuds, curriculum: new Set(["curriculum"]),
    stage: new Set(["stage"]), domain: new Set(["domain"]) };
  for (const entree of index.values()) {
    const { objet } = entree;
    for (const champ of [...Object.keys(champs), "replacedBy"]) {
      if (!Object.hasOwn(objet, champ)) continue;
      const cible = index.get(objet[champ])?.objet;
      const lieu = "/" + champ;
      if (!cible) {
        signaler(entree, "S4-REFERENCE-ABSENTE", "Identifiant référencé introuvable.", "ERROR", lieu);
        continue;
      }
      if (champ === "replacedBy") {
        if (cible.id === objet.id || cible.type !== objet.type || cible.status !== "validated") {
          signaler(entree, "S4-REMPLACEMENT-CIBLE", "Le remplacement exige une cible distincte et validée du même type.", "ERROR", lieu);
        }
        continue;
      }
      if (!champs[champ].has(contrat(cible)) || cible.id.split(".")[0] !== contrat(cible)) {
        signaler(entree, "S4-REFERENCE-TYPE", "Type ou namespace de cible incompatible.", "ERROR", lieu);
      } else if (objet.status === "validated" && cible.status !== "validated") {
        if (cible.status === "deprecated" && historique === null) continue;
        const ancienne = cible.status === "deprecated" && referenceAncienne(historique, objet, champ, cible);
        signaler(entree, ancienne ? "S4-REFERENCE-HISTORIQUE" : "S4-REFERENCE-STATUT",
          ancienne ? "Référence historique vers une cible dépréciée." : "Une nouvelle référence validée exige une cible validée.",
          ancienne ? "WARNING" : "ERROR", lieu);
      }
    }
  }
}

function verifierCycles(arcs, regle, severite, signaler) {
  const suivants = new Map();
  for (const { source, cible } of arcs) {
    if (!suivants.has(source)) suivants.set(source, []);
    suivants.get(source).push(cible);
  }
  for (const { source, cible, entree } of arcs) {
    const vus = new Set();
    const pile = [cible];
    while (pile.length) {
      const id = pile.pop();
      if (id === source) {
        signaler(entree, regle, "Cycle détecté.", severite);
        break;
      }
      if (vus.has(id)) continue;
      vus.add(id);
      for (const suivant of suivants.get(id) ?? []) pile.push(suivant);
    }
  }
}

function verifierPlacements(index, signaler) {
  const cles = new Set();
  const niveaux = new Map();
  for (const entree of index.values()) {
    const o = entree.objet;
    if (o.type !== "curriculum-mapping") continue;
    const k = cle(o.object, o.curriculum, o.stage, o.domain ?? null, o.role);
    if (cles.has(k)) signaler(entree, "S4-MAPPING-DOUBLON", "Placement curriculaire en double.");
    cles.add(k);
    const stage = index.get(o.stage)?.objet;
    const domain = index.get(o.domain)?.objet;
    const incoherents = [["stage", stage], ["domain", domain]].filter(([, cible]) => cible && cible.curriculum !== o.curriculum);
    for (const [champ] of incoherents) {
      signaler(entree, "S4-MAPPING-CURRICULUM", "Le placement et la cible appartiennent à des programmes différents.", "ERROR", "/" + champ);
    }
    const rang = rangs.get(stage?.code);
    if (incoherents.length || o.status === "deprecated" || rang === undefined) continue;
    const [programme, objet] = [o.curriculum, o.object];
    if (!niveaux.has(objet)) niveaux.set(objet, new Map());
    const ordre = niveaux.get(objet);
    ordre.set(programme, Math.min(ordre.get(programme) ?? Infinity, rang));
  }
  return niveaux;
}

function verifierRelations(index, niveaux, signaler) {
  const cles = new Set();
  const arcs = { requires: [], extends: [], supports: [] };
  const enseignees = new Set();
  const contribuees = new Set();
  for (const entree of index.values()) {
    const { type, source, target, status } = entree.objet;
    if (!typesRelation.has(type)) continue;
    if (source === target) signaler(entree, "S4-RELATION-REFLEXIVE", "Source et cible identiques.");
    if (symetriques.has(type) && source > target) signaler(entree, "S4-RELATION-CANONIQUE", "Ordre ASCII source < target requis.");
    const k = cle(type, ...(symetriques.has(type) ? [source, target].sort() : [source, target]));
    if (cles.has(k)) signaler(entree, "S4-RELATION-DOUBLON", "Relation en double.");
    cles.add(k);
    const s = index.get(source)?.objet;
    const t = index.get(target)?.objet;
    if (!s || !t) continue;
    const compatible = type === "teaches" ? s.type === "notion" && t.type === "microskill" :
      type === "contributesTo" ? s.type === "microskill" && t.type === "skill" : noeuds.has(s.type) && s.type === t.type;
    if (!compatible) {
      signaler(entree, "S4-RELATION-MATRICE", "Types d’extrémités incompatibles.");
      continue;
    }
    if (status === "deprecated" || source === target) continue;
    if (Object.hasOwn(arcs, type)) arcs[type].push({ source, cible: target, entree });
    if ([status, s.status, t.status].every(v => v === "validated")) {
      if (type === "teaches") enseignees.add(target);
      if (type === "contributesTo") contribuees.add(target);
      if (type === "equivalentTo") signaler(entree, "S4-RELATION-EQUIVALENCE", "Deux objets validés sont déclarés équivalents.", "WARNING");
    }
    if (type === "requires" && [...(niveaux.get(source) ?? [])].some(([p, r]) => niveaux.get(target)?.get(p) > r)) {
      signaler(entree, "S4-PREREQUIS-NIVEAU", "Le prérequis apparaît à une étape plus avancée.", "WARNING");
    }
  }
  for (const [type, liste] of Object.entries(arcs)) {
    verifierCycles(liste, "S4-CYCLE-" + type.toUpperCase(), type === "supports" ? "WARNING" : "ERROR", signaler);
  }
  for (const entree of index.values()) {
    const o = entree.objet;
    if (o.status !== "validated") continue;
    if (o.type === "microskill" && !enseignees.has(o.id)) signaler(entree, "S4-MICROSKILL-TEACHES", "Lien teaches validé manquant.");
    if (o.type === "skill" && !contribuees.has(o.id)) signaler(entree, "S4-SKILL-CONTRIBUTES", "Lien contributesTo validé manquant.");
  }
}

export function verifierIntegrite(entrees, historique, signaler) {
  const index = new Map();
  for (const entree of entrees) {
    if (index.has(entree.objet.id)) signaler(entree, "S4-ID-DOUBLON", "Identifiant canonique en double.");
    else index.set(entree.objet.id, entree);
  }
  if (historique !== null) verifierRevisions(index, historique, signaler);
  verifierReferences(index, historique, signaler);
  const remplacements = [...index.values()].filter(e => index.has(e.objet.replacedBy))
    .map(entree => ({ source: entree.objet.id, cible: entree.objet.replacedBy, entree }));
  verifierCycles(remplacements, "S4-REMPLACEMENT-CYCLE", "ERROR", signaler);
  verifierRelations(index, verifierPlacements(index, signaler), signaler);
}
