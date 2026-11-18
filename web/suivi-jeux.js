// Faits de tentatives bornés, sans réponse ni texte libre. Stockés dans l'enveloppe événements existante.
import { jeuConnu, JEUX } from "./contrat-jeux.js";
export const VERSION = 2;
const objet = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const ID = /^[a-z0-9][a-z0-9/-]{0,79}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const SEMVER = /^\d{1,6}\.\d{1,6}\.\d{1,6}$/;
export const jourValide = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const entier = (v, max = 1e6) => Number.isInteger(v) && v >= 0 && v <= max;
const champs = ["type", "v", "notion", "version", "evenement", "tentative", "activite", "mode", "sequence"];
const extras = { demarre: [], interaction: [], reponse: ["correct"], indice: [], termine: ["resultat"], efface: [] };
export function normaliserEvenementJeu(b, attendu) {
  if (!objet(b) || b.type !== "kermiclab:evenement" || b.v !== VERSION || b.notion !== attendu || !jeuConnu(attendu) ||
      typeof b.version !== "string" || !SEMVER.test(b.version) || typeof b.evenement !== "string" || !Object.hasOwn(extras, b.evenement) || typeof b.tentative !== "string" || !UUID.test(b.tentative) ||
      typeof b.activite !== "string" || !ID.test(b.activite) || !JEUX[attendu].activites.includes(b.mode) || !entier(b.sequence, 100000) ||
      Object.keys(b).some((k) => !champs.includes(k) && !extras[b.evenement].includes(k))) return null;
  if (b.evenement === "reponse" && typeof b.correct !== "boolean") return null;
  if (b.evenement === "termine" && !["reussite", "echec", "abandon", "neutre"].includes(b.resultat)) return null;
  return Object.fromEntries([...champs, ...extras[b.evenement]].map((k) => [k, b[k]]));
}
// 64 dernières tentatives par jeu ; agrégats et détail portent toujours sur cette même fenêtre explicite.
export function enregistrerJeu(jeux, ev, jour) {
  const suivant = normaliserSuivi(jeux);
  if (!jourValide(jour)) return suivant;
  if (ev.evenement === "efface") { delete suivant[ev.notion]; return suivant; }
  const n = suivant[ev.notion] ??= { tentatives: [] };
  let t = n.tentatives.find((x) => x.id === ev.tentative);
  if (!t) {
    if (ev.evenement !== "demarre" || ev.sequence !== 0) return suivant;
    t = { id: ev.tentative, version: ev.version, activite: ev.activite, mode: ev.mode, jour,
      jours: [jour], sequence: -1, reponses: 0, erreurs: 0, indices: 0, resultat: null };
    n.tentatives.push(t);
    n.tentatives = n.tentatives.slice(-64);
  }
  if (t.resultat !== null || t.version !== ev.version || t.activite !== ev.activite || t.mode !== ev.mode ||
      ev.sequence !== t.sequence + 1) return suivant;
  if (ev.evenement === "demarre" && t.sequence !== -1) return suivant;
  t.sequence = ev.sequence;
  if (!t.jours.includes(jour)) t.jours = [...t.jours, jour].sort().slice(-7);
  if (ev.evenement === "reponse") { t.reponses++; if (!ev.correct) t.erreurs++; }
  if (ev.evenement === "indice") t.indices++;
  if (ev.evenement === "termine") t.resultat = ev.resultat;
  return suivant;
}
export function normaliserSuivi(brut) {
  const resultat = {};
  if (!objet(brut)) return resultat;
  for (const [id, n] of Object.entries(brut)) {
    if (!jeuConnu(id) || !Array.isArray(n?.tentatives)) continue;
    const vus = new Set();
    const tentatives = n.tentatives.slice(-64).filter((t) => objet(t) && typeof t.id === "string" && UUID.test(t.id) && !vus.has(t.id) &&
      typeof t.version === "string" && SEMVER.test(t.version) && typeof t.activite === "string" && ID.test(t.activite) && JEUX[id].activites.includes(t.mode) && jourValide(t.jour) &&
      entier(t.sequence, 100000) && entier(t.reponses, 100000) && entier(t.erreurs, t.reponses) && entier(t.indices, 100000) &&
      [null, "reussite", "echec", "abandon", "neutre"].includes(t.resultat) && !!vus.add(t.id))
      .map((t) => ({
        ...Object.fromEntries(["id", "version", "activite", "mode", "jour", "sequence", "reponses", "erreurs", "indices", "resultat"].map((k) => [k, t[k]])),
        jours: [...new Set((Array.isArray(t.jours) ? t.jours : [t.jour]).filter(jourValide))].sort().slice(-7)
      }));
    if (tentatives.length) resultat[id] = { tentatives };
  }
  return resultat;
}
export function interrompreJeu(jeux, id) {
  const suivant = normaliserSuivi(jeux);
  for (const t of suivant[id]?.tentatives ?? []) if (t.resultat === null) t.resultat = "abandon";
  return suivant;
}
export function indicateursJeu(n, jour, { version, mode, activite } = {}) {
  const ts = (n?.tentatives ?? []).filter((t) => (!version || t.version === version) && (!mode || t.mode === mode) && (!activite || t.activite === activite));
  const terminees = ts.filter((t) => t.resultat !== null && t.resultat !== "abandon");
  const evaluables = terminees.filter((t) => ["reussite", "echec"].includes(t.resultat));
  const reussies = evaluables.filter((t) => t.resultat === "reussite");
  const autonomie = reussies.filter((t) => t.mode !== "partie" || ["sudoku", "mots-croises", "mots-fleches", "pendu"].includes(n?.jeu));
  const jours = new Set(ts.flatMap((t) => t.jours ?? [t.jour]).filter((j) => { const age = (Date.parse(jour) - Date.parse(j)) / 86400000; return age >= 0 && age < 7; }));
  return { commencees: ts.length, terminees: terminees.length, evaluables: evaluables.length, reussies: reussies.length,
    abandons: ts.filter((t) => t.resultat === "abandon").length, enCours: ts.filter((t) => t.resultat === null).length,
    autonomieEvaluables: autonomie.length, autonomes: autonomie.filter((t) => !t.erreurs && !t.indices).length,
    avecAide: reussies.filter((t) => t.indices > 0).length, joursActifs: jours.size,
    revisions: ts.filter((t) => t.mode === "revision" && t.resultat !== null && t.resultat !== "abandon").length,
    revisionsReussies: reussies.filter((t) => t.mode === "revision" && !t.erreurs && !t.indices).length };
}
// Validation commune navigateur/serveur : aucun identifiant de tentative, réponse ou cible fournie par le client.
export function normaliserBilanJeux(brut) {
  if (!objet(brut) || brut.v !== 1 || !jourValide(brut.jour) || !objet(brut.jeux)) return null;
  const jeux = {};
  for (const [id, b] of Object.entries(brut.jeux)) {
    if (!jeuConnu(id) || !objet(b) || typeof b.version !== "string" || !SEMVER.test(b.version)) continue;
    const cles = Object.keys(indicateursJeu(null, brut.jour));
    if (cles.some((c) => !entier(b[c], c === "joursActifs" ? 7 : 64)) ||
        b.terminees + b.abandons + b.enCours !== b.commencees || b.evaluables > b.terminees || b.reussies > b.evaluables ||
        b.autonomes > b.autonomieEvaluables || b.autonomieEvaluables > b.reussies || b.avecAide > b.reussies || b.revisions > b.terminees || b.revisionsReussies > b.revisions ||
        !entier(b.tempsMin, 1e7)) continue;
    jeux[id] = { version: b.version, ...Object.fromEntries(cles.map((c) => [c, b[c]])), tempsMin: b.tempsMin };
    if (entier(b.acquis, 1000) && entier(b.total, 1000) && b.acquis <= b.total) Object.assign(jeux[id], { acquis: b.acquis, total: b.total });
  }
  return { v: 1, jour: brut.jour, jeux };
}
export function construireBilanJeux(suivi, jour, progression, trophees) {
  const jeux = {};
  for (const [id, n] of Object.entries(normaliserSuivi(suivi))) {
    const version = n.tentatives.at(-1).version;
    const m = trophees?.[id];
    jeux[id] = { version, ...indicateursJeu({ ...n, jeu: id }, jour, { version }),
      tempsMin: Math.floor((progression?.tempsActif?.experiences?.[`jeu:${id}`] ?? 0) / 60000) };
    if (m?.leconsTotal > 0) Object.assign(jeux[id], { acquis: m.lecons, total: m.leconsTotal });
    else if (m?.gradesTotal > 0) Object.assign(jeux[id], { acquis: m.grades, total: m.gradesTotal });
  }
  return normaliserBilanJeux({ v: 1, jour, jeux });
}
