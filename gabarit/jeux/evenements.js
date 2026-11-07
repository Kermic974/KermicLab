// Contrat d'événements pédagogiques v1 (ADR 0025) : une page autonome n'a pas de réseau (connect-src 'none').
// Elle signale ce qui se passe à la page qui l'affiche (tableau de bord), par postMessage, après une poignée de main :
//   page → parent  { type: "kermiclab:evenements:pret", v: 1, notion }            (identifiant seul, origine inconnue)
//   parent → page  { type: "kermiclab:evenements:ecouter", v: 1, notion }        (fixe l'origine du parent)
//   page → parent  { type: "kermiclab:evenement", v: 1, notion, version, evenement, … }   vers cette origine seulement
// Événements : demarre | indice (exercice, rang) | reponse (exercice, correct, essai) | termine.
// Jamais de texte saisi par l'élève, ni d'horodatage précis : le parent date à la journée.
const Evenements = (() => {
  const VERSION_CONTRAT = 1;
  const TYPES = ["demarre", "indice", "reponse", "termine"];
  const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
  const MAX_FILE = 50;
  const isole = window.parent === window;
  const meta = JSON.parse(document.getElementById("kermiclab-meta").textContent);
  const notion = meta.id;
  const file = [];
  let origineParent = null;
  let demarre = false;
  let termine = false;

  const entier = (v, max) => Number.isInteger(v) && v >= 1 && v <= max;
  /** Construit un événement conforme au schéma v1, ou null : un événement invalide n'est jamais envoyé. */
  function construire(evenement, donnees = {}) {
    if (!TYPES.includes(evenement)) return null;
    const ev = { type: "kermiclab:evenement", v: VERSION_CONTRAT, notion, version: meta.version, evenement };
    if (evenement === "indice" || evenement === "reponse") {
      if (!ID.test(String(donnees.exercice ?? ""))) return null;
      ev.exercice = donnees.exercice;
    }
    if (evenement === "indice") {
      if (!entier(donnees.rang, 10)) return null;
      ev.rang = donnees.rang;
    }
    if (evenement === "reponse") {
      if (typeof donnees.correct !== "boolean" || !entier(donnees.essai, 99)) return null;
      ev.correct = donnees.correct;
      ev.essai = donnees.essai;
    }
    return ev;
  }

  function envoyer(ev) {
    if (origineParent) window.parent.postMessage(ev, origineParent);
    else if (file.length < MAX_FILE) file.push(ev);
  }

  /** Émet un événement ; « demarre » et « termine » ne sont émis qu'une fois par ouverture de la page. */
  function emettre(evenement, donnees) {
    if (isole) return;
    if (evenement === "demarre") { if (demarre) return; demarre = true; }
    if (evenement === "termine") { if (termine) return; termine = true; }
    const ev = construire(evenement, donnees);
    if (ev) envoyer(ev);
  }

  if (!isole) {
    const estOrigineValide = (o) => {
      try {
        const u = new URL(o);
        return ["https:", "http:"].includes(u.protocol) && u.origin === o;
      } catch {
        return false;
      }
    };

    const originesAutorisees = new Set();
    if (estOrigineValide(meta.parentOrigin)) originesAutorisees.add(meta.parentOrigin);
    if (Array.isArray(meta.allowedParentOrigins)) {
      for (const o of meta.allowedParentOrigins) {
        if (estOrigineValide(o)) originesAutorisees.add(o);
      }
    }

    if (originesAutorisees.size > 0) {
      window.addEventListener("message", (e) => {
        if (e.source !== window.parent || e.data?.type !== "kermiclab:evenements:ecouter" || e.data.v !== VERSION_CONTRAT ||
            e.data.notion !== notion || origineParent) return;
        let origine;
        try { origine = new URL(e.origin); } catch { return; }
        if (!["https:", "http:"].includes(origine.protocol) || origine.origin !== e.origin ||
            !originesAutorisees.has(e.origin)) return;
        origineParent = e.origin;
        for (const ev of file.splice(0)) window.parent.postMessage(ev, origineParent);
      });
      window.parent.postMessage({ type: "kermiclab:evenements:pret", v: VERSION_CONTRAT, notion }, [...originesAutorisees][0]);
    }
  }

  return Object.freeze({ emettre, construire, VERSION_CONTRAT });
})();
