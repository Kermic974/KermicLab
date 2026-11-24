import { isDeepStrictEqual } from "node:util";

const activites = ["explanation", "example", "exercise", "quiz", "visualization", "manipulation", "deepening-resource"];
const compositions = new Map([
  ["explanation", ["example", "visualization", "manipulation", "deepening-resource"]],
  ["quiz", ["exercise"]], ["guided-activity", activites], ["lab", [...activites, "mission"]],
  ["mission", activites], ["manipulation", ["visualization"]], ["remediation", activites]
]);
const transitions = new Set(["draft:review", "review:draft", "review:validated", "validated:deprecated"]);
const axes = new Set(["language", "reading", "duration", "presentation", "navigation", "response"]);
const valeurs = {
  reading: ["standard", "simplified"], duration: ["short", "standard", "extended"],
  presentation: ["standard", "text"], navigation: ["standard", "keyboard"], response: ["standard", "keyboard"]
};

export function contexteValide(contexte) {
  return contexte !== null && typeof contexte === "object" && !Array.isArray(contexte) &&
    Object.entries(contexte).every(([axe, valeur]) => axes.has(axe) && typeof valeur === "string" &&
      (axe === "language" ? /^[a-z]{2}(?:-[A-Z]{2})?(?![\s\S])/.test(valeur) : valeurs[axe].includes(valeur)));
}

export function choisirVariante(base, variantes, contexte) {
  if (contexte === undefined || contexte === null) return base;
  if (!contexteValide(contexte)) throw new Error("Contexte éditorial invalide.");
  const candidates = variantes.filter(v => v.variantOf?.id === base.id && v.variantOf.version === base.version &&
    v.status !== "deprecated" && Object.entries(v.applicability).every(([axe, valeur]) => contexte[axe] === valeur));
  if (!candidates.length) return base;
  const maximum = Math.max(...candidates.map(v => v.priority));
  const premieres = candidates.filter(v => v.priority === maximum);
  if (premieres.length !== 1) throw new Error("Conflit de variantes de priorité maximale.");
  return premieres[0];
}

export function canonique(valeur) {
  if (Array.isArray(valeur)) return valeur.map(canonique);
  if (valeur !== null && typeof valeur === "object") return Object.fromEntries(Object.keys(valeur).sort().map(cle => [cle, canonique(valeur[cle])]));
  return valeur;
}

export function verifierIntegriteExperiences(entrees, cibles, historique, signaler) {
  const index = new Map();
  for (const entree of entrees) {
    if (index.has(entree.objet.id)) signaler(entree, "S6-ID-DOUBLON", "Identifiant d’expérience dupliqué.");
    else index.set(entree.objet.id, entree);
  }
  for (const entree of entrees) {
    const o = entree.objet;
    for (const id of o.targets) {
      const cible = cibles.get(id);
      if (!cible || !["notion", "microskill", "skill"].includes(cible.type) || cible.status === "deprecated" ||
          (o.status === "validated" && cible.status !== "validated")) {
        signaler(entree, "S6-TARGET", "Cible canonique absente, dépréciée ou incompatible avec le statut.");
      }
    }
    for (const reference of [...(o.components || []), ...(o.variantOf ? [o.variantOf] : [])]) {
      const cible = index.get(reference.id)?.objet;
      if (!cible || cible.version !== reference.version || cible.status === "deprecated") {
        signaler(entree, "S6-REFERENCE", "Expérience référencée absente, périmée ou dépréciée.");
      }
    }
    const ids = (o.components || []).map(r => r.id);
    if (new Set(ids).size !== ids.length || ids.some(id => {
      const cible = index.get(id)?.objet;
      return cible && !(compositions.get(o.type) || []).includes(cible.type);
    })) signaler(entree, "S6-COMPOSITION", "Composition incompatible ou enfant répété.");
    if (o.variantOf) {
      const base = index.get(o.variantOf.id)?.objet;
      if (base && (base.variantOf || base.type !== o.type || base.objective !== o.objective ||
          !isDeepStrictEqual([...base.targets].sort(), [...o.targets].sort()))) {
        signaler(entree, "S6-VARIANT-INVARIANT", "Une variante doit conserver le type, l’objectif et les cibles d’une base directe.");
      }
    }
    const revue = entree.revueValide === true;
    if (!revue) signaler(entree, o.status === "validated" ? "S6-EVIDENCE-VALIDATED" : "S6-EVIDENCE-REVIEW",
      "Revue humaine de cette version non attestée.", o.status === "validated" ? "ERROR" : "WARNING");
    if (!entree.accessibiliteValide) signaler(entree, o.status === "validated" ? "S6-ACCESS-VALIDATED" : "S6-ACCESS-REVIEW",
      "Alternatives ou revue d’accessibilité à compléter.", o.status === "validated" ? "ERROR" : "WARNING");
  }

  // Détection itérative : ne dépend pas de la profondeur du graphe ni de l’ordre des fichiers.
  const termines = new Set();
  for (const id of index.keys()) {
    if (termines.has(id)) continue;
    const actifs = new Set();
    const pile = [[id, false]];
    while (pile.length) {
      const [courant, sortie] = pile.pop();
      if (sortie) { actifs.delete(courant); termines.add(courant); continue; }
      if (actifs.has(courant)) { signaler(index.get(courant), "S6-CYCLE", "Cycle de composition ou de variante."); continue; }
      if (termines.has(courant) || !index.has(courant)) continue;
      actifs.add(courant);
      pile.push([courant, true]);
      const o = index.get(courant).objet;
      for (const r of [...(o.components || []), ...(o.variantOf ? [o.variantOf] : [])]) pile.push([r.id, false]);
    }
  }
  for (const base of entrees.filter(e => !e.objet.variantOf)) {
    const variantes = entrees.map(e => e.objet).filter(o => o.variantOf?.id === base.objet.id && o.status !== "deprecated");
    for (let i = 0; i < variantes.length; i++) for (let j = i + 1; j < variantes.length; j++) {
      const a = variantes[i], b = variantes[j];
      if (a.priority !== b.priority || Object.entries(a.applicability).some(([cle, v]) =>
        Object.hasOwn(b.applicability, cle) && b.applicability[cle] !== v)) continue;
      try { choisirVariante(base.objet, variantes, { ...a.applicability, ...b.applicability }); }
      catch { signaler(base, "S6-VARIANT-CONFLICT", "Plusieurs variantes applicables ont la même priorité maximale."); }
    }
  }
  if (historique !== null) verifierHistoriqueExperiences(index, historique, signaler);
}

export function verifierHistoriqueExperiences(index, historique, signaler) {
  const vus = new Map();
  let precedent = new Map();
  const courant = new Map([...index].map(([id, entree]) => [id, { objet: entree.objet, signature: entree.signature }]));
  for (const etat of [...historique, courant]) {
    for (const [id, revision] of etat) {
      const o = revision.objet;
      const ancien = vus.get(id);
      const entree = index.get(id);
      if (entree) {
        if (!ancien && o.status !== "draft" && !(o.status === "review" && o.provenance.type === "legacy-v0")) {
          signaler(entree, "S6-TRANSITION", "Une création commence en draft ou une migration identifiée en review.");
        }
        if (ancien) {
          if (!precedent.has(id) || ancien.objet.type !== o.type) signaler(entree, "S6-ID-REUTILISE", "ID réutilisé après suppression ou changement de type.");
          const modifie = !isDeepStrictEqual(canonique(ancien.objet), canonique(o)) || ancien.signature !== revision.signature;
          if (o.version < ancien.objet.version || (modifie && o.version <= ancien.objet.version)) {
            signaler(entree, "S6-REVISION", "La définition ou sa source effective modifiée exige une version supérieure.");
          }
          if (ancien.objet.status !== o.status && !transitions.has(ancien.objet.status + ":" + o.status)) signaler(entree, "S6-TRANSITION", "Transition de statut interdite.");
        }
      }
      vus.set(id, revision);
    }
    precedent = etat;
  }
}
