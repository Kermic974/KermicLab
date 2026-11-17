// Interface Kermiclab : tableau de bord élève avec un chat flottant.
// Aucun texte en dur : tout vient de i18n/<langue>.json. Toutes les données affichées viennent de la session en cours
// (pseudo, progression) : rien n'est envoyé à Kermiclab (ADR 0012).
import * as progression from "./progression.js";
import * as profil from "./profil.js";
import * as comptes from "./comptes.js";
import * as compteLocal from "./compte-local.js";
import * as familleModule from "./famille.js";
import * as demoFamille from "./demo-famille.js";
import * as professeur from "./professeur.js";
import * as demoProf from "./demo-professeur.js";
import * as contributions from "./contributions.js";
import * as demoContrib from "./demo-contributions.js";
import { monterCercle } from "./cercle.js";
import * as trophees from "./trophees.js";
import * as evenements from "./evenements.js";
import * as recommandation from "./recommandation.js";
import * as fichierProgression from "./fichier-progression.js";
import * as vacances from "./cahier-vacances.js";
// Module partagé des jeux (boîtes de Leitner, ADR 0015), produit par le build depuis gabarit/jeux/progression.js.
import { ProgressionJeux } from "./progression-jeux.js";
import * as experiences from "./experiences.js";
import { creerMoteurTemps } from "./temps-actif.js";
import * as charte from "./theme.js";
import * as parcours from "./parcours.js";

const $ = (s) => document.querySelector(s);
const etat = {
  config: null, langue: "fr", textes: {}, envoiEnCours: false, progres: null, suggestions: [], notions: [],
  notionCourante: null, compte: null, enfants: [], familleChargee: false, familleErreur: false,
  memoire: false, pseudo: null, reprise: false, cercle: null, trophees: {},
  ecran: "accueil", registre: experiences.creerRegistre([]), ouverts: new Set(), moteur: null, llmActif: false, llmDisponible: false,
  defiIa: { ia: false, generationsParJour: 0, restantesServeur: null },
  cahiersIa: { ia: false, generationsParJour: 0, restantesServeur: null, modele: "" },
  // Configuration centralisée exposée par le Worker (/api/llm/status, ADR 0019) et skills actifs.
  configurationServeur: null, skills: {}
};
const NIVEAUX = ["college", "seconde", "premiere", "terminale", "autres"];
const MATIERES = ["mathematiques", "physique-chimie", "svt", "histoire", "geographie", "emc", "philosophie", "francais", "ses", "jeux"];
const CLE_MATIERE = "kermiclab:matiere";
const CLE_CLASSE = "kermiclab:classe";
const CLE_THEME = "kermiclab:theme";
const CLE_CAHIERS = "kermiclab:cahiers";
const TYPES_CAHIERS = ["brouillon", "fiches", "vacances", "exercices"];
const CLE_LLM = "kermiclab:llm:actif";
const DEFI_BONNES = [1, 0, 1, 0, 0];
const CLE_DEFI_IA = "kermiclab:defi:ia-par-jour";
const CLE_DEFI_COMPTE = "kermiclab:defi:ia-generations";
const MAX_PUCES = 4;
const TAILLE_MAX_PUCE = 120;
const mouvementReduit = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Stockage des données de l'élève : local si le cookie de mémorisation existe, sinon limité à la session (onglet). */
function stockage() {
  try { return etat.memoire ? window.localStorage : window.sessionStorage; } catch { return null; }
}
function sessionPreferences() {
  try { return window.sessionStorage; } catch { return null; }
}
/** Préférences d'affichage (langue, thème, matière) : sans donnée personnelle, gardées sur l'appareil. */
function preferences() {
  try { return window.localStorage; } catch { return null; }
}
const lireCle = (zone, cle) => { try { return zone?.getItem(cle) ?? null; } catch { return null; } };
const ecrireCle = (zone, cle, valeur) => { try { zone?.setItem(cle, valeur); } catch { /* stockage indisponible */ } };
const effacerCle = (zone, cle) => { try { zone?.removeItem(cle); } catch { /* stockage indisponible */ } };
const cookieSecurise = () => location.protocol === "https:";

async function chargerJson(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}

/** Texte traduit, avec remplacement des variables {n}, {m}, {nom}… */
function t(cle, variables = {}) {
  const brut = etat.textes[cle] ?? cle;
  return brut.replace(/\{(\w+)\}/g, (tout, nom) => (nom in variables ? String(variables[nom]) : tout));
}

function lirePreference() {
  return lireCle(preferences(), "kermiclab:langue");
}
function ecrirePreference(l) {
  ecrireCle(preferences(), "kermiclab:langue", l);
}

function langueInitiale(langues) {
  const pref = lirePreference();
  if (pref && langues.includes(pref)) return pref;
  for (const l of navigator.languages ?? [navigator.language]) {
    const court = String(l).slice(0, 2).toLowerCase();
    if (langues.includes(court)) return court;
  }
  return "fr";
}

async function appliquerLangue(langue) {
  etat.langue = langue;
  etat.textes = await chargerJson(`i18n/${langue}.json`);
  document.documentElement.lang = langue;
  document.querySelectorAll("[data-i18n]").forEach((n) => { n.textContent = etat.textes[n.dataset.i18n] ?? n.dataset.i18n; });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((n) => { n.placeholder = etat.textes[n.dataset.i18nPlaceholder] ?? ""; });
  document.querySelectorAll("[data-i18n-title]").forEach((n) => { n.title = etat.textes[n.dataset.i18nTitle] ?? ""; });
  document.querySelectorAll("[data-i18n-aria]").forEach((n) => { n.setAttribute("aria-label", etat.textes[n.dataset.i18nAria] ?? ""); });
  document.title = etat.textes.titre;
  await chargerSuggestions();
  rafraichirBienvenue();
  rafraichirPastille();
  rendreCatalogue();
  rendreJeux();
  rafraichirEntete();
  rafraichirTheme();
  rafraichirControleLlm();
  etat.cercle?.rafraichir();
  if (etat.ecran === "progression") rendreProgression();
  rafraichirDefiTextes();
  rafraichirFamille();
  rafraichirCompte();
  rafraichirContributions();
  rendreCahiers();
}

/* ---------- Comptes famille (ADR 0017) ---------- */
// Profil local par défaut. Un compte parent (OAuth) est nécessaire pour créer un profil enfant ; rien n'est appelé
// côté Worker tant que `connexionActive` vaut false.

// Démonstration (« green card ») : `?demo=famille` simule le compte parent et les profils enfants dans le navigateur,
// sans OAuth ni appel au Worker, pour valider les écrans. Un bandeau la signale ; elle s'arrête en un clic.
const CLE_DEMO_ACTIVE = "kermiclab:demo-famille:active";
const demoActive = () => etat.demoFamille === true;
const connexionActive = () => demoActive() || etat.config?.connexionActive === true;
const urlApi = (chemin) => `${etat.config.apiUrl}${chemin}`;

function sauverDemo(suivant) {
  etat.demo = suivant;
  ecrireCle(sessionPreferences(), demoFamille.CLE_DEMO, JSON.stringify(suivant));
}

function initialiserDemo() {
  const demandee = new URLSearchParams(location.search).get("demo") === demoFamille.PARAMETRE_DEMO;
  if (demandee) ecrireCle(sessionPreferences(), CLE_DEMO_ACTIVE, "1");
  etat.demoFamille = demandee || lireCle(sessionPreferences(), CLE_DEMO_ACTIVE) === "1";
  if (etat.demoFamille) etat.demo = demoFamille.lireEtat(lireCle(sessionPreferences(), demoFamille.CLE_DEMO));
  $("#bandeau-demo").hidden = !etat.demoFamille;
}

function demarrerDemo() {
  ecrireCle(sessionPreferences(), CLE_DEMO_ACTIVE, "1");
  const url = new URL(location.href);
  url.searchParams.set("demo", demoFamille.PARAMETRE_DEMO);
  url.hash = "famille";
  location.assign(url.href);
}

function quitterDemo() {
  for (const cle of [CLE_DEMO_ACTIVE, demoFamille.CLE_DEMO, CLE_DEMO_CONTRIB_ACTIVE, demoContrib.CLE_DEMO, demoProf.CLE_DEMO]) effacerCle(sessionPreferences(), cle);
  if (lireCle(stockage(), comptes.CLE_ENFANT_ACTIF)?.startsWith("demo-")) effacerCle(stockage(), comptes.CLE_ENFANT_ACTIF);
  const url = new URL(location.href);
  url.searchParams.delete("demo");
  url.hash = "";
  location.assign(url.href);
}

/** Accès aux comptes : le Worker, ou le double de démonstration (mêmes formes de réponse). */
const apiFamille = {
  async moi() {
    if (demoActive()) return demoFamille.moi(etat.demo);
    const r = await fetch(urlApi("/auth/me"), { credentials: "include" });
    return r.ok ? r.json() : null;
  },
  async eleves() {
    if (demoActive()) return demoFamille.eleves(etat.demo);
    const r = await fetch(urlApi("/api/eleves"), { credentials: "include" });
    if (!r.ok) throw new Error(`eleves ${r.status}`);
    return r.json();
  },
  async creer(enfant) {
    if (demoActive()) { const { etat: suivant, id } = demoFamille.creerEleve(etat.demo, enfant); sauverDemo(suivant); return id; }
    const r = await fetch(urlApi("/api/eleves"), {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(enfant)
    });
    if (!r.ok) throw new Error(`creation ${r.status}`);
    return (await r.json()).id;
  },
  async supprimer(id) {
    if (demoActive()) { sauverDemo(demoFamille.supprimerEleve(etat.demo, id)); return; }
    const r = await fetch(urlApi(`/api/eleves/${encodeURIComponent(id)}`), { method: "DELETE", credentials: "include" });
    if (!r.ok) throw new Error(`suppression ${r.status}`);
  },
  async progres(id) {
    if (demoActive()) return demoFamille.lireProgres(etat.demo, id);
    const r = await fetch(urlApi(`/api/progres?eleveId=${encodeURIComponent(id)}`), { credentials: "include" });
    return r.ok ? r.json() : null;
  },
  async sauverProgres(id, progres) {
    if (demoActive()) { sauverDemo(demoFamille.sauverProgres(etat.demo, id, progres)); return; }
    await fetch(urlApi("/api/progres"), {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ eleveId: id, progres })
    });
  },
  async deconnecter() {
    if (demoActive()) { sauverDemo(demoFamille.deconnecter(etat.demo)); return; }
    await fetch(urlApi("/auth/logout"), { method: "POST", credentials: "include" });
  }
};

/** La démonstration reste locale ; les fournisseurs réels sont en préparation. */
async function connecterParent(fournisseur) {
  if (demoActive()) {
    sauverDemo(demoFamille.connecter(etat.demo, fournisseur));
    await verifierConnexion();
    notifier(t("demoConnecte"), "🟢");
    return;
  }
  naviguer("connexion-en-cours");
}

function modeFamille() {
  return comptes.modeCompte({
    connexionActive: connexionActive(), compte: etat.compte, enfants: etat.enfants,
    enfantActifId: lireCle(stockage(), comptes.CLE_ENFANT_ACTIF)
  });
}

async function verifierConnexion() {
  if (!connexionActive()) return;
  etat.familleChargee = false;
  try {
    const data = await apiFamille.moi();
    etat.compte = data?.connecte ? data.compte : null;
    if (etat.compte) await chargerEnfants();
    etat.familleErreur = false;
  } catch {
    etat.compte = null;
    etat.familleErreur = true;
  }
  etat.familleChargee = true;
  rafraichirFamille();
  const actif = comptes.enfantActif(etat.enfants, lireCle(stockage(), comptes.CLE_ENFANT_ACTIF));
  if (actif) await chargerProgressionDistante(actif.id);
}

async function chargerEnfants() {
  etat.enfants = comptes.normaliserEnfants(await apiFamille.eleves());
}

function rafraichirFamille() {
  const actif = connexionActive();
  $("#entree-famille").hidden = !actif;
  $("#type-profil").hidden = !actif;
  // Lien vers le back-office : seulement si le Worker dit que le rôle du compte connecté a une permission
  // d'administration. Les comptes de démonstration ne l'ont jamais. Le lien n'ouvre aucun droit (clé demandée).
  $("#entree-backoffice").hidden = !(actif && !demoActive() && etat.compte?.backOffice === true);
  if (!actif) return;
  const mode = modeFamille();
  const enfant = comptes.enfantActif(etat.enfants, lireCle(stockage(), comptes.CLE_ENFANT_ACTIF));
  $("#type-profil-nom").textContent = t(comptes.cleTypeProfil(mode), { prenom: enfant?.prenom_affiche ?? "" });
  $("#type-profil-aide").textContent = t(comptes.cleAideProfil(mode));
  $("#famille-etat").textContent = !etat.familleChargee ? t("familleChargement") : etat.familleErreur ? t("familleErreur") : "";
  $("#famille-invite").hidden = !etat.familleChargee || mode !== "local";
  $("#essayer-demo").hidden = demoActive();
  $("#famille-demo-note").hidden = !demoActive();
  $("#famille-parent").hidden = mode !== "parent";
  $("#famille-enfant").hidden = mode !== "enfant";
  if (mode === "enfant") $("#famille-enfant-texte").textContent = t("familleModeEnfant", { prenom: enfant.prenom_affiche });
  if (mode === "parent") rendreEnfants();
}

function rendreEnfants() {
  const liste = $("#famille-enfants");
  liste.replaceChildren(...etat.enfants.map((e) => {
    const li = element("li", { classe: "famille-enfant" });
    const nom = element("span", { classe: "famille-enfant-nom" });
    nom.append(element("strong", { texte: e.prenom_affiche }));
    if (e.age_tranche) nom.append(element("span", { classe: "doux petit", cle: `tranche_${e.age_tranche}` }));
    const utiliser = element("button", { classe: "bouton", cle: "enfantUtiliser", attributs: { type: "button" } });
    utiliser.addEventListener("click", () => utiliserEnfant(e));
    const supprimer = element("button", { classe: "danger", cle: "enfantSupprimer", attributs: { type: "button" } });
    supprimer.addEventListener("click", () => supprimerEnfant(e, supprimer));
    li.append(nom, utiliser, supprimer);
    return li;
  }));
  $("#famille-vide").hidden = etat.enfants.length > 0;
  const plein = etat.enfants.length >= comptes.MAX_ENFANTS;
  $("#famille-ajout").hidden = plein;
  $("#famille-etat").textContent = plein ? t("familleQuota", { n: comptes.MAX_ENFANTS }) : $("#famille-etat").textContent;
  const local = etat.progres && (etat.progres.questions > 0 || Object.keys(etat.progres.notions ?? {}).length > 0);
  $("#enfant-reprise-ligne").hidden = !local;
  $("#enfant-reprise-texte").textContent = t("enfantReprise", { pseudo: etat.pseudo ?? t("anonyme") });
}

async function utiliserEnfant(enfant, { reprendre = false } = {}) {
  ecrireCle(stockage(), comptes.CLE_ENFANT_ACTIF, enfant.id);
  if (reprendre) await synchroniserProgression();
  else await chargerProgressionDistante(enfant.id);
  rafraichirFamille();
  notifier(t("familleModeEnfant", { prenom: enfant.prenom_affiche }), "👧");
}

async function supprimerEnfant(enfant, bouton) {
  // Confirmation en deux temps, comme l'effacement des données locales.
  if (bouton.dataset.confirmer !== "1") {
    bouton.dataset.confirmer = "1";
    bouton.textContent = t("enfantSupprimerConfirmer", { prenom: enfant.prenom_affiche });
    return;
  }
  try {
    await apiFamille.supprimer(enfant.id);
    if (lireCle(stockage(), comptes.CLE_ENFANT_ACTIF) === enfant.id) effacerCle(stockage(), comptes.CLE_ENFANT_ACTIF);
    await chargerEnfants();
    rafraichirFamille();
    notifier(t("enfantSupprime"), "🧹");
  } catch {
    $("#famille-etat").textContent = t("familleErreur");
  }
}

function erreursEnfant(erreurs = {}) {
  const prenom = $("#enfant-prenom");
  prenom.setAttribute("aria-invalid", String(!!erreurs.prenom));
  $("#enfant-prenom-erreur").textContent = erreurs.prenom ? messageErreurPseudo(erreurs.prenom) : "";
  $("#enfant-tranche-erreur").textContent = erreurs.tranche ? t("enfantTrancheErreur") : "";
  $("#enfant-consentement-erreur").textContent = erreurs.consentement ? t("consentementErreur") : "";
  $("#enfant-erreur").textContent = erreurs.quota ? t("familleQuota", { n: comptes.MAX_ENFANTS }) : erreurs.reseau ? t("familleErreur") : "";
}

async function creerEnfant(e) {
  e.preventDefault();
  const r = comptes.validerEnfant({
    prenom: $("#enfant-prenom").value,
    tranche: document.querySelector("input[name=enfant-tranche]:checked")?.value,
    consentement: $("#enfant-consentement").checked
  }, etat.enfants.length, profil.validerPseudo);
  erreursEnfant(r.ok ? {} : r.erreurs);
  if (!r.ok) {
    if (r.erreurs.prenom) $("#enfant-prenom").focus();
    return;
  }
  const reprendre = !$("#enfant-reprise-ligne").hidden && $("#enfant-reprise").checked;
  try {
    const id = await apiFamille.creer(r.enfant);
    await chargerEnfants();
    $("#formulaire-enfant").reset();
    $("#famille-ajout").open = false;
    notifier(t("enfantCree", { prenom: r.enfant.prenom_affiche }), "🎉");
    const cree = etat.enfants.find((x) => x.id === id);
    if (reprendre && cree) await utiliserEnfant(cree, { reprendre: true });
    else rafraichirFamille();
  } catch {
    erreursEnfant({ reseau: true });
  }
}

async function chargerProgressionDistante(enfantId) {
  try {
    const lignes = await apiFamille.progres(enfantId);
    if (!Array.isArray(lignes)) return;
    // Fusion sans perte : les notions distantes s'ajoutent aux notions locales (et à leurs découvertes), jamais l'inverse.
    etat.progres = progression.fusionnerNotionsDistantes(etat.progres, lignes.map((l) => l?.notion_id));
    progression.sauver(stockage(), etat.progres);
    rafraichirPastille();
  } catch { /* hors ligne : la progression locale reste utilisable */ }
}

async function synchroniserProgression() {
  const enfant = comptes.enfantActif(etat.enfants, lireCle(stockage(), comptes.CLE_ENFANT_ACTIF));
  if (!connexionActive() || !etat.compte || !enfant || !etat.progres) return;
  try {
    // L'API attend { notions: { idNotion: { score, etoiles } } } (worker/src/comptes.js, lignesProgres) : seules les
    // notions partent ; le temps actif et les découvertes restent sur l'appareil.
    await apiFamille.sauverProgres(enfant.id, progression.pourSynchronisation(etat.progres));
  } catch { /* hors ligne : nouvel essai à la prochaine progression */ }
}

/** Fin de session parent : en mode enfant, revenir à l'Espace famille demande une nouvelle connexion du parent. */
async function deconnecterParent() {
  try { await apiFamille.deconnecter(); } catch { /* session déjà close */ }
  effacerCle(stockage(), comptes.CLE_ENFANT_ACTIF);
  etat.compte = null;
  etat.enfants = [];
  rafraichirFamille();
}

function brancherFamille() {
  if (!connexionActive()) return;
  ECRANS.push("famille");
  $("#connexion-google").addEventListener("click", () => connecterParent("google"));
  $("#connexion-microsoft").addEventListener("click", () => connecterParent("microsoft"));
  $("#essayer-demo").addEventListener("click", demarrerDemo);
  $("#deconnexion").addEventListener("click", deconnecterParent);
  $("#quitter-mode-enfant").addEventListener("click", deconnecterParent);
  $("#formulaire-enfant").addEventListener("submit", creerEnfant);
  $("#ouvrir-famille").addEventListener("click", () => naviguer("famille"));
  rafraichirFamille();
}

/* ---------- Mon compte (ADR 0024) ---------- */
// Compte facultatif : identifiant + mot de passe, enregistré sur l'appareil (vérificateur PBKDF2, jamais le mot de
// passe). La synchronisation, sur demande, envoie un instantané chiffré sous un pseudonyme dérivé d'une phrase secrète
// qui ne quitte pas l'appareil. La liaison du compte au serveur peut aussi être choisie sans synchronisation.
const CLES_SYNCHRONISEES = [profil.CLE_PSEUDO, progression.CLE_STOCKAGE, trophees.CLE_STOCKAGE, CLE_CAHIERS];
const compteEtat = { enregistrement: null, session: null, occupe: false };
const bornesCompte = {
  min: compteLocal.IDENTIFIANT_MIN, max: compteLocal.IDENTIFIANT_MAX
};

function chargerCompte() {
  const e = compteLocal.lireEnregistrement(lireCle(stockage(), compteLocal.CLE_COMPTE));
  compteEtat.enregistrement = e;
  const s = e ? compteLocal.lireSession(lireCle(sessionPreferences(), compteLocal.CLE_SESSION), e.identifiant) : null;
  // Jeton de synchronisation expiré (12 h) : la synchronisation redevient verrouillée.
  if (s?.synchro && !(s.synchro.expire > Date.now() / 1000)) s.synchro = null;
  compteEtat.session = s;
}

function sauverCompte() {
  const { enregistrement: e, session: s } = compteEtat;
  if (e) ecrireCle(stockage(), compteLocal.CLE_COMPTE, JSON.stringify(e));
  else effacerCle(stockage(), compteLocal.CLE_COMPTE);
  if (s) ecrireCle(sessionPreferences(), compteLocal.CLE_SESSION, JSON.stringify(s));
  else effacerCle(sessionPreferences(), compteLocal.CLE_SESSION);
}

async function apiCompte(route, { methode = "POST", corps, jeton } = {}) {
  const r = await fetch(urlApi(`/api/compte-local/${route}`), {
    method: methode, credentials: "omit", cache: "no-store",
    headers: { ...(corps ? { "content-type": "application/json" } : {}), ...(jeton ? { authorization: `Bearer ${jeton}` } : {}) },
    body: corps ? JSON.stringify(corps) : undefined
  });
  let donnees = null;
  try { donnees = await r.json(); } catch { /* réponse vide (204) */ }
  return { statut: r.status, donnees };
}

/** Affiche (ou efface) l'erreur d'un champ : `#id` et son message `#id-erreur`. */
function erreurChamp(id, message, erreurId = `${id}-erreur`) {
  const champ = $(`#${id}`);
  if (message) champ.setAttribute("aria-invalid", "true"); else champ.removeAttribute("aria-invalid");
  $(`#${erreurId}`).textContent = message;
  if (message) champ.focus();
  return !message;
}

function messageSynchro(cle, variables) {
  $("#synchro-message").textContent = cle ? t(cle, variables) : "";
}

function marquerReglesMdp() {
  const mdp = $("#compte-mdp").value;
  const manquants = new Set(compteLocal.validerMotDePasse(mdp).manquants ?? []);
  document.querySelectorAll("#compte-mdp-regles [data-regle]").forEach((li) => {
    const ok = li.dataset.regle === "longueur" ? [...mdp].length >= compteLocal.MOT_DE_PASSE_MIN
      : mdp.length > 0 && !manquants.has(li.dataset.regle);
    li.dataset.ok = String(ok);
  });
}

function rafraichirCompte() {
  const { enregistrement: e, session: s } = compteEtat;
  $("#compte-identifiant-aide").textContent = t("compteIdentifiantAide", bornesCompte);
  $("#compte-mdp-regles [data-regle=longueur]").textContent = t("compteRegleLongueur", { min: compteLocal.MOT_DE_PASSE_MIN });
  $("#synchro-phrase-aide").textContent = t("synchroPhraseAide", { min: compteLocal.PASSPHRASE_MIN });
  $("#compte-memoire").hidden = etat.memoire;
  const lie = e?.serveur === true || !!e?.synchro;
  $("#ouvrir-connexion").dataset.i18n = s ? "compteTitre" : "compteSeConnecter";
  $("#ouvrir-connexion").textContent = t($("#ouvrir-connexion").dataset.i18n);
  $("#compte-options-connexion").hidden = !!s;
  $("#liaison-ouvrir").hidden = lie;
  $("#compte-creation").hidden = !!e;
  $("#compte-connexion").hidden = !e || !!s;
  $("#compte-ouvert").hidden = !e || !s;
  if (e && !s) $("#compte-connexion-texte").textContent = t("compteConnexionTexte", { identifiant: e.identifiant });
  rafraichirFamilleCompte();
  if (!e || !s) return;
  const active = !!e.synchro;
  const deverrouillee = active && !!s.synchro;
  $("#compte-ouvert-texte").textContent = t(lie ? "connexionLiee" : "compteConnecte", { identifiant: e.identifiant });
  $("#synchro-statut").textContent = !active ? t("synchroInactive")
    : !deverrouillee ? t("synchroVerrouillee")
      : t("synchroActive", { version: e.synchro.version, maj: e.synchro.maj ? t("synchroMaj", { date: e.synchro.maj }) : "" });
  $("#synchro-activation").hidden = active;
  $("#synchro-deverrouillage").hidden = !active || deverrouillee;
  $("#synchro-actions").hidden = !deverrouillee;
  $("#compte-suppression-aide").textContent = t(!active ? (lie ? "connexionSuppression" : "compteSuppressionAide") : deverrouillee ? "compteSuppressionAideSynchro" : "compteSuppressionAideVerrouille");
}

/**
 * Vérifie les identifiants côté D1 sans activer le transfert de progression. La session ouverte est gardée pour
 * l'onglet (Espace famille, ADR 0029) : elle ne transporte aucune progression chiffrée.
 * @returns {Promise<{ jeton: string, expire: number } | null>}
 */
async function verifierCompteEnLigne(identifiant, motDePasse, { inscrire, cible }) {
  const statut = $(cible);
  statut.textContent = t("synchroEnCours");
  try {
    const r = await ouvrirSessionServeur(identifiant, motDePasse, { inscrire });
    if (r.donnees?.jeton) {
      statut.textContent = "";
      return { jeton: r.donnees.jeton, expire: r.donnees.expire };
    }
    statut.textContent = t(r.statut === 409 ? "synchroIdentifiantPris" : erreurServeur(r));
  } catch {
    statut.textContent = t("synchroErreur");
  }
  return null;
}

async function creerCompteLocal(ev) {
  ev.preventDefault();
  if (compteEtat.occupe) return;
  const id = compteLocal.validerIdentifiant($("#compte-identifiant").value);
  if (!erreurChamp("compte-identifiant", id.ok ? "" : t(`compteIdentifiantErreur_${id.erreur}`, bornesCompte))) return;
  const mdp = $("#compte-mdp").value;
  const m = compteLocal.validerMotDePasse(mdp, { identifiant: id.identifiant });
  const manquants = (m.manquants ?? []).map((f) => t(`compteFamille_${f}`)).join(", ");
  if (!erreurChamp("compte-mdp", m.ok ? "" : t(`compteMdpErreur_${m.erreur}`, { min: compteLocal.MOT_DE_PASSE_MIN, max: compteLocal.MOT_DE_PASSE_MAX, manquants }))) return;
  if (!erreurChamp("compte-mdp2", $("#compte-mdp2").value === mdp ? "" : t("compteMdpDifferents"))) return;
  compteEtat.occupe = true;
  try {
    const enregistrement = await compteLocal.creerEnregistrement(id.identifiant, mdp);
    let serveur = null;
    if ($("#liaison-creer-d1").checked) {
      serveur = await verifierCompteEnLigne(id.identifiant, mdp, { inscrire: true, cible: "#liaison-creer-etat" });
      if (!serveur) return;
      enregistrement.serveur = true;
    }
    $("#liaison-creer-etat").textContent = "";
    compteEtat.enregistrement = enregistrement;
    compteEtat.session = { identifiant: id.identifiant, synchro: null, serveur };
    sauverCompte();
  } finally {
    compteEtat.occupe = false;
  }
  $("#formulaire-compte-creer").reset();
  marquerReglesMdp();
  rafraichirCompte();
  void chargerFamille();
  notifier(t("compteCree"), "🔐");
}

async function connecterCompteLocal(ev) {
  ev.preventDefault();
  if (compteEtat.occupe) return;
  const e = compteEtat.enregistrement;
  const mdp = $("#compte-connexion-mdp").value;
  if (!erreurChamp("compte-connexion-mdp", mdp ? "" : t("compteMdpRequis"), "compte-connexion-erreur")) return;
  compteEtat.occupe = true;
  try {
    const lie = e.serveur === true || !!e.synchro;
    let serveur = null;
    if (!await compteLocal.verifierMotDePasse(mdp, e)) {
      // Mot de passe changé par le parent (ADR 0029) : le serveur fait foi pour un compte lié ; le vérificateur de
      // l'appareil est alors recalculé (la phrase secrète de synchronisation ne dépend pas du mot de passe).
      serveur = lie ? await verifierCompteEnLigne(e.identifiant, mdp, { inscrire: false, cible: "#liaison-ouvrir-etat" }) : null;
      if (!erreurChamp("compte-connexion-mdp", serveur ? "" : t("compteMdpIncorrect"), "compte-connexion-erreur")) return;
      const nouveau = await compteLocal.creerEnregistrement(e.identifiant, mdp);
      Object.assign(e, { verificateur: nouveau.verificateur, sel: nouveau.sel, iterations: nouveau.iterations });
    } else if (lie || $("#liaison-ouvrir-d1").checked) {
      serveur = await verifierCompteEnLigne(e.identifiant, mdp, { inscrire: !lie, cible: "#liaison-ouvrir-etat" });
      if (!serveur) return;
      e.serveur = true;
    }
    $("#liaison-ouvrir-etat").textContent = "";
    compteEtat.session = { identifiant: e.identifiant, synchro: null, serveur };
    sauverCompte();
  } finally {
    compteEtat.occupe = false;
  }
  $("#formulaire-compte-connexion").reset();
  rafraichirCompte();
  void chargerFamille();
  notifier(t("compteConnecte", { identifiant: e.identifiant }), "🔓");
}

function deconnecterCompteLocal() {
  for (const jeton of new Set([compteEtat.session?.synchro?.jetonServeur, compteEtat.session?.serveur?.jeton].filter(Boolean))) {
    void apiCompte("deconnexion", { jeton }).catch(() => {});
  }
  compteEtat.session = null;
  sauverCompte();
  oublierFamille();
  messageSynchro("");
  rafraichirCompte();
  notifier(t("compteDeconnecte"), "👋");
}

/** Message d'une réponse d'erreur du serveur ; une session expirée reverrouille la synchronisation. */
function erreurServeur({ statut, donnees }) {
  if (statut === 401 && donnees?.erreur === "non-connecte" && compteEtat.session) {
    compteEtat.session.synchro = null;
    sauverCompte();
    rafraichirCompte();
    return "synchroSessionExpiree";
  }
  if (statut === 401) return "synchroIdentifiantsInvalides";
  if (statut === 429) return "synchroTropDeTentatives";
  if (statut === 503) return "synchroIndisponible";
  return "synchroErreur";
}

const jourLocal = () => new Date().toISOString().slice(0, 10);
const preuveSynchro = () => ({ pseudonyme: compteEtat.session.synchro.pseudonyme, jeton: compteEtat.session.synchro.jeton });

/** Envoie l'instantané chiffré ; renvoie la clé du message à afficher. */
async function envoyerInstantane() {
  const { synchro } = compteEtat.session;
  const e = compteEtat.enregistrement;
  sauverSession();
  const instant = compteLocal.instantane((cle) => lireCle(stockage(), cle), CLES_SYNCHRONISEES);
  const boite = await compteLocal.chiffrer(synchro.cle, synchro.pseudonyme, instant);
  const r = await apiCompte("donnees", { methode: "PUT", jeton: synchro.jetonServeur, corps: { ...preuveSynchro(), versionAttendue: e.synchro.version, ...boite } });
  if (r.statut === 200) {
    e.synchro.version = r.donnees.version;
    e.synchro.maj = jourLocal();
    sauverCompte();
    return ["synchroEnvoyees", { version: r.donnees.version }];
  }
  if (r.statut === 409 && Number.isInteger(r.donnees?.version)) {
    // Un autre appareil a écrit : un nouvel envoi remplacera sciemment sa version.
    e.synchro.version = r.donnees.version;
    sauverCompte();
    return ["synchroConflit"];
  }
  return [erreurServeur(r)];
}

/** Connexion au serveur : inscription au premier usage, sinon connexion (même identifiant et mot de passe). */
async function ouvrirSessionServeur(identifiant, motDePasse, { inscrire }) {
  if (inscrire) {
    const r = await apiCompte("inscription", { corps: { identifiant, motDePasse } });
    if (r.statut === 201) return { ...r, nouveau: true };
    if (r.statut !== 409) return r;
  }
  const r = await apiCompte("connexion", { corps: { identifiant, motDePasse } });
  if (inscrire && r.statut === 401) return { statut: 409, donnees: { erreur: "identifiant-pris" } };
  return { ...r, nouveau: false };
}

async function activerSynchro(ev) {
  ev.preventDefault();
  if (compteEtat.occupe) return;
  const e = compteEtat.enregistrement;
  const mdp = $("#synchro-mdp").value;
  const phrase = $("#synchro-phrase").value;
  for (const id of ["synchro-mdp", "synchro-phrase", "synchro-phrase2", "synchro-compris"]) erreurChamp(id, "");
  if (!erreurChamp("synchro-mdp", mdp ? "" : t("compteMdpRequis"))) return;
  const p = compteLocal.validerPassphrase(phrase, { motDePasse: mdp });
  if (!erreurChamp("synchro-phrase", p.ok ? "" : t(`synchroPhraseErreur_${p.erreur}`, { min: compteLocal.PASSPHRASE_MIN, max: compteLocal.PASSPHRASE_MAX }))) return;
  if (!erreurChamp("synchro-phrase2", $("#synchro-phrase2").value === phrase ? "" : t("synchroPhrasesDifferentes"))) return;
  if (!erreurChamp("synchro-compris", $("#synchro-compris").checked ? "" : t("synchroComprisRequis"))) return;
  if (!erreurChamp("synchro-mdp", await compteLocal.verifierMotDePasse(mdp, e) ? "" : t("compteMdpIncorrect"))) return;
  compteEtat.occupe = true;
  messageSynchro("synchroEnCours");
  try {
    const dispo = await apiCompte("etat", { methode: "GET" });
    if (!dispo.donnees?.disponible) { messageSynchro("synchroIndisponible"); return; }
    const s = await ouvrirSessionServeur(e.identifiant, mdp, { inscrire: true });
    if (s.statut === 409) { messageSynchro("synchroIdentifiantPris"); return; }
    if (!s.donnees?.jeton) { messageSynchro(erreurServeur(s)); return; }
    const secrets = await compteLocal.deriverSecrets(phrase, e.identifiant);
    compteEtat.session.synchro = { pseudonyme: secrets.pseudonyme, jeton: secrets.jeton, cle: secrets.cle, jetonServeur: s.donnees.jeton, expire: s.donnees.expire };
    e.synchro = { empreinte: secrets.empreinte, version: 0, maj: null };
    const lu = await apiCompte("donnees/lire", { jeton: s.donnees.jeton, corps: preuveSynchro() });
    let message;
    const trouve = lu.statut === 200 && lu.donnees?.version > 0;
    if (trouve) {
      e.synchro.version = lu.donnees.version;
      e.synchro.maj = lu.donnees.maj ?? null;
      message = ["synchroDonneesTrouvees"];
    } else if (lu.statut === 200 && !s.nouveau) {
      message = ["synchroAucuneDonnee"];
    } else if (lu.statut === 200) {
      sauverCompte();
      const [cle, variables] = await envoyerInstantane();
      message = cle === "synchroEnvoyees" ? ["synchroActivee", variables] : [cle, variables];
    } else {
      compteEtat.session.synchro = null;
      e.synchro = null;
      message = [erreurServeur(lu)];
    }
    sauverCompte();
    $("#formulaire-synchro-activer").reset();
    rafraichirCompte();
    messageSynchro(...message);
  } catch {
    messageSynchro("synchroErreur");
  } finally {
    compteEtat.occupe = false;
  }
}

async function deverrouillerSynchro(ev) {
  ev.preventDefault();
  if (compteEtat.occupe) return;
  const e = compteEtat.enregistrement;
  const mdp = $("#synchro-dv-mdp").value;
  const phrase = $("#synchro-dv-phrase").value;
  if (!erreurChamp("synchro-dv-mdp", mdp && phrase ? "" : t("compteMdpRequis"), "synchro-dv-erreur")) return;
  if (!erreurChamp("synchro-dv-mdp", await compteLocal.verifierMotDePasse(mdp, e) ? "" : t("compteMdpIncorrect"), "synchro-dv-erreur")) return;
  compteEtat.occupe = true;
  try {
    const secrets = await compteLocal.deriverSecrets(phrase, e.identifiant);
    // L'empreinte gardée sur l'appareil reconnaît une phrase mal saisie, sans rien demander au serveur.
    if (!erreurChamp("synchro-dv-phrase", compteLocal.egalesTempsConstant(secrets.empreinte, e.synchro.empreinte) ? "" : t("synchroPhraseIncorrecte"), "synchro-dv-erreur")) return;
    const s = await ouvrirSessionServeur(e.identifiant, mdp, { inscrire: false });
    if (!s.donnees?.jeton) { erreurChamp("synchro-dv-mdp", t(erreurServeur(s)), "synchro-dv-erreur"); return; }
    compteEtat.session.synchro = { pseudonyme: secrets.pseudonyme, jeton: secrets.jeton, cle: secrets.cle, jetonServeur: s.donnees.jeton, expire: s.donnees.expire };
    sauverCompte();
    $("#formulaire-synchro-deverrouiller").reset();
    rafraichirCompte();
    messageSynchro("synchroDeverrouillee");
  } catch {
    erreurChamp("synchro-dv-mdp", t("synchroErreur"), "synchro-dv-erreur");
  } finally {
    compteEtat.occupe = false;
  }
}

async function envoyerSynchro() {
  if (compteEtat.occupe) return;
  compteEtat.occupe = true;
  messageSynchro("synchroEnCours");
  try {
    messageSynchro(...await envoyerInstantane());
    rafraichirCompte();
  } catch {
    messageSynchro("synchroErreur");
  } finally {
    compteEtat.occupe = false;
  }
}

async function recupererSynchro(ev) {
  const bouton = ev.currentTarget;
  // Confirmation en deux temps : la récupération remplace les données de l'appareil.
  if (bouton.dataset.confirmer !== "1") {
    bouton.dataset.confirmer = "1";
    bouton.textContent = t("synchroRecupererConfirmer");
    return;
  }
  delete bouton.dataset.confirmer;
  bouton.textContent = t("synchroRecuperer");
  if (compteEtat.occupe) return;
  compteEtat.occupe = true;
  messageSynchro("synchroEnCours");
  try {
    const { synchro } = compteEtat.session;
    const lu = await apiCompte("donnees/lire", { jeton: synchro.jetonServeur, corps: preuveSynchro() });
    if (lu.statut !== 200) { messageSynchro(erreurServeur(lu)); return; }
    if (!(lu.donnees?.version > 0)) { messageSynchro("synchroAucuneDonnee"); return; }
    let instant;
    try { instant = await compteLocal.dechiffrer(synchro.cle, synchro.pseudonyme, lu.donnees); } catch { messageSynchro("synchroIllisible"); return; }
    if (!compteLocal.restaurer(instant, CLES_SYNCHRONISEES, (cle, v) => ecrireCle(stockage(), cle, v), (cle) => effacerCle(stockage(), cle))) {
      messageSynchro("synchroIllisible");
      return;
    }
    const e = compteEtat.enregistrement;
    e.synchro.version = lu.donnees.version;
    e.synchro.maj = lu.donnees.maj ?? null;
    sauverCompte();
    // Les données restaurées (pseudo, progression, trophées, cahiers) sont relues au rechargement.
    location.reload();
  } catch {
    messageSynchro("synchroErreur");
  } finally {
    compteEtat.occupe = false;
  }
}

const erreurSuppression = (message) => erreurChamp("compte-suppr-mdp", message, "compte-suppr-erreur");

async function supprimerCompteLocal(ev) {
  ev.preventDefault();
  if (compteEtat.occupe) return;
  const e = compteEtat.enregistrement;
  const mdp = $("#compte-suppr-mdp").value;
  if (!erreurSuppression(mdp ? "" : t("compteMdpRequis"))) return;
  if (!erreurSuppression(await compteLocal.verifierMotDePasse(mdp, e) ? "" : t("compteMdpIncorrect"))) return;
  compteEtat.occupe = true;
  try {
    if (e.serveur === true || e.synchro) {
      // Compte en ligne : données pseudonymisées d'abord (si la phrase est déverrouillée), puis identifiants.
      const s = await ouvrirSessionServeur(e.identifiant, mdp, { inscrire: false });
      if (s.donnees?.jeton) {
        if (compteEtat.session?.synchro) {
          const r = await apiCompte("donnees/supprimer", { jeton: s.donnees.jeton, corps: preuveSynchro() });
          if (r.statut !== 204) { erreurSuppression(t(erreurServeur(r))); return; }
        }
        const r = await apiCompte("compte/supprimer", { jeton: s.donnees.jeton, corps: { motDePasse: mdp } });
        if (r.statut !== 204) { erreurSuppression(t(erreurServeur(r))); return; }
      } else if (s.statut !== 401) {
        // Serveur injoignable : rien n'est effacé, pour ne pas laisser un compte en ligne orphelin.
        erreurSuppression(t(erreurServeur(s)));
        return;
      }
    }
    compteEtat.enregistrement = null;
    compteEtat.session = null;
    sauverCompte();
    $("#formulaire-compte-supprimer").reset();
    $("#compte-suppression").open = false;
    messageSynchro("");
    rafraichirCompte();
    notifier(t("compteSupprime"), "🧹");
  } catch {
    erreurSuppression(t("synchroErreur"));
  } finally {
    compteEtat.occupe = false;
  }
}

function brancherCompte() {
  chargerCompte();
  $("#formulaire-compte-creer").addEventListener("submit", creerCompteLocal);
  $("#compte-mdp").addEventListener("input", marquerReglesMdp);
  $("#formulaire-compte-connexion").addEventListener("submit", connecterCompteLocal);
  $("#compte-deconnexion").addEventListener("click", deconnecterCompteLocal);
  $("#formulaire-synchro-activer").addEventListener("submit", activerSynchro);
  $("#formulaire-synchro-deverrouiller").addEventListener("submit", deverrouillerSynchro);
  $("#synchro-envoyer").addEventListener("click", envoyerSynchro);
  $("#synchro-recuperer").addEventListener("click", recupererSynchro);
  $("#formulaire-compte-supprimer").addEventListener("submit", supprimerCompteLocal);
  marquerReglesMdp();
  rafraichirCompte();
}

/* ---------- Espace famille des comptes locaux (ADR 0029) ---------- */
// Le compte local lié au serveur garde une session pour l'onglet. Un compte solo invite son parent par un code ; un
// compte parent (rôle attribué dans le back-office) voit le tableau de bord Famille. L'appareil d'un enfant envoie un
// bilan clair et borné (compteurs et identifiants du catalogue) et reçoit les cahiers assignés par son parent.
const familleEtat = { moi: null, tableau: null, mesCahiers: [], occupe: false, minuteurBilan: null, dernierBilan: 0, ouverts: new Set() };
const DELAI_BILAN_MS = 60_000;

const jetonFamille = () => {
  const s = compteEtat.session?.serveur;
  return s && s.expire > Date.now() / 1000 ? s.jeton : null;
};
/** Membre d'une famille : ses consommations d'IA sont comptées (en-tête Authorization sur les routes d'IA). */
const enteteFamille = () => {
  const jeton = jetonFamille();
  const m = familleEtat.moi;
  return jeton && m && (m.enfant || m.enfants > 0) ? { authorization: `Bearer ${jeton}` } : {};
};

async function apiFamilleLocale(route, { methode = "GET", corps } = {}) {
  const jeton = jetonFamille();
  if (!jeton) return { statut: 401, donnees: { erreur: "non-connecte" } };
  const r = await fetch(urlApi(`/api/famille/${route}`), {
    method: methode, credentials: "omit", cache: "no-store",
    headers: { authorization: `Bearer ${jeton}`, ...(corps ? { "content-type": "application/json" } : {}) },
    body: corps ? JSON.stringify(corps) : undefined
  });
  let donnees = null;
  try { donnees = await r.json(); } catch { /* 204 */ }
  if (r.status === 401 && compteEtat.session) {
    compteEtat.session.serveur = null;
    sauverCompte();
  }
  return { statut: r.status, donnees };
}

function oublierFamille() {
  Object.assign(familleEtat, { moi: null, tableau: null, mesCahiers: [] });
  clearTimeout(familleEtat.minuteurBilan);
  rafraichirFamilleCompte();
  rendreCahiersFamille();
  if (etat.ecran === "espace-famille") rendreEspaceFamille();
  oublierProf();
}

/** Message d'erreur de l'API famille (codes connus, sinon générique). */
function messageFamille(r) {
  const code = r?.donnees?.erreur;
  if (r?.statut === 401 && code === "reauthentification") return t("efErreur_reauthentification");
  if (r?.statut === 401) return t("efErreur_session");
  if (r?.statut === 503) return t("efErreur_indisponible");
  if (r?.statut === 429) return t("synchroTropDeTentatives");
  if (typeof code === "string" && etat.textes[`efErreur_${code}`]) return t(`efErreur_${code}`);
  if (typeof code === "string" && code.startsWith("prenom-")) return t(`pseudoErreur_${code.slice(7)}`, { min: profil.PSEUDO_MIN, max: profil.PSEUDO_MAX });
  if (typeof code === "string" && code.startsWith("identifiant-") && etat.textes[`compteIdentifiantErreur_${code.slice(12)}`]) return t(`compteIdentifiantErreur_${code.slice(12)}`, bornesCompte);
  if (typeof code === "string" && code.startsWith("mot-de-passe-")) return t("efErreur_motDePasse", { min: compteLocal.MOT_DE_PASSE_MIN });
  return t("efErreur_generique");
}

/** Situation du compte dans sa famille ; charge ensuite les cahiers assignés (enfant) et envoie le bilan. */
async function chargerFamille() {
  if (!jetonFamille()) { oublierFamille(); return; }
  try {
    const r = await apiFamilleLocale("moi");
    familleEtat.moi = r.statut === 200 ? r.donnees : null;
  } catch {
    familleEtat.moi = null;
  }
  rafraichirFamilleCompte();
  if (familleEtat.moi?.enfant) {
    await chargerMesCahiers();
    planifierBilanFamille({ immediat: true });
  }
  await chargerProf();
}

function rafraichirFamilleCompte() {
  const m = familleEtat.moi;
  const lie = !!jetonFamille();
  $("#entree-espace-famille").hidden = !m?.parent;
  $("#famille-ouvrir-espace").hidden = !m?.parent;
  // Lien rapide de la navigation : l'Espace famille pour un parent, le bloc Famille de « Mon compte » sinon.
  const navFamille = $("#nav-famille");
  navFamille.hidden = !lie || !m;
  navFamille.dataset.nav = m?.parent ? "espace-famille" : "compte";
  marquerNavigation(sectionDe(etat.ecran));
  $("#famille-compte-solo").hidden = !m || !!m.parent || !!m.enfant;
  $("#famille-compte-statut").textContent = !lie ? t("fcNonLie")
    : !m ? t("fcIndisponible")
      : m.enfant ? t("fcEnfant", { prenom: m.enfant.prenom })
        : m.parent ? t("fcParent", { n: m.enfants })
          : t("fcSolo");
  const invitation = m?.invitation;
  if (!invitation) $("#famille-code-zone").hidden = true;
  $("#famille-inviter").hidden = !!invitation && !$("#famille-code-zone").hidden;
}

async function inviterParent() {
  if (familleEtat.occupe) return;
  familleEtat.occupe = true;
  $("#famille-compte-message").textContent = t("synchroEnCours");
  try {
    const r = await apiFamilleLocale("invitation", { methode: "POST", corps: {} });
    if (r.statut !== 201) { $("#famille-compte-message").textContent = messageFamille(r); return; }
    $("#famille-code").textContent = familleModule.afficherCode(r.donnees.code);
    const expire = new Intl.DateTimeFormat(etat.langue, { dateStyle: "medium", timeStyle: "short" }).format(new Date(r.donnees.expire * 1000));
    $("#famille-code-aide").textContent = t("fcCodeAide", { date: expire });
    $("#famille-code-zone").hidden = false;
    $("#famille-inviter").hidden = true;
    $("#famille-compte-message").textContent = "";
  } catch {
    $("#famille-compte-message").textContent = t("efErreur_generique");
  } finally {
    familleEtat.occupe = false;
  }
}

async function annulerInvitation() {
  try { await apiFamilleLocale("invitation/annuler", { methode: "POST", corps: {} }); } catch { /* sans effet */ }
  $("#famille-code-zone").hidden = true;
  $("#famille-inviter").hidden = false;
  $("#famille-code").textContent = "";
}

/* Bilan envoyé par l'appareil de l'enfant */

function bilanDeLAppareil() {
  const p = etat.progres ?? progression.etatInitial();
  const jour = progression.jourLocal();
  const notions = {};
  for (const [id, n] of Object.entries(etat.evenements?.notions ?? {})) {
    const maitrise = evenements.maitriseNotion(n, jour).etat;
    if (!familleModule.ETATS_NOTION.includes(maitrise)) continue;
    const r = evenements.resumerNotion(n);
    notions[id] = { etat: maitrise, tentes: r?.tentes ?? 0, reussis: r?.reussis ?? 0 };
  }
  for (const id of p.notions) notions[id] ??= { etat: "decouverte", tentes: 0, reussis: 0 };
  const cahiers = cahiersEnregistres().filter((c) => c.famille).map((c) => ({ famille: c.famille, ...bilanExercices(c) }));
  return familleModule.construireBilan(p, {
    jour, niveau: progression.niveau(p).niveau, serie: progression.serieCourante(p, jour),
    semaine: progression.activite(p, jour, familleModule.JOURS_BILAN), notions, cahiers
  });
}

/** Un bilan part vers la famille (enfant rattaché) et vers les professeurs suivis (ADR 0030), jamais ailleurs. */
const bilanAttendu = () => !!familleEtat.moi?.enfant || profEtat.mesProfs.length > 0;

async function envoyerBilanFamille() {
  if (!bilanAttendu() || !jetonFamille()) return;
  familleEtat.dernierBilan = Date.now();
  const bilan = bilanDeLAppareil();
  if (familleEtat.moi?.enfant) {
    try { await apiFamilleLocale("bilan", { methode: "PUT", corps: { bilan } }); } catch { /* nouvel essai au prochain changement */ }
  }
  if (profEtat.mesProfs.length) {
    // Le professeur ne reçoit ni badges ni cahiers de la famille.
    try { await apiProf("bilan", { methode: "PUT", corps: { bilan: { ...bilan, badges: [], cahiers: [] } }, reel: true }); } catch { /* idem */ }
    await envoyerResultatsCahiersProf();
  }
}

/** Envoi groupé : au plus un bilan par minute, tout de suite à la connexion ou quand l'onglet est masqué. */
function planifierBilanFamille({ immediat = false } = {}) {
  if (!bilanAttendu()) return;
  clearTimeout(familleEtat.minuteurBilan);
  const attente = immediat ? 0 : Math.max(0, DELAI_BILAN_MS - (Date.now() - familleEtat.dernierBilan));
  familleEtat.minuteurBilan = setTimeout(() => void envoyerBilanFamille(), attente);
}

/* Cahiers assignés : côté enfant */

async function chargerMesCahiers() {
  try {
    const r = await apiFamilleLocale("mes-cahiers");
    familleEtat.mesCahiers = r.statut === 200 && Array.isArray(r.donnees?.cahiers) ? r.donnees.cahiers : [];
  } catch {
    familleEtat.mesCahiers = [];
  }
  // Un cahier déjà calibré sur un autre appareil est importé ici directement.
  for (const c of familleEtat.mesCahiers) if (c.statut !== "assigne" && c.calibrage) importerCahierFamille(c, c.calibrage);
  rendreCahiersFamille();
}

const titreCahierFamille = (c) => c.titre || t(`cahier_${c.demande?.type}`) || t("cfSansTitre");
const cahierLocalFamille = (id) => cahiersEnregistres().find((c) => c.famille === id) ?? null;

/** Copie un cahier assigné dans « Mes cahiers », calibrage appliqué ; il garde le lien vers la famille. */
function importerCahierFamille(c, calibrage) {
  if (cahierLocalFamille(c.id)) return cahierLocalFamille(c.id);
  const d = c.demande ?? {};
  const notions = Array.isArray(d.notions) ? d.notions : [];
  const sections = c.cahier?.sections?.length
    ? c.cahier.sections.map((s) => ({ notion: s.notion, titre: s.titre, blocs: s.blocs, notes: "" }))
    : sectionsCatalogue(notions);
  const calibre = familleModule.appliquerCalibrage({ sections }, calibrage ?? {});
  const cahiers = cahiersEnregistres();
  const local = cahierValide({
    id: window.crypto?.randomUUID?.() ?? `${Date.now()}-${cahiers.length}`, famille: c.id, type: d.type, creeLe: c.creeLe ? new Date(`${c.creeLe.replace(" ", "T")}Z`).toISOString() : new Date().toISOString(),
    titre: titreCahierFamille(c), source: c.cahier ? "ia" : "catalogue", longueur: d.longueur, univers: d.univers, objectif: d.objectif,
    introduction: c.cahier?.introduction || t(`cahierIntro_${d.type}`), conclusion: c.cahier?.conclusion ?? "", notes: "",
    sections: calibre.sections.map(({ acquise, ...s }) => s)
  });
  if (!local) return null;
  enregistrerCahiers([local, ...cahiers]);
  rendreCahiers();
  return local;
}

function rendreCahiersFamille() {
  const zone = $("#cahiers-famille");
  if (!zone || !etat.textes.titre) return;
  const liste = familleEtat.mesCahiers;
  zone.hidden = !liste.length;
  $("#liste-cahiers-famille").replaceChildren(...liste.map((c) => {
    const carte = element("article", { classe: "carte cahier-enregistre cahier-famille" });
    const infos = element("div", { classe: "cahier-infos" });
    const local = cahierLocalFamille(c.id);
    const avancement = local ? bilanExercices(local) : null;
    const details = [t(`cahier_${c.demande?.type}`), t("cahierNotionsCompte", { n: c.demande?.notions?.length ?? 0 }),
      avancement?.total ? t("cahierProgression", { n: avancement.reussis, m: avancement.total }) : null].filter(Boolean).join(" · ");
    infos.append(element("h4", { texte: titreCahierFamille(c) }), element("p", { classe: "doux petit", texte: details }),
      element("span", { classe: `pastille ${c.statut === "assigne" ? "pri" : c.statut === "termine" ? "ok" : "en-cours"}`, cle: `cfStatut_${c.statut}` }));
    const action = element("button", { classe: "bouton petit-bouton", cle: c.statut === "assigne" ? "cfCommencer" : "cahierOuvrir", attributs: { type: "button", "data-cahier-famille": c.id } });
    const actions = element("div", { classe: "cahier-actions" });
    actions.append(action);
    carte.append(infos, actions);
    return carte;
  }));
}

const calibrageEtat = { cahier: null, questions: [] };

async function commencerCahierFamille(id) {
  const c = familleEtat.mesCahiers.find((x) => x.id === id);
  if (!c) return;
  if (c.statut !== "assigne") {
    const local = importerCahierFamille(c, c.calibrage);
    if (local) ouvrirLectureCahier(local.id);
    return;
  }
  calibrageEtat.cahier = c;
  calibrageEtat.questions = await questionsDiagnosticVacances(c.demande?.notions ?? []);
  $("#calibrage-questions").replaceChildren(...calibrageEtat.questions.map((q, i) => {
    const bloc = element("fieldset", { classe: "vacances-question" });
    bloc.append(element("legend", { texte: `${notionParId(q.notion)?.titre ?? q.notion} · ${q.question}` }));
    q.choix.forEach((choix, j) => {
      const label = element("label");
      label.append(element("input", { attributs: { type: "radio", name: `calibrage-${i}`, value: String(j) } }), element("span", { texte: choix }));
      bloc.append(label);
    });
    const jeNeSaisPas = element("label");
    jeNeSaisPas.append(element("input", { attributs: { type: "radio", name: `calibrage-${i}`, value: "-1" } }), element("span", { cle: "vacancesJeNeSaisPas" }));
    bloc.append(jeNeSaisPas);
    return bloc;
  }));
  if (!calibrageEtat.questions.length) $("#calibrage-questions").append(element("p", { classe: "doux", cle: "calibrageSansQuestion" }));
  $("#calibrage-retour").textContent = "";
  $("#calibrage-valider").disabled = false;
  $("#calibrage-cahier").showModal();
  $("#calibrage-questions input")?.focus();
}

async function validerCalibrage(e) {
  e.preventDefault();
  const c = calibrageEtat.cahier;
  if (!c || familleEtat.occupe) return;
  // Une bonne réponse = notion acquise : elle passe en approfondissement, à la fin du cahier.
  const resultats = Object.fromEntries(calibrageEtat.questions.map((q, i) => [q.notion, Number($(`input[name="calibrage-${i}"]:checked`)?.value) === q.bonne]));
  familleEtat.occupe = true;
  $("#calibrage-valider").disabled = true;
  try {
    const r = await apiFamilleLocale(`mes-cahiers/${c.id}/calibrage`, { methode: "POST", corps: { resultats } });
    if (r.statut !== 200 && r.statut !== 409) { $("#calibrage-retour").textContent = messageFamille(r); return; }
    const calibrage = r.donnees?.calibrage ?? resultats;
    Object.assign(c, { statut: "en-cours", calibrage });
    const local = importerCahierFamille(c, calibrage);
    $("#calibrage-cahier").close();
    rendreCahiersFamille();
    const acquises = Object.values(calibrage).filter(Boolean).length;
    if (local) ouvrirLectureCahier(local.id, acquises ? t("calibrageResultat", { n: acquises }) : t("calibrageTout"));
    planifierBilanFamille({ immediat: true });
  } catch {
    $("#calibrage-retour").textContent = t("efErreur_generique");
  } finally {
    familleEtat.occupe = false;
    $("#calibrage-valider").disabled = false;
  }
}

/* Espace famille : côté parent */

async function ouvrirEspaceFamille() {
  if (!familleEtat.moi && jetonFamille()) await chargerFamille();
  await chargerTableauFamille();
}

async function chargerTableauFamille() {
  if (!familleEtat.moi?.parent) { familleEtat.tableau = null; rendreEspaceFamille(); return; }
  $("#ef-etat").textContent = t("efChargement");
  try {
    const r = await apiFamilleLocale("tableau");
    familleEtat.tableau = r.statut === 200 ? r.donnees : null;
    $("#ef-etat").textContent = r.statut === 200 ? "" : messageFamille(r);
  } catch {
    familleEtat.tableau = null;
    $("#ef-etat").textContent = t("efErreur_generique");
  }
  rendreEspaceFamille();
}

/** Durée compacte pour les tuiles : « 0 min », « 45 min », « 2 h 05 ». */
const formatMinutes = (min) => (min < 60 ? t("efMinutes", { n: min }) : t("efHeures", { h: Math.floor(min / 60), m: String(min % 60).padStart(2, "0") }));

function chiffre(dt, dd) {
  const div = element("div");
  div.append(element("dd", { texte: String(dd) }), element("dt", { texte: dt }));
  return div;
}

function rendreEspaceFamille() {
  const tableau = familleEtat.tableau;
  const m = familleEtat.moi;
  if (!tableau) {
    $("#ef-contenu").hidden = true;
    if (!$("#ef-etat").textContent || !m?.parent) {
      $("#ef-etat").textContent = !jetonFamille() ? t("efConnexionRequise") : m && !m.parent ? t(m.enfant ? "efCompteEnfant" : "efRoleRequis") : "";
    }
    return;
  }
  $("#ef-contenu").hidden = false;
  const jour = progression.jourLocal();
  const s = familleModule.syntheseFamille(tableau.enfants, jour);
  $("#ef-chiffres").replaceChildren(
    chiffre(t("efChiffreEnfants"), s.enfants), chiffre(t("efChiffreXp"), s.xp),
    chiffre(t("efChiffreTemps"), formatMinutes(s.minutes)), chiffre(t("efChiffreCahiers"), s.cahiersEnCours)
  );
  const prenomDe = (id) => tableau.enfants.find((e) => e.id === id)?.prenom ?? "";
  $("#ef-alertes").replaceChildren(...s.alertes.map((a) => element("li", { texte: t(`efAlerte_${a.type}`, { prenom: prenomDe(a.enfant), n: a.n ?? a.jours ?? "" }) })));
  $("#ef-vide").hidden = tableau.enfants.length > 0;
  $("#ef-enfants").replaceChildren(...tableau.enfants.map(carteEnfant));
  $("#ef-ajout").hidden = tableau.enfants.length >= tableau.maxEnfants;
  rendreConsommations(tableau);
}

function barresSemaine(bilan, jour) {
  const conteneur = element("div", { classe: "ef-semaine", attributs: { role: "img" } });
  const jours = [];
  for (let i = 6; i >= 0; i--) jours.push(familleModule.ecartJours("1970-01-01", jour) - i);
  const parJour = new Map((bilan?.jours ?? []).map((j) => [familleModule.ecartJours("1970-01-01", j.jour), j]));
  const max = Math.max(1, ...jours.map((d) => parJour.get(d)?.min ?? 0));
  const resume = [];
  for (const d of jours) {
    const min = parJour.get(d)?.min ?? 0;
    const date = new Date(d * 86400000);
    const nom = date.toLocaleDateString(etat.langue, { weekday: "short", timeZone: "UTC" });
    resume.push(`${nom} ${min} min`);
    const barre = element("span", { classe: "ef-barre", attributs: { "aria-hidden": "true", title: `${nom} : ${min} min` } });
    barre.style.setProperty("--h", `${Math.round((min / max) * 100)}%`);
    conteneur.append(barre);
  }
  conteneur.setAttribute("aria-label", t("efSemaineAria", { detail: resume.join(", ") }));
  return conteneur;
}

function carteEnfant(e) {
  const carte = element("article", { classe: "carte ef-enfant", attributs: { "data-enfant": e.id } });
  const tete = element("div", { classe: "ef-enfant-tete" });
  const nom = element("div", { classe: "famille-enfant-nom" });
  nom.append(element("h4", { texte: e.prenom }), element("span", { classe: "doux petit", texte: `${t(`tranche_${e.trancheAge}`)} · ${t(e.origine === "invitation" ? "efOrigineInvitation" : "efOrigineCreation")}` }));
  tete.append(nom);
  const b = e.bilan;
  const jour = progression.jourLocal();
  if (!b) tete.append(element("span", { classe: "pastille neutre", cle: "efJamaisVu" }));
  else {
    const vu = b.dernierJour ? familleModule.ecartJours(b.dernierJour, jour) : null;
    tete.append(element("span", { classe: `pastille ${vu !== null && vu < familleModule.JOURS_INACTIVITE ? "ok" : "en-cours"}`, texte: vu === null ? t("efJamaisActif") : vu === 0 ? t("efActifAujourdhui") : t("efActifIlYa", { n: vu }) }));
  }
  carte.append(tete);
  if (b) {
    const sem = familleModule.semaineBilan(b, jour);
    const rep = familleModule.repartitionNotions(b);
    const stats = element("dl", { classe: "stats stats-progression" });
    stats.append(chiffre(t("niveauLong", { n: "" }).trim(), b.niveau), chiffre(t("efSerie"), b.serie), chiffre(t("efXpSemaine"), sem.xp), chiffre(t("efTempsSemaine"), formatMinutes(sem.minutes)));
    carte.append(stats, barresSemaine(b, jour));
    carte.append(element("p", { classe: "doux petit", texte: t("efNotionsResume", { maitrisees: rep.maitrisee, encours: rep["en-cours"], arevoir: rep["a-revoir"], decouvertes: rep.decouverte }) }));
    const aRevoir = Object.entries(b.notions).filter(([, n]) => n.etat === "a-revoir").map(([id]) => notionParId(id)?.titre ?? id).slice(0, 5);
    if (aRevoir.length) carte.append(element("p", { classe: "petit", texte: t("efARevoirListe", { liste: aRevoir.join(", ") }) }));
  }
  // Cahiers assignés.
  const cahiers = element("div", { classe: "ef-cahiers" });
  cahiers.append(element("h5", { cle: "efCahiersAssignes" }));
  if (!e.cahiers.length) cahiers.append(element("p", { classe: "doux petit", cle: "efAucunCahier" }));
  for (const c of e.cahiers) {
    const ligne = element("div", { classe: "ef-cahier" });
    const texte = [titreCahierFamille(c), t(`cfStatut_${c.statut}`), c.total ? t("cahierProgression", { n: c.reussis, m: c.total }) : null,
      c.calibrage ? t("efCalibrage", { n: Object.values(c.calibrage).filter(Boolean).length, m: Object.keys(c.calibrage).length }) : null].filter(Boolean).join(" · ");
    ligne.append(element("span", { texte }));
    const archiver = element("button", { classe: "secondaire petit-bouton", cle: "efArchiver", attributs: { type: "button", "data-ef-archiver": c.id } });
    ligne.append(archiver);
    cahiers.append(ligne);
  }
  carte.append(cahiers);
  // Actions.
  const actions = element("div", { classe: "actions" });
  actions.append(element("button", { classe: "bouton petit-bouton", cle: "efAssigner", attributs: { type: "button", "data-ef-assigner": e.id } }));
  carte.append(actions);
  const gestion = element("details", { classe: "famille-ajout ef-gestion" });
  if (familleEtat.ouverts.has(e.id)) gestion.open = true;
  gestion.addEventListener("toggle", () => { if (gestion.open) familleEtat.ouverts.add(e.id); else familleEtat.ouverts.delete(e.id); });
  gestion.append(element("summary", { cle: "efGerer" }), formulaireGestion(e));
  carte.append(gestion);
  return carte;
}

function champ(id, cle, attributs = {}) {
  const frag = document.createDocumentFragment();
  frag.append(element("label", { classe: "etiquette-champ", cle, attributs: { for: id } }), element("input", { attributs: { id, ...attributs } }));
  return frag;
}

function formulaireGestion(e) {
  const zone = element("div", { classe: "ef-gestion-corps" });
  const id = e.id.slice(0, 8);
  // Modifier le profil.
  const modif = element("form", { classe: "formulaire-profil", attributs: { "data-ef-modifier": e.id, novalidate: "" } });
  modif.append(champ(`ef-prenom-${id}`, "enfantPrenomLabel", { type: "text", maxlength: "20", value: e.prenom, name: "prenom" }));
  const tranche = element("select", { attributs: { name: "trancheAge", "aria-label": t("enfantTrancheLabel") } });
  for (const tr of comptes.TRANCHES_AGE) tranche.append(option(tr, t(`tranche_${tr}`)));
  tranche.value = e.trancheAge;
  modif.append(tranche, element("button", { classe: "secondaire petit-bouton", cle: "efEnregistrer", attributs: { type: "submit" } }));
  // Nouveau mot de passe (mot de passe du parent redemandé).
  const mdp = element("form", { classe: "formulaire-profil", attributs: { "data-ef-mdp": e.id, novalidate: "" } });
  mdp.append(element("p", { classe: "doux petit", cle: "efMdpResetAide" }),
    champ(`ef-nmdp-${id}`, "efNouveauMdp", { type: "password", maxlength: "128", autocomplete: "new-password", name: "motDePasse" }),
    champ(`ef-pmdp-${id}`, "efMdpParent", { type: "password", maxlength: "128", autocomplete: "current-password", name: "motDePasseParent" }),
    element("button", { classe: "secondaire petit-bouton", cle: "efChangerMdp", attributs: { type: "submit" } }));
  // Détacher, supprimer.
  const sortir = element("form", { classe: "formulaire-profil", attributs: { "data-ef-supprimer": e.id, novalidate: "" } });
  sortir.append(element("p", { classe: "doux petit", cle: "efSortieAide" }),
    champ(`ef-smdp-${id}`, "efMdpParent", { type: "password", maxlength: "128", autocomplete: "current-password", name: "motDePasseParent" }));
  const boutons = element("div", { classe: "actions" });
  boutons.append(element("button", { classe: "secondaire petit-bouton", cle: "efDetacher", attributs: { type: "button", "data-ef-detacher": e.id } }),
    element("button", { classe: "danger petit-bouton", cle: "efSupprimer", attributs: { type: "submit" } }));
  sortir.append(boutons);
  zone.append(modif, mdp, sortir, element("p", { classe: "erreur-champ", attributs: { role: "status", "data-ef-message": e.id } }));
  return zone;
}

const messageEnfant = (id, texte) => { const p = document.querySelector(`[data-ef-message="${id}"]`); if (p) p.textContent = texte; };

async function actionEnfant(id, route, corps, { succes, confirmer } = {}) {
  if (familleEtat.occupe) return;
  familleEtat.occupe = true;
  messageEnfant(id, t("synchroEnCours"));
  try {
    const r = await apiFamilleLocale(`enfants/${id}/${route}`, { methode: "POST", corps: corps ?? {} });
    if (r.statut >= 300) { messageEnfant(id, messageFamille(r)); return; }
    if (succes) notifier(succes, "👪");
    await chargerTableauFamille();
    if (confirmer) messageEnfant(id, confirmer);
  } catch {
    messageEnfant(id, t("efErreur_generique"));
  } finally {
    familleEtat.occupe = false;
  }
}

function brancherEspaceFamille() {
  const zone = $("#ef-enfants");
  zone.addEventListener("submit", (ev) => {
    const f = ev.target;
    ev.preventDefault();
    const donnees = Object.fromEntries(new FormData(f));
    if (f.dataset.efModifier) void actionEnfant(f.dataset.efModifier, "modifier", donnees, { succes: t("efModifie") });
    else if (f.dataset.efMdp) {
      const v = compteLocal.validerMotDePasse(donnees.motDePasse);
      if (!v.ok) { messageEnfant(f.dataset.efMdp, t("efErreur_motDePasse", { min: compteLocal.MOT_DE_PASSE_MIN })); return; }
      void actionEnfant(f.dataset.efMdp, "mot-de-passe", donnees, { confirmer: t("efMdpChange") });
    } else if (f.dataset.efSupprimer) {
      const bouton = f.querySelector("button[type=submit]");
      // Confirmation en deux temps : le compte de l'enfant et ses données en ligne sont effacés.
      if (bouton.dataset.confirmer !== "1") { bouton.dataset.confirmer = "1"; bouton.textContent = t("efSupprimerConfirmer"); return; }
      void actionEnfant(f.dataset.efSupprimer, "supprimer", donnees, { succes: t("efSupprime") });
    }
  });
  zone.addEventListener("click", (ev) => {
    const detacher = ev.target.closest("[data-ef-detacher]");
    if (detacher) {
      if (detacher.dataset.confirmer !== "1") { detacher.dataset.confirmer = "1"; detacher.textContent = t("efDetacherConfirmer"); return; }
      void actionEnfant(detacher.dataset.efDetacher, "detacher", {}, { succes: t("efDetache") });
      return;
    }
    const archiver = ev.target.closest("[data-ef-archiver]");
    if (archiver) {
      void apiFamilleLocale(`cahiers/${archiver.dataset.efArchiver}/archiver`, { methode: "POST", corps: {} }).then(chargerTableauFamille).catch(() => {});
      return;
    }
    const assigner = ev.target.closest("[data-ef-assigner]");
    if (assigner) ouvrirConstructeurFamille(assigner.dataset.efAssigner);
  });
  for (const radio of document.querySelectorAll('input[name="ef-mode"]')) {
    radio.addEventListener("change", () => {
      const creation = document.querySelector('input[name="ef-mode"]:checked')?.value === "creation";
      $("#ef-ajout-code").hidden = creation;
      $("#ef-ajout-creation").hidden = !creation;
    });
  }
  $("#ef-formulaire-ajout").addEventListener("submit", ajouterEnfantFamille);
  $("#ef-actualiser").addEventListener("click", () => void ouvrirEspaceFamille());
}

async function ajouterEnfantFamille(ev) {
  ev.preventDefault();
  if (familleEtat.occupe) return;
  const creation = document.querySelector('input[name="ef-mode"]:checked')?.value === "creation";
  const erreurAjout = (texte) => { $("#ef-ajout-erreur").textContent = texte; return false; };
  const prenom = profil.validerPseudo($("#ef-prenom").value);
  if (!prenom.ok) return erreurAjout(t(`pseudoErreur_${prenom.erreur}`, { min: profil.PSEUDO_MIN, max: profil.PSEUDO_MAX }));
  const trancheAge = document.querySelector('input[name="ef-tranche"]:checked')?.value;
  if (!trancheAge) return erreurAjout(t("enfantTrancheErreur"));
  if (!$("#ef-consentement").checked) return erreurAjout(t("consentementErreur"));
  const corps = { prenom: prenom.pseudo, trancheAge, consentement: comptes.VERSION_CONSENTEMENT };
  if (creation) {
    const id = compteLocal.validerIdentifiant($("#ef-identifiant").value);
    if (!id.ok) return erreurAjout(t(`compteIdentifiantErreur_${id.erreur}`, bornesCompte));
    const mdp = $("#ef-mdp").value;
    if (!compteLocal.validerMotDePasse(mdp, { identifiant: id.identifiant }).ok) return erreurAjout(t("efErreur_motDePasse", { min: compteLocal.MOT_DE_PASSE_MIN }));
    Object.assign(corps, { identifiant: id.identifiant, motDePasse: mdp });
  } else {
    const code = familleModule.normaliserCode($("#ef-code").value);
    if (!code) return erreurAjout(t("efErreur_code-invalide"));
    corps.code = code;
  }
  familleEtat.occupe = true;
  erreurAjout(t("synchroEnCours"));
  try {
    const r = await apiFamilleLocale(creation ? "enfants" : "rejoindre", { methode: "POST", corps });
    if (r.statut !== 201) { erreurAjout(messageFamille(r)); return; }
    erreurAjout("");
    $("#ef-formulaire-ajout").reset();
    $("#ef-ajout").open = false;
    notifier(t(creation ? "efEnfantCree" : "efEnfantRejoint", { prenom: r.donnees.prenom }), "👪");
    familleEtat.occupe = false;
    await chargerTableauFamille();
  } catch {
    erreurAjout(t("efErreur_generique"));
  } finally {
    familleEtat.occupe = false;
  }
}

function rendreConsommations(tableau) {
  const membres = [tableau.parent, ...tableau.enfants.map((e) => e.id)];
  const nomDe = (id) => (id === tableau.parent ? t("efMoi") : tableau.enfants.find((e) => e.id === id)?.prenom ?? "");
  const { parMembre, total } = familleModule.resumerConsommations(tableau.consommations.lignes, membres);
  const modules = familleModule.MODULES_CONSOMMATION.filter((m) => total.modules[m]);
  $("#ef-conso-aide").textContent = t("efConsommationsAide", { n: tableau.consommations.jours, restantes: tableau.cahiersIa?.restantes ?? 0, limite: tableau.cahiersIa?.limite ?? 0 });
  const table = $("#ef-conso");
  const ligne = (cellules, entete = false) => {
    const tr = element("tr");
    cellules.forEach((c, i) => tr.append(element(entete || i === 0 ? "th" : "td", { texte: String(c), attributs: entete ? { scope: "col" } : i === 0 ? { scope: "row" } : {} })));
    return tr;
  };
  const fmt = (m) => (m ? t("efConsoCellule", { appels: m.appels, tokens: new Intl.NumberFormat(etat.langue).format(m.tokens) }) : "—");
  const thead = element("thead");
  thead.append(ligne([t("efMembre"), ...modules.map((m) => t(`efModule_${m}`)), t("efTotal")], true));
  const tbody = element("tbody");
  for (const id of membres) tbody.append(ligne([nomDe(id), ...modules.map((m) => fmt(parMembre[id].modules[m])), fmt(parMembre[id].appels ? parMembre[id] : null)]));
  tbody.append(ligne([t("efTotal"), ...modules.map((m) => fmt(total.modules[m])), fmt(total.appels ? total : null)]));
  table.replaceChildren(element("caption", { classe: "visuellement-cache", cle: "efConsommations" }), thead, tbody);
}

/* Constructeur de cahier en mode famille : même dialogue, destination l'enfant choisi. */

function ouvrirConstructeurFamille(enfantId) {
  const enfant = familleEtat.tableau?.enfants.find((e) => e.id === enfantId);
  if (!enfant) return;
  constructeur.enfant = enfant;
  const select = $("#cahier-type-famille");
  select.replaceChildren(...TYPES_CAHIERS.filter((ty) => ty !== "brouillon").map((ty) => option(ty, t(`cahier_${ty}`))));
  select.value = "exercices";
  ouvrirConstructeur("exercices");
}

function basculerModeFamilleConstructeur() {
  const enfant = constructeur.enfant;
  $("#cahier-famille-zone").hidden = !enfant;
  $("#cahier-titre-zone").hidden = !!enfant;
  if (enfant) $("#cahier-famille-pour").textContent = t("efCahierPour", { prenom: enfant.prenom });
}

async function assignerCahierFamille({ type, ids, longueur, univers, objectif }) {
  const enfant = constructeur.enfant;
  const retour = $("#retour-cahier");
  if (!ids.length) { retour.textContent = t("cahierChoisirNotion"); return; }
  constructeur.envoi = true;
  $("#construire-cahier").disabled = true;
  retour.textContent = t($("#cahier-ia").checked ? "cahierPreparation" : "synchroEnCours");
  try {
    const r = await apiFamilleLocale("cahiers", {
      methode: "POST",
      corps: { enfantId: enfant.id, type, notions: ids, longueur, univers, objectif, langue: etat.langue, utiliserLlm: $("#cahier-ia").checked }
    });
    if (r.statut !== 201) { retour.textContent = messageFamille(r); return; }
    $("#constructeur-cahier").close();
    notifier(t(r.donnees.source === "ia" ? "efCahierAssigneIa" : "efCahierAssigne", { prenom: enfant.prenom }), "📒");
    await chargerTableauFamille();
  } catch {
    retour.textContent = t("efErreur_generique");
  } finally {
    constructeur.envoi = false;
    $("#construire-cahier").disabled = false;
  }
}

function brancherFamilleLocale() {
  ECRANS.push("espace-famille");
  // « Ma famille » sans rôle parent : « Mon compte », bloc Famille (situation, invitation d'un parent).
  $("#nav-famille").addEventListener("click", (e) => {
    if (e.currentTarget.dataset.nav !== "compte") return;
    requestAnimationFrame(() => $("#famille-compte").scrollIntoView({ block: "start", behavior: mouvementReduit() ? "auto" : "smooth" }));
  });
  $("#famille-inviter").addEventListener("click", inviterParent);
  $("#famille-annuler-invitation").addEventListener("click", annulerInvitation);
  $("#liste-cahiers-famille").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cahier-famille]");
    if (b) void commencerCahierFamille(b.dataset.cahierFamille);
  });
  $("#formulaire-calibrage").addEventListener("submit", validerCalibrage);
  brancherDialogue($("#calibrage-cahier"), $("#fermer-calibrage"));
  $("#cahier-type-famille").addEventListener("change", (e) => { constructeur.type = e.target.value; });
  $("#constructeur-cahier").addEventListener("close", () => { constructeur.enfant = null; basculerModeFamilleConstructeur(); });
  brancherEspaceFamille();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && bilanAttendu()) void envoyerBilanFamille(); });
  void chargerFamille();
}

/* ---------- Expérience Professeur (ADR 0030) ---------- */
// Réservée au rôle Professeur (permission `professeur`, attribuée dans le back-office) : profil (nom affiché, matières,
// niveaux), « Mes classes » (classes, liens d'invitation) et « Mes élèves » (suivi des élèves affiliés). Elle complète
// l'expérience Contributeur (relecture et décisions, ADR 0023). Côté élève : rejoindre un professeur par un lien ou un
// code, avec accord explicite, et quitter. « Tester les rôles → Professeur » utilise le double web/demo-professeur.js.
const profEtat = { moi: null, classes: null, eleves: null, activites: null, mesProfs: [], filtre: "tous", filtreSuivi: "tous", lien: null, adhesion: null, occupe: false };
const CLE_REJOINDRE = "kermiclab:rejoindre";
const profDemo = () => demoContribActive() && contrib.etatDemo?.connecte === true && contrib.etatDemo.role === "prof";
const profActif = () => profDemo() || profEtat.moi?.professeur === true;
const codeEnAttente = () => lireCle(sessionPreferences(), CLE_REJOINDRE);

function etatDemoProf() {
  const notions = etat.registre?.deType("notion").filter((e) => e.matiere === "mathematiques").map((e) => e.id) ?? [];
  return demoProf.lireEtat(lireCle(sessionPreferences(), demoProf.CLE_DEMO), { aujourdhui: progression.jourLocal(), notions });
}
const moiProf = () => (profDemo() ? { professeur: true, profil: etatDemoProf().profil } : profEtat.moi);

/** API du professeur ; `reel` force le Worker (routes de l'élève, jamais simulées). */
async function apiProf(route, { methode = "GET", corps, reel = false } = {}) {
  if (!reel && profDemo()) {
    const r = demoProf.traiter(etatDemoProf(), methode, route, corps ?? {}, { matiereDe: (id) => notionParId(id)?.matiere ?? null });
    ecrireCle(sessionPreferences(), demoProf.CLE_DEMO, JSON.stringify(r.etat));
    return { statut: r.statut, donnees: r.donnees };
  }
  const jeton = jetonFamille();
  if (!jeton) return { statut: 401, donnees: { erreur: "non-connecte" } };
  const r = await fetch(urlApi(`/api/professeur/${route}`), {
    method: methode, credentials: "omit", cache: "no-store",
    headers: { authorization: `Bearer ${jeton}`, ...(corps ? { "content-type": "application/json" } : {}) },
    body: corps ? JSON.stringify(corps) : undefined
  });
  let donnees = null;
  try { donnees = await r.json(); } catch { /* 204 */ }
  return { statut: r.status, donnees };
}

function messageProf(r) {
  const code = r?.donnees?.erreur;
  if (typeof code === "string" && etat.textes[`profErreur_${code}`]) return t(`profErreur_${code}`, { max: professeur.MAX_PROFS_ELEVE });
  if (typeof code === "string" && code.startsWith("pseudo-")) return t(`pseudoErreur_${code.slice(7)}`, { min: profil.PSEUDO_MIN, max: profil.PSEUDO_MAX });
  if (r?.statut === 401) return t("efErreur_session");
  if (r?.statut === 503) return t("efErreur_indisponible");
  if (r?.statut === 429) return t("synchroTropDeTentatives");
  return t("efErreur_generique");
}

const libelleMatiere = (m) => t(`matiere_${m}`);
const libelleNiveau = (n) => t(`profNiveau_${n}`);
const dateCourte = (jour) => (jour ? new Intl.DateTimeFormat(etat.langue, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${String(jour).slice(0, 10)}T12:00:00Z`)) : "");
const dateHeure = (secondes) => new Intl.DateTimeFormat(etat.langue, { dateStyle: "medium", timeStyle: "short" }).format(new Date(secondes * 1000));

/** Situation du compte connecté : professeur (rôle) et professeurs suivis (élève). Appelé après chargerFamille. */
async function chargerProf() {
  if (!jetonFamille()) { oublierProf(); return; }
  try {
    const [moi, mes] = await Promise.all([apiProf("moi", { reel: true }), apiProf("mes-professeurs", { reel: true })]);
    profEtat.moi = moi.statut === 200 ? moi.donnees : null;
    profEtat.mesProfs = mes.statut === 200 && Array.isArray(mes.donnees?.professeurs) ? mes.donnees.professeurs : [];
  } catch {
    profEtat.moi = null;
    profEtat.mesProfs = [];
  }
  actualiserContributionsLocales();
  rendreMesProfs();
  await chargerMesActivites();
  if (profEtat.mesProfs.length) planifierBilanFamille({ immediat: true });
  const code = codeEnAttente();
  if (code) void ouvrirAdhesion(code);
}

function oublierProf() {
  Object.assign(profEtat, { moi: null, classes: null, eleves: null, activites: null, mesProfs: [], lien: null });
  activitesEtat.mesActivites = [];
  actualiserContributionsLocales();
  rendreMesProfs();
  rendreActivitesEleve();
}

/**
 * Le rôle du compte local vient d'être lu (ou oublié) : menus Contributions et Professeur à jour, contributions
 * rechargées pour ce compte, et ouverture de l'écran demandé par l'adresse (#contributions) s'il devient accessible.
 */
function actualiserContributionsLocales() {
  const cle = roleContribLocal() ? `${profEtat.moi.id}:${roleContribLocal()}` : null;
  if (cle !== contrib.compteLocal) {
    contrib.compteLocal = cle;
    Object.assign(contrib, { chargee: false, miennes: [], relecture: [] });
  }
  rafraichirContributions();
  if (location.hash === "#contributions" && etat.ecran !== "contributions" && contributionsActives()) afficherEcran("contributions", { focus: false });
  else if (etat.ecran === "contributions" && contributionsActives() && !contrib.chargee) void chargerContributions();
}

function rafraichirProfNav() {
  const actif = profActif();
  for (const id of ["#nav-suivi", "#nav-classes", "#nav-eleves", "#nav-mobile-suivi"]) $(id).hidden = !actif;
  $("#profil-prof").hidden = !actif;
  const contribVisible = !$("#nav-contributions").hidden;
  document.querySelectorAll("[data-prof-contrib]").forEach((b) => { b.hidden = !contribVisible; });
  if (actif && etat.ecran === "profil") remplirProfilProf();
}

/* Profil du professeur */

function remplirProfilProf() {
  const p = moiProf()?.profil;
  $("#prof-nom").value = p?.nomAffiche ?? "";
  document.querySelectorAll("#prof-matieres input").forEach((c) => { c.checked = !!p?.matieres.includes(c.value); });
  document.querySelectorAll("#prof-niveaux input").forEach((c) => { c.checked = !!p?.niveaux.includes(c.value); });
  $("#prof-profil-erreur").textContent = "";
}

function casesProf(zone, valeurs, libelle, nom) {
  for (const v of valeurs) {
    const label = element("label", { classe: "prof-case" });
    label.append(element("input", { attributs: { type: "checkbox", name: nom, value: v } }), element("span", { texte: libelle(v) }));
    zone.append(label);
  }
}

async function enregistrerProfilProf(ev) {
  ev.preventDefault();
  if (profEtat.occupe) return;
  const coches = (zone) => [...document.querySelectorAll(`${zone} input:checked`)].map((c) => c.value);
  const corps = { nomAffiche: $("#prof-nom").value, matieres: coches("#prof-matieres"), niveaux: coches("#prof-niveaux") };
  const v = professeur.validerProfilProf(corps);
  if (!v.ok) { $("#prof-profil-erreur").textContent = t(`profErreur_${v.code}`, { min: professeur.NOM_AFFICHE_MIN, max: professeur.NOM_AFFICHE_MAX }); return; }
  profEtat.occupe = true;
  $("#prof-profil-erreur").textContent = t("synchroEnCours");
  try {
    const r = await apiProf("profil", { methode: "PUT", corps: v.profil });
    if (r.statut !== 200) { $("#prof-profil-erreur").textContent = messageProf(r); return; }
    if (profEtat.moi) profEtat.moi.profil = r.donnees.profil;
    $("#prof-profil-erreur").textContent = "";
    notifier(t("profProfilEnregistre"), "🧑‍🏫");
  } catch {
    $("#prof-profil-erreur").textContent = t("efErreur_generique");
  } finally {
    profEtat.occupe = false;
  }
}

/* Mes classes */

const etatEcranProf = () => {
  if (profActif()) return "";
  return t(!jetonFamille() ? "profConnexionRequise" : "profRoleRequis");
};

async function ouvrirClasses() {
  if (!profActif()) { profEtat.classes = null; rendreClasses(); return; }
  $("#classes-etat").textContent = t("efChargement");
  try {
    const r = await apiProf("classes");
    profEtat.classes = r.statut === 200 ? r.donnees : null;
    $("#classes-etat").textContent = r.statut === 200 ? "" : messageProf(r);
  } catch {
    profEtat.classes = null;
    $("#classes-etat").textContent = t("efErreur_generique");
  }
  rendreClasses();
}

function selectDuree(attributs = {}) {
  const s = element("select", { attributs: { "aria-label": t("profDuree"), ...attributs } });
  for (const n of professeur.DUREES_INVITATION_JOURS) s.append(option(String(n), t("profDureeJours", { n })));
  s.value = String(professeur.DUREE_INVITATION_DEFAUT);
  return s;
}

function ligneInvitation(i) {
  const li = element("li", { classe: "ef-cahier" });
  const usage = i.mode === "classe" ? t("profLienUtilise", { n: i.utilisations, max: i.max }) : t("profLienUnique");
  li.append(element("span", { texte: `${t("profLienActif")} · ${t("profLienExpire", { date: dateHeure(i.expire) })} · ${usage}` }),
    element("button", { classe: "secondaire petit-bouton", cle: "profRevoquer", attributs: { type: "button", "data-prof-revoquer": i.id } }));
  return li;
}

function rendreClasses() {
  const donnees = profEtat.classes;
  if (!donnees) {
    $("#classes-contenu").hidden = true;
    if (!$("#classes-etat").textContent || !profActif()) $("#classes-etat").textContent = etatEcranProf();
    return;
  }
  $("#classes-contenu").hidden = false;
  const p = moiProf()?.profil;
  $("#classes-profil").textContent = p
    ? t("profResume", { nom: p.nomAffiche, matieres: p.matieres.map(libelleMatiere).join(", "), niveaux: p.niveaux.map(libelleNiveau).join(", ") })
    : t("profProfilManquant");
  $("#classe-matiere").replaceChildren(...(p?.matieres ?? []).map((m) => option(m, libelleMatiere(m))));
  $("#classe-niveau").replaceChildren(...(p?.niveaux ?? []).map((n) => option(n, libelleNiveau(n))));
  $("#classes-ajout").hidden = !p || donnees.classes.length >= donnees.limites.classes;
  $("#classes-vide").hidden = donnees.classes.length > 0;
  $("#classes-liste").replaceChildren(...donnees.classes.map((c) => carteClasse(c, donnees)));
  $("#classes-particuliers").textContent = t("profParticuliersResume", { n: donnees.particuliers });
  $("#particulier-lien").disabled = !p;
  $("#particulier-invitations").replaceChildren(...donnees.invitations.filter((i) => i.mode === "particulier").map(ligneInvitation));
  rendreLienCree();
}

function carteClasse(c, donnees) {
  const carte = element("article", { classe: "carte ef-enfant prof-classe", attributs: { "data-classe": c.id } });
  const tete = element("div", { classe: "ef-enfant-tete" });
  const nom = element("div", { classe: "famille-enfant-nom" });
  nom.append(element("h4", { texte: c.nom }), element("span", { classe: "doux petit", texte: `${libelleMatiere(c.matiere)} · ${libelleNiveau(c.niveau)}` }));
  tete.append(nom, element("span", { classe: `pastille ${c.eleves ? "ok" : "neutre"}`, texte: t("profEffectif", { n: c.eleves, max: donnees.limites.elevesParClasse }) }));
  carte.append(tete);
  const invitations = donnees.invitations.filter((i) => i.classeId === c.id);
  if (invitations.length) {
    const ul = element("ul", { classe: "prof-invitations" });
    ul.append(...invitations.map(ligneInvitation));
    carte.append(ul);
  }
  const actions = element("div", { classe: "actions" });
  actions.append(selectDuree({ "data-duree-classe": c.id }),
    element("button", { classe: "bouton petit-bouton", cle: "profLienClasse", attributs: { type: "button", "data-classe-lien": c.id } }),
    element("button", { classe: "secondaire petit-bouton", cle: "profVoirEleves", attributs: { type: "button", "data-classe-eleves": c.id } }),
    element("button", { classe: "secondaire petit-bouton", cle: "actDonnerClasse", attributs: { type: "button", "data-activite-classe": c.id } }));
  carte.append(actions);
  // Modifier, supprimer.
  const gestion = element("details", { classe: "famille-ajout ef-gestion" });
  gestion.append(element("summary", { cle: "profGererClasse" }));
  const corps = element("div", { classe: "ef-gestion-corps" });
  const form = element("form", { classe: "formulaire-profil", attributs: { "data-classe-modifier": c.id, novalidate: "" } });
  const id = c.id.slice(-8);
  form.append(champ(`classe-nom-${id}`, "profClasseNom", { type: "text", maxlength: "30", value: c.nom, name: "nom" }));
  const p = moiProf()?.profil;
  const matiere = element("select", { attributs: { name: "matiere", "aria-label": t("profMatiere") } });
  for (const m of new Set([...(p?.matieres ?? []), c.matiere])) matiere.append(option(m, libelleMatiere(m)));
  matiere.value = c.matiere;
  const niveau = element("select", { attributs: { name: "niveau", "aria-label": t("profNiveau") } });
  for (const n of new Set([...(p?.niveaux ?? []), c.niveau])) niveau.append(option(n, libelleNiveau(n)));
  niveau.value = c.niveau;
  form.append(matiere, niveau, element("button", { classe: "secondaire petit-bouton", cle: "efEnregistrer", attributs: { type: "submit" } }));
  const sortie = element("div", { classe: "actions" });
  sortie.append(element("p", { classe: "doux petit", cle: "profSupprimerClasseAide" }),
    element("button", { classe: "danger petit-bouton", cle: "profSupprimerClasse", attributs: { type: "button", "data-classe-supprimer": c.id } }));
  corps.append(form, sortie, element("p", { classe: "erreur-champ", attributs: { role: "status", "data-classe-message": c.id } }));
  gestion.append(corps);
  carte.append(gestion);
  return carte;
}

function rendreLienCree() {
  const l = profEtat.lien;
  $("#classes-lien").hidden = !l;
  if (!l) return;
  const classe = profEtat.classes?.classes.find((c) => c.id === l.classeId);
  $("#classes-lien-url").value = professeur.lienInvitation(location.origin, l.code);
  $("#classes-lien-code").textContent = professeur.afficherCodeProf(l.code);
  $("#classes-lien-aide").textContent = t(l.mode === "classe" ? "profLienAideClasse" : "profLienAideParticulier", { classe: classe?.nom ?? "", date: dateHeure(l.expire) });
  $("#classes-lien-simuler").hidden = !profDemo();
}

async function actionProf(route, corps, { message, succes, recharger = ouvrirClasses } = {}) {
  if (profEtat.occupe) return null;
  profEtat.occupe = true;
  if (message) message(t("synchroEnCours"));
  try {
    const r = await apiProf(route, { methode: "POST", corps: corps ?? {} });
    if (r.statut >= 300) { if (message) message(messageProf(r)); else notifier(messageProf(r), "⚠️"); return null; }
    if (succes) notifier(succes, "🧑‍🏫");
    profEtat.occupe = false;
    await recharger();
    return r;
  } catch {
    if (message) message(t("efErreur_generique"));
    return null;
  } finally {
    profEtat.occupe = false;
  }
}

async function creerLien(mode, classeId, dureeJours) {
  const r = await actionProf("invitations", { mode, classeId, dureeJours });
  if (!r) return;
  profEtat.lien = r.donnees;
  rendreLienCree();
  $("#classes-lien").scrollIntoView({ block: "nearest" });
  $("#classes-lien-url").select();
}

async function creerClasse(ev) {
  ev.preventDefault();
  const corps = { nom: $("#classe-nom").value, matiere: $("#classe-matiere").value, niveau: $("#classe-niveau").value };
  const v = professeur.validerClasse(corps, moiProf()?.profil);
  if (!v.ok) { $("#classe-erreur").textContent = t(`profErreur_${v.code}`, { max: professeur.NOM_CLASSE_MAX }); return; }
  const r = await actionProf("classes", v.classe, { message: (m) => { $("#classe-erreur").textContent = m; }, succes: t("profClasseCreee", { nom: v.classe.nom }) });
  if (!r) return;
  $("#formulaire-classe").reset();
  $("#classe-erreur").textContent = "";
  $("#classes-ajout").open = false;
}

function brancherClasses() {
  $("#formulaire-classe").addEventListener("submit", creerClasse);
  $("#classes-actualiser").addEventListener("click", () => void ouvrirClasses());
  $("#particulier-duree").replaceWith(selectDuree({ id: "particulier-duree" }));
  $("#particulier-lien").addEventListener("click", () => void creerLien("particulier", null, Number($("#particulier-duree").value)));
  $("#classes-lien-fermer").addEventListener("click", () => { profEtat.lien = null; rendreLienCree(); });
  $("#classes-lien-copier").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("#classes-lien-url").value); notifier(t("profLienCopie"), "📋"); }
    catch { $("#classes-lien-url").select(); }
  });
  $("#classes-lien-simuler").addEventListener("click", async () => {
    const r = await actionProf(`demo/simuler/${profEtat.lien?.id}`, {});
    if (r) notifier(t("profDemoInscrit", { pseudo: r.donnees.pseudo }), "🎒");
  });
  const zone = $("#classes");
  zone.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.classeLien) void creerLien("classe", b.dataset.classeLien, Number(document.querySelector(`[data-duree-classe="${b.dataset.classeLien}"]`)?.value));
    else if (b.dataset.classeEleves) { profEtat.filtre = b.dataset.classeEleves; naviguer("eleves"); }
    else if (b.dataset.profRevoquer) void actionProf(`invitations/${b.dataset.profRevoquer}/revoquer`, {}, { succes: t("profLienRevoque") });
    else if (b.dataset.classeSupprimer) {
      // Confirmation en deux temps : les élèves de la classe ne sont plus suivis.
      if (b.dataset.confirmer !== "1") { b.dataset.confirmer = "1"; b.textContent = t("profSupprimerClasseConfirmer"); return; }
      const id = b.dataset.classeSupprimer;
      void actionProf(`classes/${id}/supprimer`, {}, { succes: t("profClasseSupprimee") });
    }
  });
  zone.addEventListener("submit", (ev) => {
    const f = ev.target;
    if (!f.dataset.classeModifier) return;
    ev.preventDefault();
    const id = f.dataset.classeModifier;
    const message = (m) => { const p = document.querySelector(`[data-classe-message="${id}"]`); if (p) p.textContent = m; };
    void actionProf(`classes/${id}/modifier`, Object.fromEntries(new FormData(f)), { message, succes: t("efModifie") });
  });
}

/* Mes élèves */

async function ouvrirEleves() {
  if (!profActif()) { profEtat.eleves = null; rendreEleves(); return; }
  $("#eleves-etat").textContent = t("efChargement");
  try {
    const [r] = await Promise.all([apiProf("eleves"), chargerActivitesProf()]);
    profEtat.eleves = r.statut === 200 ? r.donnees : null;
    $("#eleves-etat").textContent = r.statut === 200 ? "" : messageProf(r);
  } catch {
    profEtat.eleves = null;
    $("#eleves-etat").textContent = t("efErreur_generique");
  }
  rendreEleves();
}

const nomClasse = (id) => profEtat.eleves?.classes.find((c) => c.id === id)?.nom ?? t("profParticulier");

function rendreEleves() {
  const donnees = profEtat.eleves;
  if (!donnees) {
    $("#eleves-contenu").hidden = true;
    if (!$("#eleves-etat").textContent || !profActif()) $("#eleves-etat").textContent = etatEcranProf();
    return;
  }
  $("#eleves-contenu").hidden = false;
  const filtre = $("#eleves-filtre");
  filtre.replaceChildren(option("tous", t("profTousEleves")), ...donnees.classes.map((c) => option(c.id, c.nom)), option("particulier", t("profParticuliers")));
  if (![...filtre.options].some((o) => o.value === profEtat.filtre)) profEtat.filtre = "tous";
  filtre.value = profEtat.filtre;
  const liste = professeur.filtrerEleves(donnees.eleves, profEtat.filtre);
  const jour = progression.jourLocal();
  const s = professeur.syntheseEleves(liste, jour);
  $("#eleves-chiffres").replaceChildren(
    chiffre(t("profChiffreEleves"), s.eleves), chiffre(t("profChiffreActifs"), s.actifs),
    chiffre(t("efChiffreTemps"), formatMinutes(s.minutes)), chiffre(t("profChiffreARevoir"), s.aRevoir)
  );
  const aRevoir = professeur.notionsARevoir(liste).map((n) => `${notionParId(n.id)?.titre ?? n.id} (${n.n})`);
  $("#eleves-a-revoir").textContent = aRevoir.length ? t("profARevoirGroupe", { liste: aRevoir.join(", ") }) : "";
  const pseudoDe = (id) => liste.find((e) => e.id === id)?.pseudo ?? "";
  $("#eleves-alertes").replaceChildren(...s.alertes.map((a) => element("li", { texte: t(`profAlerte_${a.type}`, { pseudo: pseudoDe(a.eleve), n: a.n ?? a.jours ?? "" }) })));
  $("#eleves-vide").hidden = liste.length > 0;
  $("#eleves-liste").replaceChildren(...liste.map(carteEleve));
}

function carteEleve(e) {
  const carte = element("article", { classe: "carte ef-enfant", attributs: { "data-eleve": e.id } });
  const tete = element("div", { classe: "ef-enfant-tete" });
  const nom = element("div", { classe: "famille-enfant-nom" });
  nom.append(element("h4", { texte: e.pseudo }), element("span", { classe: "doux petit", texte: `${nomClasse(e.classeId)} · ${t("profDepuis", { date: dateCourte(e.rejointLe) })}` }));
  tete.append(nom);
  const b = e.bilan;
  const jour = progression.jourLocal();
  if (!b) tete.append(element("span", { classe: "pastille neutre", cle: "efJamaisVu" }));
  else {
    const vu = b.dernierJour ? familleModule.ecartJours(b.dernierJour, jour) : null;
    tete.append(element("span", { classe: `pastille ${vu !== null && vu < familleModule.JOURS_INACTIVITE ? "ok" : "en-cours"}`, texte: vu === null ? t("efJamaisActif") : vu === 0 ? t("efActifAujourdhui") : t("efActifIlYa", { n: vu }) }));
  }
  carte.append(tete);
  if (b) {
    const sem = familleModule.semaineBilan(b, jour);
    const rep = familleModule.repartitionNotions(b);
    const stats = element("dl", { classe: "stats stats-progression" });
    stats.append(chiffre(t("niveauLong", { n: "" }).trim(), b.niveau), chiffre(t("efSerie"), b.serie), chiffre(t("efXpSemaine"), sem.xp), chiffre(t("efTempsSemaine"), formatMinutes(sem.minutes)));
    carte.append(stats, barresSemaine(b, jour));
    carte.append(element("p", { classe: "doux petit", texte: t("efNotionsResume", { maitrisees: rep.maitrisee, encours: rep["en-cours"], arevoir: rep["a-revoir"], decouvertes: rep.decouverte }) }));
    const aRevoir = Object.entries(b.notions).filter(([, n]) => n.etat === "a-revoir").map(([id]) => notionParId(id)?.titre ?? id).slice(0, 5);
    if (aRevoir.length) carte.append(element("p", { classe: "petit", texte: t("efARevoirListe", { liste: aRevoir.join(", ") }) }));
  }
  const activitesBloc = activitesDeLEleve(e);
  if (activitesBloc) carte.append(activitesBloc);
  const agir = element("div", { classe: "actions" });
  agir.append(element("button", { classe: "bouton petit-bouton", cle: "actDonner", attributs: { type: "button", "data-activite-eleve": e.id } }));
  carte.append(agir);
  const gestion = element("details", { classe: "famille-ajout ef-gestion" });
  gestion.append(element("summary", { cle: "profGererEleve" }));
  const corps = element("div", { classe: "ef-gestion-corps" });
  const form = element("form", { classe: "formulaire-profil", attributs: { "data-eleve-deplacer": e.id, novalidate: "" } });
  const cible = element("select", { attributs: { name: "classeId", "aria-label": t("profDeplacerVers") } });
  cible.append(...(profEtat.eleves?.classes ?? []).map((c) => option(c.id, c.nom)), option("", t("profParticulier")));
  cible.value = e.classeId ?? "";
  form.append(element("label", { classe: "etiquette-champ", cle: "profDeplacerVers" }), cible,
    element("button", { classe: "secondaire petit-bouton", cle: "profDeplacer", attributs: { type: "submit" } }));
  const sortie = element("div", { classe: "actions" });
  sortie.append(element("p", { classe: "doux petit", cle: "profRetirerAide" }),
    element("button", { classe: "danger petit-bouton", cle: "profRetirer", attributs: { type: "button", "data-eleve-retirer": e.id } }));
  corps.append(form, sortie, element("p", { classe: "erreur-champ", attributs: { role: "status", "data-eleve-message": e.id } }));
  gestion.append(corps);
  carte.append(gestion);
  return carte;
}

function brancherEleves() {
  $("#eleves-actualiser").addEventListener("click", () => void ouvrirEleves());
  $("#eleves-filtre").addEventListener("change", (e) => { profEtat.filtre = e.currentTarget.value; rendreEleves(); });
  const zone = $("#eleves-liste");
  const message = (id) => (m) => { const p = document.querySelector(`[data-eleve-message="${id}"]`); if (p) p.textContent = m; };
  zone.addEventListener("submit", (ev) => {
    const f = ev.target;
    if (!f.dataset.eleveDeplacer) return;
    ev.preventDefault();
    const id = f.dataset.eleveDeplacer;
    const classeId = new FormData(f).get("classeId") || null;
    void actionProf(`eleves/${id}/deplacer`, { classeId }, { message: message(id), succes: t("profEleveDeplace"), recharger: ouvrirEleves });
  });
  zone.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-eleve-retirer]");
    if (!b) return;
    if (b.dataset.confirmer !== "1") { b.dataset.confirmer = "1"; b.textContent = t("profRetirerConfirmer"); return; }
    const id = b.dataset.eleveRetirer;
    void actionProf(`eleves/${id}/retirer`, {}, { message: message(id), succes: t("profEleveRetire"), recharger: ouvrirEleves });
  });
}

/* Côté élève : mes professeurs, rejoindre par un lien ou un code */

/** Un lien d'invitation ouvert (`?rejoindre=CODE`) : le code est gardé pour l'onglet et retiré de l'adresse. */
function capturerInvitationProf() {
  const url = new URL(location.href);
  if (!url.searchParams.has("rejoindre")) return;
  const code = professeur.normaliserCodeProf(url.searchParams.get("rejoindre"));
  url.searchParams.delete("rejoindre");
  history.replaceState(null, "", url.href);
  if (code) ecrireCle(sessionPreferences(), CLE_REJOINDRE, code);
}

function rendreMesProfs() {
  const lie = !!jetonFamille();
  const attente = !!codeEnAttente();
  $("#prof-compte").hidden = !lie;
  $("#prof-compte-attente").hidden = lie || !attente;
  $("#formulaire-code-prof").hidden = !lie;
  $("#mes-profs-vide").hidden = !lie || profEtat.mesProfs.length > 0;
  $("#mes-profs").replaceChildren(...profEtat.mesProfs.map((p) => {
    const li = element("li", { classe: "ef-cahier" });
    const ou = p.classe ? `${p.classe.nom} · ${libelleMatiere(p.classe.matiere)}` : `${t("profParticulier")} · ${p.matieres.map(libelleMatiere).join(", ")}`;
    li.append(element("span", { texte: `${p.professeur} — ${ou} · ${t("mesProfsPseudo", { pseudo: p.pseudo })}` }),
      element("button", { classe: "secondaire petit-bouton", cle: "mesProfsQuitter", attributs: { type: "button", "data-quitter-prof": p.id } }));
    return li;
  }));
}

async function ouvrirAdhesion(code) {
  if (!jetonFamille()) { rendreMesProfs(); return; }
  if (profEtat.adhesion || $("#dialogue-rejoindre").open) return;
  let r;
  try { r = await apiProf(`invitation/${code}`, { reel: true }); } catch { r = { statut: 0 }; }
  effacerCle(sessionPreferences(), CLE_REJOINDRE);
  rendreMesProfs();
  if (r.statut !== 200 || r.donnees?.soiMeme) {
    naviguer("compte");
    $("#code-prof-erreur").textContent = r.donnees?.soiMeme ? t("profErreur_propre-invitation") : messageProf(r);
    return;
  }
  const d = r.donnees;
  profEtat.adhesion = { code };
  $("#rejoindre-resume").textContent = d.classe
    ? t("rejoindreResumeClasse", { prof: d.professeur, classe: d.classe.nom, matiere: libelleMatiere(d.classe.matiere), niveau: libelleNiveau(d.classe.niveau) })
    : t("rejoindreResumeParticulier", { prof: d.professeur, matieres: d.matieres.map(libelleMatiere).join(", ") });
  if (d.deja) $("#rejoindre-resume").textContent += ` ${t("rejoindreDeja")}`;
  $("#rejoindre-pseudo").value = etat.pseudo ?? "";
  $("#rejoindre-accord").checked = false;
  $("#rejoindre-erreur").textContent = "";
  $("#dialogue-rejoindre").showModal();
}

async function validerAdhesion(ev) {
  ev.preventDefault();
  const a = profEtat.adhesion;
  if (!a || profEtat.occupe) return;
  const pseudo = profil.validerPseudo($("#rejoindre-pseudo").value);
  if (!pseudo.ok) { $("#rejoindre-erreur").textContent = t(`pseudoErreur_${pseudo.erreur}`, { min: profil.PSEUDO_MIN, max: profil.PSEUDO_MAX }); return; }
  if (!$("#rejoindre-accord").checked) { $("#rejoindre-erreur").textContent = t("profErreur_accord-requis"); return; }
  profEtat.occupe = true;
  $("#rejoindre-valider").disabled = true;
  try {
    const r = await apiProf("rejoindre", { methode: "POST", corps: { code: a.code, pseudo: pseudo.pseudo, accord: professeur.VERSION_ACCORD_ELEVE }, reel: true });
    if (r.statut !== 201) { $("#rejoindre-erreur").textContent = messageProf(r); return; }
    profEtat.adhesion = null;
    $("#dialogue-rejoindre").close();
    notifier(t("rejoindreOk", { prof: r.donnees.professeur }), "🎒");
    profEtat.occupe = false;
    await chargerProf();
  } catch {
    $("#rejoindre-erreur").textContent = t("efErreur_generique");
  } finally {
    profEtat.occupe = false;
    $("#rejoindre-valider").disabled = false;
  }
}

function brancherProfesseur() {
  ECRANS.push("classes", "eleves");
  casesProf($("#prof-matieres"), professeur.MATIERES_PROF, libelleMatiere, "matieres");
  casesProf($("#prof-niveaux"), professeur.NIVEAUX_PROF, libelleNiveau, "niveaux");
  $("#formulaire-profil-prof").addEventListener("submit", enregistrerProfilProf);
  brancherClasses();
  brancherEleves();
  brancherActivitesProf();
  $("#formulaire-code-prof").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const code = professeur.normaliserCodeProf($("#code-prof").value);
    $("#code-prof-erreur").textContent = code ? "" : t("profErreur_code-invalide");
    if (code) { $("#code-prof").value = ""; void ouvrirAdhesion(code); }
  });
  $("#formulaire-rejoindre").addEventListener("submit", validerAdhesion);
  $("#rejoindre-annuler").addEventListener("click", () => $("#dialogue-rejoindre").close());
  $("#dialogue-rejoindre").addEventListener("close", () => { profEtat.adhesion = null; });
  $("#mes-profs").addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-quitter-prof]");
    if (!b || profEtat.occupe) return;
    if (b.dataset.confirmer !== "1") { b.dataset.confirmer = "1"; b.textContent = t("mesProfsQuitterConfirmer"); return; }
    const r = await apiProf(`mes-professeurs/${b.dataset.quitterProf}/quitter`, { methode: "POST", corps: {}, reel: true }).catch(() => ({ statut: 0 }));
    if (r.statut !== 204) { $("#code-prof-erreur").textContent = messageProf(r); return; }
    notifier(t("mesProfsQuitte"), "👋");
    await chargerProf();
  });
  rafraichirProfNav();
  rendreMesProfs();
  // Lien ouvert sans compte lié : l'élève est guidé vers « Mon compte » ; l'adhésion reprend après la connexion.
  if (codeEnAttente() && !jetonFamille()) setTimeout(() => naviguer("compte"), 0);
}

/* ---------- Activités du professeur et tableau de bord (ADR 0030 §9) ---------- */
// Le professeur donne des défis (5 questions), des évaluations (5 à 40 questions), des cahiers et des objectifs à un
// élève ou à toute une classe. Les questions sont des QCM publiés du catalogue, tirés de façon reproductible ; l'appareil
// de l'élève n'envoie que des compteurs (réussies, total, durée). Le tableau de bord est calculé dans le navigateur.
const activitesEtat = { cible: null, quiz: null, mesActivites: [], minuteur: null, debut: 0 };

const titreActivite = (a) => a.parametres?.libelle
  || [t(`actType_${a.type}`), (a.parametres?.notions ?? []).slice(0, 2).map((id) => notionParId(id)?.titre ?? id).join(", ")].filter(Boolean).join(" · ");
const cibleActivite = (a, classes, eleves) => (a.eleveId
  ? eleves.find((e) => e.id === a.eleveId)?.pseudo ?? "—"
  : t("actCibleClasse", { classe: classes.find((c) => c.id === a.classeId)?.nom ?? "—" }));
const pct = (v) => (v === null || v === undefined ? "—" : `${v} %`);

/** Élèves, classes, activités et résultats du professeur (le tableau de bord et « Mes élèves » s'en servent). */
async function chargerActivitesProf() {
  try {
    const r = await apiProf("activites");
    profEtat.activites = r.statut === 200 ? r.donnees : null;
  } catch {
    profEtat.activites = null;
  }
}

async function ouvrirTableauProf() {
  if (!profActif()) { profEtat.eleves = null; rendreTableauProf(); return; }
  $("#suivi-etat").textContent = t("efChargement");
  try {
    const [r] = await Promise.all([apiProf("eleves"), chargerActivitesProf()]);
    profEtat.eleves = r.statut === 200 ? r.donnees : null;
    $("#suivi-etat").textContent = r.statut === 200 ? "" : messageProf(r);
  } catch {
    profEtat.eleves = null;
    $("#suivi-etat").textContent = t("efErreur_generique");
  }
  rendreTableauProf();
}

function rendreTableauProf() {
  const d = profEtat.eleves;
  if (!d || !profEtat.activites) {
    $("#suivi-contenu").hidden = true;
    if (!$("#suivi-etat").textContent || !profActif()) $("#suivi-etat").textContent = etatEcranProf();
    return;
  }
  $("#suivi-contenu").hidden = false;
  const filtre = $("#suivi-filtre");
  filtre.replaceChildren(option("tous", t("suiviToutes")), ...d.classes.map((c) => option(c.id, c.nom)), option("particulier", t("profParticuliers")));
  if (![...filtre.options].some((o) => o.value === profEtat.filtreSuivi)) profEtat.filtreSuivi = "tous";
  filtre.value = profEtat.filtreSuivi;
  const eleves = professeur.filtrerEleves(d.eleves, profEtat.filtreSuivi);
  const ids = new Set(eleves.map((e) => e.id));
  const activites = profEtat.activites.activites.filter((a) => profEtat.filtreSuivi === "tous" || professeur.elevesCibles(a, eleves).length);
  const jour = progression.jourLocal();
  const tb = professeur.tableauDeBord({ eleves, classes: d.classes, activites, resultats: profEtat.activites.resultats.filter((r) => ids.has(r.eleve)) }, jour);
  const g = tb.global;
  $("#suivi-engagement").replaceChildren(
    chiffre(t("suiviActifs"), `${g.actifs} / ${g.eleves}`), chiffre(t("suiviTempsMoyen"), formatMinutes(g.minutesMoyennes)),
    chiffre(t("suiviCompletion"), pct(g.completion)), chiffre(t("suiviRetards"), g.retard)
  );
  $("#suivi-performance").replaceChildren(
    chiffre(t("suiviScoreEvaluations"), pct(g.scoreEvaluations)), chiffre(t("suiviScoreDefis"), pct(g.scoreDefis)),
    chiffre(t("suiviMaitrise"), pct(g.maitrise)), chiffre(t("profChiffreARevoir"), g.aRevoir)
  );
  const aRevoir = professeur.notionsARevoir(eleves).map((n) => `${notionParId(n.id)?.titre ?? n.id} (${n.n})`);
  $("#suivi-a-revoir").textContent = aRevoir.length ? t("profARevoirGroupe", { liste: aRevoir.join(", ") }) : "";
  // Par classe.
  const ligne = (cellules, entete = false) => {
    const tr = element("tr");
    cellules.forEach((c, i) => tr.append(element(entete || i === 0 ? "th" : "td", { texte: String(c), attributs: entete ? { scope: "col" } : i === 0 ? { scope: "row" } : {} })));
    return tr;
  };
  const thead = element("thead");
  thead.append(ligne([t("profFiltreClasse"), t("profChiffreEleves"), t("suiviActifs"), t("suiviTempsMoyen"), t("suiviCompletion"), t("suiviScoreEvaluations"), t("suiviMaitrise")], true));
  const tbody = element("tbody");
  for (const c of tb.parClasse.filter((x) => profEtat.filtreSuivi === "tous" || x.id === profEtat.filtreSuivi)) {
    tbody.append(ligne([c.nom ?? t("profParticuliers"), c.eleves, `${c.actifs} (${pct(c.tauxActifs)})`, formatMinutes(c.minutesMoyennes), pct(c.completion), pct(c.scoreEvaluations), pct(c.maitrise)]));
  }
  $("#suivi-classes").replaceChildren(element("caption", { classe: "visuellement-cache", cle: "suiviParClasse" }), thead, tbody);
  // Activités.
  $("#suivi-activites-vide").hidden = tb.activites.length > 0;
  $("#suivi-activites").replaceChildren(...tb.activites.map((a) => carteActivite(a, { eleves, classes: d.classes, jour })));
  // Élèves à suivre.
  const pseudo = (id) => eleves.find((e) => e.id === id)?.pseudo ?? "";
  $("#suivi-a-suivre-vide").hidden = tb.aSuivre.length > 0;
  $("#suivi-a-suivre").replaceChildren(...tb.aSuivre.map((s) => element("li", {
    texte: `${pseudo(s.eleve)} : ${s.raisons.map((r) => t(`suiviRaison_${r}`, { n: s.retard, score: s.score ?? "" })).join(" · ")}`
  })));
}

/** Détail d'une activité : indicateurs, puis une ligne par élève ciblé (statut, score, essais, durée). */
function carteActivite(a, { eleves, classes, jour }) {
  const carte = element("article", { classe: "carte ef-enfant activite-carte", attributs: { "data-activite": a.id } });
  const tete = element("div", { classe: "ef-enfant-tete" });
  const nom = element("div", { classe: "famille-enfant-nom" });
  const details = [t(`actType_${a.type}`), cibleActivite(a, classes, eleves),
    a.parametres?.nbQuestions ? t("actQuestions", { n: a.parametres.nbQuestions }) : null,
    a.type === "objectif" ? t(`actObjectif_${a.parametres.objectif.mesure}`, { n: a.parametres.objectif.valeur }) : null,
    a.echeance ? t("actPourLe", { date: dateCourte(a.echeance) }) : null, a.source === "ia" ? t("actSourceIa") : null].filter(Boolean).join(" · ");
  nom.append(element("h4", { texte: titreActivite(a) }), element("span", { classe: "doux petit", texte: details }));
  const i = a.indicateurs;
  tete.append(nom, element("span", { classe: `pastille ${i.completion === 100 ? "ok" : i.retard ? "en-cours" : "neutre"}`, texte: t("actTermines", { n: i.termines, m: i.attendus }) }));
  carte.append(tete);
  const stats = element("dl", { classe: "stats stats-progression" });
  stats.append(chiffre(t("suiviCompletion"), pct(i.completion)), chiffre(t("actCommences"), i.commences),
    chiffre(t("actScoreMoyen"), pct(i.score)), chiffre(t("suiviRetards"), i.retard));
  carte.append(stats);
  // Détail par élève.
  const det = element("details", { classe: "famille-ajout ef-gestion" });
  det.append(element("summary", { cle: "actDetail" }));
  const ul = element("ul", { classe: "prof-invitations" });
  const res = profEtat.activites?.resultats ?? [];
  const terminees = (id) => res.filter((r) => r.eleve === id && r.termine).length;
  for (const e of professeur.elevesCibles(a, eleves)) {
    const r = res.find((x) => x.activite === a.id && x.eleve === e.id);
    ul.append(element("li", { classe: "ef-cahier", texte: `${e.pseudo} — ${statutEleveActivite(a, r, { bilan: e.bilan, terminees: terminees(e.id) }, jour)}` }));
  }
  det.append(ul);
  carte.append(det);
  const actions = element("div", { classe: "actions" });
  actions.append(element("button", { classe: "secondaire petit-bouton", cle: "efArchiver", attributs: { type: "button", "data-activite-archiver": a.id } }),
    element("button", { classe: "danger petit-bouton", cle: "actSupprimer", attributs: { type: "button", "data-activite-supprimer": a.id } }));
  carte.append(actions);
  return carte;
}

/** Statut lisible d'un élève sur une activité (vu par le professeur). */
function statutEleveActivite(a, r, suivi, jour) {
  if (a.type === "objectif") {
    const o = professeur.avancementObjectif(a, suivi, jour);
    return t(o.atteint ? "actObjectifAtteint" : "actObjectifEnCours", { n: o.valeur, m: o.cible });
  }
  if (!r) return t(a.echeance && a.echeance < jour ? "actEnRetard" : "actAFaire");
  const score = professeur.scoreResultat(a, r);
  const parts = [t(r.termine ? "actTermine" : "actEnCours")];
  if (r.total) parts.push(t("cahierProgression", { n: a.type === "defi" ? Math.max(r.meilleur, r.reussis) : r.reussis, m: r.total }));
  if (score !== null && r.termine) parts.push(pct(score));
  if (a.type === "defi" && r.tentatives > 1) parts.push(t("actEssais", { n: r.tentatives }));
  if (r.dureeS) parts.push(formatMinutes(Math.max(1, Math.round(r.dureeS / 60))));
  return parts.join(" · ");
}

/* Dialogue « Donner une activité » */

const notionsDuProfil = () => {
  const p = moiProf()?.profil;
  return (etat.registre?.deType("notion") ?? []).filter((n) => p?.matieres.includes(n.matiere));
};

function ouvrirDialogueActivite({ classeId = null, eleveId = null } = {}) {
  const p = moiProf()?.profil;
  if (!p) { notifier(t("profProfilManquant"), "⚠️"); return; }
  const classes = profEtat.eleves?.classes ?? profEtat.classes?.classes ?? [];
  const eleves = profEtat.eleves?.eleves ?? [];
  const cible = $("#activite-cible");
  cible.replaceChildren(
    ...classes.map((c) => option(`classe:${c.id}`, t("actCibleClasse", { classe: c.nom }))),
    ...eleves.map((e) => option(`eleve:${e.id}`, t("actCibleEleve", { pseudo: e.pseudo, classe: nomClasse(e.classeId) })))
  );
  if (!cible.options.length) { notifier(t("actAucuneCible"), "⚠️"); return; }
  cible.value = eleveId ? `eleve:${eleveId}` : classeId ? `classe:${classeId}` : cible.options[0].value;
  $("#formulaire-activite").reset();
  cible.value = eleveId ? `eleve:${eleveId}` : classeId ? `classe:${classeId}` : cible.options[0].value;
  $("#activite-matiere").replaceChildren(...p.matieres.map((m) => option(m, libelleMatiere(m))));
  const classe = classes.find((c) => c.id === (classeId ?? eleves.find((e) => e.id === eleveId)?.classeId));
  if (classe) $("#activite-matiere").value = classe.matiere;
  activitesEtat.niveau = classe ? professeur.niveauCatalogue(classe.niveau) : null;
  const quota = profEtat.activites?.cahiersIa;
  $("#activite-cahier-ia").disabled = !quota?.ia || !quota.restantes;
  $("#activite-cahier-ia-aide").textContent = quota?.ia ? t("actCahierIaAide", { n: quota.restantes, m: quota.limite }) : t("actCahierIaIndisponible");
  $("#activite-erreur").textContent = "";
  basculerTypeActivite();
  $("#dialogue-activite").showModal();
}

function basculerTypeActivite() {
  const type = new FormData($("#formulaire-activite")).get("activite-type") ?? "defi";
  const mesure = $("#activite-mesure").value;
  $("#activite-type-aide").textContent = t(`actAide_${type}`, { min: professeur.QUESTIONS_EVALUATION_MIN, max: professeur.QUESTIONS_EVALUATION_MAX });
  $("#activite-zone-evaluation").hidden = type !== "evaluation";
  $("#activite-zone-cahier").hidden = type !== "cahier";
  $("#activite-zone-objectif").hidden = type !== "objectif";
  $("#activite-zone-notions").hidden = type === "objectif" && mesure !== "notions";
  $("#activite-zone-valeur").hidden = mesure === "notions";
  const [min, max] = professeur.BORNES_OBJECTIF[mesure] ?? [1, 100];
  Object.assign($("#activite-valeur"), { min, max });
  if (!$("#activite-valeur").value) $("#activite-valeur").value = String(mesure === "temps" ? 60 : mesure === "xp" ? 200 : 3);
  $("#activite-valeur-label").textContent = t(`actValeur_${mesure}`);
  rendreNotionsActivite();
}

function rendreNotionsActivite() {
  const matiere = $("#activite-matiere").value;
  const deja = new Set([...document.querySelectorAll("#activite-notions input:checked")].map((c) => c.value));
  const rang = (n) => (n.niveau === activitesEtat.niveau ? 0 : 1);
  const liste = notionsDuProfil().filter((n) => n.matiere === matiere).sort((a, b) => rang(a) - rang(b) || a.titre.localeCompare(b.titre, etat.langue));
  $("#activite-notions-aide").textContent = t("actNotionsAide", { max: professeur.MAX_NOTIONS_ACTIVITE });
  $("#activite-notions").replaceChildren(...liste.map((n) => {
    const label = element("label", { classe: "prof-case" });
    label.append(element("input", { attributs: { type: "checkbox", value: n.id, ...(deja.has(n.id) ? { checked: "" } : {}) } }),
      element("span", { texte: `${n.titre} · ${t(`niveau_${n.niveau}`)}` }));
    return label;
  }));
}

/** QCM publiés des notions (dist/contenus/, même origine, mis en cache) : { notion: [QCM] }. */
async function banqueQuestions(notions) {
  const banque = {};
  for (const notion of notions) {
    if (!contenusDefi.has(notion)) {
      try { contenusDefi.set(notion, await chargerJson(`contenus/${encodeURIComponent(notion)}.json`)); } catch { contenusDefi.set(notion, null); }
    }
    const c = contenusDefi.get(notion);
    const qs = [];
    (c?.application?.exercices ?? []).forEach((_, i) => { const ex = exerciceDuContenu(c, `app-${i + 1}`); if (ex) qs.push(ex); });
    (c?.situation?.etapes ?? []).forEach((_, i) => { const ex = exerciceDuContenu(c, `defi-${i + 1}`); if (ex) qs.push(ex); });
    banque[notion] = qs;
  }
  return banque;
}

async function validerDialogueActivite(ev) {
  ev.preventDefault();
  if (profEtat.occupe) return;
  const type = new FormData($("#formulaire-activite")).get("activite-type");
  const [genre, id] = $("#activite-cible").value.split(":");
  const notions = [...document.querySelectorAll("#activite-notions input:checked")].map((c) => c.value);
  const mesure = $("#activite-mesure").value;
  const corps = {
    type, cible: genre === "classe" ? { classeId: id } : { eleveId: id }, notions: type === "objectif" && mesure !== "notions" ? [] : notions,
    libelle: $("#activite-libelle").value.trim() || null, echeance: $("#activite-echeance").value || null, langue: etat.langue,
    ...(type === "evaluation" ? { nbQuestions: Number($("#activite-nb").value) } : {}),
    ...(type === "cahier" ? { cahier: { type: $("#activite-cahier-type").value, longueur: $("#activite-cahier-longueur").value, univers: $("#activite-cahier-univers").value, objectif: $("#activite-cahier-objectif").value, ia: $("#activite-cahier-ia").checked } } : {}),
    ...(type === "objectif" ? { objectif: { mesure, valeur: Number($("#activite-valeur").value) } } : {})
  };
  const p = moiProf()?.profil;
  const matiereDe = (n) => notionParId(n)?.matiere ?? null;
  const v = professeur.validerActivite(corps, { profil: p, matiereDe, aujourdhui: progression.jourLocal() });
  const erreurDialogue = (m) => { $("#activite-erreur").textContent = m; };
  if (!v.ok) { erreurDialogue(t(`actErreur_${v.code}`, { max: professeur.MAX_NOTIONS_ACTIVITE, min: professeur.QUESTIONS_EVALUATION_MIN, maxq: professeur.QUESTIONS_EVALUATION_MAX })); return; }
  // Défi ou évaluation : le catalogue doit avoir des QCM publiés pour ces notions.
  let disponibles = null;
  if (["defi", "evaluation"].includes(type)) {
    const banque = await banqueQuestions(notions);
    disponibles = Object.values(banque).reduce((s, l) => s + l.length, 0);
    if (!disponibles) { erreurDialogue(t("actErreur_sans-questions")); return; }
  }
  profEtat.occupe = true;
  $("#activite-valider").disabled = true;
  erreurDialogue(t(type === "cahier" && corps.cahier.ia ? "cahierPreparation" : "synchroEnCours"));
  try {
    const r = await apiProf("activites", { methode: "POST", corps });
    if (r.statut !== 201) { erreurDialogue(messageProf(r)); return; }
    $("#dialogue-activite").close();
    const demande = corps.nbQuestions ?? (type === "defi" ? professeur.QUESTIONS_DEFI : 0);
    notifier(disponibles !== null && disponibles < demande ? t("actDonneeMoinsQuestions", { n: disponibles }) : t("actDonnee"), "🧑‍🏫");
    profEtat.occupe = false;
    await rechargerEcranProf();
  } catch {
    erreurDialogue(t("efErreur_generique"));
  } finally {
    profEtat.occupe = false;
    $("#activite-valider").disabled = false;
  }
}

async function rechargerEcranProf() {
  if (etat.ecran === "suivi") await ouvrirTableauProf();
  else if (etat.ecran === "eleves") { await chargerActivitesProf(); await ouvrirEleves(); }
  else if (etat.ecran === "classes") { await chargerActivitesProf(); await ouvrirClasses(); }
}

/** Activités d'un élève dans sa carte « Mes élèves ». */
function activitesDeLEleve(e) {
  const d = profEtat.activites;
  if (!d) return null;
  const siennes = d.activites.filter((a) => a.statut !== "archivee" && professeur.elevesCibles(a, [e]).length);
  const bloc = element("div", { classe: "ef-cahiers" });
  bloc.append(element("h5", { cle: "actActivitesEleve" }));
  if (!siennes.length) bloc.append(element("p", { classe: "doux petit", cle: "actAucunePourEleve" }));
  const jour = progression.jourLocal();
  const terminees = d.resultats.filter((r) => r.eleve === e.id && r.termine).length;
  for (const a of siennes) {
    const r = d.resultats.find((x) => x.activite === a.id && x.eleve === e.id);
    bloc.append(element("div", { classe: "ef-cahier", texte: `${titreActivite(a)} — ${statutEleveActivite(a, r, { bilan: e.bilan, terminees }, jour)}` }));
  }
  return bloc;
}

function brancherActivitesProf() {
  ECRANS.push("suivi");
  $("#suivi-actualiser").addEventListener("click", () => void ouvrirTableauProf());
  $("#suivi-activite").addEventListener("click", () => ouvrirDialogueActivite());
  $("#suivi-filtre").addEventListener("change", (e) => { profEtat.filtreSuivi = e.currentTarget.value; rendreTableauProf(); });
  $("#suivi-activites").addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.activiteArchiver) void actionProf(`activites/${b.dataset.activiteArchiver}/archiver`, {}, { succes: t("actArchivee"), recharger: ouvrirTableauProf });
    else if (b.dataset.activiteSupprimer) {
      if (b.dataset.confirmer !== "1") { b.dataset.confirmer = "1"; b.textContent = t("actSupprimerConfirmer"); return; }
      void actionProf(`activites/${b.dataset.activiteSupprimer}/supprimer`, {}, { succes: t("actSupprimee"), recharger: ouvrirTableauProf });
    }
  });
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-activite-classe], [data-activite-eleve]");
    if (b) ouvrirDialogueActivite({ classeId: b.dataset.activiteClasse ?? null, eleveId: b.dataset.activiteEleve ?? null });
  });
  // Réglages du dialogue : mêmes listes que le constructeur de cahiers.
  $("#activite-cahier-type").replaceChildren(...professeur.TYPES_CAHIER_PROF.map((ty) => option(ty, t(`cahier_${ty}`))));
  $("#activite-cahier-longueur").replaceChildren(...professeur.LONGUEURS_CAHIER_PROF.map((l) => option(l, t(`cahierLongueur_${l}`))));
  $("#activite-cahier-univers").replaceChildren(...professeur.UNIVERS_CAHIER_PROF.map((u) => option(u, t(`cahierUnivers_${u}`))));
  $("#activite-cahier-objectif").replaceChildren(...professeur.OBJECTIFS_CAHIER_PROF.map((o) => option(o, t(`cahierObjectif_${o}`))));
  $("#activite-cahier-longueur").value = "standard";
  $("#activite-cahier-objectif").value = "reviser";
  $("#activite-mesure").replaceChildren(...professeur.MESURES_OBJECTIF.map((m) => option(m, t(`actMesure_${m}`))));
  $("#activite-types").addEventListener("change", basculerTypeActivite);
  $("#activite-mesure").addEventListener("change", () => { $("#activite-valeur").value = ""; basculerTypeActivite(); });
  $("#activite-matiere").addEventListener("change", rendreNotionsActivite);
  $("#formulaire-activite").addEventListener("submit", validerDialogueActivite);
  $("#activite-annuler").addEventListener("click", () => $("#dialogue-activite").close());
  brancherActivitesEleve();
}

/* Côté élève : travail donné par les professeurs */

async function chargerMesActivites() {
  if (!jetonFamille() || !profEtat.mesProfs.length) { activitesEtat.mesActivites = []; rendreActivitesEleve(); return; }
  try {
    const r = await apiProf("mes-activites", { reel: true });
    activitesEtat.mesActivites = r.statut === 200 && Array.isArray(r.donnees?.activites) ? r.donnees.activites : [];
  } catch {
    activitesEtat.mesActivites = [];
  }
  rendreActivitesEleve();
}

const cahierLocalProf = (id) => cahiersEnregistres().find((c) => c.prof === id) ?? null;

/** Objectif côté élève : même calcul que chez le professeur, à partir de la progression de l'appareil. */
function avancementObjectifLocal(a) {
  const bilan = bilanDeLAppareil();
  const terminees = activitesEtat.mesActivites.filter((x) => x.resultat?.termine).length;
  return professeur.avancementObjectif(a, { bilan, terminees }, progression.jourLocal());
}

function rendreActivitesEleve() {
  const liste = activitesEtat.mesActivites;
  const zone = $("#activites-eleve");
  if (!zone) return;
  zone.hidden = !liste.length;
  const jour = progression.jourLocal();
  $("#activites-eleve-liste").replaceChildren(...liste.map((a) => {
    const li = element("li", { classe: "ef-cahier activite-eleve" });
    const textes = element("span");
    const r = a.resultat;
    let statut;
    if (a.type === "objectif") {
      const o = avancementObjectifLocal(a);
      statut = t(o.atteint ? "actObjectifAtteint" : "actObjectifEnCours", { n: o.valeur, m: o.cible });
    } else if (r?.termine) {
      statut = [t("actTermine"), r.total ? t("cahierProgression", { n: a.type === "defi" ? Math.max(r.meilleur, r.reussis) : r.reussis, m: r.total }) : null].filter(Boolean).join(" · ");
    } else statut = t(r ? "actEnCours" : a.echeance && a.echeance < jour ? "actEnRetard" : "actAFaire");
    const quoi = [t(`actType_${a.type}`), a.type === "objectif" ? t(`actObjectif_${a.parametres.objectif.mesure}`, { n: a.parametres.objectif.valeur }) : null,
      a.parametres?.nbQuestions ? t("actQuestions", { n: a.parametres.nbQuestions }) : null, a.professeur,
      a.echeance ? t("actPourLe", { date: dateCourte(a.echeance) }) : null].filter(Boolean).join(" · ");
    textes.append(element("strong", { texte: titreActivite(a) }), element("span", { classe: "doux petit bloc", texte: `${quoi} — ${statut}` }));
    li.append(textes);
    if (a.type !== "objectif" && !(a.type === "evaluation" && r?.termine)) {
      const cle = a.type === "cahier" ? "cahierOuvrir" : a.type === "defi" && r?.termine ? "actRejouer" : r ? "actContinuer" : "actCommencer";
      li.append(element("button", { classe: "bouton petit-bouton", cle, attributs: { type: "button", "data-mon-activite": a.id } }));
    }
    return li;
  }));
}

async function ouvrirMonActivite(id) {
  const a = activitesEtat.mesActivites.find((x) => x.id === id);
  if (!a) return;
  if (a.type === "cahier") {
    let local = cahierLocalProf(a.id);
    if (!local) {
      const p = a.parametres ?? {};
      const sections = a.contenu?.sections?.length
        ? a.contenu.sections.map((s) => ({ notion: s.notion, titre: s.titre, blocs: s.blocs, notes: "" }))
        : sectionsCatalogue(p.notions ?? []);
      const cahiers = cahiersEnregistres();
      local = cahierValide({
        id: window.crypto?.randomUUID?.() ?? `${Date.now()}-${cahiers.length}`, prof: a.id, type: p.cahier?.type ?? "exercices",
        creeLe: new Date().toISOString(), titre: (a.contenu?.titre || titreActivite(a)).slice(0, 60), source: a.contenu ? "ia" : "catalogue",
        longueur: p.cahier?.longueur, univers: p.cahier?.univers, objectif: p.cahier?.objectif,
        introduction: a.contenu?.introduction || t(`cahierIntro_${p.cahier?.type ?? "exercices"}`), conclusion: a.contenu?.conclusion ?? "", notes: "", sections
      });
      if (!local) return;
      enregistrerCahiers([local, ...cahiers]);
      rendreCahiers();
    }
    ouvrirLectureCahier(local.id, t("actCahierDuProf", { prof: a.professeur }));
    planifierResultatsProf();
    return;
  }
  // Défi ou évaluation : QCM publiés du catalogue, tirés avec l'identifiant de l'activité.
  const banque = await banqueQuestions(a.parametres?.notions ?? []);
  const questions = professeur.construireQuiz(a.id, banque, a.parametres?.nbQuestions ?? professeur.QUESTIONS_DEFI);
  activitesEtat.quiz = { activite: a, questions, corrige: false };
  activitesEtat.debut = Date.now();
  $("#quiz-titre").textContent = titreActivite(a);
  $("#quiz-aide").textContent = t(a.type === "evaluation" ? "quizAideEvaluation" : "quizAideDefi", { n: questions.length, prof: a.professeur });
  $("#quiz-questions").replaceChildren(...questions.map((q, i) => {
    const bloc = element("fieldset", { classe: "vacances-question", attributs: { "data-quiz": String(i) } });
    bloc.append(element("legend", { texte: `${i + 1}. ${notionParId(q.notion)?.titre ?? q.notion} · ${q.question}` }));
    q.choix.forEach((choix, j) => {
      const label = element("label");
      label.append(element("input", { attributs: { type: "radio", name: `quiz-${i}`, value: String(j) } }), element("span", { texte: choix }));
      bloc.append(label);
    });
    return bloc;
  }));
  if (!questions.length) $("#quiz-questions").append(element("p", { classe: "doux", cle: "quizSansQuestion" }));
  $("#quiz-retour").textContent = "";
  $("#quiz-valider").hidden = !questions.length;
  $("#quiz-valider").disabled = false;
  $("#dialogue-quiz").showModal();
}

async function validerQuiz(ev) {
  ev.preventDefault();
  const q = activitesEtat.quiz;
  if (!q || q.corrige) { $("#dialogue-quiz").close(); return; }
  const reponses = q.questions.map((_, i) => $(`input[name="quiz-${i}"]:checked`));
  const manquantes = reponses.filter((r) => !r).length;
  if (manquantes && q.activite.type === "evaluation" && q.confirmer !== true) {
    q.confirmer = true;
    $("#quiz-retour").textContent = t("quizManquantes", { n: manquantes });
    return;
  }
  const reussis = q.questions.filter((x, i) => Number(reponses[i]?.value) === x.bonne).length;
  // Correction affichée sur place ; rien de ce qui a été coché ne quitte l'appareil.
  q.questions.forEach((x, i) => {
    const bloc = document.querySelector(`[data-quiz="${i}"]`);
    bloc.dataset.correct = String(Number(reponses[i]?.value) === x.bonne);
    bloc.querySelectorAll("input").forEach((inp) => { inp.disabled = true; if (Number(inp.value) === x.bonne) inp.parentElement.classList.add("bonne-reponse"); });
  });
  q.corrige = true;
  $("#quiz-valider").textContent = t("fermer");
  $("#quiz-retour").textContent = t("quizResultat", { n: reussis, m: q.questions.length });
  const dureeS = Math.min(86400, Math.round((Date.now() - activitesEtat.debut) / 1000));
  try {
    const r = await apiProf("resultats", { methode: "PUT", reel: true, corps: { resultats: [{ activite: q.activite.id, reussis, total: q.questions.length, dureeS, termine: true }] } });
    if (r.statut !== 200 || r.donnees?.refuses?.length) $("#quiz-retour").textContent += ` ${t("quizNonEnvoye")}`;
  } catch {
    $("#quiz-retour").textContent += ` ${t("quizNonEnvoye")}`;
  }
  await chargerMesActivites();
}

/** Avancement des cahiers donnés par un professeur : envoyé avec le bilan (au plus une fois par minute). */
async function envoyerResultatsCahiersProf() {
  const resultats = cahiersEnregistres().filter((c) => c.prof && activitesEtat.mesActivites.some((a) => a.id === c.prof))
    .map((c) => ({ activite: c.prof, ...bilanExercices(c), dureeS: 0, termine: false }))
    .filter((r) => r.total > 0);
  if (!resultats.length) return;
  try { await apiProf("resultats", { methode: "PUT", reel: true, corps: { resultats } }); } catch { /* nouvel essai au prochain envoi */ }
}

function planifierResultatsProf() {
  clearTimeout(activitesEtat.minuteur);
  activitesEtat.minuteur = setTimeout(() => void envoyerResultatsCahiersProf(), 5000);
}

function brancherActivitesEleve() {
  $("#activites-eleve-liste").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-mon-activite]");
    if (b) void ouvrirMonActivite(b.dataset.monActivite);
  });
  $("#formulaire-quiz").addEventListener("submit", validerQuiz);
  $("#quiz-fermer").addEventListener("click", () => $("#dialogue-quiz").close());
  $("#dialogue-quiz").addEventListener("close", () => {
    activitesEtat.quiz = null;
    $("#quiz-valider").textContent = t("quizValider");
  });
}

/* ---------- Contributions au contenu des notions (ADR 0023) ---------- */
// Rôles contributeur et prof, scénario sans IA. Rien n'est appelé côté Worker tant que `connexionActive` vaut false ;
// `?demo=contributions` simule les deux rôles dans l'onglet (web/demo-contributions.js), sans OAuth ni réseau.
const CLE_DEMO_CONTRIB_ACTIVE = "kermiclab:demo-contributions:active";
const contrib = {
  demo: false, etatDemo: null, chargee: false, erreur: false, miennes: [], relecture: [],
  index: null, contenus: new Map(), filtre: { statut: "proposee", notion: "", matiere: "" }, edition: null,
  bulle: { notion: null, cible: null, viser: null },
  suivi: { statut: "tous", notion: "" }
};
const demoContribActive = () => contrib.demo === true;
/**
 * Compte local connecté dont le rôle (attribué dans le back-office) permet de contribuer (ADR 0023 §6 ter) :
 * `contributeur`, `prof` ou `admin`, donné par `GET /api/professeur/moi`. Null sinon (démonstration comprise).
 */
const roleContribLocal = () => {
  if (demoContribActive() || !jetonFamille()) return null;
  const role = profEtat.moi?.contribution;
  return contributions.peutContribuer(role) && typeof profEtat.moi?.id === "string" ? role : null;
};
const contributionsActives = () => demoContribActive() || etat.config?.connexionActive === true || roleContribLocal() !== null;

function sauverDemoContrib(suivant) {
  contrib.etatDemo = suivant;
  ecrireCle(sessionPreferences(), demoContrib.CLE_DEMO, JSON.stringify(suivant));
}

function initialiserDemoContrib() {
  const demandee = new URLSearchParams(location.search).get("demo") === demoContrib.PARAMETRE_DEMO;
  if (demandee) ecrireCle(sessionPreferences(), CLE_DEMO_CONTRIB_ACTIVE, "1");
  contrib.demo = demandee || lireCle(sessionPreferences(), CLE_DEMO_CONTRIB_ACTIVE) === "1";
  if (!contrib.demo) return;
  contrib.etatDemo = demoContrib.lireEtat(lireCle(sessionPreferences(), demoContrib.CLE_DEMO));
  const texte = $("#bandeau-demo-texte");
  texte.dataset.i18n = "demoBandeauContrib";
  texte.textContent = t("demoBandeauContrib");
  $("#bandeau-demo").hidden = false;
}

function demarrerDemoContrib() {
  ecrireCle(sessionPreferences(), CLE_DEMO_CONTRIB_ACTIVE, "1");
  const url = new URL(location.href);
  url.searchParams.set("demo", demoContrib.PARAMETRE_DEMO);
  url.hash = "contributions";
  location.assign(url.href);
}

/** Erreur de l'API : code et détails par champ (mêmes codes que web/contributions.js). */
class ErreurContrib extends Error {
  constructor(code, details = {}) { super(code); this.code = code; this.details = details; }
}
async function reponseContrib(r) {
  if (r.ok) return r.status === 204 ? null : r.json();
  const j = await r.json().catch(() => ({}));
  throw new ErreurContrib(j.erreur ?? `http-${r.status}`, j.details ?? {});
}

/** Requête vers `/api/contributions` : jeton du compte local (en-tête), sinon cookie de la session OAuth. */
function initContrib({ method = "GET", body } = {}) {
  const headers = body === undefined ? {} : { "content-type": "application/json" };
  if (roleContribLocal()) return { method, body, headers: { ...headers, authorization: `Bearer ${jetonFamille()}` } };
  return { method, body, headers, credentials: "include" };
}

/** Accès aux contributions : le Worker, ou le double de démonstration (mêmes formes de réponse). */
const apiContrib = {
  compte() {
    if (demoContribActive()) return demoContrib.moi(contrib.etatDemo).compte ?? null;
    const local = roleContribLocal();
    if (local) return { id: profEtat.moi.id, role: local, local: true };
    return etat.compte;
  },
  async lister(vue) {
    if (demoContribActive()) return demoContrib.lister(contrib.etatDemo, vue);
    return reponseContrib(await fetch(urlApi(`/api/contributions?vue=${vue}`), initContrib()));
  },
  async creer(donnees) {
    if (demoContribActive()) {
      const r = demoContrib.creer(contrib.etatDemo, donnees);
      if (r.erreurs) throw new ErreurContrib(r.erreurs.quota ? "quota-atteint" : "contribution-invalide", r.erreurs);
      sauverDemoContrib(r.etat);
      return r.id;
    }
    return (await reponseContrib(await fetch(urlApi("/api/contributions"), initContrib({ method: "POST", body: JSON.stringify(donnees) })))).id;
  },
  async agir(id, corps) {
    if (demoContribActive()) {
      const r = demoContrib.agir(contrib.etatDemo, id, corps);
      if (r.code) throw new ErreurContrib(r.code);
      if (r.erreurs) throw new ErreurContrib("contribution-invalide", r.erreurs);
      sauverDemoContrib(r.etat);
      return r.contribution;
    }
    return reponseContrib(await fetch(urlApi(`/api/contributions/${encodeURIComponent(id)}`), initContrib({ method: "PATCH", body: JSON.stringify(corps) })));
  }
};

/** Index et contenus des notions (dist/contenus/, générés par le build) : fichiers statiques, même origine. */
async function indexContenus() {
  if (!contrib.index) {
    try { contrib.index = (await chargerJson("contenus/index.json")).notions ?? []; } catch { contrib.index = []; }
  }
  return contrib.index;
}
async function contenuNotion(id) {
  if (!contrib.contenus.has(id)) {
    try { contrib.contenus.set(id, await chargerJson(`contenus/${encodeURIComponent(id)}.json`)); } catch { return null; }
  }
  return contrib.contenus.get(id);
}
const titreNotion = (id) => contrib.index?.find((n) => n.id === id)?.titre ?? id;
const matiereNotion = (id) => contrib.index?.find((n) => n.id === id)?.matiere ?? "autres";
const nomMatiere = (m) => (etat.textes[`matiere_${m}`] ? t(`matiere_${m}`) : t("matiere_autres"));
const libelleChamp = (chemin) => contributions.libelleChemin(chemin, (cle) => t(cle));

async function ouvrirContributions() {
  if (!contributionsActives()) return;
  await chargerContributions();
}

async function chargerContributions() {
  const compte = apiContrib.compte();
  contrib.chargee = false;
  rafraichirContributions();
  try {
    await indexContenus();
    if (compte && contributions.peutContribuer(compte.role)) {
      contrib.miennes = contributions.normaliserContributions(await apiContrib.lister("miennes"));
      contrib.relecture = contributions.peutRelire(compte.role)
        ? contributions.normaliserContributions(await apiContrib.lister("relecture")) : [];
      await Promise.all([...new Set(contrib.relecture.filter((c) => contributions.STATUTS_OUVERTS.includes(c.statut)).map((c) => c.notion_id))].map(contenuNotion));
    } else {
      contrib.miennes = [];
      contrib.relecture = [];
    }
    contrib.erreur = false;
  } catch {
    contrib.erreur = true;
  }
  contrib.chargee = true;
  rafraichirContributions();
}

function rafraichirContributions() {
  synchroniserTestRoles();
  const actif = contributionsActives();
  const compte = actif ? apiContrib.compte() : null;
  const role = compte?.role;
  $("#entree-contributions").hidden = !actif || !(demoContribActive() || contributions.peutContribuer(role));
  // Menu « Contributions » de la navigation : seulement pour un rôle contributeur, prof ou admin.
  for (const id of ["#nav-contributions", "#nav-mobile-contributions"]) $(id).hidden = !actif || !contributions.peutContribuer(role);
  rafraichirProfNav(); // Expérience Professeur (ADR 0030) : le rôle simulé ou réel change aussi ces menus.
  if (!actif) return;
  const autorise = contributions.peutContribuer(role);
  $("#contrib-etat").textContent = !contrib.chargee ? t("familleChargement") : contrib.erreur ? t("familleErreur") : "";
  $("#contrib-invite").hidden = autorise;
  $("#contrib-role-requis").hidden = !compte || autorise;
  $("#contrib-demo-roles").hidden = !demoContribActive();
  $("#essayer-demo-contrib").hidden = demoContribActive();
  $("#contrib-espace").hidden = !autorise;
  // Compte local : la connexion se gère dans « Mon compte », pas depuis cet écran.
  $("#contrib-deconnexion").hidden = compte?.local === true;
  if (!autorise) return;
  $("#contrib-role-nom").textContent = t(`contribRole_${role}`) + (compte.demo ? ` · ${t("demoPastille")}` : "");
  $("#contrib-role-aide").textContent = ` — ${t(contributions.peutRelire(role) ? "contribRoleAideProf" : "contribRoleAideContributeur")}`;
  $("#contrib-tableau").hidden = !contributions.peutRelire(role);
  if (contributions.peutRelire(role)) rendreTableau(compte);
  rendreSuivi(compte);
  remplirOptionsFormulaire();
}

/** Suivi de ses contributions : synthèse, action attendue, compteurs et filtres, frise de chaque proposition. */
function rendreSuivi(compte) {
  const s = contributions.suiviAuteur(contrib.miennes);
  const tuiles = [
    ["contribSuiviEnCours", t("contribSuiviSurMax", { n: s.ouvertes, max: contributions.MAX_OUVERTES_PAR_AUTEUR })],
    ["contribSuiviACorriger", String(s.aCorriger)],
    ["contribSuiviAcceptees", String(s.acceptees)],
    ["contribSuiviIntegrees", String(s.resume.integree)],
    ["contribSuiviTaux", s.taux === null ? "—" : `${s.taux} %`]
  ];
  $("#contrib-suivi-synthese").replaceChildren(...tuiles.map(([cle, valeur]) => {
    const bloc = element("div", { classe: "contrib-suivi-tuile" });
    bloc.append(element("dt", { cle }), element("dd", { texte: valeur }));
    return bloc;
  }));
  $("#contrib-suivi-alerte").hidden = s.aCorriger === 0;
  $("#contrib-suivi-alerte-texte").textContent = t("contribSuiviAlerte", { n: s.aCorriger });

  const statuts = ["tous", "proposee", "a_reviser", "validee", "integree", "refusee", "retiree"];
  const nombre = (st) => (st === "tous" ? s.resume.total : s.resume[st]);
  $("#contrib-suivi-compteurs").replaceChildren(...statuts.filter((st) => st === "tous" || nombre(st) > 0).map((st) => {
    const li = element("li");
    const b = element("button", { classe: `contrib-compteur statut-${st}`, attributs: { type: "button", "aria-pressed": String(contrib.suivi.statut === st), "data-statut": st } });
    b.append(element("strong", { texte: String(nombre(st)) }), element("span", { cle: st === "tous" ? "contribFiltreTous" : `contribStatut_${st}` }));
    b.addEventListener("click", () => { contrib.suivi.statut = st; rafraichirContributions(); });
    li.append(b);
    return li;
  }));
  if (contrib.suivi.statut !== "tous" && !nombre(contrib.suivi.statut)) contrib.suivi.statut = "tous";
  $("#contrib-suivi-outils").hidden = contrib.miennes.length === 0;
  const notions = [...new Set(contrib.miennes.map((c) => c.notion_id))].sort((a, b) => titreNotion(a).localeCompare(titreNotion(b)));
  const toutes = element("option", { cle: "contribFiltreToutes" });
  toutes.value = "";
  $("#contrib-suivi-notion").replaceChildren(toutes, ...notions.map((id) => { const o = element("option", { texte: titreNotion(id) }); o.value = id; return o; }));
  if (!notions.includes(contrib.suivi.notion)) contrib.suivi.notion = "";
  $("#contrib-suivi-notion").value = contrib.suivi.notion;

  const visibles = contributions.trierSuivi(contributions.filtrer(contrib.miennes, contrib.suivi));
  rendreListe($("#contrib-miennes"), visibles, { compte, mode: "miennes" });
  $("#contrib-miennes-vide").hidden = contrib.miennes.length > 0;
  $("#contrib-miennes-filtre-vide").hidden = contrib.miennes.length === 0 || visibles.length > 0;
}

/** Frise de suivi : envoyée → relue → validée → intégrée, avec les dates connues. */
function friseSuivi(c) {
  const frise = element("ol", { classe: "contrib-frise", attributs: { "aria-label": t("contribSuiviFrise") } });
  frise.append(...contributions.etapesSuivi(c).map((e) => {
    const cle = e.statut ? `contribEtape_${e.etape}_${e.statut}` : `contribEtape_${e.etape}`;
    const li = element("li", { classe: `etape-${e.etat}`, attributs: { "data-etape": e.etape, "data-etat": e.etat } });
    li.append(element("span", { classe: "contrib-frise-point", attributs: { "aria-hidden": "true" } }), element("span", { cle: etat.textes[cle] ? cle : `contribEtape_${e.etape}` }));
    if (e.date) li.append(element("span", { classe: "doux petit", texte: new Date(e.date).toLocaleDateString(etat.langue) }));
    li.append(element("span", { classe: "visuellement-cache", cle: `contribEtat_${e.etat}` }));
    if (e.etat === "courant" || e.etat === "action") li.setAttribute("aria-current", "step");
    return li;
  }));
  return frise;
}

function rendreTableau(compte) {
  const resume = contributions.resumer(contrib.relecture);
  const statuts = ["proposee", "a_reviser", "validee", "integree", "refusee"];
  $("#contrib-compteurs").replaceChildren(...statuts.map((s) => {
    const li = element("li");
    const b = element("button", { classe: `contrib-compteur statut-${s}`, attributs: { type: "button", "aria-pressed": String(contrib.filtre.statut === s) } });
    b.append(element("strong", { texte: String(resume[s]) }), element("span", { cle: `contribStatut_${s}` }));
    b.addEventListener("click", () => { contrib.filtre.statut = s; $("#contrib-filtre-statut").value = s; rafraichirContributions(); });
    li.append(b);
    return li;
  }));
  const selStatut = $("#contrib-filtre-statut");
  selStatut.replaceChildren(...["proposee", ...statuts.slice(1), "tous"].map((s) => {
    const o = element("option", { cle: s === "tous" ? "contribFiltreTous" : `contribStatut_${s}` });
    o.value = s;
    return o;
  }));
  selStatut.value = contrib.filtre.statut;
  rendreParMatiere();
  const matieres = [...new Set(contrib.relecture.map((c) => matiereNotion(c.notion_id)))].sort();
  const selMatiere = $("#contrib-filtre-matiere");
  const toutesMatieres = element("option", { cle: "contribFiltreToutesMatieres" });
  toutesMatieres.value = "";
  selMatiere.replaceChildren(toutesMatieres, ...matieres.map((m) => { const o = element("option", { texte: nomMatiere(m) }); o.value = m; return o; }));
  if (!matieres.includes(contrib.filtre.matiere)) contrib.filtre.matiere = "";
  selMatiere.value = contrib.filtre.matiere;
  const notions = [...new Set(contrib.relecture
    .filter((c) => !contrib.filtre.matiere || matiereNotion(c.notion_id) === contrib.filtre.matiere).map((c) => c.notion_id))].sort();
  const selNotion = $("#contrib-filtre-notion");
  const toutes = element("option", { cle: "contribFiltreToutes" });
  toutes.value = "";
  selNotion.replaceChildren(toutes, ...notions.map((id) => { const o = element("option", { texte: titreNotion(id) }); o.value = id; return o; }));
  if (!notions.includes(contrib.filtre.notion)) contrib.filtre.notion = "";
  selNotion.value = contrib.filtre.notion;
  const visibles = contributions.filtrer(contrib.relecture, contrib.filtre, matiereNotion);
  rendreListe($("#contrib-relecture"), visibles, { compte, mode: "relecture" });
  $("#contrib-relecture-vide").hidden = visibles.length > 0;
}

/** Synthèse matière par matière, puis notion par notion : un clic filtre la liste de relecture. */
function rendreParMatiere() {
  const groupes = contributions.grouperParMatiere(contrib.relecture, matiereNotion);
  const filtrerSur = (matiere, notion = "") => {
    Object.assign(contrib.filtre, { matiere, notion, statut: "tous" });
    rafraichirContributions();
    $("#contrib-relecture").scrollIntoView({ block: "start", behavior: "instant" });
  };
  $("#contrib-matieres").replaceChildren(...groupes.map((g) => {
    const li = element("li", { classe: "contrib-matiere", attributs: { "data-matiere": g.matiere } });
    const entete = element("div", { classe: "contrib-matiere-entete" });
    const titre = element("button", { classe: "secondaire petit-bouton", texte: nomMatiere(g.matiere), attributs: { type: "button" } });
    titre.addEventListener("click", () => filtrerSur(g.matiere));
    entete.append(titre, element("span", { classe: "doux petit", texte: t("contribMatiereResume", {
      relire: g.resume.proposee, reviser: g.resume.a_reviser, validees: g.resume.validee + g.resume.integree, total: g.resume.total
    }) }));
    const notions = element("ul");
    notions.append(...g.notions.map((n) => {
      const item = element("li");
      const b = element("button", { classe: "secondaire petit-bouton", texte: t("contribNotionResume", { titre: titreNotion(n.id), relire: n.resume.proposee }), attributs: { type: "button" } });
      b.addEventListener("click", () => filtrerSur(g.matiere, n.id));
      item.append(b);
      return item;
    }));
    li.append(entete, notions);
    return li;
  }));
  $("#contrib-matieres-vide").hidden = groupes.length > 0;
}

/** Avant / après mot à mot : <del> pour le texte retiré, <ins> pour le texte ajouté. */
function blocDiff(c) {
  const bloc = element("p", { classe: "contrib-diff" });
  const morceaux = c.nature === "ajout"
    ? [{ type: "egal", texte: c.texte_actuel }, { type: "ajoute", texte: `\n${c.texte_propose}` }]
    : contributions.diffMots(c.texte_actuel, c.texte_propose);
  for (const m of morceaux) bloc.append(m.type === "egal" ? document.createTextNode(m.texte) : element(m.type === "retire" ? "del" : "ins", { texte: m.texte }));
  return bloc;
}

function rendreListe(liste, items, { compte, mode }) {
  liste.replaceChildren(...items.map((c) => {
    const li = element("li", { classe: "contrib-item", attributs: { "data-id": c.id } });
    const entete = element("div", { classe: "contrib-entete" });
    const titre = element("span", { classe: "contrib-cible" });
    titre.append(element("strong", { texte: titreNotion(c.notion_id) }), element("span", { classe: "doux petit", texte: ` · ${libelleChamp(c.chemin)}` }));
    entete.append(titre, element("span", { classe: `contrib-statut statut-${c.statut}`, cle: `contribStatut_${c.statut}` }));
    const meta = element("p", { classe: "doux petit contrib-meta" });
    const auteur = c.auteur_id === compte?.id ? t("contribAuteurMoi") : t("contribAuteur", { code: contributions.codeAuteur(c.auteur_id) });
    meta.textContent = [t(`contribType_${c.type}`), t(`contribNature_${c.nature}`), mode === "relecture" ? auteur : null,
      c.created_at ? new Date(c.created_at).toLocaleDateString(etat.langue) : null].filter(Boolean).join(" · ");
    li.append(entete, meta);
    if (mode === "miennes") li.append(friseSuivi(c));
    li.append(blocDiff(c));
    const motif = element("p", { classe: "petit" });
    motif.append(element("strong", { cle: "contribMotif" }), document.createTextNode(` ${c.motif}`));
    li.append(motif);
    if (c.commentaire) {
      const com = element("p", { classe: "petit contrib-commentaire" });
      com.append(element("strong", { cle: "contribCommentaireRelecteur" }), document.createTextNode(` ${c.commentaire}`));
      li.append(com);
    }
    if (c.issue_numero) li.append(element("p", { classe: "doux petit", texte: t("contribIssue", { n: c.issue_numero }) }));
    if (mode === "relecture" && contributions.STATUTS_OUVERTS.includes(c.statut) && contributions.estObsolete(c, contrib.contenus.get(c.notion_id))) {
      li.append(element("p", { classe: "note-locale petit", cle: "contribObsolete" }));
    }
    const actions = actionsContribution(c, compte, mode);
    // Retrouver le texte dans la notion, volet d'édition ouvert (seulement pour une notion du gabarit encore publiée).
    if (contrib.index?.some((n) => n.id === c.notion_id)) {
      const voir = element("button", { classe: "secondaire petit-bouton contrib-voir", cle: "contribVoirNotion", attributs: { type: "button" } });
      voir.addEventListener("click", () => ouvrirNotionEnEdition(c.notion_id, c.chemin));
      const rangee = actions.classList.contains("actions") ? actions : actions.querySelector(".actions");
      if (rangee) rangee.append(voir); else { actions.classList.add("actions"); actions.append(voir); }
    }
    li.append(actions);
    return li;
  }));
}

function actionsContribution(c, compte, mode) {
  const zone = element("div", { classe: "contrib-actions" });
  const contexte = { compteId: compte?.id, role: compte?.role };
  const possibles = contributions.actionsPossibles(c, contexte);
  if (mode === "miennes") {
    zone.classList.add("actions");
    if (contributions.transition(c, "modifier", contexte).ok) {
      const b = element("button", { classe: "bouton", cle: c.statut === "a_reviser" ? "contribCorriger" : "contribModifier", attributs: { type: "button" } });
      b.addEventListener("click", () => editerContribution(c));
      zone.append(b);
    }
    if (possibles.includes("retirer")) zone.append(boutonAction(c, "retirer", "secondaire"));
    return zone;
  }
  const decisions = possibles.filter((a) => a !== "retirer");
  if (!decisions.length) {
    if (c.auteur_id === compte?.id && c.statut === "proposee") zone.append(element("p", { classe: "doux petit", cle: "contribQuatreYeux" }));
    return zone;
  }
  let champ = null;
  if (decisions.some((a) => ["valider", "refuser", "reviser"].includes(a))) {
    const id = `contrib-com-${c.id}`;
    zone.append(element("label", { classe: "etiquette-champ", cle: "contribCommentaireLabel", attributs: { for: id } }));
    champ = element("textarea", { attributs: { id, rows: "2", maxlength: String(contributions.COMMENTAIRE_MAX) } });
    zone.append(champ, element("p", { classe: "erreur-champ", attributs: { "aria-live": "assertive" } }));
  }
  const boutons = element("div", { classe: "actions" });
  for (const a of decisions) boutons.append(boutonAction(c, a, a === "valider" || a === "integrer" ? "bouton" : a === "refuser" ? "danger" : "secondaire", champ));
  zone.append(boutons);
  return zone;
}

function boutonAction(c, action, classe, champ = null) {
  const b = element("button", { classe, cle: `contribAction_${action}`, attributs: { type: "button" } });
  b.addEventListener("click", async () => {
    const erreurChamp = champ?.nextElementSibling;
    const commentaire = champ?.value ?? "";
    const verif = contributions.validerCommentaire(commentaire, action);
    if (!verif.ok) {
      if (erreurChamp) erreurChamp.textContent = t(`contribErreurCommentaire_${verif.erreur}`);
      champ?.focus();
      return;
    }
    b.disabled = true;
    try {
      const maj = await apiContrib.agir(c.id, { action, commentaire: verif.commentaire });
      notifier(t(`contribFait_${action}`) + (maj?.issue === "indisponible" ? ` ${t("contribIssueIndisponible")}` : ""), "✅");
      await chargerContributions();
    } catch (e) {
      b.disabled = false;
      if (erreurChamp) erreurChamp.textContent = messageErreurContrib(e);
      else $("#contrib-etat").textContent = messageErreurContrib(e);
    }
  });
  return b;
}

function messageErreurContrib(e) {
  const code = e?.code ?? "";
  const connus = ["quota-atteint", "relecture-quatre-yeux", "statut-incompatible", "role-requis", "donnees-personnelles", "non-connecte"];
  return t(connus.includes(code) ? `contribErreur_${code}` : "familleErreur", { n: contributions.MAX_OUVERTES_PAR_AUTEUR });
}

/* Formulaire : notion → champ → texte actuel ; ajout possible seulement pour un élément de liste. */
function remplirOptionsFormulaire() {
  const selNotion = $("#contrib-notion");
  if (contrib.index && selNotion.options.length !== contrib.index.length + 1) {
    const vide = element("option", { cle: "contribChoisirNotion" });
    vide.value = "";
    selNotion.replaceChildren(vide, ...contrib.index.map((n) => { const o = element("option", { texte: n.titre }); o.value = n.id; return o; }));
  }
  const selType = $("#contrib-type");
  const valeur = selType.value;
  selType.replaceChildren(...contributions.TYPES.map((ty) => { const o = element("option", { cle: `contribType_${ty}` }); o.value = ty; return o; }));
  selType.value = valeur || contributions.TYPES[0];
}

async function choisirNotion() {
  const id = $("#contrib-notion").value;
  const selChamp = $("#contrib-champ");
  selChamp.replaceChildren();
  selChamp.disabled = true;
  afficherTexteActuel();
  if (!id) return;
  const contenu = await contenuNotion(id);
  const champs = contributions.champsEditables(contenu);
  const vide = element("option", { cle: "contribChoisirChamp" });
  vide.value = "";
  const groupes = new Map();
  for (const c of champs) {
    if (!groupes.has(c.section)) groupes.set(c.section, element("optgroup", { attributs: { label: t(`champ_${c.section}`) } }));
    const extrait = c.valeur.length > 60 ? `${c.valeur.slice(0, 60)}…` : c.valeur;
    const o = element("option", { texte: `${libelleChamp(c.chemin)} — ${extrait}` });
    o.value = c.chemin;
    groupes.get(c.section).append(o);
  }
  selChamp.replaceChildren(vide, ...groupes.values());
  selChamp.disabled = champs.length === 0;
  $("#contrib-champ-erreur").textContent = champs.length ? "" : t("contribAucunChamp");
}

function afficherTexteActuel() {
  const contenu = contrib.contenus.get($("#contrib-notion").value);
  const chemin = $("#contrib-champ").value;
  const valeur = contenu && chemin ? contributions.valeurAChemin(contenu, chemin) : null;
  $("#contrib-actuel-bloc").hidden = typeof valeur !== "string";
  $("#contrib-actuel").textContent = valeur ?? "";
  const ajout = !!chemin && contributions.ajoutPossible(chemin);
  $("#contrib-nature-ajout").disabled = !ajout;
  if (!ajout) document.querySelector("input[name=contrib-nature][value=modification]").checked = true;
  if (typeof valeur === "string" && !$("#contrib-texte").value) $("#contrib-texte").value = valeur;
}

function erreursContrib(erreurs = {}) {
  const champs = { notion: "contrib-notion", chemin: "contrib-champ", nature: "contrib-nature", type: "contrib-type", texte: "contrib-texte", motif: "contrib-motif", charte: "contrib-charte" };
  for (const [nom, id] of Object.entries(champs)) {
    $(`#${id}-erreur`).textContent = erreurs[nom] ? t(`contribErreur_${nom}_${erreurs[nom]}`) : "";
    $(`#${id}`)?.setAttribute("aria-invalid", String(!!erreurs[nom]));
  }
}

function editerContribution(c) {
  contrib.edition = c;
  const form = $("#formulaire-contribution");
  form.reset();
  $("#contrib-proposer").open = true;
  const selNotion = $("#contrib-notion");
  selNotion.value = c.notion_id;
  const selChamp = $("#contrib-champ");
  const o = element("option", { texte: libelleChamp(c.chemin) });
  o.value = c.chemin;
  selChamp.replaceChildren(o);
  selNotion.disabled = true;
  selChamp.disabled = true;
  $("#contrib-actuel-bloc").hidden = false;
  $("#contrib-actuel").textContent = c.texte_actuel;
  $("#contrib-nature-ajout").disabled = !contributions.ajoutPossible(c.chemin);
  document.querySelector(`input[name=contrib-nature][value=${c.nature}]`).checked = true;
  $("#contrib-type").value = c.type;
  $("#contrib-texte").value = c.texte_propose;
  $("#contrib-motif").value = c.motif;
  $("#contrib-edition").hidden = false;
  $("#contrib-edition").textContent = c.commentaire ? t("contribEditionAvecCommentaire", { commentaire: c.commentaire }) : t("contribEdition");
  $("#contrib-annuler-edition").hidden = false;
  $("#contrib-texte").focus();
}

function finirEdition() {
  contrib.edition = null;
  $("#formulaire-contribution").reset();
  $("#contrib-notion").disabled = false;
  $("#contrib-champ").replaceChildren();
  $("#contrib-champ").disabled = true;
  $("#contrib-actuel-bloc").hidden = true;
  $("#contrib-edition").hidden = true;
  $("#contrib-annuler-edition").hidden = true;
  erreursContrib();
  $("#contrib-erreur").textContent = "";
}

async function envoyerContribution(e) {
  e.preventDefault();
  const edition = contrib.edition;
  const notion = edition?.notion_id ?? $("#contrib-notion").value;
  const chemin = edition?.chemin ?? $("#contrib-champ").value;
  const contenu = contrib.contenus.get(notion);
  const donnees = {
    notion_id: notion, chemin,
    nature: document.querySelector("input[name=contrib-nature]:checked")?.value,
    type: $("#contrib-type").value,
    texte_actuel: edition?.texte_actuel ?? (contenu ? contributions.valeurAChemin(contenu, chemin) : ""),
    texte_propose: $("#contrib-texte").value,
    motif: $("#contrib-motif").value,
    charte_version: $("#contrib-charte").checked ? contributions.VERSION_CHARTE : null,
    notion_version: contrib.index?.find((n) => n.id === notion)?.version ?? ""
  };
  const v = contributions.validerContribution(donnees);
  const erreurs = v.ok ? {} : { ...v.erreurs };
  if (!notion) { erreurs.notion = "requise"; delete erreurs.chemin; }
  else if (!chemin) erreurs.chemin = "requis";
  erreursContrib(erreurs);
  $("#contrib-erreur").textContent = "";
  if (Object.keys(erreurs).length) return;
  try {
    if (edition) await apiContrib.agir(edition.id, { action: "modifier", ...donnees });
    else await apiContrib.creer(donnees);
    notifier(t(edition ? "contribFait_modifier" : "contribEnvoyee"), "📝");
    finirEdition();
    $("#contrib-proposer").open = false;
    await chargerContributions();
  } catch (err) {
    if (err?.details && Object.keys(err.details).length && err.code !== "donnees-personnelles") erreursContrib(err.details);
    $("#contrib-erreur").textContent = messageErreurContrib(err);
  }
}

async function connecterDemoContrib(role) {
  sauverDemoContrib(demoContrib.connecter(contrib.etatDemo, role));
  notifier(t(`contribDemoConnecte_${role}`), "🟢");
  finirEdition();
  await chargerContributions();
}

async function deconnecterContrib() {
  if (demoContribActive()) sauverDemoContrib(demoContrib.deconnecter(contrib.etatDemo));
  else {
    try { await apiFamille.deconnecter(); } catch { /* session déjà close */ }
    etat.compte = null;
    rafraichirFamille();
  }
  finirEdition();
  await chargerContributions();
}

/* ---------- Édition ciblée d'une notion dans la bulle (ADR 0023) ---------- */
// Rôle contributeur ou prof : la bulle affiche, à côté de la page, les textes de la notion regroupés par onglet.
// Chaque texte se modifie ou se complète sur place, avec l'aperçu avant / après, puis part en relecture.
// La page elle-même n'est jamais modifiée : elle reste isolée (iframe sans même origine) et déterministe.
const CLE_EDITION_OUVERTE = "kermiclab:edition-ouverte";
const roleEdition = () => {
  if (!contributionsActives()) return null;
  const role = apiContrib.compte()?.role;
  return contributions.peutContribuer(role) ? role : null;
};
/** Propositions connues pour afficher les compteurs : toutes pour un relecteur, les siennes sinon. */
const contributionsConnues = () => (contributions.peutRelire(roleEdition()) ? contrib.relecture : contrib.miennes);

async function preparerEdition(notionId) {
  const bouton = $("#bulle-editer");
  const viser = contrib.bulle.viser;
  contrib.bulle = { notion: null, cible: null, viser: null };
  bouton.hidden = true;
  $("#bulle-edition").hidden = true;
  $("#bulle-lab").classList.remove("en-edition");
  if (!roleEdition()) return;
  const index = await indexContenus();
  if (!index.some((n) => n.id === notionId) || $("#bulle-lab").dataset.notion !== notionId) return;
  contrib.bulle.notion = notionId;
  bouton.hidden = false;
  // Volet affiché à la demande : fermé par défaut pour laisser toute la place à la page ; le choix est retenu dans
  // l'onglet. Ouvert d'office quand on vient du suivi (« Voir dans la notion ») pour viser un texte précis.
  const ouverte = !!viser || lireCle(sessionPreferences(), CLE_EDITION_OUVERTE) === "1";
  basculerEdition(ouverte, { memoriser: false, focus: false });
  if (!contrib.chargee) await chargerContributions();
  await contenuNotion(notionId);
  rendreEdition();
  if (viser) viserChamp(viser);
}

function basculerEdition(ouverte, { memoriser = true, focus = true } = {}) {
  const bouton = $("#bulle-editer");
  bouton.setAttribute("aria-expanded", String(ouverte));
  $("#bulle-edition").hidden = !ouverte;
  $("#bulle-lab").classList.toggle("en-edition", ouverte);
  if (memoriser) ecrireCle(sessionPreferences(), CLE_EDITION_OUVERTE, ouverte ? "1" : "0");
  if (!focus) return;
  if (ouverte) $("#edition-fermer").focus({ preventScroll: true });
  else bouton.focus({ preventScroll: true });
}

function fermerEdition() {
  contrib.bulle = { notion: null, cible: null, viser: null };
  $("#bulle-editer").hidden = true;
  $("#bulle-edition").hidden = true;
  $("#bulle-lab").classList.remove("en-edition");
  $("#edition-formulaire").hidden = true;
}

/** Ouvre une notion dans la bulle, volet d'édition ouvert sur un texte (depuis le suivi des contributions). */
function ouvrirNotionEnEdition(notionId, chemin) {
  const n = notionParId(notionId) ?? { id: notionId, titre: titreNotion(notionId) };
  contrib.bulle.viser = chemin;
  const url = `${etat.config.apiUrl}/maquettes/${encodeURIComponent(n.id)}?lang=${encodeURIComponent(etat.langue)}`;
  ouvrirBulle(n, url);
}

/** Déplie l'onglet du texte visé, le fait défiler dans le volet et le met en évidence. */
function viserChamp(chemin) {
  const champ = document.querySelector(`.edition-champ[data-chemin="${CSS.escape(chemin)}"]`);
  if (!champ) return;
  champ.closest("details").open = true;
  for (const c of document.querySelectorAll(".edition-champ.vise")) c.classList.remove("vise");
  champ.classList.add("vise");
  champ.scrollIntoView({ block: "center", behavior: mouvementReduit() ? "auto" : "smooth" });
  champ.querySelector("button")?.focus({ preventScroll: true });
}

function rendreEdition() {
  const id = contrib.bulle.notion;
  const contenu = id ? contrib.contenus.get(id) : null;
  if (!contenu) { $("#edition-sections").replaceChildren(element("p", { classe: "doux", cle: "familleErreur" })); return; }
  const groupes = contributions.champsParOnglet(contenu, contributionsConnues(), id);
  const total = groupes.reduce((n, g) => n + g.champs.length, 0);
  const enCours = groupes.reduce((n, g) => n + g.champs.reduce((m, c) => m + c.enCours, 0), 0);
  $("#edition-resume").textContent = t(contributions.peutRelire(roleEdition()) ? "editionResumeProf" : "editionResume", { champs: total, n: enCours });
  const compteur = $("#bulle-editer-compteur");
  compteur.hidden = enCours === 0;
  compteur.textContent = String(enCours);
  compteur.title = t("editionEnCours", { n: enCours });
  rendreSuiviNotion(id);
  $("#edition-sections").replaceChildren(...groupes.map((g, i) => {
    const section = element("details", { classe: "edition-section", attributs: { "data-onglet": g.onglet } });
    if (i === 0) section.open = true;
    const resume = element("summary");
    const enCoursOnglet = g.champs.reduce((m, c) => m + c.enCours, 0);
    resume.append(element("span", { cle: `editionOnglet_${g.onglet}` }),
      element("span", { classe: "doux petit", texte: t("editionChamps", { n: g.champs.length }) + (enCoursOnglet ? ` · ${t("editionEnCours", { n: enCoursOnglet })}` : "") }));
    const liste = element("ul", { classe: "edition-champs" });
    liste.append(...g.champs.map((c) => {
      const li = element("li", { classe: "edition-champ", attributs: { "data-chemin": c.chemin } });
      const titre = element("p");
      titre.append(element("strong", { texte: libelleChamp(c.chemin) }));
      if (c.enCours) titre.append(document.createTextNode(" "), element("span", { classe: "edition-pastille", texte: t("editionEnCours", { n: c.enCours }) }));
      const extrait = element("p", { classe: "doux", texte: contributions.extrait(c.valeur) });
      const actions = element("div", { classe: "actions" });
      const modifier = element("button", { classe: "bouton petit-bouton", cle: "contribModifier", attributs: { type: "button" } });
      modifier.addEventListener("click", () => ouvrirFormulaireEdition(c, "modification"));
      actions.append(modifier);
      if (c.liste) {
        const ajouter = element("button", { classe: "secondaire petit-bouton", cle: "editionAjouterApres", attributs: { type: "button" } });
        ajouter.addEventListener("click", () => ouvrirFormulaireEdition(c, "ajout"));
        actions.append(ajouter);
      }
      li.append(titre, extrait, actions);
      return li;
    }));
    section.append(resume, liste);
    return section;
  }));
}

/** Dans le volet : propositions déjà faites sur cette notion (les siennes ; toutes pour un prof), avec leur statut. */
function rendreSuiviNotion(id) {
  const liste = contributions.trierSuivi(contributionsConnues().filter((c) => c.notion_id === id));
  const bloc = $("#edition-suivi");
  bloc.hidden = liste.length === 0;
  if (!liste.length) return;
  const s = contributions.suiviAuteur(liste);
  $("#edition-suivi-resume").textContent = t("editionSuiviResume", { total: liste.length, ouvertes: s.ouvertes, acceptees: s.acceptees });
  $("#edition-suivi-liste").replaceChildren(...liste.map((c) => {
    const li = element("li", { classe: "edition-suivi-item", attributs: { "data-id": c.id } });
    const lien = element("button", { classe: "lien-bouton", texte: libelleChamp(c.chemin), attributs: { type: "button" } });
    lien.addEventListener("click", () => viserChamp(c.chemin));
    li.append(lien, element("span", { classe: `contrib-statut statut-${c.statut}`, cle: `contribStatut_${c.statut}` }));
    if (c.commentaire && c.statut === "a_reviser") li.append(element("p", { classe: "petit contrib-commentaire", texte: c.commentaire }));
    return li;
  }));
}

function ouvrirFormulaireEdition(champ, nature) {
  contrib.bulle.cible = champ;
  const form = $("#edition-formulaire");
  form.reset();
  form.hidden = false;
  $("#edition-cible").textContent = `${titreNotion(contrib.bulle.notion)} · ${libelleChamp(champ.chemin)}`;
  $("#edition-actuel").textContent = champ.valeur;
  $("#edition-nature-ajout").disabled = !champ.liste;
  document.querySelector(`input[name=edition-nature][value=${nature}]`).checked = true;
  $("#edition-type").replaceChildren(...contributions.TYPES.map((ty) => { const o = element("option", { cle: `contribType_${ty}` }); o.value = ty; return o; }));
  $("#edition-texte").value = nature === "modification" ? champ.valeur : "";
  for (const id of ["texte", "motif", "charte"]) $(`#edition-${id}-erreur`).textContent = "";
  $("#edition-erreur").textContent = "";
  apercuEdition();
  form.scrollIntoView({ block: "start", behavior: mouvementReduit() ? "auto" : "smooth" });
  $("#edition-texte").focus({ preventScroll: true });
}

function apercuEdition() {
  const cible = contrib.bulle.cible;
  if (!cible) return;
  const nature = document.querySelector("input[name=edition-nature]:checked")?.value;
  const c = { nature, texte_actuel: cible.valeur, texte_propose: $("#edition-texte").value };
  $("#edition-apercu").replaceWith(Object.assign(blocDiff(c), { id: "edition-apercu" }));
}

async function envoyerEdition(e) {
  e.preventDefault();
  const cible = contrib.bulle.cible;
  if (!cible) return;
  const notion = contrib.bulle.notion;
  const donnees = {
    notion_id: notion, chemin: cible.chemin,
    nature: document.querySelector("input[name=edition-nature]:checked")?.value,
    type: $("#edition-type").value,
    texte_actuel: cible.valeur,
    texte_propose: $("#edition-texte").value,
    motif: $("#edition-motif").value,
    charte_version: $("#edition-charte").checked ? contributions.VERSION_CHARTE : null,
    notion_version: contrib.index?.find((n) => n.id === notion)?.version ?? ""
  };
  const v = contributions.validerContribution(donnees);
  const erreurs = v.ok ? {} : v.erreurs;
  for (const nom of ["texte", "motif", "charte"]) {
    $(`#edition-${nom}-erreur`).textContent = erreurs[nom] ? t(`contribErreur_${nom}_${erreurs[nom]}`) : "";
  }
  $("#edition-erreur").textContent = erreurs.nature ? t(`contribErreur_nature_${erreurs.nature}`) : erreurs.type ? t("contribErreur_type_invalide") : "";
  if (!v.ok) return;
  try {
    await apiContrib.creer(donnees);
    notifier(t("contribEnvoyee"), "📝");
    $("#edition-formulaire").hidden = true;
    contrib.bulle.cible = null;
    await chargerContributions();
    rendreEdition();
    $(`.edition-champ[data-chemin="${CSS.escape(cible.chemin)}"] button`)?.focus();
  } catch (err) {
    $("#edition-erreur").textContent = messageErreurContrib(err);
  }
}

function brancherEdition() {
  $("#bulle-editer").addEventListener("click", (e) => basculerEdition(e.currentTarget.getAttribute("aria-expanded") !== "true"));
  $("#edition-fermer").addEventListener("click", () => basculerEdition(false));
  // Échap dans le volet ferme le volet seulement, pas la bulle.
  $("#bulle-edition").addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    if (!$("#edition-formulaire").hidden) { $("#edition-formulaire").hidden = true; contrib.bulle.cible = null; return; }
    basculerEdition(false);
  });
  $("#edition-formulaire").addEventListener("submit", envoyerEdition);
  $("#edition-texte").addEventListener("input", apercuEdition);
  for (const r of document.querySelectorAll("input[name=edition-nature]")) r.addEventListener("change", apercuEdition);
  $("#edition-annuler").addEventListener("click", () => { $("#edition-formulaire").hidden = true; contrib.bulle.cible = null; });
  $("#edition-vers-contributions").addEventListener("click", () => {
    const notion = contrib.bulle.notion;
    $("#bulle-lab").addEventListener("close", () => {
      if (notion && contributions.peutRelire(roleEdition())) Object.assign(contrib.filtre, { statut: "tous", matiere: matiereNotion(notion), notion });
      if (notion) Object.assign(contrib.suivi, { statut: "tous", notion });
      naviguer("contributions");
    }, { once: true });
    $("#bulle-lab").close();
  });
}

/*
 * TEMPORAIRE (issue #160) — à supprimer quand la gestion des comptes sera disponible.
 * « Tester les rôles » dans le Profil simule le rôle contributeur ou prof dans le navigateur (double de démonstration,
 * état gardé dans l'onglet) pour tester les écrans Contributions. Aucun rôle n'est attribué côté serveur : le Worker
 * reste réservé aux rôles posés en base. Affiché seulement si `config.testRolesTemporaire` vaut true.
 */
function brancherTestRoles() {
  const bloc = $("#test-roles");
  bloc.hidden = etat.config?.testRolesTemporaire !== true;
  if (bloc.hidden) return;
  synchroniserTestRoles();
  $("#test-roles-choix").addEventListener("change", (e) => choisirRoleTest(e.currentTarget.value));
}

function synchroniserTestRoles() {
  const choix = $("#test-roles-choix");
  if (choix) choix.value = demoContribActive() ? (contrib.etatDemo?.connecte ? contrib.etatDemo.role : "") : "";
}

function choisirRoleTest(role) {
  if (!["contributeur", "prof"].includes(role)) { quitterDemo(); return; }
  const suivant = demoContrib.connecter(demoContrib.lireEtat(lireCle(sessionPreferences(), demoContrib.CLE_DEMO)), role);
  if (!demoContribActive()) {
    // Premier choix : l'écran Contributions n'existe qu'après un rechargement en démonstration.
    ecrireCle(sessionPreferences(), demoContrib.CLE_DEMO, JSON.stringify(suivant));
    demarrerDemoContrib();
    return;
  }
  sauverDemoContrib(suivant);
  finirEdition();
  naviguer("contributions"); // l'ouverture de l'écran recharge les contributions avec le nouveau rôle
}

function brancherContributions() {
  initialiserDemoContrib();
  // Écran toujours déclaré : un compte local peut obtenir son rôle après le démarrage (chargerProf). Tant que les
  // contributions ne sont pas actives, l'écran renvoie vers l'accueil (afficherEcran).
  ECRANS.push("contributions");
  $("#essayer-demo-contrib").addEventListener("click", demarrerDemoContrib);
  $("#contrib-demo-contributeur").addEventListener("click", () => connecterDemoContrib("contributeur"));
  $("#contrib-demo-prof").addEventListener("click", () => connecterDemoContrib("prof"));
  $("#contrib-deconnexion").addEventListener("click", deconnecterContrib);
  $("#contrib-notion").addEventListener("change", () => { $("#contrib-texte").value = ""; void choisirNotion(); });
  $("#contrib-champ").addEventListener("change", () => { $("#contrib-texte").value = ""; afficherTexteActuel(); });
  $("#formulaire-contribution").addEventListener("submit", envoyerContribution);
  $("#contrib-annuler-edition").addEventListener("click", finirEdition);
  $("#contrib-filtre-statut").addEventListener("change", (e) => { contrib.filtre.statut = e.currentTarget.value; rafraichirContributions(); });
  $("#contrib-filtre-notion").addEventListener("change", (e) => { contrib.filtre.notion = e.currentTarget.value; rafraichirContributions(); });
  $("#contrib-suivi-notion").addEventListener("change", (e) => { contrib.suivi.notion = e.currentTarget.value; rafraichirContributions(); });
  $("#contrib-suivi-alerte-voir").addEventListener("click", () => {
    Object.assign(contrib.suivi, { statut: "a_reviser", notion: "" });
    rafraichirContributions();
    $("#contrib-miennes").scrollIntoView({ block: "start", behavior: "instant" });
  });
  $("#contrib-filtre-matiere").addEventListener("change", (e) => { contrib.filtre.matiere = e.currentTarget.value; contrib.filtre.notion = ""; rafraichirContributions(); });
  brancherEdition();
  if (demoContribActive()) void indexContenus().then(rafraichirContributions);
  rafraichirContributions();
}

/* ---------- Construction du fil ---------- */

function element(balise, { classe, texte, cle, attributs } = {}) {
  const n = document.createElement(balise);
  if (classe) n.className = classe;
  if (cle) { n.dataset.i18n = cle; n.textContent = t(cle); } else if (texte !== undefined) n.textContent = texte;
  for (const [k, v] of Object.entries(attributs ?? {})) n.setAttribute(k, v);
  return n;
}

function defiler(li, bloc = "end") {
  // Le fil est visible dans le panneau flottant ou incrusté dans l'accueil.
  if ($("#fil").offsetParent !== null) li.scrollIntoView({ behavior: mouvementReduit() ? "auto" : "smooth", block: bloc });
}

/**
 * Accueil : le fil (unique) quitte le panneau flottant et s'affiche sous le champ de l'accueil.
 * Le panneau flottant se referme ; il reprend le fil à sa prochaine ouverture (`ouvrirChat`).
 */
function incrusterFil() {
  const hote = $("#fil-accueil");
  fermerChat();
  if (!hote.contains($("#fil"))) hote.prepend($("#fil"));
  hote.hidden = false;
}

/** Le fil revient dans le panneau flottant (déplacer une page incrustée la recharge). */
function rendreFilAuChat() {
  const fil = $("#fil");
  const panneau = $("#panneau-chat");
  if (!panneau.contains(fil)) panneau.insertBefore(fil, panneau.querySelector(".zone-saisie"));
  $("#fil-accueil").hidden = true;
}

function ouvrirChat() {
  rendreFilAuChat();
  $("#panneau-chat").hidden = false;
  $("#ouvrir-chat").setAttribute("aria-expanded", "true");
  $("#question").focus({ preventScroll: true });
  const fil = $("#fil");
  fil.scrollTop = fil.scrollHeight;
}

function fermerChat({ rendreFocus = false } = {}) {
  const panneau = $("#panneau-chat");
  if (panneau.hidden) return;
  const focusDansChat = panneau.contains(document.activeElement);
  panneau.hidden = true;
  $("#ouvrir-chat").setAttribute("aria-expanded", "false");
  if (rendreFocus || focusDansChat) $("#ouvrir-chat").focus({ preventScroll: true });
}

/** Crée une bulle du fil. `cleAuteur` reste lié à i18n pour suivre un changement de langue. */
function creerMessage({ moi = false } = {}) {
  const li = element("li", { classe: `message ${moi ? "moi" : "assistant"}` });
  if (!moi) li.append(element("span", { classe: "avatar", texte: "K", attributs: { "aria-hidden": "true" } }));
  const bulle = element("div", { classe: "bulle" });
  bulle.append(element("span", { classe: "auteur", cle: moi ? "vous" : "assistant" }));
  li.append(bulle);
  $("#fil").append(li);
  return { li, bulle };
}

function puce(texte, { cle, classe = "puce" } = {}) {
  const b = element("button", { classe, cle, texte, attributs: { type: "button" } });
  b.addEventListener("click", () => { if (!etat.envoiEnCours) envoyer(cle ? t(cle) : texte); });
  return b;
}

/** Questions d'exemple du catalogue (toujours routées vers une page) ; textes de secours i18n si l'API ne répond pas. */
async function chargerSuggestions() {
  try {
    const r = await fetch(`${etat.config.apiUrl}/api/suggestions?lang=${encodeURIComponent(etat.langue)}`);
    etat.suggestions = r.ok ? pucesValides((await r.json()).suggestions) : [];
  } catch {
    etat.suggestions = [];
  }
}

function pucesValides(liste) {
  return Array.isArray(liste) ? liste.filter((q) => typeof q === "string" && q.trim() && q.length <= TAILLE_MAX_PUCE).slice(0, MAX_PUCES) : [];
}

function remplirPuces(conteneur, questions) {
  conteneur.replaceChildren(...questions.map((q) => puce(q)));
}

function ajouterBienvenue() {
  const { li, bulle } = creerMessage();
  li.classList.add("bienvenue");
  bulle.append(
    element("h2", { classe: "bienvenue-titre", cle: "bienvenueTitre" }),
    element("p", { classe: "texte", attributs: { id: "texte-bienvenue" } }),
    element("p", { classe: "puces-titre", cle: "suggestionsTitre" })
  );
  bulle.append(element("div", { classe: "puces", attributs: { id: "puces-bienvenue" } }));
  rafraichirBienvenue();
}

/** Questions d'exemple sous le champ de l'accueil : les mêmes que dans le fil. */
const questionsExemple = () => etat.suggestions.length ? etat.suggestions : ["suggestion1", "suggestion2", "suggestion3", "suggestion4"].map((c) => t(c));

function rafraichirBienvenue() {
  const accueil = $("#puces-accueil");
  if (accueil) remplirPuces(accueil, questionsExemple());
  const n = $("#texte-bienvenue");
  if (!n || !etat.progres) return;
  const serie = progression.serieCourante(etat.progres);
  n.textContent = etat.progres.questions > 0 && serie > 0 ? t("bienvenueRetour", { n: serie }) : t("bienvenue");
  const puces = $("#puces-bienvenue");
  if (puces) remplirPuces(puces, questionsExemple());
}

/**
 * Repart d'un fil vierge (message d'accueil et suggestions). Côté serveur, rien n'est effacé : le quota IA
 * de la session reste décompté, et aucun historique n'est envoyé au modèle de toute façon.
 */
function nouvelleConversation() {
  if (etat.envoiEnCours) return;
  $("#fil").replaceChildren();
  ajouterBienvenue();
  if (!$("#fil-accueil").hidden) {
    // Fil incrusté dans l'accueil : il se replie, la saisie de l'accueil reprend la main.
    $("#fil-accueil").hidden = true;
    $("#question-accueil").focus({ preventScroll: true });
    return;
  }
  const champ = $("#question");
  champ.value = "";
  champ.style.height = "auto";
  champ.focus({ preventScroll: true });
}

/** Bascule le panneau du chat en plein écran (et retour) ; le libellé suit l'état pour les lecteurs d'écran. */
function basculerPleinEcran(actif = !$("#panneau-chat").classList.contains("plein-ecran")) {
  $("#panneau-chat").classList.toggle("plein-ecran", actif);
  const bouton = $("#plein-ecran-chat");
  bouton.setAttribute("aria-pressed", String(actif));
  const cle = actif ? "chatQuitterPleinEcran" : "chatPleinEcran";
  bouton.dataset.i18nAria = cle;
  bouton.dataset.i18nTitle = cle;
  bouton.setAttribute("aria-label", t(cle));
  bouton.title = t(cle);
  const fil = $("#fil");
  fil.scrollTop = fil.scrollHeight;
}

function ajouterQuestion(question) {
  const { li, bulle } = creerMessage({ moi: true });
  bulle.append(element("p", { classe: "texte", texte: question }));
  defiler(li);
}

function ajouterAttente() {
  const { li, bulle } = creerMessage();
  li.classList.add("attente");
  const points = element("span", { classe: "points", attributs: { "aria-hidden": "true" } });
  points.append(element("span"), element("span"), element("span"));
  bulle.append(points, element("span", { classe: "visuellement-cache", cle: "chargement" }));
  defiler(li);
  return li;
}

function carteMaquette(maquette) {
  const carte = element("div", { classe: "carte-maquette" });
  const entete = element("div", { classe: "carte-entete" });
  const titre = element("div", { classe: "carte-titre" });
  titre.append(element("strong", { texte: maquette.titre }), element("span", { classe: "etiquette", texte: t("version", { n: maquette.version }) }));
  const actions = element("div", { classe: "carte-actions" });
  const lien = element("a", { classe: "bouton-lien plein-ecran", attributs: { href: maquette.url, target: "_blank", rel: "noopener" } });
  lien.append(element("span", { cle: "pleinEcran" }));
  lien.title = t("ouvrirPage");
  lien.dataset.i18nTitle = "ouvrirPage";
  const bascule = element("button", { classe: "secondaire petit-bouton", cle: "reduire", attributs: { type: "button", "aria-expanded": "true" } });
  actions.append(bascule, lien);
  entete.append(titre, actions);

  const cadre = element("iframe", { attributs: { src: maquette.url, title: maquette.titre, loading: "lazy" } });
  // Même origine que le chat : pas d'allow-same-origin, pour que la maquette reste isolée de la page.
  // Les modules compatibles confient leur progression locale au tableau de bord par postMessage.
  cadre.setAttribute("sandbox", "allow-scripts allow-popups allow-popups-to-escape-sandbox");
  cadre.dataset.module = maquette.id;
  bascule.addEventListener("click", () => {
    const ouvert = bascule.getAttribute("aria-expanded") === "true";
    bascule.setAttribute("aria-expanded", String(!ouvert));
    bascule.dataset.i18n = ouvert ? "afficher" : "reduire";
    bascule.textContent = t(bascule.dataset.i18n);
    cadre.hidden = ouvert;
  });
  carte.append(entete, cadre);
  return carte;
}

function ajouterRelances(bulle, questions, cleTitre) {
  document.querySelectorAll("#fil .relances").forEach((n) => n.remove());
  const bloc = element("div", { classe: "relances" });
  bloc.append(element("p", { classe: "puces-titre", cle: cleTitre }));
  const puces = element("div", { classe: "puces" });
  remplirPuces(puces, questions);
  bloc.append(puces);
  bulle.append(bloc);
}

function referencesLlm(sources, llm) {
  const bloc = element("footer", { classe: "references-llm" });
  bloc.append(element("strong", { cle: "llmSources" }));
  const liste = element("ul");
  for (const source of sources) {
    let url;
    try { url = new URL(source.url, etat.config.apiUrl || location.origin); } catch {
      console.error("source LLM invalide");
      continue;
    }
    const origineApi = new URL(etat.config.apiUrl || location.origin).origin;
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== origineApi
      || !/^\/maquettes\/[a-z0-9-]+$/.test(url.pathname)) {
      console.error("source LLM non autorisée");
      continue;
    }
    const ligne = element("li");
    ligne.append(
      element("a", { texte: source.titre, attributs: { href: url.href, target: "_blank", rel: "noopener noreferrer" } }),
      element("span", { classe: "source-description", texte: source.description })
    );
    liste.append(ligne);
  }
  bloc.append(liste);
  // Métadonnées techniques repliées derrière un chevron : présentes (ADR 0016) sans surcharger le fil.
  const details = element("details", { classe: "details-llm" });
  details.append(element("summary", { cle: "llmDetails" }));
  const metadonnees = element("dl", { classe: "metadonnees-llm" });
  for (const [cle, valeur] of [
    ["llmModele", `${llm.fournisseur} · ${llm.modele}`],
    ["llmHarness", `${llm.harness.nom} v${llm.harness.version} · ${llm.harness.prompt}`],
    ["llmPerimetre", llm.harness.perimetre],
    ["llmAcces", t("llmAccesGratuit")],
    ["llmQuota", `${llm.quota.consommes} / ${llm.quota.limite}`]
  ]) {
    metadonnees.append(element("dt", { cle }), element("dd", { texte: valeur, ...(cle === "llmAcces" ? { cle: "llmAccesGratuit" } : {}) }));
  }
  details.append(metadonnees);
  for (const appel of llm.appels) {
    const ligne = element("p", { classe: "llm-appel" });
    ligne.append(
      element("span", { texte: `${appel.fournisseur} · ${appel.modele} · ${appel.tokensSortie} ` }),
      element("span", { cle: appel.comptage === "fournisseur" ? "llmTokensMesures" : "llmTokensReserves" })
    );
    details.append(ligne);
  }
  if (llm.repli) details.append(element("p", { cle: "llmRepli" }));
  bloc.append(details);
  return bloc;
}

/** Écrans que l'assistant peut proposer d'ouvrir (liste fermée : la réponse du serveur ne choisit rien d'autre). */
const ACTIONS_ECRANS = { jeux: "navJeux", labs: "navLabs", notions: "navEducation", progression: "navProgression", badges: "mesBadges", defi: "navDefi" };

function actionsEcrans(actions) {
  // Deux actions qui mènent au même écran (notions → Éducation) n'en font qu'une.
  const vus = new Set();
  const valides = (Array.isArray(actions) ? actions : []).filter((a) => Object.hasOwn(ACTIONS_ECRANS, a))
    .filter((a) => { const cible = ACTIONS_ECRANS[a]; if (vus.has(cible)) return false; vus.add(cible); return true; }).slice(0, 3);
  if (!valides.length) return null;
  const bloc = element("div", { classe: "actions-chat" });
  for (const ecran of valides) {
    const b = element("button", { classe: "secondaire petit-bouton", cle: ACTIONS_ECRANS[ecran], attributs: { type: "button", "data-ecran-chat": ecran } });
    b.addEventListener("click", () => {
      naviguer(ecran);
      // Sur petit écran ou en plein écran, le chat couvre l'écran ouvert : on le replie.
      if ($("#panneau-chat").classList.contains("plein-ecran") || window.matchMedia?.("(max-width: 720px)").matches) fermerChat();
    });
    bloc.append(b);
  }
  return bloc;
}

/** Résumé de progression calculé sur l'appareil (le serveur ne connaît ni l'XP, ni la série, ni les trophées). */
function resumeProgression() {
  const p = etat.progres;
  if (!p) return null;
  const { niveau } = progression.niveau(p);
  const badges = p.badges.length;
  const modules = Object.keys(etat.trophees ?? {}).length;
  const liste = element("dl", { classe: "resume-progression" });
  for (const [cle, valeur] of [
    ["resumeNiveau", t("niveauLong", { n: niveau })],
    ["resumeXp", `${p.xp ?? 0} XP`],
    ["resumeSerie", t("resumeJours", { n: progression.serieCourante(p) })],
    ["resumeNotions", String(p.notions.length)],
    ["resumeBadges", `${badges} / ${progression.BADGES.length}`],
    ["resumeModules", String(modules)]
  ]) {
    const ligne = element("div");
    ligne.append(element("dt", { cle }), element("dd", { texte: valeur }));
    liste.append(ligne);
  }
  return liste;
}

function ajouterReponse({ texte, maquette, suggestions, horsCatalogue, conversation, sources, llm, actions, resume }) {
  const { li, bulle } = creerMessage();
  if (conversation) li.classList.add("conversation");
  bulle.append(element("p", { classe: "texte", texte }));
  if (conversation && resume === "progression") {
    const carte = resumeProgression();
    if (carte) bulle.append(carte);
  }
  if (conversation) {
    const boutons = actionsEcrans(actions);
    if (boutons) bulle.append(boutons);
  }
  if (maquette) {
    li.classList.add("maquette");
    li.dataset.maquette = maquette.id;
    bulle.append(carteMaquette(maquette));
  }
  const questions = pucesValides(suggestions);
  if (horsCatalogue) li.classList.add("hors-catalogue");
  if (questions.length) ajouterRelances(bulle, questions, horsCatalogue ? "horsCatalogueTitre" : conversation ? "conversationTitre" : "relancesTitre");
  if (llm && Array.isArray(sources)) bulle.append(referencesLlm(sources, llm));
  defiler(li, maquette ? "start" : "end");
  return li;
}

function ajouterErreur(question) {
  const { li, bulle } = creerMessage();
  li.classList.add("erreur");
  bulle.append(element("p", { classe: "texte", cle: "erreurReseau" }));
  const bouton = element("button", { classe: "secondaire petit-bouton", cle: "reessayer", attributs: { type: "button" } });
  bouton.addEventListener("click", () => { if (!etat.envoiEnCours) { li.remove(); envoyer(question, { dejaAffichee: true }); } });
  bulle.append(bouton);
  defiler(li);
}

/* ---------- Progression : pastille, notifications, tableau ---------- */

function rafraichirPastille() {
  if (!etat.progres) return;
  const serie = progression.serieCourante(etat.progres);
  const { niveau, xpDansNiveau, xpParNiveau } = progression.niveau(etat.progres);
  $("#pastille-serie").textContent = String(serie);
  $("#pastille-niveau").textContent = t("niveauCourt", { n: niveau });
  const barre = $("#pastille-xp");
  barre.max = xpParNiveau; barre.value = xpDansNiveau;
  $("#ouvrir-progres").classList.toggle("serie-active", serie > 0);
  $("#ouvrir-progres").title = `${t("monProgres")} — ${t("niveauLong", { n: niveau })}`;
  rafraichirTableau();
}

// Les notifications s'enchaînent une à une : plusieurs succès simultanés restent lisibles.
const fileToasts = [];
let toastEnCours = false;

function notifier(texte, icone = "✨") {
  fileToasts.push({ texte, icone });
  if (!toastEnCours) afficherToastSuivant();
}

function afficherToastSuivant() {
  const suivant = fileToasts.shift();
  if (!suivant) { toastEnCours = false; return; }
  toastEnCours = true;
  const n = element("div", { classe: "toast" });
  n.append(element("span", { classe: "toast-icone", texte: suivant.icone, attributs: { "aria-hidden": "true" } }), element("span", { texte: suivant.texte }));
  $("#toasts").append(n);
  const duree = fileToasts.length ? 1800 : 2800;
  setTimeout(() => n.classList.add("sortie"), duree);
  setTimeout(() => { n.remove(); afficherToastSuivant(); }, duree + 400);
}

function animerGain(xp) {
  const pastille = $("#ouvrir-progres");
  const gain = element("span", { classe: "gain", texte: t("xpGagne", { n: xp }), attributs: { "aria-hidden": "true" } });
  pastille.append(gain);
  pastille.classList.remove("pulse");
  void pastille.offsetWidth; // relance l'animation
  pastille.classList.add("pulse");
  setTimeout(() => gain.remove(), 1300);
}

function appliquerResultat(resultat) {
  etat.progres = resultat.p;
  progression.sauver(stockage(), etat.progres);
  rafraichirPastille();
  if (resultat.xpGagne) animerGain(resultat.xpGagne);
  if (resultat.nouvelleNotion) notifier(t("nouvelleNotion"), "🧩");
  for (const b of resultat.nouveaux) notifier(t("badgeDebloque", { nom: t(`badge_${b.id}`) }), b.icone);
  if (resultat.niveauGagne) notifier(t("niveauGagne", { n: progression.niveau(etat.progres).niveau }), "⭐");
  // Synchronise si un profil enfant est actif sur l'appareil (ADR 0017).
  void synchroniserProgression();
  // Compte enfant d'une famille (ADR 0029) : bilan groupé envoyé au parent.
  planifierBilanFamille();
  if (resultat.nouvelleNotion) rendreCatalogue();
  rafraichirTableau();
}

/** Mes badges : accomplissements obtenus, les deux plus proches, puis les modules réellement lancés. */
function remplirProgres() {
  const p = etat.progres;
  const { niveau, xpDansNiveau, xpParNiveau } = progression.niveau(p);
  $("#progres-niveau-num").textContent = String(niveau);
  $("#progres-niveau").textContent = t("niveauLong", { n: niveau });
  $("#progres-xp").max = xpParNiveau; $("#progres-xp").value = xpDansNiveau;
  $("#progres-xp-texte").textContent = t("xpAvantNiveau", { n: xpParNiveau - xpDansNiveau, m: niveau + 1 });
  $("#stat-serie-max").textContent = p.serieMax ? t("statSerieMax", { n: p.serieMax }) : "";
  $("#note-memoire").textContent = t(etat.memoire ? "progressionMemoire" : "progressionSession");
  const avancement = progression.avancementBadges(p);
  const obtenus = avancement.filter((b) => b.obtenu);
  // « À portée » : les deux badges non obtenus les plus avancés, jamais la liste complète des badges verrouillés.
  const portee = avancement.filter((b) => !b.obtenu).sort((a, b) => b.actuel / b.cible - a.actuel / a.cible).slice(0, 2);
  const ligne = (b) => {
    const li = element("li", { classe: `badge ${b.obtenu ? "obtenu" : "a-portee"}` });
    li.append(
      element("span", { classe: "badge-icone", texte: b.icone, attributs: { "aria-hidden": "true" } }),
      element("strong", { texte: t(`badge_${b.id}`) }),
      element("span", { classe: "doux petit", texte: t(`badge_${b.id}_desc`) })
    );
    if (!b.obtenu) {
      li.append(element("progress", { attributs: { max: b.cible, value: b.actuel, "aria-label": t(`badge_${b.id}`) } }),
        element("span", { classe: "doux petit", texte: `${b.actuel} / ${b.cible}` }));
    }
    return li;
  };
  $("#liste-badges").replaceChildren(...obtenus.map(ligne));
  $("#badges-obtenus-titre").hidden = !obtenus.length;
  $("#badges-portee").replaceChildren(...portee.map(ligne));
  $("#badges-portee-titre").hidden = !portee.length;
  rendreTrophees();
}

/** Trophées des modules (notions, labs, jeux) : seulement ceux que l'élève a déjà lancés sur cet appareil. */
function rendreTrophees() {
  const ouverts = new Set([...document.querySelectorAll(".trophee-module details[open]")].map((n) => n.closest("[data-trophee-module]").dataset.tropheeModule));
  const modules = Object.entries(etat.trophees);
  const obtenusModules = modules.reduce((s, [, m]) => s + m.badges.filter((b) => b.obtenu).length, 0);
  $("#trophees-resume").textContent = t("badgesResume", { n: etat.progres.badges.length + obtenusModules });
  $("#trophees-modules").hidden = !modules.length;
  const titres = { notions: "tropheesNotions", labs: "tropheesLabs", jeux: "tropheesJeux" };
  for (const genre of ["notions", "labs", "jeux"]) {
    const zone = $(`#trophees-${genre}`);
    zone.replaceChildren();
    const selection = modules.filter(([, m]) => m.genre === genre);
    const categorie = $(`[data-trophees-categorie="${genre}"]`);
    categorie.hidden = !selection.length;
    const obtenusCategorie = selection.reduce((s, [, m]) => s + m.badges.filter((b) => b.obtenu).length, 0);
    const totalCategorie = selection.reduce((s, [, m]) => s + m.badges.length, 0);
    categorie.querySelector("summary").textContent = totalCategorie
      ? `${t(titres[genre])} · ${t("tropheesBadges", { n: obtenusCategorie, m: totalCategorie })}`
      : t(titres[genre]);
    for (const [id, m] of selection) {
      const carte = element("article", { classe: "trophee-module", attributs: { "data-trophee-module": id } });
      const notion = notionParId(id);
      carte.append(element("h4", { texte: id === "mini-cercle" ? t("minilabTitre") : notion?.titre ?? id }));
      if (id === "mini-cercle") carte.append(element("p", { cle: "tropheesMiniLab" }));
      carte.append(chiffresModule(m));
      if (m.etoilesTotal) carte.append(element("progress", { attributs: { max: m.etoilesTotal, value: m.etoiles, "aria-label": t("tropheesEtoiles") } }));
      const activite = activiteNotion(id);
      if (activite) carte.append(activite);
      if (m.badges.length) {
        const details = element("details");
        details.open = ouverts.has(id);
        details.append(element("summary", { texte: t("tropheesBadges", { n: m.badges.filter((b) => b.obtenu).length, m: m.badges.length }) }));
        const badges = element("ul", { classe: "badges" });
        for (const b of m.badges) {
          const li = element("li", { classe: `badge ${b.obtenu ? "obtenu" : "a-portee"}` });
          li.append(element("strong", { texte: `${b.obtenu ? `${b.icone} ` : ""}${b.nom}` }),
            element("span", { texte: b.description }),
            element("span", { classe: "doux petit", texte: b.obtenu ? t("tropheesObtenu") : `${b.actuel} / ${b.cible}` }));
          if (!b.obtenu) li.append(element("progress", { attributs: { max: b.cible, value: b.actuel, "aria-label": b.nom } }));
          badges.append(li);
        }
        details.append(badges); carte.append(details);
      }
      if (notion) {
        const reprendre = element("button", { classe: "secondaire", cle: "reprendreBouton", attributs: { type: "button" } });
        reprendre.addEventListener("click", () => ouvrirNotion(notion));
        carte.append(reprendre);
      }
      zone.append(carte);
    }
  }
}

/** Chiffres d'un module, uniquement ceux que le module a réellement transmis. */
function chiffresModule(m) {
  const chiffres = element("dl", { classe: "trophees-chiffres" });
  for (const [cle, valeur] of [
    ["tropheesXp", m.xp], ["tropheesNiveau", m.niveau], ["tropheesEtoiles", m.etoiles === undefined ? undefined : `${m.etoiles} / ${m.etoilesTotal}`],
    ["tropheesLecons", m.lecons === undefined ? undefined : `${m.lecons} / ${m.leconsTotal}`],
    ["tropheesGrades", m.grades === undefined ? undefined : `${m.grades} / ${m.gradesTotal}`],
    ["statSerie", m.serie === undefined ? undefined : progression.serieCourante(m)],
    ["tropheesRevisions", m.revisions], ["tropheesVictoires", m.victoires], ["tropheesRecord", m.record]
  ]) {
    if (valeur === undefined) continue;
    const d = element("div");
    d.append(element("dt", { texte: t(cle) }), element("dd", { texte: String(valeur) }));
    chiffres.append(d);
  }
  return chiffres;
}

/**
 * Activité d'une notion d'après le contrat d'événements (ADR 0025, issue #182) : exercices tentés et réussis, dont après
 * un indice, ouvertures, notion terminée. Des faits locaux, distincts des étoiles. La maîtrise (issue #185) en est
 * déduite par des règles déterministes (`evenements.maitriseNotion`).
 */
function activiteNotion(id) {
  const n = etat.evenements?.notions?.[id];
  const r = evenements.resumerNotion(n);
  if (!r || (!r.tentes && !r.ouvertures)) return null;
  const bloc = element("div", { classe: "trophee-activite", attributs: { "data-activite": id } });
  bloc.append(element("p", { classe: "doux petit", cle: "activiteTitre" }));
  const m = evenements.maitriseNotion(n, progression.jourLocal());
  const maitrise = element("p", { classe: `maitrise maitrise-${m.etat}`, attributs: { "data-maitrise": m.etat } });
  maitrise.append(element("strong", { texte: `${t("maitriseTitre")} : ` }), document.createTextNode(t(`maitrise-${m.etat}`)));
  if (m.revision) {
    const date = new Date(`${m.revision}T00:00:00`).toLocaleDateString(etat.langue, { day: "numeric", month: "long" });
    maitrise.append(element("span", { classe: "doux petit", texte: ` · ${t(m.etat === "a-revoir" ? "maitriseRevisionDue" : "maitriseRevision", { date })}` }));
  }
  bloc.append(maitrise);
  const liste = element("dl", { classe: "trophees-chiffres" });
  for (const [cle, valeur] of [["activiteReussis", `${r.reussis} / ${r.tentes}`], ["activiteApresIndice", r.apresIndice], ["activiteOuvertures", r.ouvertures]]) {
    if (cle !== "activiteOuvertures" && !r.tentes) continue;
    const d = element("div");
    d.append(element("dt", { texte: t(cle) }), element("dd", { texte: String(valeur) }));
    liste.append(d);
  }
  bloc.append(liste);
  if (r.termine) bloc.append(element("p", { classe: "badge obtenu", texte: `✓ ${t("activiteTerminee")}` }));
  return bloc;
}

/* ---------- Export et import de la progression en fichier (issue #189) ---------- */

/** Clé de stockage de chaque champ du fichier de progression. */
const CLES_FICHIER = {
  pseudo: profil.CLE_PSEUDO, progression: progression.CLE_STOCKAGE, trophees: trophees.CLE_STOCKAGE,
  evenements: evenements.CLE_STOCKAGE, cahiers: CLE_CAHIERS
};
const estObjet = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
/** Zone de stockage en mémoire qui ne contient qu'une valeur : réutilise les fonctions de chargement de chaque module. */
const zoneUnique = (cle, valeur) => ({ getItem: (k) => (k === cle ? JSON.stringify(valeur) : null), setItem: () => {} });
const NORMALISEURS_FICHIER = {
  pseudo: (v) => { const r = typeof v === "string" ? profil.validerPseudo(v) : { ok: false }; return r.ok ? r.pseudo : null; },
  progression: (v) => (estObjet(v) ? progression.charger(zoneUnique(progression.CLE_STOCKAGE, v)) : null),
  trophees: (v) => (estObjet(v) ? trophees.charger(zoneUnique(trophees.CLE_STOCKAGE, v)) : null),
  evenements: (v) => (estObjet(v) && v.v === evenements.VERSION_CONTRAT ? evenements.charger(zoneUnique(evenements.CLE_STOCKAGE, v)) : null),
  cahiers: (v) => (Array.isArray(v) ? v.slice(0, 50).map(cahierValide).filter(Boolean) : null)
};

function brancherFichierProgression() {
  const etatFichier = $("#fichier-etat"), confirmer = $("#confirmer-import"), choix = $("#importer-progression");
  let enAttente = null;
  $("#exporter-progression").addEventListener("click", () => {
    const jour = progression.jourLocal();
    const contenu = fichierProgression.exporter({ lire: (champ) => lireCle(stockage(), CLES_FICHIER[champ]), jour });
    const url = URL.createObjectURL(new Blob([fichierProgression.texteFichier(contenu)], { type: "application/json" }));
    const lien = element("a", { attributs: { href: url, download: fichierProgression.nomFichier(jour) } });
    document.body.append(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    etatFichier.textContent = t("fichierExporte");
  });
  choix.addEventListener("change", async () => {
    const fichier = choix.files?.[0];
    choix.value = "";
    enAttente = null;
    confirmer.hidden = true;
    if (!fichier) return;
    const texte = fichier.size > fichierProgression.TAILLE_MAX ? null : await fichier.text();
    const lu = fichierProgression.lireFichier(texte, { normaliser: NORMALISEURS_FICHIER });
    if (!lu.ok) { etatFichier.textContent = t(`fichierErreur_${lu.erreur}`); return; }
    enAttente = lu.valeurs;
    const date = new Date(`${lu.cree}T00:00:00`).toLocaleDateString(etat.langue, { day: "numeric", month: "long", year: "numeric" });
    etatFichier.textContent = t("fichierPret", { date });
    confirmer.hidden = false;
    confirmer.focus();
  });
  confirmer.addEventListener("click", () => {
    if (!enAttente) return;
    // Remplacement complet, puis rechargement : chaque module relit son état avec ses propres contrôles. L'état en
    // mémoire est d'abord abandonné : sinon l'enregistrement du temps actif au départ de la page (« pagehide »)
    // réécrirait l'ancienne progression par-dessus celle du fichier.
    etat.progres = null;
    etat.moteur = null;
    fichierProgression.appliquer(enAttente, {
      ecrire: (champ, valeur) => ecrireCle(stockage(), CLES_FICHIER[champ], valeur),
      effacer: (champ) => effacerCle(stockage(), CLES_FICHIER[champ])
    });
    location.reload();
  });
}

function brancherTrophees() {
  window.addEventListener("message", (e) => {
    // Une iframe sandboxée a une origine opaque (« null ») : l'identité de la fenêtre fait foi.
    const cadre = [...document.querySelectorAll("iframe[data-module]")].find((c) => c.contentWindow === e.source);
    if (!cadre || e.origin !== "null" || !cadre.hasAttribute("src")) return;
    // Signal d'activité (web/signal-activite.js) : sans contenu, il prolonge seulement le temps actif.
    if (e.data?.type === "kermiclab:activite") { etat.moteur?.signal(); return; }
    if (e.data?.type === "kermiclab:idee") {
      ouvrirIdee({ ...nettoyerContexteIdee(e.data.contexte), module: cadre.dataset.module });
      return;
    }
    if (e.data?.type === "kermiclab:chat:fermer") {
      if ($("#panneau-chat").hidden || !$("#fil").contains(cadre) || document.querySelector("dialog[open]")) return;
      fermerChat({ rendreFocus: true });
      return;
    }
    const id = cadre.dataset.module;
    // Contrat d'événements pédagogiques v1 (ADR 0025) : poignée de main, puis événements validés et agrégés localement.
    if (e.data?.type === "kermiclab:evenements:pret") {
      if (e.data.v === evenements.VERSION_CONTRAT && e.data.notion === id) {
        cadre.contentWindow.postMessage({ type: "kermiclab:evenements:ecouter", v: evenements.VERSION_CONTRAT, notion: id }, "*");
      }
      return;
    }
    if (e.data?.type === "kermiclab:evenement") {
      const ev = evenements.normaliserEvenement(e.data, id);
      if (!ev) { console.warn("evenements : message invalide", id); return; }
      etat.evenements = evenements.enregistrer(etat.evenements, ev, progression.jourLocal(), { planifier: ProgressionJeux.planifierCarte });
      evenements.sauver(stockage(), etat.evenements);
      if (etat.ecran === "progression") rendreProgression();
      return;
    }
    if (e.data?.module !== id) return;
    if (e.data?.type === "kermiclab:trophees:pret") {
      cadre.contentWindow.postMessage({ type: "kermiclab:trophees:charger", module: id, etat: etat.trophees[id]?.etat ?? null }, "*");
    } else if (e.data?.type === "kermiclab:trophees:progres") {
      const module = trophees.normaliser(e.data);
      if (!module) { console.warn("trophees : instantané invalide", id); return; }
      etat.trophees[id] = module;
      trophees.sauver(stockage(), etat.trophees);
      if (etat.ecran === "progression") rendreProgression();
    }
  });
}

/* ---------- Barre de navigation du catalogue ---------- */

const sansAccents = (texte) => String(texte).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

async function chargerCatalogue() {
  try {
    const r = await fetch(`${etat.config.apiUrl}/api/catalogue`);
    const notions = r.ok ? (await r.json()).notions : [];
    etat.notions = Array.isArray(notions) ? notions.filter((n) => typeof n?.id === "string" && typeof n.titre === "string") : [];
  } catch {
    etat.notions = [];
  }
  etat.registre = experiences.creerRegistre(etat.notions);
  // Matière de référence du défi généré par l'IA : la dernière ouverte dans Éducation.
  etat.matiere = lireCle(preferences(), CLE_MATIERE) || "mathematiques";
  // Migration non destructive : un jeu ouvert avant la séparation Éducation / Jeux quitte la liste des notions.
  const reclasse = progression.reclasser(etat.progres, etat.registre.typeDe);
  if (reclasse !== etat.progres) { etat.progres = reclasse; progression.sauver(stockage(), etat.progres); }
  $("#catalogue-indisponible").hidden = etat.notions.length > 0;
  etat.classe = parcours.classeValide(lireCle(preferences(), CLE_CLASSE), niveauxDuCatalogue());
  rendreCatalogue();
  rafraichirTableau();
}

/** Niveaux scolaires présents au catalogue, dans l'ordre d'affichage. */
const niveauxDuCatalogue = () => experiences.arbreEducation(etat.registre, MATIERES).map((n) => n.niveau);

/** Parcours publiés depuis le back-office (ADR 0026) ; sans réponse, la section reste masquée. */
async function chargerParcours() {
  try {
    const r = await fetch(`${etat.config.apiUrl}/api/parcours`);
    etat.parcours = r.ok ? (await r.json()).parcours : [];
  } catch {
    etat.parcours = [];
  }
  rendrePilotes();
}

/** Accueil : contenus mis en avant et parcours, tous deux décidés dans le back-office. */
function rendrePilotes() {
  if (!etat.progres || !etat.textes.titre || !etat.registre) return;
  const ouverts = new Set([...etat.progres.notions, ...Object.keys(etat.progres.decouvertes?.jeu ?? {})]);
  const enAvant = parcours.contenusEnAvant(etat.notions);
  $("#a-la-une").hidden = !enAvant.length;
  $("#une-liste").replaceChildren(...enAvant.map((n) => {
    const bouton = element("button", { classe: "une-entree", attributs: { type: "button", "data-une": n.id } });
    const type = etat.registre.typeDe(n.id) === "jeu" ? t("navJeux") : t(`matiere_${matiereDe(n)}`);
    bouton.append(element("span", { classe: "une-titre", texte: n.titre }), element("span", { classe: "doux petit", texte: type }));
    if (ouverts.has(n.id)) bouton.append(element("span", { classe: "visuellement-cache", texte: ` (${t("notionExploree")})` }));
    bouton.addEventListener("click", () => ouvrirNotion(notionParId(n.id) ?? n));
    const li = element("li");
    li.append(bouton);
    return li;
  }));

  const liste = parcours.parcoursAffichables(etat.parcours, (id) => etat.registre.trouver(id));
  $("#parcours").hidden = !liste.length;
  $("#parcours-liste").replaceChildren(...liste.map((p) => {
    const a = parcours.avancement(p, ouverts);
    const bloc = element("article", { classe: "parcours-carte", attributs: { "data-parcours": p.id } });
    const tete = element("div", { classe: "parcours-tete" });
    tete.append(element("h4", { texte: p.titre }), element("span", { classe: "doux petit", texte: t("parcoursEtapes", { n: a.faites, m: a.total }) }));
    const jauge = element("progress", { attributs: { max: String(a.total), value: String(a.faites), "aria-label": t("parcoursEtapes", { n: a.faites, m: a.total }) } });
    bloc.append(tete);
    if (p.description) bloc.append(element("p", { classe: "doux", texte: p.description }));
    bloc.append(jauge);
    const etapes = element("ol", { classe: "parcours-etapes" });
    etapes.append(...p.etapes.map((e) => {
      const fait = ouverts.has(e.id);
      const bouton = element("button", { classe: `notion${fait ? " exploree" : ""}`, attributs: { type: "button", "data-etape": e.id } });
      bouton.append(element("span", { texte: e.titre }));
      if (fait) bouton.append(element("span", { classe: "coche", texte: "✓", attributs: { "aria-hidden": "true" } }), element("span", { classe: "visuellement-cache", texte: ` (${t("notionExploree")})` }));
      if (a.suivante?.id === e.id) bouton.setAttribute("aria-current", "step");
      bouton.addEventListener("click", () => ouvrirNotion(notionParId(e.id) ?? e));
      const li = element("li");
      li.append(bouton);
      return li;
    }));
    bloc.append(etapes);
    if (a.termine) bloc.append(element("p", { classe: "pastille ok", cle: "parcoursTermine" }));
    else {
      const suite = element("button", { classe: "bouton", attributs: { type: "button", "data-parcours-suite": a.suivante.id } });
      suite.append(element("span", { cle: a.faites ? "parcoursContinuer" : "parcoursCommencer" }), element("span", { classe: "visuellement-cache", texte: ` : ${a.suivante.titre}` }));
      suite.addEventListener("click", () => ouvrirNotion(notionParId(a.suivante.id) ?? a.suivante));
      bloc.append(suite);
    }
    return bloc;
  }));
}

/** Éducation, « Ma classe » : un bouton par niveau ; le niveau choisi s'ouvre d'emblée et reste retenu. */
function rendreMaClasse(niveaux) {
  const barre = $("#ma-classe");
  barre.hidden = niveaux.length < 2;
  barre.replaceChildren(element("span", { classe: "ma-classe-titre", cle: "maClasseTitre" }), ...niveaux.map((niveau) => {
    const bouton = element("button", { classe: "puce", texte: t(`niveau_${niveau}`), attributs: { type: "button", "data-classe": niveau, "aria-pressed": String(etat.classe === niveau) } });
    bouton.addEventListener("click", () => {
      etat.classe = etat.classe === niveau ? null : niveau;
      ecrireCle(preferences(), CLE_CLASSE, etat.classe ?? "");
      // Le choix remplace l'ouverture manuelle des niveaux : seul le niveau choisi reste ouvert.
      for (const n of niveaux) etat.ouverts.delete(`edu-${n}`);
      rendreCatalogue();
      document.querySelector(`[data-classe="${CSS.escape(niveau)}"]`)?.focus({ preventScroll: true });
    });
    return bouton;
  }));
}

const matiereDe = (n) => n.matiere || "mathematiques";
const ordreMatiere = (a, b) => (MATIERES.indexOf(a) + 1 || 99) - (MATIERES.indexOf(b) + 1 || 99);

/**
 * Accordéon accessible : un vrai bouton (aria-expanded, aria-controls) dans un titre, et un panneau masqué.
 * Fermé par défaut ; l'état ouvert est retenu pendant la session (`etat.ouverts`) pour survivre aux rendus.
 */
function accordeon({ id, niveauTitre = 3, titre, detail, ouvert = false, remplir, auPremierAffichage }) {
  const bloc = element("div", { classe: "accordeon" });
  const entete = element(`h${niveauTitre}`, { classe: "accordeon-titre" });
  const bouton = element("button", { classe: "accordeon-bouton", attributs: { type: "button", "aria-controls": id, "aria-expanded": "false" } });
  const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  chevron.setAttribute("class", "ico chevron"); chevron.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", "#i-chevron");
  chevron.append(use);
  bouton.append(chevron, element("span", { classe: "accordeon-libelle", texte: titre }));
  if (detail) bouton.append(element("span", { classe: "accordeon-detail", texte: detail }));
  entete.append(bouton);
  const panneau = element("div", { classe: "accordeon-panneau", attributs: { id } });
  let rempli = false;
  const basculer = (visible, { memoriser = true } = {}) => {
    if (visible && !rempli) { remplir(panneau); rempli = true; }
    panneau.hidden = !visible;
    bouton.setAttribute("aria-expanded", String(visible));
    if (memoriser) etat.ouverts[visible ? "add" : "delete"](id);
    if (visible && memoriser) auPremierAffichage?.();
  };
  bouton.addEventListener("click", () => basculer(bouton.getAttribute("aria-expanded") !== "true"));
  basculer(ouvert || etat.ouverts.has(id), { memoriser: false });
  bloc.append(entete, panneau);
  return bloc;
}

function boutonNotion(n, explorees) {
  const b = element("button", { classe: "notion", attributs: { type: "button", "data-notion": n.id } });
  b.append(element("span", { texte: n.titre }));
  if (explorees.has(n.id)) {
    b.classList.add("exploree");
    b.append(element("span", { classe: "coche", texte: "✓", attributs: { "aria-hidden": "true" } }), element("span", { classe: "visuellement-cache", texte: ` (${t("notionExploree")})` }));
  }
  if (n.id === etat.notionCourante) b.setAttribute("aria-current", "page");
  b.addEventListener("click", () => ouvrirNotion(n));
  const li = element("li");
  li.append(b);
  return li;
}

/** Éducation : Niveau > Matière > Notions, d'après les métadonnées du catalogue ; rien n'est ouvert par défaut. */
function rendreCatalogue() {
  const liste = $("#catalogue-liste");
  if (!liste || !etat.progres || !etat.textes.titre) return;
  const filtre = sansAccents($("#recherche-notion").value.trim());
  const explorees = new Set(etat.progres.notions);
  const arbre = experiences.arbreEducation(etat.registre, MATIERES);
  rendreMaClasse(arbre.map((n) => n.niveau));
  liste.replaceChildren();
  let affichees = 0;
  for (const { niveau, matieres } of arbre) {
    const retenues = matieres
      .map(({ matiere, notions }) => ({ matiere, notions: notions.filter((n) => !filtre || sansAccents(n.titre).includes(filtre)) }))
      .filter((m) => m.notions.length);
    if (!retenues.length) continue;
    const total = retenues.reduce((s, m) => s + m.notions.length, 0);
    affichees += total;
    // Une recherche ouvre les groupes qui contiennent un résultat, sans modifier l'état retenu.
    liste.append(accordeon({
      id: `edu-${niveau}`, niveauTitre: 3, titre: t(`niveau_${niveau}`), detail: t("compteNotions", { n: total }), ouvert: Boolean(filtre) || etat.classe === niveau,
      remplir: (panneau) => panneau.append(...retenues.map(({ matiere, notions }) => accordeon({
        id: `edu-${niveau}-${matiere}`, niveauTitre: 4, titre: t(`matiere_${matiere}`), ouvert: Boolean(filtre),
        detail: t("exploreesSur", { n: notions.filter((n) => explorees.has(n.id)).length, m: notions.length }),
        remplir: (sous) => { const ul = element("ul", { classe: "liste-notions" }); ul.append(...notions.map((n) => boutonNotion(n, explorees))); sous.append(ul); },
        auPremierAffichage: () => {
          etat.matiere = matiere;
          ecrireCle(preferences(), CLE_MATIERE, matiere);
          decouvrirEnSilence("matiere", matiere);
        }
      })))
    }));
  }
  $("#catalogue-vide").hidden = affichees > 0 || !etat.notions.length;
  const scolaires = etat.registre.deType("notion");
  $("#catalogue-compteur").textContent = scolaires.length
    ? t("notionsExplorees", { n: scolaires.filter((n) => explorees.has(n.id)).length, m: scolaires.length }) : "";
}

/** Découverte d'une section ou d'une matière : enregistrée sans XP ni notification (aucun accomplissement inventé). */
function decouvrirEnSilence(type, id) {
  if (!etat.progres || progression.estDecouverte(etat.progres, type, id)) return;
  etat.progres = progression.decouvrir(etat.progres, type, id).p;
  progression.sauver(stockage(), etat.progres);
}

/**
 * Ouvre une notion depuis le tableau de bord (catalogue, reprise, suggestion, mini-lab) dans une bulle par-dessus
 * la page, sans l'ajouter au fil du chat ni appeler le chat (zéro token, comme le routage par mots-clés).
 */
function ouvrirNotion(n) {
  etat.notionCourante = n.id;
  const type = etat.registre.typeDe(n.id) ?? "notion";
  const url = `${etat.config.apiUrl}/maquettes/${encodeURIComponent(n.id)}?lang=${encodeURIComponent(etat.langue)}`;
  ouvrirBulle(n, url);
  // Le temps passé dans la bulle est attribué à cette expérience jusqu'à sa fermeture.
  etat.moteur?.contexte({ section: sectionDe(etat.ecran), experience: `${type}:${n.id}` });
  appliquerResultat(progression.enregistrerExperience(etat.progres, type, n.id));
  rendreCatalogue();
  rafraichirTableau();
}

function ouvrirBulle(n, url) {
  const bulle = $("#bulle-lab");
  const contexte = n.matiere || n.niveau
    ? `${t(`matiere_${matiereDe(n)}`)} · ${t(`niveau_${NIVEAUX.includes(n.niveau) ? n.niveau : "autres"}`)}`
    : t("reprendreTitre");
  $("#bulle-contexte").textContent = contexte;
  $("#bulle-titre").textContent = n.titre;
  $("#bulle-plein-ecran").href = url;
  const cadre = $("#bulle-cadre");
  // Même origine que le chat : pas d'allow-same-origin, pour que la page reste isolée (comme dans le fil).
  cadre.title = n.titre;
  cadre.dataset.module = n.id;
  cadre.src = url;
  bulle.dataset.notion = n.id;
  if (!bulle.open) bulle.showModal();
  $("#fermer-bulle").focus();
  void preparerEdition(n.id);
}

function brancherBulle() {
  const bulle = $("#bulle-lab");
  brancherDialogue(bulle, $("#fermer-bulle"));
  // Fermée : on décharge la page pour arrêter ses animations et libérer la mémoire.
  bulle.addEventListener("close", () => {
    const id = bulle.dataset.notion;
    $("#bulle-cadre").removeAttribute("src");
    fermerEdition();
    delete $("#bulle-cadre").dataset.module;
    delete bulle.dataset.notion;
    etat.moteur?.contexte({ section: sectionDe(etat.ecran) });
    if (etat.ecran === "jeux") document.querySelector(`[data-jeu="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
    if (etat.ecran === "progression") document.querySelector(`[data-trophee-module="${CSS.escape(id)}"] button, [data-experience="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  });
  $("#bulle-question").addEventListener("click", () => {
    bulle.addEventListener("close", ouvrirChat, { once: true });
    bulle.close();
  });
}

function ouvrirCatalogue() { naviguer("education"); }

/* ---------- Échanges avec l'API ---------- */

async function envoyer(question, { dejaAffichee = false } = {}) {
  if (etat.envoiEnCours) return;
  etat.envoiEnCours = true;
  document.body.classList.add("occupe");
  if (!dejaAffichee) ajouterQuestion(question);
  const attente = ajouterAttente();
  const bouton = $("#formulaire button");
  bouton.disabled = true;
  $("#nouvelle-conversation").disabled = true;
  $("#nouvelle-conversation-accueil").disabled = true;
  try {
    const r = await fetch(`${etat.config.apiUrl}/api/chat`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", ...enteteFamille() },
      body: JSON.stringify({ message: question, langue: etat.langue, utiliserLlm: etat.llmDisponible && etat.llmActif })
    });
    const donnees = await r.json();
    attente.remove();
    const reussie = donnees.type === "reponse" || donnees.type === "maquette";
    ajouterReponse({
      ...donnees, texte: donnees.texte ?? t("erreurReseau"),
      horsCatalogue: donnees.type === "hors-catalogue", conversation: donnees.type === "conversation"
    });
    if (reussie) {
      appliquerResultat(progression.enregistrerQuestion(etat.progres));
      // Une page proposée par le chat est enregistrée selon son type au catalogue (notion ou jeu).
      if (donnees.maquette?.id) appliquerResultat(progression.enregistrerExperience(etat.progres, etat.registre.typeDe(donnees.maquette.id) ?? "notion", donnees.maquette.id));
    }
  } catch {
    attente.remove();
    ajouterErreur(question);
  } finally {
    bouton.disabled = false;
    $("#nouvelle-conversation").disabled = false;
    $("#nouvelle-conversation-accueil").disabled = false;
    etat.envoiEnCours = false;
    document.body.classList.remove("occupe");
  }
}

function rafraichirControleLlm() {
  const interrupteur = $("#llm-actif");
  if (!interrupteur) return;
  interrupteur.disabled = !etat.llmDisponible;
  interrupteur.checked = etat.llmDisponible && etat.llmActif;
  const statut = $("#llm-etat");
  const cle = !etat.llmDisponible ? "llmStatutIndisponible" : etat.llmActif ? "llmStatutActif" : "llmStatutInactif";
  statut.textContent = t(cle);
  rafraichirIdeeIa();
  rafraichirReglageDefi();
  rafraichirConfigurationServeur();
}

/** Valeur lisible d'un paramètre (booléen, liste de skills, entier borné, alias). */
function valeurParametre(p) {
  if (p.type === "booleen") return t(p.valeur ? "configOui" : "configNon");
  if (p.type === "liste") return p.valeur.length ? p.valeur.map((id) => t(`configSkill_${id}`)).join(", ") : t("configAucun");
  if (p.type === "entier") return t("configBornes", { valeur: p.valeur, min: p.min, max: p.max });
  return String(p.valeur);
}

/** Écran Configuration : paramètres du site regroupés par module, en lecture seule (réglés dans wrangler.toml). */
function rafraichirConfigurationServeur() {
  const conteneur = $("#config-modules");
  if (!conteneur) return;
  const etatTexte = $("#config-serveur-etat");
  const modules = etat.configurationServeur?.modules;
  conteneur.replaceChildren();
  if (!Array.isArray(modules)) {
    etatTexte.hidden = false;
    etatTexte.textContent = t(etat.configurationServeur === null ? "llmStatutChargement" : "configIndisponible");
    return;
  }
  etatTexte.hidden = true;
  for (const module of modules) {
    const bloc = document.createElement("section");
    bloc.className = "config-module";
    bloc.dataset.module = module.id;
    const titre = document.createElement("h4");
    titre.textContent = t(`configModule_${module.id}`);
    const liste = document.createElement("dl");
    for (const p of module.parametres || []) {
      const ligne = document.createElement("div");
      ligne.className = "config-ligne";
      ligne.dataset.cle = p.cle;
      const dt = document.createElement("dt");
      dt.textContent = t(`configParam_${p.cle}`);
      const dd = document.createElement("dd");
      const code = document.createElement("code");
      code.textContent = valeurParametre(p);
      dd.append(code);
      ligne.append(dt, dd);
      liste.append(ligne);
    }
    for (const s of module.skills || []) {
      const ligne = document.createElement("div");
      ligne.className = "config-ligne config-skill";
      ligne.dataset.skill = s.id;
      const dt = document.createElement("dt");
      dt.textContent = t("configSkill", { nom: t(`configSkill_${s.id}`) });
      const dd = document.createElement("dd");
      const pastille = document.createElement("span");
      pastille.className = `config-pastille ${s.actif ? "actif" : "inactif"}`;
      pastille.textContent = t(s.actif ? "configActif" : "configInactif");
      const version = document.createElement("code");
      version.textContent = `${s.prompt} · v${s.version}`;
      dd.append(pastille, " ", version);
      ligne.append(dt, dd);
      liste.append(ligne);
    }
    bloc.append(titre, liste);
    conteneur.append(bloc);
  }
}

async function chargerStatutLlm() {
  try {
    const r = await fetch(`${etat.config.apiUrl}/api/llm/status`, { cache: "no-store" });
    if (!r.ok) throw new Error(`statut LLM ${r.status}`);
    const statut = await r.json();
    etat.llmDisponible = statut.actif === true;
    const n = statut.defi?.generationsParJour;
    etat.defiIa.ia = statut.defi?.ia === true;
    const maxDefi = statut.configuration?.modules?.flatMap((m) => m.parametres || [])
      .find((p) => p.cle === "DEFI_GENERATIONS_JOUR")?.max;
    etat.defiIa.generationsParJour = Number.isInteger(n) ? Math.max(0, Math.min(Number.isInteger(maxDefi) ? maxDefi : 10, n)) : 0;
    etat.cahiersIa.ia = statut.cahiers?.ia === true;
    etat.cahiersIa.generationsParJour = Number.isInteger(statut.cahiers?.generationsParJour) ? Math.max(0, Math.min(5, statut.cahiers.generationsParJour)) : 0;
    const modele = statut.configuration?.modules?.flatMap((m) => m.parametres || []).find((p) => p.cle === "MODELE_CAHIERS")?.valeur;
    etat.cahiersIa.modele = typeof modele === "string" ? modele : "";
    etat.skills = statut.skills && typeof statut.skills === "object" ? statut.skills : {};
    etat.configurationServeur = statut.configuration && Array.isArray(statut.configuration.modules) ? statut.configuration : false;
  } catch {
    etat.llmDisponible = false;
    etat.defiIa.ia = false;
    etat.cahiersIa.ia = false;
    etat.skills = {};
    etat.configurationServeur = false;
    console.error("llm statut indisponible");
  }
  rafraichirControleLlm();
}

/* ---------- Démarrage ---------- */

function brancherDialogue(dialogue, boutonFermer) {
  boutonFermer.addEventListener("click", () => dialogue.close());
  // Un clic sur le fond (hors du contenu) ferme la fenêtre.
  dialogue.addEventListener("click", (e) => { if (e.target === dialogue) dialogue.close(); });
}

async function demarrer() {
  $(".pied").before($("#profil"), $("#apropos"), $("#compte"), $("#connexion-en-cours"), $("#famille"), $("#espace-famille"), $("#contributions"), $("#suivi"), $("#classes"), $("#eleves"), $("#defi"), $("#progres"));
  capturerInvitationProf();
  etat.config = await chargerJson("config.json");
  initialiserSession();
  etat.trophees = trophees.charger(stockage());
  etat.evenements = evenements.charger(stockage());
  brancherTrophees();
  brancherFichierProgression();
  appliquerTheme(lireCle(preferences(), CLE_THEME));
  void chargerCharte();
  const select = $("#langue");
  for (const l of etat.config.langues) {
    const o = document.createElement("option");
    o.value = l; o.textContent = l.toUpperCase();
    select.append(o);
  }
  select.value = langueInitiale(etat.config.langues);
  await appliquerLangue(select.value);
  etat.llmActif = lireCle(sessionPreferences(), CLE_LLM) === "true";
  void chargerStatutLlm();
  $("#llm-actif").addEventListener("change", (e) => {
    etat.llmActif = e.currentTarget.checked;
    ecrireCle(sessionPreferences(), CLE_LLM, String(etat.llmActif));
    rafraichirControleLlm();
  });
  $("#defi-ia-par-jour").addEventListener("change", (e) => {
    ecrireCle(preferences(), CLE_DEFI_IA, e.currentTarget.value);
    rafraichirReglageDefi();
  });
  select.addEventListener("change", async () => { ecrirePreference(select.value); await appliquerLangue(select.value); });

  brancherProfil();
  brancherCompte();
  brancherFamilleLocale();
  $("#ouvrir-chat").addEventListener("click", () => {
    if ($("#panneau-chat").hidden) ouvrirChat();
    else fermerChat({ rendreFocus: true });
  });
  $("#fermer-chat").addEventListener("click", () => fermerChat({ rendreFocus: true }));
  $("#nouvelle-conversation").addEventListener("click", nouvelleConversation);
  $("#plein-ecran-chat").addEventListener("click", () => basculerPleinEcran());
  if (!etat.pseudo) demanderPseudo();

  // Comptes famille : rien n'est appelé côté Worker si la connexion est désactivée.
  initialiserDemo();
  $("#quitter-demo").addEventListener("click", quitterDemo);
  brancherFamille();
  brancherContributions();
  brancherProfesseur();
  brancherTestRoles();
  void verifierConnexion().then(rafraichirContributions);

  ajouterBienvenue();
  brancherTemps();
  await chargerCatalogue();
  void chargerParcours();
  $("#recherche-notion").addEventListener("input", rendreCatalogue);
  $("#recherche-jeu").addEventListener("input", rendreJeux);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || document.querySelector("dialog[open]")) return;
    if (!$("#panneau-chat").hidden) {
      e.preventDefault();
      fermerChat({ rendreFocus: true });
    }
  });

  const champ = $("#question");
  const ajusterHauteur = () => { champ.style.height = "auto"; champ.style.height = `${Math.min(champ.scrollHeight, 160)}px`; };
  champ.addEventListener("input", ajusterHauteur);
  $("#formulaire").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = champ.value.trim();
    if (!q || etat.envoiEnCours) return;
    champ.value = "";
    ajusterHauteur();
    envoyer(q);
  });
  champ.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("#formulaire").requestSubmit(); }
  });

  // Accueil : la question part dans le même fil que le chat, incrusté sous le champ (le panneau flottant reste fermé).
  $("#formulaire-accueil").addEventListener("submit", (e) => {
    e.preventDefault();
    const saisie = $("#question-accueil");
    const q = saisie.value.trim();
    if (!q || etat.envoiEnCours) return;
    saisie.value = "";
    incrusterFil();
    envoyer(q);
  });
  // En capture : le fil est en place avant que la puce n'envoie sa question.
  $("#puces-accueil").addEventListener("click", (e) => { if (e.target.closest(".puce") && !etat.envoiEnCours) incrusterFil(); }, { capture: true });
  $("#nouvelle-conversation-accueil").addEventListener("click", nouvelleConversation);

  $("#ouvrir-progres").addEventListener("click", ouvrirProgres);

  brancherIdees();
  const ideeDemandee = lireIdeeDepuisAdresse();
  if (ideeDemandee) ouvrirIdee(ideeDemandee);

  const dialogue = $("#signalement");
  $("#ouvrir-signalement").addEventListener("click", ouvrirSignalement);
  brancherDialogue(dialogue, $("#fermer-signalement"));
  $("#formulaire-signalement").addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = $("#texte-signalement").value.trim();
    if (!message) return;
    try {
      const r = await fetch(`${etat.config.apiUrl}/api/support`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, langue: etat.langue })
      });
      const d = await r.json();
      $("#retour-signalement").textContent = d.texte ?? "";
      if (d.ok) $("#texte-signalement").value = "";
    } catch {
      $("#retour-signalement").textContent = t("erreurReseau");
    }
  });

  brancherNavigation();
  brancherAccordeonsFixes();
  brancherCahiers();
  brancherBulle();
  $("#bascule-theme").addEventListener("click", () => {
    const suivant = themeSombre() ? "light" : "dark";
    ecrireCle(preferences(), CLE_THEME, suivant);
    appliquerTheme(suivant);
  });
  etat.cercle = monterCercle($("#minilab"), { t, langue: () => etat.langue, manipuler: (angle) => {
    const avant = etat.trophees["mini-cercle"]?.etat;
    const angles = [...new Set([...(Array.isArray(avant?.angles) ? avant.angles.filter((a) => Number.isInteger(a) && a >= 0 && a <= 360) : []), angle])];
    const cible = avant?.cible === true || angle === 90;
    etat.trophees["mini-cercle"] = { genre: "labs", etat: { angles, cible }, etoiles: Number(angles.length >= 3) + Number(cible), etoilesTotal: 2, badges: [] };
    trophees.sauver(stockage(), etat.trophees);
  } });
  $("#minilab-page").addEventListener("click", () => {
    const n = notionParId("trigo-cercle");
    if (n) ouvrirNotion(n); else location.href = "cercle/";
  });
  rafraichirTableau();
}

function ouvrirProgres() { naviguer("progression"); }
/* ---------- Boîte à idées (formulaire natif, comme le signalement) ---------- */

const CLES_CONTEXTE_IDEE = ["page", "version", "langue", "navigation", "dialogue", "panneau", "module", "onglet", "vues"];

/** Contexte venu d'une page (éventuellement isolée) : clés connues, valeurs courtes et sans caractère spécial. */
function nettoyerContexteIdee(brut) {
  if (!brut || typeof brut !== "object") return {};
  return Object.fromEntries(CLES_CONTEXTE_IDEE
    .map((cle) => [cle, brut[cle]])
    .filter(([, v]) => typeof v === "string" && v.length <= 80 && /^[\p{L}\p{N} .,:_\/-]+$/u.test(v) && !/\d{5,}/.test(v)));
}

function ouvrirIdee(contexte = {}) {
  etat.ideeContexte = nettoyerContexteIdee(contexte);
  const resume = Object.entries(etat.ideeContexte).filter(([cle]) => ["page", "navigation", "onglet", "module", "dialogue"].includes(cle))
    .map(([, v]) => v).join(" · ");
  $("#idee-contexte").textContent = resume ? t("ideeContexte", { contexte: resume }) : "";
  $("#retour-idee").textContent = "";
  afficherCadrage(null);
  rafraichirIdeeIa();
  const icone = document.querySelector(".boite-idees .boite-idees-icone svg");
  if (icone && !$("#idee-icone").firstChild) $("#idee-icone").append(icone.cloneNode(true));
  const dialogue = $("#dialogue-idee");
  if (!dialogue.open) dialogue.showModal();
  $("#texte-idee").focus();
}

/** Le cadrage par l'IA suit le même opt-in que le tuteur (Configuration) et la disponibilité du site. */
function rafraichirIdeeIa() {
  const bouton = $("#preparer-idee");
  if (!bouton) return;
  const possible = etat.llmDisponible && etat.llmActif && etat.skills["cadrage-idee"] !== false;
  bouton.disabled = !possible;
  const aide = $("#idee-ia-aide");
  aide.dataset.i18n = possible ? "ideeIaAide" : "ideeIaInactive";
  aide.textContent = t(aide.dataset.i18n);
}

function afficherCadrage(cadrage, llm) {
  etat.ideeCadrage = cadrage;
  const bloc = $("#idee-cadrage");
  bloc.hidden = !cadrage;
  if (!cadrage) return;
  $("#idee-cadrage-nom").textContent = cadrage.titre;
  $("#idee-cadrage-besoin").textContent = cadrage.besoin;
  $("#idee-cadrage-criteres").replaceChildren(...cadrage.criteres.map((c) => element("li", { texte: c })));
  $("#idee-cadrage-zones").textContent = cadrage.zones.length ? t("ideeCadrageZones", { zones: cadrage.zones.join(", ") }) : "";
  $("#idee-cadrage-questions").replaceChildren(...cadrage.questions.map((q) => element("li", { texte: q })));
  $("#idee-cadrage-questions-bloc").hidden = !cadrage.questions.length;
  $("#idee-cadrage-llm").textContent = llm
    ? `${llm.fournisseur} · ${llm.modele} · ${llm.harness?.prompt ?? ""} · ${llm.quota?.consommes ?? "?"} / ${llm.quota?.limite ?? "?"}`
    : "";
  $("#idee-joindre").checked = true;
}

function cadrageValide(c) {
  const chaines = (l, n) => Array.isArray(l) && l.length <= n && l.every((v) => typeof v === "string" && v.length <= 600);
  return c && typeof c.titre === "string" && typeof c.besoin === "string" && chaines(c.criteres, 5) && chaines(c.zones, 3) && chaines(c.questions, 3);
}

async function preparerIdee() {
  const message = $("#texte-idee").value.trim();
  const retour = $("#retour-idee");
  if (!message) { retour.textContent = t("ideeIaVide"); $("#texte-idee").focus(); return; }
  const bouton = $("#preparer-idee");
  bouton.disabled = true;
  afficherCadrage(null);
  retour.textContent = t("ideeIaChargement");
  const contexteDemande = JSON.stringify(etat.ideeContexte ?? {});
  try {
    const r = await fetch(`${etat.config.apiUrl}/api/idee/cadrage`, {
      method: "POST", credentials: "include", headers: { "content-type": "application/json", ...enteteFamille() },
      body: JSON.stringify({ message, langue: etat.langue, contexte: etat.ideeContexte ?? {}, utiliserLlm: true })
    });
    const d = await r.json();
    // Le texte ou le contexte ont changé pendant l'appel : ce cadrage ne correspond plus à la saisie.
    if ($("#texte-idee").value.trim() !== message || JSON.stringify(etat.ideeContexte ?? {}) !== contexteDemande) {
      retour.textContent = "";
    } else if (d.ok && cadrageValide(d.cadrage)) {
      etat.ideeCadrageMessage = message;
      afficherCadrage(d.cadrage, d.llm);
      retour.textContent = "";
    } else {
      retour.textContent = d.texte ?? t("erreurReseau");
    }
  } catch {
    retour.textContent = t("erreurReseau");
  } finally {
    rafraichirIdeeIa();
  }
}

/** Contexte transmis par une page ouverte seule (fragment #idee=…, jamais envoyé au serveur). */
function lireIdeeDepuisAdresse() {
  if (!location.hash.startsWith("#idee=")) return null;
  let contexte = {};
  try { contexte = JSON.parse(decodeURIComponent(location.hash.slice(6))); } catch { contexte = {}; }
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  return contexte;
}

function brancherIdees() {
  document.addEventListener("kermiclab:idee", (e) => { e.preventDefault(); ouvrirIdee(e.detail); });
  brancherDialogue($("#dialogue-idee"), $("#fermer-idee"));
  $("#preparer-idee").addEventListener("click", preparerIdee);
  // Toute modification du texte invalide le cadrage : il ne doit jamais partir avec une autre idée.
  $("#texte-idee").addEventListener("input", () => { if (etat.ideeCadrage) afficherCadrage(null); });
  $("#formulaire-idee").addEventListener("submit", async (e) => {
    e.preventDefault();
    const champ = $("#texte-idee");
    const message = champ.value.trim();
    if (!message) return;
    const bouton = e.submitter ?? $("#formulaire-idee button[type=submit]");
    bouton.disabled = true;
    try {
      const r = await fetch(`${etat.config.apiUrl}/api/idee`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message, langue: etat.langue, contexte: etat.ideeContexte ?? {},
          ...(etat.ideeCadrage && $("#idee-joindre").checked && etat.ideeCadrageMessage === message ? { cadrage: etat.ideeCadrage } : {})
        })
      });
      const d = await r.json();
      $("#retour-idee").textContent = d.texte ?? t("erreurReseau");
      if (d.ok) { champ.value = ""; afficherCadrage(null); }
    } catch {
      $("#retour-idee").textContent = t("erreurReseau");
    } finally {
      bouton.disabled = false;
    }
  });
}

function ouvrirSignalement() { $("#retour-signalement").textContent = ""; $("#signalement").showModal(); }

/* ---------- Session, pseudo et mémorisation (ADR 0012) ---------- */

/** Mode de stockage et données de la session : cookie de mémorisation → stockage local, sinon session de l'onglet. */
function initialiserSession() {
  etat.memoire = profil.memoireActive(document.cookie);
  etat.pseudo = lireCle(stockage(), profil.CLE_PSEUDO);
  const brut = lireCle(stockage(), progression.CLE_STOCKAGE);
  // Progression gardée par une version précédente (stockage local sans cookie) : reprise dans la session.
  const ancienne = !etat.memoire && !brut ? lireCle(preferences(), progression.CLE_STOCKAGE) : null;
  etat.reprise = Boolean(ancienne);
  try { etat.progres = progression.normaliser(JSON.parse(brut ?? ancienne ?? "null")); } catch { etat.progres = progression.etatInitial(); }
  const valide = profil.validerPseudo(etat.pseudo);
  etat.pseudo = valide.ok ? valide.pseudo : null;
}

/** Passe du stockage de session au stockage local (ou l'inverse) en déplaçant pseudo et progression. */
function changerMemoire(active) {
  const ancien = stockage();
  const cahiers = lireCle(ancien, CLE_CAHIERS);
  const compte = lireCle(ancien, compteLocal.CLE_COMPTE);
  if (active) document.cookie = profil.cookieMemoire({ securise: cookieSecurise() });
  else document.cookie = profil.cookieEffacement({ securise: cookieSecurise() });
  etat.memoire = active;
  for (const cle of [profil.CLE_PSEUDO, progression.CLE_STOCKAGE, trophees.CLE_STOCKAGE, evenements.CLE_STOCKAGE, CLE_CAHIERS, compteLocal.CLE_COMPTE]) effacerCle(ancien, cle);
  if (!active) effacerCle(preferences(), progression.CLE_STOCKAGE);
  sauverSession();
  if (cahiers) ecrireCle(stockage(), CLE_CAHIERS, cahiers);
  if (compte) ecrireCle(stockage(), compteLocal.CLE_COMPTE, compte);
}

function sauverSession() {
  if (etat.pseudo) ecrireCle(stockage(), profil.CLE_PSEUDO, etat.pseudo);
  progression.sauver(stockage(), etat.progres);
  trophees.sauver(stockage(), etat.trophees);
  evenements.sauver(stockage(), etat.evenements);
}

function messageErreurPseudo(erreur) {
  return t(`pseudoErreur_${erreur}`, { min: profil.PSEUDO_MIN, max: profil.PSEUDO_MAX });
}

function demanderPseudo() {
  const dialogue = $("#dialogue-pseudo");
  $("#pseudo-reprise").hidden = !etat.reprise;
  $("#pseudo-memoriser").checked = etat.memoire || etat.reprise;
  // Fenêtre obligatoire au premier lancement : Échap ne la ferme pas.
  dialogue.addEventListener("cancel", (e) => e.preventDefault());
  dialogue.showModal();
  $("#pseudo").focus();
}

function brancherProfil() {
  $("#formulaire-pseudo").addEventListener("submit", (e) => {
    e.preventDefault();
    const champ = $("#pseudo");
    const r = profil.validerPseudo(champ.value);
    champ.setAttribute("aria-invalid", String(!r.ok));
    $("#pseudo-erreur").textContent = r.ok ? "" : messageErreurPseudo(r.erreur);
    if (!r.ok) { champ.focus(); return; }
    etat.pseudo = r.pseudo;
    const memoriser = $("#pseudo-memoriser").checked;
    if (memoriser !== etat.memoire || etat.reprise) changerMemoire(memoriser);
    else sauverSession();
    etat.reprise = false;
    $("#dialogue-pseudo").close();
    remplirProfil();
    rafraichirTableau();
    notifier(t("pseudoBienvenue", { pseudo: etat.pseudo }), "👋");
    $(etat.ecran === "accueil" ? "#ouvrir-chat" : "#salut").focus({ preventScroll: true });
  });

  $("#formulaire-profil").addEventListener("submit", (e) => {
    e.preventDefault();
    const champ = $("#profil-pseudo");
    const r = profil.validerPseudo(champ.value);
    champ.setAttribute("aria-invalid", String(!r.ok));
    $("#profil-erreur").textContent = r.ok ? "" : messageErreurPseudo(r.erreur);
    if (!r.ok) return;
    etat.pseudo = r.pseudo;
    champ.value = r.pseudo;
    sauverSession();
    rafraichirTableau();
    notifier(t("pseudoEnregistre"), "✅");
  });
  $("#profil-memoriser").addEventListener("change", (e) => {
    changerMemoire(e.target.checked);
    rafraichirEtatMemoire();
    notifier(t(e.target.checked ? "memoireActivee" : "memoireDesactivee"), e.target.checked ? "🍪" : "🧹");
  });
  $("#effacer-donnees").addEventListener("click", (e) => {
    const bouton = e.currentTarget;
    if (bouton.dataset.confirmer !== "1") {
      bouton.dataset.confirmer = "1";
      bouton.textContent = t("effacerConfirmer");
      return;
    }
    document.cookie = profil.cookieEffacement({ securise: cookieSecurise() });
    for (const zone of [preferences(), (() => { try { return window.sessionStorage; } catch { return null; } })()]) {
      for (const cle of [profil.CLE_PSEUDO, progression.CLE_STOCKAGE, trophees.CLE_STOCKAGE, evenements.CLE_STOCKAGE, CLE_CAHIERS, compteLocal.CLE_COMPTE, compteLocal.CLE_SESSION]) effacerCle(zone, cle);
    }
    location.reload();
  });
}

function reinitialiserEffacement() {
  const bouton = $("#effacer-donnees");
  delete bouton.dataset.confirmer;
  bouton.textContent = t("effacerDonnees");
}

function rafraichirEtatMemoire() {
  $("#profil-memoriser").checked = etat.memoire;
  $("#profil-etat-memoire").textContent = t(etat.memoire ? "progressionMemoire" : "progressionSession");
}

/** Remet l'écran Profil dans l'état enregistré : pseudo, mémorisation, bouton d'effacement non armé. */
function remplirProfil() {
  $("#profil-pseudo").value = etat.pseudo ?? "";
  $("#profil-pseudo").removeAttribute("aria-invalid");
  $("#profil-erreur").textContent = "";
  rafraichirEtatMemoire();
  reinitialiserEffacement();
}

/* ---------- Thème ---------- */

const CLE_CHARTE = "kermiclab:charte";

/**
 * Charte graphique choisie dans le back-office (ADR 0026) : la dernière connue est appliquée tout de suite (gardée
 * pour l'onglet), puis celle du serveur. Sans réponse, le site garde ses couleurs d'origine.
 */
async function chargerCharte() {
  const appliquer = (theme) => {
    const v = charte.validerTheme(theme);
    if (v.ok) charte.appliquerTheme(v.theme);
    return v.ok;
  };
  try { appliquer(JSON.parse(sessionStorage.getItem(CLE_CHARTE))); } catch { /* aucune charte gardée */ }
  try {
    const r = await fetch(`${etat.config.apiUrl}/api/theme`);
    if (!r.ok) return;
    const { theme } = await r.json();
    if (appliquer(theme)) sessionStorage.setItem(CLE_CHARTE, JSON.stringify(theme));
  } catch { /* hors ligne ou stockage indisponible : couleurs d'origine */ }
}

function themeSombre() {
  const choix = document.documentElement.dataset.theme;
  if (choix) return choix === "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function appliquerTheme(choix) {
  if (choix === "dark" || choix === "light") document.documentElement.dataset.theme = choix;
  rafraichirTheme();
}

function rafraichirTheme() {
  const bouton = $("#bascule-theme");
  if (!bouton) return;
  const sombre = themeSombre();
  bouton.setAttribute("aria-pressed", String(sombre));
  bouton.setAttribute("aria-label", t(sombre ? "themeClair" : "themeSombre"));
  bouton.title = bouton.getAttribute("aria-label");
  bouton.querySelector("use")?.setAttribute("href", sombre ? "#i-soleil" : "#i-lune");
}

/* ---------- Navigation ---------- */

/** Les 6 destinations de la navigation, puis les sous-écrans (rattachés à une destination). */
const DESTINATIONS = ["accueil", "education", "labs", "jeux", "progression", "profil"];
const ECRANS = [...DESTINATIONS, "defi", "compte", "apropos", "connexion-en-cours"];
const PARENTS = { defi: "education", famille: "profil", "espace-famille": "profil", compte: "profil", apropos: "profil", "connexion-en-cours": "profil" };
/** Anciennes adresses (#notions, #badges…) : redirigées vers la destination qui les contient. */
const ALIAS_ECRANS = { catalogue: "education", notions: "education", cahiers: "education", badges: "progression" };
const ANCRES_ALIAS = { badges: "#progres", cahiers: "#ecran-cahiers" };
const sectionDe = (ecran) => PARENTS[ecran] ?? ecran;

function rafraichirEntete() {
  const accueil = etat.ecran === "accueil";
  $("#salut").textContent = accueil
    ? etat.pseudo ? t("salut", { pseudo: etat.pseudo }) : t("salutAnonyme")
    : t({ education: "navEducation", labs: "navLabs", jeux: "navJeux", progression: "navProgression", defi: "navDefi", profil: "navProfil", famille: "familleTitre", "espace-famille": "efTitre", "connexion-en-cours": "connexionEnCours", compte: "compteTitre", contributions: "contribTitre", suivi: "navSuivi", classes: "navClasses", eleves: "navEleves", apropos: "navAPropos" }[etat.ecran]);
  $("#accroche").textContent = t(accueil ? "accroche" : etat.ecran === "connexion-en-cours" ? "connexionEnCoursAide" : `${etat.ecran}Intro`);
}

function afficherEcran(cle, { focus = true } = {}) {
  const demande = ALIAS_ECRANS[cle] ?? cle;
  const ecran = ECRANS.includes(demande) && (demande !== "contributions" || contributionsActives()) ? demande : "accueil";
  const changement = ecran !== etat.ecran;
  etat.ecran = ecran;
  if (changement && $("#bulle-lab").open) $("#bulle-lab").close();
  document.querySelectorAll("[data-ecrans]").forEach((zone) => {
    zone.hidden = !zone.dataset.ecrans.split(" ").includes(etat.ecran);
  });
  marquerNavigation(sectionDe(etat.ecran));
  $("#ouvrir-connexion").hidden = !$("#navigation-personnelle").hidden;
  for (const bouton of document.querySelectorAll("#navigation-personnelle [data-nav], .prof-onglets [data-nav]")) {
    if (bouton.dataset.nav === ecran) bouton.setAttribute("aria-current", "page");
    else bouton.removeAttribute("aria-current");
  }
  rafraichirEntete();
  etat.moteur?.contexte({ section: sectionDe(etat.ecran) });
  decouvrirEnSilence("section", sectionDe(etat.ecran));
  if (etat.ecran === "defi" && changement) ouvrirDefi();
  if (etat.ecran === "progression") rendreProgression();
  if (etat.ecran === "contributions" && changement) void ouvrirContributions();
  if (etat.ecran === "compte") rafraichirCompte();
  if (etat.ecran === "espace-famille" && changement) void ouvrirEspaceFamille();
  if (etat.ecran === "profil" && changement) remplirProfil();
  if (etat.ecran === "suivi" && changement) void ouvrirTableauProf();
  if (etat.ecran === "classes" && changement) void ouvrirClasses();
  if (etat.ecran === "eleves" && changement) void ouvrirEleves();
  if (etat.ecran === "profil" && changement && profActif()) remplirProfilProf();
  const ancre = ANCRES_ALIAS[cle] ? $(ANCRES_ALIAS[cle]) : null;
  if (ancre?.hidden && ancre.id === "ecran-cahiers") basculerAccordeonFixe(document.querySelector('[aria-controls="ecran-cahiers"]'), true);
  if (focus) {
    window.scrollTo({ top: 0, behavior: "instant" });
    $("#salut").focus({ preventScroll: true });
    if (ancre && !ancre.hidden) ancre.scrollIntoView({ block: "start", behavior: "instant" });
  }
}

function naviguer(cle) {
  if (location.hash !== `#${cle}`) history.pushState(null, "", `#${cle}`);
  afficherEcran(cle);
}

/** Une seule destination est marquée « page courante » ; un sous-écran marque sa destination. */
function marquerNavigation(cle) {
  // « Ma famille » mène à l'Espace famille (sous-écran du Profil) : il est la page courante quand cet écran est affiché.
  const famille = $("#nav-famille");
  const surFamille = !famille.hidden && etat.ecran === "espace-famille" && famille.dataset.nav === "espace-famille";
  document.querySelectorAll(".nav-bouton[data-nav], .nav-mobile-bouton[data-nav], .barre-pied .profil-carte[data-action=\"profil\"]").forEach((b) => {
    const courant = b === famille ? surFamille : !surFamille && (b.dataset.nav ?? b.dataset.action) === cle;
    if (courant) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
}

/** Accordéons écrits dans la page (mini-lab, cahiers) : même comportement que ceux de l'arbre Éducation. */
function basculerAccordeonFixe(bouton, visible = bouton.getAttribute("aria-expanded") !== "true") {
  if (!bouton) return;
  bouton.setAttribute("aria-expanded", String(visible));
  $(`#${bouton.getAttribute("aria-controls")}`).hidden = !visible;
}

function brancherAccordeonsFixes() {
  document.querySelectorAll("button[data-accordeon-fixe][aria-controls]").forEach((bouton) => {
    bouton.addEventListener("click", () => basculerAccordeonFixe(bouton));
  });
}

/* ---------- Temps actif (web/temps-actif.js) ---------- */
// Une seule source : le moteur reçoit les interactions de la page et le signal des pages ouvertes en bulle.
// Le cumul est écrit dans la progression locale toutes les 15 s et dès que la page est cachée ou quittée.
// Aucun appel réseau : le temps ne quitte jamais l'appareil.
const INTERVALLE_ENREGISTREMENT_MS = 15_000;

function brancherTemps() {
  etat.moteur = creerMoteurTemps({ visible: !document.hidden });
  etat.moteur.contexte({ section: sectionDe(etat.ecran) });
  const signal = () => etat.moteur?.signal();
  for (const evenement of ["pointerdown", "keydown", "touchstart", "wheel"]) {
    document.addEventListener(evenement, signal, { capture: true, passive: true });
  }
  document.addEventListener("visibilitychange", () => {
    etat.moteur?.visibilite(!document.hidden);
    if (document.hidden) enregistrerTemps();
  });
  window.addEventListener("pagehide", enregistrerTemps);
  setInterval(enregistrerTemps, INTERVALLE_ENREGISTREMENT_MS);
}

function enregistrerTemps() {
  if (!etat.moteur || !etat.progres) return;
  const releve = etat.moteur.relever();
  if (!releve.total) return;
  const { p, nouveaux } = progression.ajouterTemps(etat.progres, releve);
  etat.progres = p;
  progression.sauver(stockage(), etat.progres);
  for (const b of nouveaux) notifier(t("badgeDebloque", { nom: t(`badge_${b.id}`) }), b.icone);
  if (document.hidden) return;
  rendreApercu();
  if (etat.ecran === "progression") rendreProgression();
}

/** « 2 h 14 min », « 5 min », ou « moins d'une minute » : jamais de secondes. */
function formaterDuree(ms) {
  const { heures, minutes } = experiences.decomposerDuree(ms);
  if (heures) return t("dureeHeures", { h: heures, m: minutes });
  return minutes ? t("dureeMinutes", { m: minutes }) : t("dureeMoinsMinute");
}

function brancherNavigation() {
  const suivreAdresse = () => {
    const cle = location.hash.slice(1);
    if (!cle || ECRANS.includes(ALIAS_ECRANS[cle] ?? cle)) afficherEcran(cle);
  };
  window.addEventListener("popstate", suivreAdresse);
  window.addEventListener("hashchange", suivreAdresse);
  afficherEcran(location.hash.slice(1), { focus: false });
  document.addEventListener("click", (e) => {
    const bouton = e.target.closest("[data-nav], [data-action]");
    if (!bouton || bouton.closest("dialog")) return;
    const cle = bouton.dataset.nav ?? bouton.dataset.action;
    if (ECRANS.includes(cle)) naviguer(cle);
    else if (cle === "aide") ouvrirSignalement();
    else if (cle === "question") ouvrirChat();
  });
}

/* ---------- Mes cahiers : constructeur, enrichissement IA et lecture ---------- */

const LONGUEURS_CAHIER = ["court", "standard", "complet"];
const GENRES_BLOC = ["histoire", "explication", "exemple", "retenir", "exercice", "defi", "piste", "bilan"];
const UNIVERS_CAHIER = ["aucun", "aventure", "espace", "enquete", "sport", "nature", "cuisine", "jeux-video", "musique"];
const OBJECTIFS_CAHIER = ["decouvrir", "reviser", "approfondir", "controle"];
const AVEC_REPONSE = new Set(["exercice", "defi"]);
const MAX_NOTIONS_CAHIER = 6;
const TAILLE_NOTES = 5000;
const constructeur = { type: null, envoi: false, enfant: null };

const texteBorne = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

/** Relit un cahier stocké : seuls les champs connus, bornés, sont gardés (le stockage local n'est pas une source sûre). */
function cahierValide(c) {
  if (!c || typeof c.id !== "string" || !TYPES_CAHIERS.includes(c.type) || typeof c.creeLe !== "string" || Number.isNaN(Date.parse(c.creeLe))) return null;
  const maxSections = c.type === "vacances" && c.plan ? vacances.MAX_NOTIONS : MAX_NOTIONS_CAHIER;
  const sections = Array.isArray(c.sections) ? c.sections.slice(0, maxSections).filter((s) => s && typeof s.notion === "string").map((s) => ({
    notion: texteBorne(s.notion, 80), titre: texteBorne(s.titre, 120), notes: texteBorne(s.notes, TAILLE_NOTES),
    blocs: (Array.isArray(s.blocs) ? s.blocs : []).slice(0, 20).filter((b) => b && GENRES_BLOC.includes(b.genre) && typeof b.texte === "string")
      .map((b) => ({
        genre: b.genre, texte: texteBorne(b.texte, 800),
        ...(typeof b.titre === "string" && b.titre ? { titre: texteBorne(b.titre, 80) } : {}),
        ...([1, 2, 3].includes(b.niveau) ? { niveau: b.niveau } : {}),
        ...(typeof b.indice === "string" && b.indice ? { indice: texteBorne(b.indice, 300) } : {}),
        ...(typeof b.reponse === "string" ? { reponse: texteBorne(b.reponse, 800) } : {}),
        ...(b.reussi === true ? { reussi: true } : {})
      }))
  })) : [];
  return {
    id: c.id, type: c.type, creeLe: c.creeLe, titre: texteBorne(c.titre, 60).trim() || t(`cahier_${c.type}`),
    source: c.source === "ia" ? "ia" : "catalogue", modele: texteBorne(c.modele, 100),
    longueur: LONGUEURS_CAHIER.includes(c.longueur) ? c.longueur : "standard",
    univers: UNIVERS_CAHIER.includes(c.univers) ? c.univers : "", objectif: OBJECTIFS_CAHIER.includes(c.objectif) ? c.objectif : "",
    introduction: texteBorne(c.introduction, 500), conclusion: texteBorne(c.conclusion, 400), notes: texteBorne(c.notes, TAILLE_NOTES), sections,
    // Cahier assigné par la famille (ADR 0029) : identifiant du cahier côté serveur, pour l'avancement envoyé au parent.
    ...(typeof c.famille === "string" && /^[0-9a-f-]{36}$/.test(c.famille) ? { famille: c.famille } : {}),
    // Cahier donné par un professeur (ADR 0030 §9) : identifiant de l'activité, pour l'avancement envoyé au professeur.
    ...(typeof c.prof === "string" && /^[0-9a-z-]{1,64}$/.test(c.prof) ? { prof: c.prof } : {}),
    // Planning du cahier de vacances (issue #188), relu strictement ; un plan invalide est simplement ignoré.
    ...(c.type === "vacances" && vacances.validerPlan(c.plan) ? { plan: vacances.validerPlan(c.plan) } : {})
  };
}

function cahiersEnregistres() {
  try {
    const cahiers = JSON.parse(lireCle(stockage(), CLE_CAHIERS) ?? "[]");
    return Array.isArray(cahiers) ? cahiers.map(cahierValide).filter(Boolean) : [];
  } catch { return []; }
}
const enregistrerCahiers = (cahiers) => ecrireCle(stockage(), CLE_CAHIERS, JSON.stringify(cahiers));

function rendreCahiers() {
  const liste = $("#liste-cahiers");
  if (!liste || !etat.textes.titre) return;
  const cahiers = cahiersEnregistres();
  liste.replaceChildren(...cahiers.map((cahier) => {
    const carte = element("article", { classe: "carte cahier-enregistre" });
    const contenu = element("div", { classe: "cahier-infos" });
    const date = new Intl.DateTimeFormat(etat.langue, { dateStyle: "medium" }).format(new Date(cahier.creeLe));
    const { total, reussis } = bilanExercices(cahier);
    const avancement = cahier.plan ? vacances.planning(cahier.plan, progression.jourLocal()) : null;
    const details = [t(`cahier_${cahier.type}`), avancement ? t("vacancesAvancement", { n: avancement.faites, m: avancement.total })
      : cahier.sections.length ? t("cahierNotionsCompte", { n: cahier.sections.length }) : null,
      total ? t("cahierProgression", { n: reussis, m: total }) : null, date].filter(Boolean).join(" · ");
    contenu.append(element("h4", { texte: cahier.titre }), element("p", { classe: "doux petit", texte: details }));
    if (cahier.source === "ia") contenu.append(element("span", { classe: "pastille ok", cle: "cahierBadgeIa" }));
    const actions = element("div", { classe: "cahier-actions" });
    const ouvrir = element("button", { classe: "bouton petit-bouton", cle: "cahierOuvrir", attributs: { type: "button", "data-ouvrir-cahier": cahier.id } });
    ouvrir.setAttribute("aria-label", t("cahierOuvrirNom", { titre: cahier.titre }));
    const supprimer = element("button", { classe: "secondaire petit-bouton", cle: "cahierSupprimerBouton", attributs: { type: "button", "data-supprimer-cahier": cahier.id } });
    supprimer.setAttribute("aria-label", t("cahierSupprimer", { titre: cahier.titre }));
    actions.append(ouvrir, supprimer);
    carte.append(contenu, actions);
    return carte;
  }));
  $("#cahiers-vide").hidden = cahiers.length > 0;
  rendreCahiersFamille();
}

/* Constructeur */

const notionsCahier = () => etat.notions.filter((n) => matiereDe(n) !== "jeux");
// En mode famille (cahier assigné à un enfant, ADR 0029), le quota est celui du parent, compté par le serveur.
const cahierIaRestantes = () => (constructeur.enfant ? familleEtat.tableau?.cahiersIa?.restantes ?? 0
  : etat.cahiersIa.restantesServeur ?? etat.cahiersIa.generationsParJour);
const cahierIaDisponible = () => (constructeur.enfant ? familleEtat.tableau?.cahiersIa?.ia === true : etat.llmDisponible && etat.cahiersIa.ia);
const cahierIaPossible = () => cahierIaDisponible() && etat.llmActif && cahierIaRestantes() > 0;

function option(valeur, texte) {
  const o = document.createElement("option");
  o.value = valeur; o.textContent = texte;
  return o;
}

function remplirMatieresCahier() {
  const select = $("#cahier-matiere");
  const matieres = [...new Set(notionsCahier().map(matiereDe))].sort(ordreMatiere);
  const actuelle = select.value || etat.matiere;
  select.replaceChildren(...matieres.map((m) => option(m, t(`matiere_${m}`))));
  select.value = matieres.includes(actuelle) ? actuelle : matieres[0] ?? "";
}

function remplirNiveauxCahier() {
  const select = $("#cahier-niveau");
  const actuel = select.value || "tous";
  const niveaux = NIVEAUX.filter((niv) => notionsCahier().some((n) => matiereDe(n) === $("#cahier-matiere").value && (n.niveau || "autres") === niv));
  select.replaceChildren(option("tous", t("cahierNiveauTous")), ...niveaux.map((niv) => option(niv, t(`niveau_${niv}`))));
  select.value = actuel === "tous" || niveaux.includes(actuel) ? actuel : "tous";
}

function cochees() {
  return [...document.querySelectorAll("#cahier-notions input:checked")].map((c) => c.value);
}

function limiterNotionsCahier() {
  const pleines = cochees().length >= MAX_NOTIONS_CAHIER;
  document.querySelectorAll("#cahier-notions input").forEach((c) => { c.disabled = pleines && !c.checked; });
}

function rendreNotionsCahier() {
  const deja = new Set(cochees());
  const matiere = $("#cahier-matiere").value;
  const niveau = $("#cahier-niveau").value;
  const notions = notionsCahier().filter((n) => matiereDe(n) === matiere && (niveau === "tous" || (n.niveau || "autres") === niveau));
  const zone = $("#cahier-notions");
  zone.replaceChildren(...notions.map((n) => {
    const label = element("label", { classe: "cahier-notion" });
    const case_ = element("input", { attributs: { type: "checkbox", value: n.id, name: "notions" } });
    case_.checked = deja.has(n.id);
    label.append(case_, element("span", { texte: n.titre }));
    return label;
  }));
  if (!notions.length) zone.append(element("p", { classe: "doux petit", cle: "cahierNotionsVide" }));
  limiterNotionsCahier();
}

function rafraichirIaCahier() {
  const caseIa = $("#cahier-ia");
  const possible = cahierIaPossible();
  caseIa.disabled = !possible;
  if (!possible) caseIa.checked = false;
  const cle = !cahierIaDisponible() ? "cahierIaIndisponible"
    : !etat.llmActif ? "cahierIaConsentement" : cahierIaRestantes() <= 0 ? "cahierIaQuota" : "cahierIaEtat";
  $("#cahier-ia-etat").textContent = t(cle, { n: cahierIaRestantes(), modele: etat.cahiersIa.modele });
}

function ouvrirConstructeur(type) {
  constructeur.type = type;
  basculerModeFamilleConstructeur();
  $("#constructeur-titre").textContent = t(constructeur.enfant ? "efConstructeurTitre" : "constructeurTitre", { type: t(`cahier_${type}`), prenom: constructeur.enfant?.prenom ?? "" });
  $("#constructeur-aide").textContent = t(`cahierConstructeur_${type}`);
  $("#cahier-titre").value = "";
  $("#cahier-titre").placeholder = t(`cahier_${type}`);
  $("#cahier-notions-aide").textContent = t(type === "brouillon" ? "cahierNotionsAideBrouillon" : "cahierNotionsAide", { n: MAX_NOTIONS_CAHIER });
  $("#cahier-longueur").replaceChildren(...LONGUEURS_CAHIER.map((l) => option(l, t(`cahierLongueur_${l}`))));
  $("#cahier-longueur").value = "standard";
  $("#cahier-univers").replaceChildren(...UNIVERS_CAHIER.map((u) => option(u, t(`cahierUnivers_${u}`))));
  $("#cahier-univers").value = "aucun";
  $("#cahier-objectif").replaceChildren(...OBJECTIFS_CAHIER.map((o) => option(o, t(`cahierObjectif_${o}`))));
  $("#cahier-objectif").value = "reviser";
  $("#cahier-notions").replaceChildren();
  remplirMatieresCahier();
  $("#cahier-niveau").value = "tous";
  remplirNiveauxCahier();
  rendreNotionsCahier();
  $("#cahier-ia").checked = cahierIaPossible();
  rafraichirIaCahier();
  $("#retour-cahier").textContent = "";
  $("#construire-cahier").disabled = false;
  $("#constructeur-cahier").showModal();
  (constructeur.enfant ? $("#cahier-type-famille") : $("#cahier-titre")).focus();
}

/** Sans IA : le cahier est construit à partir du catalogue (une section par notion, à compléter par l'élève). */
function sectionsCatalogue(ids) {
  return ids.map((id) => ({ notion: id, titre: notionParId(id)?.titre ?? id, blocs: [], notes: "" }));
}

async function construireCahier(e) {
  e.preventDefault();
  if (constructeur.envoi) return;
  const type = constructeur.type;
  const ids = cochees();
  const retour = $("#retour-cahier");
  if (!ids.length && type !== "brouillon") { retour.textContent = t("cahierChoisirNotion"); return; }
  const longueur = $("#cahier-longueur").value;
  const univers = $("#cahier-univers").value;
  const objectif = $("#cahier-objectif").value;
  if (constructeur.enfant) { await assignerCahierFamille({ type, ids, longueur, univers, objectif }); return; }
  const titreChoisi = $("#cahier-titre").value.trim().slice(0, 60);
  const cahiers = cahiersEnregistres();
  const cahier = {
    id: window.crypto?.randomUUID?.() ?? `${Date.now()}-${cahiers.length}`, type, creeLe: new Date().toISOString(),
    titre: titreChoisi || t(`cahier_${type}`), longueur, univers, objectif,
    source: "catalogue", introduction: t(`cahierIntro_${type}`), notes: "", sections: sectionsCatalogue(ids)
  };
  let repli = false;
  if ($("#cahier-ia").checked && cahierIaPossible() && ids.length) {
    constructeur.envoi = true;
    $("#construire-cahier").disabled = true;
    retour.textContent = t("cahierPreparation");
    try {
      // Seuls le type, la longueur, la langue et les identifiants publiés des notions partent : le titre reste ici.
      const r = await fetch(`${etat.config.apiUrl}/api/cahier`, {
        method: "POST", credentials: "include", headers: { "content-type": "application/json", ...enteteFamille() },
        body: JSON.stringify({ type, longueur, univers, objectif, langue: etat.langue, notions: ids, utiliserLlm: true })
      });
      const d = await r.json();
      if (Number.isInteger(d.quota?.restantes)) etat.cahiersIa.restantesServeur = d.quota.restantes;
      if (d.source === "ia" && Array.isArray(d.cahier?.sections) && d.cahier.sections.length) {
        cahier.source = "ia";
        cahier.modele = typeof d.llm?.modele === "string" ? d.llm.modele : "";
        cahier.introduction = typeof d.cahier.introduction === "string" && d.cahier.introduction ? d.cahier.introduction : cahier.introduction;
        cahier.conclusion = typeof d.cahier.conclusion === "string" ? d.cahier.conclusion : "";
        // Le titre proposé par l'IA ne remplace jamais celui que l'élève a choisi.
        if (!titreChoisi && typeof d.cahier.titre === "string" && d.cahier.titre) cahier.titre = d.cahier.titre;
        cahier.sections = d.cahier.sections.map((s) => ({ notion: s.notion, titre: s.titre, blocs: s.blocs, notes: "" }));
      } else repli = true;
    } catch {
      console.error("cahier IA indisponible");
      repli = true;
    } finally {
      constructeur.envoi = false;
      $("#construire-cahier").disabled = false;
    }
  }
  const propre = cahierValide(cahier);
  enregistrerCahiers([propre, ...cahiers]);
  rendreCahiers();
  $("#constructeur-cahier").close();
  ouvrirLectureCahier(propre.id, repli ? t("cahierIaRepli") : "");
}

/* Lecture */

const ICONES_GENRE = { histoire: "📖", explication: "💬", exemple: "💡", retenir: "📌", exercice: "✏️", defi: "🏆", piste: "🧭", bilan: "✅" };

/** Exercices et défis d'un cahier : total et réussis (auto-évaluation gardée sur l'appareil). */
function bilanExercices(cahier) {
  const exercices = cahier.sections.flatMap((s) => s.blocs.filter((b) => AVEC_REPONSE.has(b.genre)));
  return { total: exercices.length, reussis: exercices.filter((b) => b.reussi).length };
}

function rafraichirProgressionCahier(cahier) {
  if (cahier.famille) planifierBilanFamille();
  if (cahier.prof) planifierResultatsProf();
  const zone = $("#lecture-progression");
  const { total, reussis } = bilanExercices(cahier);
  zone.hidden = total === 0;
  if (!total) return;
  zone.querySelector("span").textContent = t("cahierProgression", { n: reussis, m: total });
  zone.querySelector("progress").max = total;
  zone.querySelector("progress").value = reussis;
  actualiserChapitresCahier();
  actualiserBilanCahier(total, reussis);
}

function blocCahier(b, cahierId, iSection, iBloc) {
  const bloc = element("div", { classe: `bloc-cahier bloc-${b.genre}` });
  const tete = element("p", { classe: "bloc-genre petit" });
  tete.append(element("span", { texte: `${ICONES_GENRE[b.genre] ?? ""} `, attributs: { "aria-hidden": "true" } }), element("span", { cle: `cahierGenre_${b.genre}` }));
  if (b.niveau) tete.append(element("span", { classe: "bloc-niveau", texte: ` · ${"★".repeat(b.niveau)}${"☆".repeat(3 - b.niveau)}`, attributs: { "aria-label": t("cahierNiveauExercice", { n: b.niveau }) } }));
  bloc.append(tete);
  if (b.titre) bloc.append(element("p", { classe: "bloc-titre", texte: b.titre }));
  bloc.append(element("p", { texte: b.texte }));
  if (b.indice) {
    const indice = element("details", { classe: "indice-cahier" });
    indice.append(element("summary", { cle: "cahierIndice" }), element("p", { texte: b.indice }));
    bloc.append(indice);
  }
  if (AVEC_REPONSE.has(b.genre) && b.reponse) {
    const details = element("details", { classe: "reponse-cahier" });
    details.append(element("summary", { cle: "cahierVoirReponse" }), element("p", { texte: b.reponse }));
    bloc.append(details);
    const reussi = element("label", { classe: "reussi-cahier" });
    const caseReussi = element("input", { attributs: { type: "checkbox" } });
    caseReussi.checked = b.reussi === true;
    caseReussi.addEventListener("change", () => {
      const cahiers = cahiersEnregistres();
      const c = cahiers.find((x) => x.id === cahierId);
      const cible = c?.sections[iSection]?.blocs[iBloc];
      if (!cible) return;
      if (caseReussi.checked) cible.reussi = true; else delete cible.reussi;
      enregistrerCahiers(cahiers);
      bloc.classList.toggle("reussi", caseReussi.checked);
      $("#lecture-suivant").classList.toggle("invite", caseReussi.checked);
      rafraichirProgressionCahier(c);
      rendreCahiers();
    });
    bloc.classList.toggle("reussi", caseReussi.checked);
    reussi.append(caseReussi, element("span", { cle: "cahierReussi" }));
    bloc.append(reussi);
  }
  return bloc;
}

function zoneNotes(cahierId, indexSection, valeur) {
  const id = `notes-${indexSection}`;
  const zone = element("div", { classe: "notes-cahier" });
  const label = element("label", { cle: indexSection < 0 ? "cahierPageLibre" : "cahierMesNotes", attributs: { for: id } });
  const texte = element("textarea", { attributs: { id, rows: indexSection < 0 ? "10" : "4", maxlength: String(TAILLE_NOTES) } });
  texte.value = valeur;
  texte.addEventListener("input", () => {
    const cahiers = cahiersEnregistres();
    const c = cahiers.find((x) => x.id === cahierId);
    if (!c) return;
    if (indexSection < 0) c.notes = texte.value; else if (c.sections[indexSection]) c.sections[indexSection].notes = texte.value;
    enregistrerCahiers(cahiers);
  });
  zone.append(label, texte);
  return zone;
}

/* Lecture pas à pas : le cahier entier est dans la page, une seule étape est affichée à la fois. */

const lecture = { id: null, etapes: [], chapitres: [], index: 0, bilan: null };
const casesReussi = (zone) => [...zone.querySelectorAll(".reussi-cahier input")];

/** Pastilles des chapitres : chapitre courant, chapitres dont tous les exercices sont réussis. */
function actualiserChapitresCahier() {
  const courant = lecture.etapes[lecture.index]?.chapitre;
  lecture.chapitres.forEach((c, i) => {
    const cases = c.section ? casesReussi(c.section) : [];
    const fait = cases.length > 0 && cases.every((x) => x.checked);
    c.bouton.classList.toggle("fait", fait);
    c.bouton.setAttribute("aria-label", fait ? t("cahierChapitreTermine", { titre: c.titre }) : c.titre);
    if (i === courant) c.bouton.setAttribute("aria-current", "step"); else c.bouton.removeAttribute("aria-current");
  });
}

/** Dernière étape : score, encouragement et raccourci vers le premier exercice à reprendre. */
function actualiserBilanCahier(total, reussis) {
  if (!lecture.bilan) return;
  const { score, message, reprendre } = lecture.bilan;
  score.hidden = total === 0;
  score.textContent = `${reussis}/${total}`;
  message.textContent = !total ? t("cahierBilanFin") : reussis === total ? t("cahierBilanBravo") : t("cahierBilanEncore", { n: total - reussis });
  reprendre.hidden = !total || reussis === total;
}

const premiereEtapeARefaire = () => lecture.etapes.findIndex((e) => casesReussi(e.el).some((x) => !x.checked));

function afficherEtapeCahier(index) {
  const n = lecture.etapes.length;
  if (!n) return;
  lecture.index = Math.max(0, Math.min(index, n - 1));
  const courante = lecture.etapes[lecture.index];
  lecture.etapes.forEach((e, i) => { e.el.hidden = i !== lecture.index; });
  lecture.chapitres.forEach((c) => { if (c.section) c.section.hidden = c.section !== courante.el.parentElement; });
  $("#lecture-precedent").disabled = lecture.index === 0;
  const suivant = $("#lecture-suivant");
  const cle = lecture.index === n - 1 ? "cahierEtapeTerminer" : lecture.index === 0 ? "cahierEtapeCommencer" : "cahierEtapeSuivante";
  suivant.dataset.i18n = cle;
  suivant.textContent = t(cle);
  suivant.classList.remove("invite");
  $("#lecture-position").textContent = t("cahierEtapePosition", { n: lecture.index + 1, m: n });
  $("#lecture-avancee").max = Math.max(1, n - 1);
  $("#lecture-avancee").value = lecture.index;
  actualiserChapitresCahier();
  $("#lecture-corps").scrollTop = 0;
  const pastille = lecture.chapitres[courante.chapitre]?.bouton;
  const rail = $("#lecture-chapitres");
  if (pastille && !rail.hidden) rail.scrollLeft = pastille.offsetLeft - (rail.clientWidth - pastille.offsetWidth) / 2;
}

function ouvrirLectureCahier(id, message = "") {
  const cahier = cahiersEnregistres().find((c) => c.id === id);
  if (!cahier) return;
  const dialogue = $("#lecture-cahier");
  const dejaOuvert = dialogue.open && lecture.id === id;
  $("#lecture-titre").textContent = cahier.titre;
  const date = new Intl.DateTimeFormat(etat.langue, { dateStyle: "medium" }).format(new Date(cahier.creeLe));
  const source = cahier.source === "ia" ? t("cahierSourceIa", { modele: cahier.modele || "IA" }) : t("cahierSourceCatalogue");
  const univers = cahier.univers && cahier.univers !== "aucun" ? t(`cahierUnivers_${cahier.univers}`) : null;
  $("#lecture-meta").textContent = [t(`cahier_${cahier.type}`), univers, date, source].filter(Boolean).join(" · ");
  const corps = $("#lecture-corps");
  corps.replaceChildren();
  const etapes = [];
  const chapitres = [];
  const chapitre = (titre, section = null) => { chapitres.push({ titre, section }); };
  const etape = (el) => { el.classList.add("etape-cahier"); etapes.push({ el, chapitre: chapitres.length - 1 }); return el; };
  const { total } = bilanExercices(cahier);
  const pageLibre = !cahier.sections.length || cahier.type === "brouillon";
  const avecBilan = cahier.sections.length > 0 && (Boolean(cahier.conclusion) || total > 0 || pageLibre);

  // Accueil : message éventuel, introduction, puis le planning (vacances) ou le sommaire.
  chapitre(t("cahierChapitreAccueil"));
  const accueil = etape(element("div", { classe: "accueil-cahier" }));
  if (message) accueil.append(element("p", { classe: "note-locale", texte: message, attributs: { role: "status" } }));
  if (cahier.introduction) accueil.append(element("p", { classe: "intro-cahier", texte: cahier.introduction }));
  if (cahier.plan) accueil.append(planningVacances(cahier));
  else if (cahier.sections.length > 1) {
    accueil.append(element("p", { classe: "bloc-genre petit", cle: "cahierSommaire" }));
    const sommaire = element("ol", { classe: "sommaire-cahier" });
    cahier.sections.forEach((s, i) => {
      const li = element("li");
      const aller = element("button", { classe: "secondaire", attributs: { type: "button" } });
      const exercices = s.blocs.filter((b) => AVEC_REPONSE.has(b.genre)).length;
      aller.append(element("span", { classe: "sommaire-titre", texte: s.titre }));
      if (exercices) aller.append(element("span", { classe: "doux petit", texte: t("cahierSommaireExercices", { n: exercices }) }));
      aller.addEventListener("click", () => afficherEtapeCahier(etapes.findIndex((e) => e.chapitre === i + 1)));
      li.append(aller);
      sommaire.append(li);
    });
    accueil.append(sommaire);
  }
  if (pageLibre && !avecBilan) accueil.append(zoneNotes(cahier.id, -1, cahier.notes));
  corps.append(accueil);

  // Un chapitre par notion : chaque bloc est une étape, les notes ferment le chapitre.
  cahier.sections.forEach((s, i) => {
    const section = element("section", { classe: "section-cahier" });
    const tete = element("div", { classe: "tete-section-cahier" });
    tete.append(element("h3", { texte: s.titre }));
    if (notionParId(s.notion)) {
      const ouvrir = element("button", { classe: "secondaire petit-bouton", cle: "cahierOuvrirNotion", attributs: { type: "button" } });
      ouvrir.addEventListener("click", () => { dialogue.close(); ouvrirNotion(notionParId(s.notion)); });
      tete.append(ouvrir);
    }
    chapitre(s.titre, section);
    section.append(tete, ...s.blocs.map((b, j) => etape(blocCahier(b, cahier.id, i, j))), etape(zoneNotes(cahier.id, i, s.notes)));
    corps.append(section);
  });

  lecture.bilan = null;
  if (avecBilan) {
    chapitre(t("cahierChapitreBilan"));
    const bilan = etape(element("div", { classe: "bilan-cahier" }));
    const score = element("p", { classe: "bilan-score", attributs: { "aria-hidden": "true" } });
    const messageBilan = element("p", { classe: "bilan-message" });
    const reprendre = element("button", { classe: "secondaire", cle: "cahierBilanReprendre", attributs: { type: "button" } });
    reprendre.addEventListener("click", () => { const i = premiereEtapeARefaire(); if (i >= 0) afficherEtapeCahier(i); });
    bilan.append(score, messageBilan, reprendre);
    if (cahier.conclusion) bilan.append(element("p", { classe: "conclusion-cahier", texte: cahier.conclusion }));
    if (pageLibre) bilan.append(zoneNotes(cahier.id, -1, cahier.notes));
    corps.append(bilan);
    lecture.bilan = { score, message: messageBilan, reprendre };
  }

  // Pastilles des chapitres : accès direct à la première étape de chacun.
  const rail = $("#lecture-chapitres");
  rail.replaceChildren(...chapitres.map((c, i) => {
    c.bouton = element("button", { classe: "pastille-chapitre", attributs: { type: "button" } });
    if (c.section) c.bouton.append(element("span", { classe: "pastille-numero", texte: String(i), attributs: { "aria-hidden": "true" } }));
    c.bouton.append(element("span", { classe: "pastille-titre", texte: c.titre }));
    c.bouton.addEventListener("click", () => afficherEtapeCahier(etapes.findIndex((e) => e.chapitre === i)));
    return c.bouton;
  }));
  rail.hidden = chapitres.length < 2;
  $("#lecture-pied").hidden = etapes.length < 2;

  const { reussis } = bilanExercices(cahier);
  const reprise = dejaOuvert ? lecture.index : 0;
  Object.assign(lecture, { id, etapes, chapitres });
  rafraichirProgressionCahier(cahier);
  // Un cahier commencé rouvre sur le premier exercice qui reste à réussir.
  const aRefaire = !dejaOuvert && reussis > 0 ? premiereEtapeARefaire() : -1;
  if (!dialogue.open) dialogue.showModal();
  afficherEtapeCahier(aRefaire >= 0 ? aRefaire : reprise);
}

function brancherLectureCahier() {
  const dialogue = $("#lecture-cahier");
  brancherDialogue(dialogue, $("#fermer-lecture"));
  $("#lecture-precedent").addEventListener("click", () => afficherEtapeCahier(lecture.index - 1));
  $("#lecture-suivant").addEventListener("click", () => {
    if (lecture.index >= lecture.etapes.length - 1) dialogue.close(); else afficherEtapeCahier(lecture.index + 1);
  });
  // Flèches gauche et droite : étape précédente ou suivante, sauf pendant la saisie.
  dialogue.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest("textarea, input, select, [contenteditable]")) return;
    if (e.key === "ArrowRight" && lecture.index < lecture.etapes.length - 1) afficherEtapeCahier(lecture.index + 1);
    else if (e.key === "ArrowLeft" && lecture.index > 0) afficherEtapeCahier(lecture.index - 1);
  });
}

/* ---------- Cahier de vacances : réglages, diagnostic court, planning jour par jour (issue #188) ---------- */

const constructeurVacances = { etape: "reglages", ordre: [], acquises: [], questions: [] };
const dateLisible = (jour, options = { weekday: "long", day: "numeric", month: "long" }) =>
  new Date(`${jour}T00:00:00`).toLocaleDateString(etat.langue, options);
const maitriseDe = (id) => evenements.maitriseNotion(etat.evenements?.notions?.[id], progression.jourLocal()).etat;

function lireReglagesVacances() {
  return {
    matiere: $("#vacances-matiere").value, niveau: $("#vacances-niveau").value,
    debut: $("#vacances-debut").value, fin: $("#vacances-fin").value, rythme: Number($("#vacances-rythme").value)
  };
}

/** Résumé en direct : nombre de notions et de séances, ou ce qui empêche de continuer. */
function actualiserReglagesVacances() {
  const r = lireReglagesVacances();
  const ordre = vacances.ordonnerNotions(etat.notions, r);
  const seances = vacances.joursActifs(r.debut, r.fin, r.rythme).length;
  const duree = r.debut && r.fin ? (Date.parse(r.fin) - Date.parse(r.debut)) / 86400000 : -1;
  const erreur = !ordre.length ? "vacancesErreurNotions" : duree < 0 ? "vacancesErreurDates"
    : duree > vacances.DUREE_MAX_JOURS ? "vacancesErreurDuree" : !seances ? "vacancesErreurSeances" : null;
  $("#vacances-resume").textContent = erreur ? "" : t("vacancesResume", { n: ordre.length, s: seances });
  $("#vacances-retour").textContent = erreur ? t(erreur, { n: vacances.DUREE_MAX_JOURS }) : "";
  $("#vacances-suivant").disabled = Boolean(erreur);
  return { ...r, ordre, erreur };
}

function remplirNiveauxVacances() {
  const choix = vacances.choixPossibles(etat.notions);
  const niveaux = choix[$("#vacances-matiere").value] ?? [];
  const avant = $("#vacances-niveau").value;
  $("#vacances-niveau").replaceChildren(...niveaux.map((n) => option(n, t(`vacancesNiveau_${n}`))));
  if (niveaux.includes(avant)) $("#vacances-niveau").value = avant;
}

function ouvrirConstructeurVacances() {
  constructeurVacances.etape = "reglages";
  const choix = vacances.choixPossibles(etat.notions);
  const matieres = Object.keys(choix).sort(ordreMatiere);
  $("#vacances-matiere").replaceChildren(...matieres.map((m) => option(m, t(`matiere_${m}`))));
  remplirNiveauxVacances();
  const jour = progression.jourLocal();
  $("#vacances-debut").value = jour;
  $("#vacances-fin").value = vacances.ajouterJours(jour, 27);
  $("#vacances-rythme").replaceChildren(...[3, 5, 7].map((n) => option(String(n), t("vacancesRythmeChoix", { n }))));
  $("#vacances-rythme").value = "5";
  $("#vacances-nom").value = "";
  $("#vacances-nom").placeholder = t("cahier_vacances");
  $("#vacances-reglages").hidden = false;
  $("#vacances-diagnostic").hidden = true;
  $("#vacances-suivant").textContent = t("vacancesContinuer");
  actualiserReglagesVacances();
  $("#constructeur-vacances").showModal();
  $("#vacances-matiere").focus();
}

/** Diagnostic court : un QCM publié par notion, pour les premières notions du parcours (dist/contenus/, même origine). */
async function questionsDiagnosticVacances(ids) {
  const questions = [];
  for (const notion of ids) {
    if (!contenusDefi.has(notion)) {
      try { contenusDefi.set(notion, await chargerJson(`contenus/${encodeURIComponent(notion)}.json`)); } catch { contenusDefi.set(notion, null); }
    }
    const exercices = contenusDefi.get(notion)?.application?.exercices ?? [];
    const rang = exercices.findIndex((_, i) => exerciceDuContenu(contenusDefi.get(notion), `app-${i + 1}`));
    if (rang >= 0) questions.push({ notion, ...exerciceDuContenu(contenusDefi.get(notion), `app-${rang + 1}`) });
  }
  return questions;
}

function afficherDiagnosticVacances(questions) {
  constructeurVacances.etape = "diagnostic";
  constructeurVacances.questions = questions;
  $("#vacances-questions").replaceChildren(...questions.map((q, i) => {
    const bloc = element("fieldset", { classe: "vacances-question", attributs: { "data-diagnostic": q.notion } });
    bloc.append(element("legend", { texte: `${notionParId(q.notion)?.titre ?? q.notion} · ${q.question}` }));
    q.choix.forEach((c, j) => {
      const label = element("label");
      label.append(element("input", { attributs: { type: "radio", name: `diagnostic-${i}`, value: String(j) } }), element("span", { texte: c }));
      bloc.append(label);
    });
    const jeNeSaisPas = element("label");
    jeNeSaisPas.append(element("input", { attributs: { type: "radio", name: `diagnostic-${i}`, value: "-1" } }), element("span", { cle: "vacancesJeNeSaisPas" }));
    bloc.append(jeNeSaisPas);
    return bloc;
  }));
  $("#vacances-reglages").hidden = true;
  $("#vacances-diagnostic").hidden = false;
  $("#vacances-retour").textContent = "";
  $("#vacances-suivant").textContent = t("vacancesCreer");
  $("#vacances-questions input")?.focus();
}

function creerCahierVacances() {
  const r = lireReglagesVacances();
  // Diagnostic : une bonne réponse = notion déjà acquise, qui sort du planning (aucune note, aucune trace ailleurs).
  const reussies = constructeurVacances.questions.filter((q, i) => Number($(`input[name="diagnostic-${i}"]:checked`)?.value) === q.bonne).map((q) => q.notion);
  const plan = vacances.creerPlan({ ...r, ordre: constructeurVacances.ordre, acquises: [...constructeurVacances.acquises, ...reussies] });
  const cahiers = cahiersEnregistres();
  const cahier = cahierValide({
    id: window.crypto?.randomUUID?.() ?? `${Date.now()}-${cahiers.length}`, type: "vacances", creeLe: new Date().toISOString(),
    titre: $("#vacances-nom").value.trim().slice(0, 60) || t("cahier_vacances"), source: "catalogue", longueur: "standard",
    introduction: t("cahierIntro_vacances"), notes: "", sections: sectionsCatalogue(plan.notions), plan
  });
  enregistrerCahiers([cahier, ...cahiers]);
  rendreCahiers();
  $("#constructeur-vacances").close();
  ouvrirLectureCahier(cahier.id, reussies.length ? t("vacancesDejaAcquises", { n: plan.acquises.length }) : "");
}

function brancherVacances() {
  $("#vacances-matiere").addEventListener("change", () => { remplirNiveauxVacances(); actualiserReglagesVacances(); });
  for (const id of ["#vacances-niveau", "#vacances-debut", "#vacances-fin", "#vacances-rythme"]) $(id).addEventListener("change", actualiserReglagesVacances);
  brancherDialogue($("#constructeur-vacances"), $("#fermer-vacances"));
  // Cahier libre, sans planning : l'ancien constructeur (sections par notion, enrichissement IA possible) reste disponible.
  $("#vacances-libre").addEventListener("click", () => { $("#constructeur-vacances").close(); ouvrirConstructeur("vacances"); });
  $("#formulaire-vacances").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (constructeurVacances.etape === "diagnostic") { creerCahierVacances(); return; }
    const r = actualiserReglagesVacances();
    if (r.erreur) return;
    constructeurVacances.ordre = r.ordre;
    // Notions déjà maîtrisées sur cet appareil (issue #185) : acquises d'office, pas de question inutile.
    constructeurVacances.acquises = r.ordre.filter((id) => ["maitrisee", "a-revoir"].includes(maitriseDe(id)));
    $("#vacances-suivant").disabled = true;
    const questions = await questionsDiagnosticVacances(vacances.notionsDiagnostic(r.ordre, constructeurVacances.acquises));
    $("#vacances-suivant").disabled = false;
    if (!questions.length) { constructeurVacances.questions = []; creerCahierVacances(); return; }
    afficherDiagnosticVacances(questions);
  });
}

/** Les cinq étapes de la journée type (20 à 30 minutes), pour la notion du jour. */
function journeeVacances(cahier, notion) {
  const n = notionParId(notion);
  const etapes = element("ol", { classe: "vacances-etapes" });
  const etape = (cle, ...contenu) => { const li = element("li"); li.append(element("strong", { cle }), ...contenu); etapes.append(li); };
  const dues = evenements.revisionsDues(etat.evenements, progression.jourLocal(), ProgressionJeux.cartesDues).length;
  const reviser = element("button", { classe: "secondaire petit-bouton", cle: dues ? "vacancesReviserBouton" : "vacancesDefiBouton", attributs: { type: "button" } });
  reviser.addEventListener("click", () => { $("#lecture-cahier").close(); naviguer("defi"); });
  etape("vacancesEtapeRevision", element("span", { classe: "doux petit", texte: ` ${t(dues ? "vacancesRevisionsDues" : "vacancesRevisionsAucune", { n: dues })} ` }), reviser);
  const ouvrir = element("button", { classe: "bouton petit-bouton", cle: "cahierOuvrirNotion", attributs: { type: "button", "data-vacances-ouvrir": notion } });
  ouvrir.addEventListener("click", () => { $("#lecture-cahier").close(); if (n) ouvrirNotion(n); });
  etape("vacancesEtapeNotion", element("span", { texte: ` ${n?.titre ?? notion} ` }), ouvrir);
  etape("vacancesEtapeManipulation", element("span", { classe: "doux petit", texte: ` ${t("vacancesManipulationAide")}` }));
  etape("vacancesEtapeExercices", element("span", { classe: "doux petit", texte: ` ${t("maitriseTitre")} : ${t(`maitrise-${maitriseDe(notion)}`)}` }));
  const terminer = element("button", { classe: "bouton petit-bouton", cle: "vacancesTerminer", attributs: { type: "button", "data-vacances-terminer": notion } });
  terminer.addEventListener("click", () => {
    const cahiers = cahiersEnregistres();
    const c = cahiers.find((x) => x.id === cahier.id);
    if (!c?.plan) return;
    c.plan = vacances.terminerJournee(c.plan, notion, progression.jourLocal());
    enregistrerCahiers(cahiers);
    rendreCahiers();
    ouvrirLectureCahier(cahier.id, t("vacancesBravo"));
  });
  etape("vacancesEtapeBilan", element("span", { classe: "doux petit", texte: ` ${t("vacancesBilanAide")} ` }), terminer);
  return etapes;
}

/** Planning du cahier de vacances, recalculé à chaque ouverture à partir d'aujourd'hui. */
function planningVacances(cahier) {
  const jour = progression.jourLocal();
  const p = vacances.planning(cahier.plan, jour);
  const bloc = element("section", { classe: "carte planning-vacances", attributs: { "data-planning": p.etat, "aria-labelledby": "planning-titre" } });
  bloc.append(element("h3", { cle: "vacancesAujourdhui", attributs: { id: "planning-titre" } }));
  const resume = [t("vacancesAvancement", { n: p.faites, m: p.total }), t("vacancesPeriode", { debut: dateLisible(cahier.plan.debut, { day: "numeric", month: "long" }), fin: dateLisible(cahier.plan.fin, { day: "numeric", month: "long" }) }),
    t("vacancesRythmeChoix", { n: cahier.plan.rythme })];
  bloc.append(element("p", { classe: "doux petit", texte: resume.join(" · ") }));
  const a = p.aujourdhui;
  if (p.etat === "termine") bloc.append(element("p", { classe: "badge obtenu", texte: `✓ ${t("vacancesTermine")}` }));
  else if (p.etat === "periode-finie") bloc.append(element("p", { texte: t("vacancesPeriodeFinie", { n: p.restantes }) }));
  else if (a?.type === "notion") {
    bloc.append(element("p", { classe: "vacances-du-jour", texte: t("vacancesNotionDuJour", { titre: notionParId(a.notion)?.titre ?? a.notion }) }), journeeVacances(cahier, a.notion));
  } else if (a?.type === "revision") {
    const reviser = element("button", { classe: "bouton petit-bouton", cle: "vacancesDefiBouton", attributs: { type: "button" } });
    reviser.addEventListener("click", () => { $("#lecture-cahier").close(); naviguer("defi"); });
    bloc.append(element("p", { cle: "vacancesJourRevision" }), reviser);
  } else {
    const cle = a?.type === "faite" ? "vacancesJourFait" : a?.type === "avant" ? "vacancesAvant" : "vacancesRepos";
    bloc.append(element("p", { texte: t(cle, { date: a?.prochain ? dateLisible(a.prochain) : "" }) }));
  }
  if (p.horsPlanning) bloc.append(element("p", { classe: "doux petit", texte: t("vacancesHorsPlanning", { n: p.horsPlanning }) }));
  const suite = p.jours.filter((j) => j.date !== jour || a?.type !== "notion").slice(0, 7);
  if (suite.length) {
    bloc.append(element("h4", { cle: "vacancesProchainsJours" }));
    const liste = element("ul", { classe: "vacances-jours" });
    for (const j of suite) {
      liste.append(element("li", { texte: `${dateLisible(j.date, { weekday: "short", day: "numeric", month: "short" })} · ${j.type === "notion" ? notionParId(j.notion)?.titre ?? j.notion : t("vacancesJourneeRevision")}` }));
    }
    bloc.append(liste);
  }
  bloc.append(element("p", { classe: "doux petit", cle: "vacancesSansPenalite" }));
  return bloc;
}

function brancherCahiers() {
  document.querySelectorAll("[data-cahier-type]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.cahierType === "vacances") ouvrirConstructeurVacances();
    else if (TYPES_CAHIERS.includes(b.dataset.cahierType)) ouvrirConstructeur(b.dataset.cahierType);
  }));
  brancherVacances();
  $("#cahier-matiere").addEventListener("change", () => { remplirNiveauxCahier(); rendreNotionsCahier(); });
  $("#cahier-niveau").addEventListener("change", rendreNotionsCahier);
  $("#cahier-notions").addEventListener("change", limiterNotionsCahier);
  $("#formulaire-cahier").addEventListener("submit", construireCahier);
  brancherDialogue($("#constructeur-cahier"), $("#fermer-constructeur"));
  brancherLectureCahier();
  $("#liste-cahiers").addEventListener("click", (e) => {
    const ouvrir = e.target.closest("[data-ouvrir-cahier]");
    if (ouvrir) { ouvrirLectureCahier(ouvrir.dataset.ouvrirCahier); return; }
    const bouton = e.target.closest("[data-supprimer-cahier]");
    if (!bouton) return;
    enregistrerCahiers(cahiersEnregistres().filter((c) => c.id !== bouton.dataset.supprimerCahier));
    rendreCahiers();
  });
}

/* ---------- Tableau de bord : données de la session ---------- */

const notionParId = (id) => etat.notions.find((n) => n.id === id) ?? null;
function bouton(cle, icone, classe = "bouton") {
  const b = element("button", { classe, attributs: { type: "button" } });
  b.append(element("span", { cle }));
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "ico"); svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${icone}`);
  svg.append(use);
  b.append(svg);
  return b;
}

function rafraichirTableau() {
  if (!etat.progres || !etat.textes.titre) return;
  const pseudo = etat.pseudo ?? "";
  rafraichirEntete();
  const { niveau } = progression.niveau(etat.progres);
  document.querySelectorAll("[data-profil=initiale]").forEach((n) => { n.textContent = profil.initiale(pseudo); });
  document.querySelectorAll("[data-profil=pseudo]").forEach((n) => { n.textContent = pseudo || t("anonyme"); });
  document.querySelectorAll("[data-profil=niveau]").forEach((n) => { n.textContent = t("niveauLong", { n: niveau }); });
  rendreReprendre();
  rendreSuggestion();
  rendreEntrees();
  rendreApercu();
  rendrePilotes();
  rendreCahiers();
  rendreJeux();
  if (etat.ecran === "progression") rendreProgression();
  const defiFait = etat.progres.defiJour === progression.jourLocal();
  $("#meta-defi").textContent = defiFait ? t("defiFaitAujourdhui") : t("xpGagne", { n: 5 * progression.XP_DEFI_BONNE });
  $("#minilab-page").hidden = etat.notions.length > 0 && !notionParId("trigo-cercle");
}

/* ---------- Jeux : uniquement les jeux publiés au catalogue ---------- */

function rendreJeux() {
  if (!etat.progres || !etat.textes.titre) return;
  const jeux = etat.registre.deType("jeu");
  const filtre = sansAccents($("#recherche-jeu").value.trim());
  const selection = jeux.filter((n) => sansAccents(n.titre).includes(filtre));
  const grille = $("#grille-jeux");
  grille.replaceChildren();
  $("#jeux-compteur").textContent = jeux.length ? t("jeuxCompteur", { n: selection.length, m: jeux.length }) : "";
  $("#jeux-vide").hidden = selection.length > 0;
  $("#jeux-vide").textContent = t(!etat.notions.length ? "catalogueIndisponible" : jeux.length ? "aucunJeu" : "jeuxIndisponibles");
  for (const jeu of selection) {
    const carte = element("article", { classe: "carte jeu-carte" });
    carte.append(element("h3", { texte: jeu.titre }));
    if (jeu.resume) carte.append(element("p", { classe: "doux", texte: jeu.resume }));
    // « Reprendre » seulement si une partie est réellement enregistrée sur cet appareil.
    const partie = Boolean(etat.trophees[jeu.id]);
    if (progression.estDecouverte(etat.progres, "jeu", jeu.id)) carte.append(element("span", { classe: "pastille ok", cle: "jeuDejaLance" }));
    const ouvrir = element("button", { classe: "bouton", cle: partie ? "reprendreBouton" : "jouer", attributs: { type: "button", "data-jeu": jeu.id } });
    ouvrir.setAttribute("aria-label", `${t(partie ? "reprendreBouton" : "jouer")} : ${jeu.titre}`);
    ouvrir.addEventListener("click", () => ouvrirNotion(jeu));
    carte.append(ouvrir);
    grille.append(carte);
  }
}

/* ---------- Accueil : une prochaine action, deux entrées, un aperçu ---------- */

function filAriane(n) {
  const fil = element("div", { classe: "fil-ariane" });
  fil.append(element("span", { cle: `matiere_${matiereDe(n)}` }), element("span", { texte: "›", attributs: { "aria-hidden": "true" } }),
    element("b", { cle: `niveau_${NIVEAUX.includes(n.niveau) ? n.niveau : "autres"}` }));
  return fil;
}

/** « Reprendre » n'apparaît que si la dernière expérience ouverte existe encore au catalogue. */
function rendreReprendre() {
  const zone = $("#reprendre-contenu");
  const derniere = etat.progres.derniere;
  const n = derniere ? etat.registre.trouver(derniere.id) : null;
  // Une seule prochaine action : une recommandation fondée sur la maîtrise (issue #186) passe avant « Reprendre ».
  $("#reprendre").hidden = !n || Boolean(recommandationCourante());
  zone.replaceChildren();
  if (!n) return;
  if (n.type === "jeu") zone.append(element("span", { classe: "fil-ariane", cle: "navJeux" }));
  else zone.append(filAriane(n));
  zone.append(element("h3", { texte: n.titre }));
  const b = bouton("reprendreBouton", "i-lecture");
  b.addEventListener("click", () => ouvrirNotion(n));
  zone.append(b);
}

/**
 * Recommandation déterministe (issue #186) : révision due, ou notion dont tous les prérequis sont maîtrisés, d'après la
 * maîtrise locale (issue #185). null tant que rien n'est maîtrisé : l'accueil garde alors sa suggestion habituelle.
 */
function recommandationCourante() {
  const derniere = notionParId(etat.progres?.derniereNotion);
  const jour = progression.jourLocal();
  return recommandation.recommander({
    notions: etat.notions, matiere: derniere ? matiereDe(derniere) : undefined,
    maitrise: (id) => evenements.maitriseNotion(etat.evenements?.notions?.[id], jour)
  });
}

/** Raison affichée d'une recommandation, traduite (titres en liste naturelle, date lisible). */
function texteRaison({ cle, variables }) {
  if (cle === "recoPrerequis") {
    const liste = new Intl.ListFormat(etat.langue, { type: "conjunction" }).format(variables.prerequis.map((p) => `« ${p} »`));
    return t(cle, { prerequis: liste });
  }
  const date = new Date(`${variables.date}T00:00:00`).toLocaleDateString(etat.langue, { day: "numeric", month: "long" });
  return t(cle, { titre: variables.titre, date });
}

/** Prochaine notion : même matière et même niveau que la dernière ouverte, sinon même matière, sinon le cercle trigo. */
function prochaineNotion() {
  const vues = new Set(etat.progres.notions);
  const libres = etat.registre.deType("notion").filter((n) => !vues.has(n.id));
  const derniere = notionParId(etat.progres.derniereNotion);
  if (derniere) {
    return libres.find((n) => matiereDe(n) === matiereDe(derniere) && n.niveau === derniere.niveau)
      ?? libres.find((n) => matiereDe(n) === matiereDe(derniere)) ?? libres[0] ?? null;
  }
  return libres.find((n) => n.id === "trigo-cercle") ?? libres[0] ?? null;
}

function rendreSuggestion() {
  const zone = $("#suggestion-contenu");
  // Une seule prochaine action : la suggestion s'efface quand « Reprendre » est proposé.
  $("#suggestion").hidden = !$("#reprendre").hidden;
  zone.replaceChildren();
  const reco = recommandationCourante();
  if (reco) {
    const revision = reco.raison.cle === "recoRevision";
    zone.append(element("p", { texte: texteRaison(reco.raison), attributs: { "data-reco": reco.raison.cle } }));
    const encart = element("div", { classe: "encart" });
    encart.append(element("span", { classe: "sur-titre", cle: revision ? "recoRevisionSurTitre" : "suggestionActivite" }), element("h3", { texte: reco.notion.titre }));
    const meta = element("p", { classe: "meta" });
    meta.append(filAriane(reco.notion));
    encart.append(meta);
    const b = bouton(revision ? "recoReviser" : "commencer", "i-lecture");
    b.addEventListener("click", () => ouvrirNotion(reco.notion));
    encart.append(b);
    zone.append(encart, element("p", { classe: "doux petit", cle: "recoNote" }));
    return;
  }
  const n = prochaineNotion();
  const derniere = notionParId(etat.progres.derniereNotion);
  if (!n) {
    zone.append(element("p", { cle: etat.notions.length ? "suggestionAucune" : "catalogueIndisponible" }));
    const b = bouton("activiteQuestionBouton", "i-bulle", "bouton doux-bouton");
    b.dataset.action = "question";
    zone.append(b);
    return;
  }
  zone.append(element("p", { texte: derniere
    ? t("suggestionRaisonSuite", { matiere: t(`matiere_${matiereDe(derniere)}`), titre: derniere.titre })
    : t("suggestionRaisonDebut") }));
  const encart = element("div", { classe: "encart" });
  encart.append(element("span", { classe: "sur-titre", cle: "suggestionActivite" }), element("h3", { texte: n.titre }));
  const meta = element("p", { classe: "meta" });
  meta.append(filAriane(n), element("span", { classe: "xp", texte: t("xpGagne", { n: progression.XP_NOTION }) }));
  encart.append(meta);
  const b = bouton("commencer", "i-lecture");
  b.addEventListener("click", () => ouvrirNotion(n));
  encart.append(b);
  zone.append(encart);
}

function rendreEntrees() {
  const notions = etat.registre.deType("notion");
  const matieres = new Set(notions.map((n) => n.matiere)).size;
  const jeux = etat.registre.deType("jeu").length;
  $("#entree-education").textContent = notions.length ? t("entreeEducation", { n: notions.length, m: matieres }) : "";
  $("#entree-jeux").textContent = jeux ? t("entreeJeux", { n: jeux }) : "";
}

/** Aperçu compact : n'apparaît qu'une fois qu'il y a quelque chose de réel à montrer. */
function rendreApercu() {
  if (!etat.progres || !etat.textes.titre) return;
  const c = experiences.compteurs(etat.progres, etat.registre);
  const morceaux = [
    c.tempsActif >= 60_000 ? t("apercuTemps", { duree: formaterDuree(c.tempsActif) }) : null,
    c.notions ? t("apercuNotions", { n: c.notions }) : null,
    c.jeux ? t("apercuJeux", { n: c.jeux }) : null
  ].filter(Boolean);
  $("#apercu-progression").hidden = !morceaux.length;
  $("#apercu-progression-texte").textContent = morceaux.join(" · ");
}

/* ---------- Progression : tableau de bord personnel, qui grandit avec l'usage ---------- */

function rendreProgression() {
  const p = etat.progres;
  if (!p || !etat.textes.titre) return;
  const c = experiences.compteurs(p, etat.registre);
  const serie = progression.serieCourante(p);
  const tuiles = [
    ["compteurTemps", c.tempsActif >= 60_000 ? formaterDuree(c.tempsActif) : null],
    ["statNotions", c.notions], ["compteurMatieres", c.matieres], ["compteurJeux", c.jeux],
    ["statQuestions", c.questions], ["statSerie", serie], ["compteurBadges", c.badges]
  ].filter(([, v]) => v);
  // Vide : aucune activité comptée, aucune XP et aucun module lancé (le mini-lab ou un jeu ont leurs propres trophées).
  const vide = !tuiles.length && !p.xp && !Object.keys(etat.trophees).length;
  $("#progression-vide").hidden = !vide;
  $("#vue-ensemble").hidden = vide;
  $("#compteurs").replaceChildren(...tuiles.map(([cle, valeur]) => {
    const d = element("div", { classe: "compteur", attributs: { "data-compteur": cle } });
    d.append(element("dt", { cle }), element("dd", { texte: String(valeur) }));
    return d;
  }));

  const matieres = experiences.progressionParMatiere(p, etat.registre, MATIERES);
  $("#bloc-matieres").hidden = !matieres.length;
  $("#progression-matieres").replaceChildren(...matieres.map(({ matiere, explorees, total }) => {
    const li = element("li", { classe: "progression-matiere" });
    const nom = t(`matiere_${matiere}`);
    li.append(element("span", { classe: "nom", texte: nom }), element("span", { classe: "doux", texte: t("exploreesSur", { n: explorees, m: total }) }),
      element("progress", { attributs: { max: total, value: explorees, "aria-label": `${nom} : ${t("exploreesSur", { n: explorees, m: total })}` } }));
    return li;
  }));

  $("#semaine").hidden = vide;
  if (!vide) rendreSemaine();
  rendreDecouvertes();
  $("#progres").hidden = vide || etat.ecran !== "progression";
  if (!vide) remplirProgres();
}

/** Expériences découvertes, par type ; chaque expérience n'affiche que les statistiques qui existent pour elle. */
function rendreDecouvertes() {
  const p = etat.progres;
  const notions = experiences.experiencesDecouvertes(p, etat.registre, "notion");
  const jeux = experiences.experiencesDecouvertes(p, etat.registre, "jeu");
  $("#decouvertes").hidden = !notions.length && !jeux.length;
  const zone = $("#decouvertes-liste");
  zone.replaceChildren();
  if (notions.length) {
    const parMatiere = new Map();
    for (const n of notions) parMatiere.set(n.matiere ?? "autres", [...(parMatiere.get(n.matiere ?? "autres") ?? []), n]);
    zone.append(accordeon({
      id: "decouvertes-education", niveauTitre: 3, titre: t("navEducation"), detail: t("compteNotions", { n: notions.length }),
      remplir: (panneau) => panneau.append(...[...parMatiere].sort(([a], [b]) => ordreMatiere(a, b)).map(([matiere, liste]) => accordeon({
        id: `decouvertes-${matiere}`, niveauTitre: 4, titre: t(`matiere_${matiere}`), detail: t("compteNotions", { n: liste.length }),
        remplir: (sous) => { const ul = element("ul", { classe: "liste-experiences" }); ul.append(...liste.map(ligneExperience)); sous.append(ul); }
      })))
    }));
  }
  if (jeux.length) {
    zone.append(accordeon({
      id: "decouvertes-jeux", niveauTitre: 3, titre: t("navJeux"), detail: t("compteJeux", { n: jeux.length }),
      remplir: (panneau) => { const ul = element("ul", { classe: "liste-experiences" }); ul.append(...jeux.map(ligneExperience)); panneau.append(ul); }
    }));
  }
}

function ligneExperience(x) {
  const li = element("li", { classe: "experience", attributs: { "data-type": x.type } });
  li.append(element("strong", { texte: x.titre }));
  const stats = [
    x.ouvertures ? t("statOuvertures", { n: x.ouvertures }) : null,
    x.tempsActif >= 60_000 ? formaterDuree(x.tempsActif) : null
  ].filter(Boolean);
  if (stats.length) li.append(element("span", { classe: "doux petit", texte: stats.join(" · ") }));
  // Statistiques propres au module (victoires, record, grades…), seulement s'il en a transmis.
  const module = etat.trophees[x.id];
  if (module) li.append(chiffresModule(module));
  const n = etat.registre.trouver(x.id);
  if (n) {
    const b = element("button", { classe: "secondaire petit-bouton", cle: "rouvrir", attributs: { type: "button", "data-experience": x.id } });
    b.setAttribute("aria-label", `${t("rouvrir")} : ${x.titre}`);
    b.addEventListener("click", () => ouvrirNotion(n));
    li.append(b);
  }
  return li;
}

function rendreSemaine() {
  const jours = progression.activite(etat.progres);
  const kpi = progression.indicateurs(etat.progres);
  $("#kpi-xp-total").textContent = String(kpi.xpTotal);
  $("#kpi-xp-30-jours").textContent = String(kpi.xp30Jours);
  $("#kpi-jours-actifs-30-jours").textContent = String(kpi.joursActifs30Jours);
  $("#kpi-meilleure-journee-30-jours").textContent = String(kpi.meilleureJournee30Jours);
  const somme = (cle) => jours.reduce((total, j) => total + j[cle], 0);
  const actifs = jours.filter((j) => j.q + j.n + j.xp + j.s > 0).length;
  const date = (j, options) => new Intl.DateTimeFormat(etat.langue, options).format(new Date(`${j}T12:00:00`));
  $("#semaine-periode").textContent = t("semainePeriode", { debut: date(jours[0].jour, { day: "numeric", month: "long" }), fin: date(jours[6].jour, { day: "numeric", month: "long" }) });
  const chiffres = $("#chiffres-semaine");
  chiffres.replaceChildren(...[
    ["semaineTemps", somme("s") >= 60_000 ? formaterDuree(somme("s")) : null],
    ["statQuestions", String(somme("q"))],
    ["semaineNotions", String(somme("n"))],
    ["semaineXp", t("xpGagne", { n: somme("xp") }), "xp-chiffre"],
    ["semaineJours", t("joursSurSept", { n: actifs })]
  ].filter(([, valeur]) => valeur !== null).map(([cle, valeur, classe]) => {
    const d = element("div", { classe });
    d.append(element("dt", { cle }), element("dd", { texte: valeur }));
    return d;
  }));
  const max = Math.max(...jours.map((j) => j.xp));
  const echelle = max <= 30 ? 30 : Math.ceil(max / 20) * 20;
  const graphique = $("#graphique-semaine");
  const graduations = element("div", { classe: "graduations" });
  for (const v of [0, echelle / 2, echelle]) {
    const g = element("div");
    g.append(element("span", { texte: String(v) }));
    graduations.append(g);
  }
  const barres = element("div", { classe: "barres" });
  jours.forEach((j, i) => {
    const aujourdhui = i === jours.length - 1;
    const col = element("div", { classe: "colonne-jour" });
    const zone = element("div", { classe: "zone-barre" });
    const b = element("div", { classe: `baton${aujourdhui ? " aujourdhui" : ""}${j.xp === 0 ? " vide" : ""}` });
    b.style.height = j.xp ? `${(j.xp / echelle) * 100}%` : "2px";
    if (j.xp && (aujourdhui || j.xp === max)) b.append(element("span", { classe: "valeur", texte: String(j.xp) }));
    zone.append(b);
    col.append(zone, element("span", { classe: `jour${aujourdhui ? " aujourdhui" : ""}`, texte: aujourdhui ? t("aujourdhuiCourt") : date(j.jour, { weekday: "short" }) }));
    barres.append(col);
  });
  graphique.replaceChildren(graduations, barres);
  graphique.setAttribute("aria-label", t("graphiqueResume", { liste: jours.map((j) => `${date(j.jour, { weekday: "long" })} ${j.xp}`).join(", ") }));
  $("#semaine-vide").hidden = max > 0;
}

/* ---------- Défi express (5 défis, XP une fois par jour ; générés par l'IA si autorisé, ADR 0018) ---------- */

const NB_DEFIS = 5;
const defi = { index: 0, bonnes: 0, resultats: [], questions: [], source: "banque", raison: null, etape: null, jeton: 0 };

/** Banque fixe (i18n) : sert sans IA et complète un lot généré incomplet. */
const questionBanque = (q) => ({
  banque: q, format: "qcm", enonce: { cle: `defiQ${q}` }, explication: { cle: `defiQ${q}E` },
  choix: [1, 2, 3].map((r) => ({ cle: `defiQ${q}R${r}` })), bonne: DEFI_BONNES[q - 1]
});
const questionIa = (d) => ({
  notion: d.notion, titre: d.titre, format: d.format, enonce: { texte: d.enonce }, explication: { texte: d.explication },
  choix: d.choix.map((c) => ({ texte: c })), bonne: d.bonne
});

function generationsDefiDuJour() {
  try {
    const brut = JSON.parse(lireCle(preferences(), CLE_DEFI_COMPTE) || "null");
    return brut?.jour === progression.jourLocal() && Number.isInteger(brut.n) ? brut.n : 0;
  } catch { return 0; }
}
function noterGenerationDefi() {
  ecrireCle(preferences(), CLE_DEFI_COMPTE, JSON.stringify({ jour: progression.jourLocal(), n: generationsDefiDuJour() + 1 }));
}
/** Réglage de l'écran Configuration : générations IA voulues par jour (0 = questions fixes), plafonné par le serveur. */
function defiIaParJour() {
  const max = etat.defiIa.generationsParJour;
  const brut = lireCle(preferences(), CLE_DEFI_IA);
  const n = brut === null ? max : Number(brut);
  return Number.isInteger(n) ? Math.max(0, Math.min(max, n)) : max;
}
function defiIaRestantes() {
  const locales = Math.max(0, defiIaParJour() - generationsDefiDuJour());
  return etat.defiIa.restantesServeur === null ? locales : Math.min(locales, etat.defiIa.restantesServeur);
}
const defiIaPossible = () => etat.llmDisponible && etat.llmActif && etat.defiIa.ia && defiIaRestantes() > 0;

function rafraichirReglageDefi() {
  const select = $("#defi-ia-par-jour");
  if (!select) return;
  const max = etat.defiIa.generationsParJour;
  const options = Array.from({ length: max + 1 }, (_, n) => {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = n === 0 ? t("defiIaAucun") : t("defiIaParJour", { n });
    return o;
  });
  select.replaceChildren(...options);
  select.value = String(defiIaParJour());
  select.disabled = !etat.llmDisponible || !etat.defiIa.ia || max === 0;
  const cle = !etat.llmDisponible || !etat.defiIa.ia || max === 0 ? "defiIaIndisponible"
    : !etat.llmActif ? "defiIaConsentement" : defiIaParJour() === 0 ? "defiIaDesactive" : "defiIaRestantes";
  $("#defi-ia-etat").textContent = t(cle, { n: defiIaRestantes() });
}

/** Pourquoi le défi sert les questions fixes : affiché sous le titre pour que l'élève sache ce qui se passe. */
const RAISONS_BANQUE = {
  "ia-inactive": "defiIaConsentement",
  desactive: "defiBanqueDesactive",
  quota: "defiBanqueQuota",
  "ia-indisponible": "defiBanqueIndisponible",
  "sortie-invalide": "defiBanqueSortie",
  "perimetre-vide": "defiBanquePerimetre"
};
function raisonBanqueLocale() {
  if (!etat.llmDisponible || !etat.defiIa.ia || etat.defiIa.generationsParJour === 0) return "ia-indisponible";
  if (!etat.llmActif) return "ia-inactive";
  if (defiIaParJour() === 0) return "desactive";
  return defiIaRestantes() > 0 ? null : "quota";
}

/* ---------- Configurateur du défi : périmètre choisi avant la génération ---------- */

const FORMATS_DEFI = ["qcm", "vrai-faux", "situation", "intrus"];
const CLE_DEFI_PERIMETRE = "kermiclab:defi:perimetre";
const niveauDe = (n) => (NIVEAUX.includes(n.niveau) ? n.niveau : "autres");

/** Périmètre mémorisé sur l'appareil ; par défaut la dernière matière ouverte dans Éducation, tous niveaux et formats. */
function lirePerimetreDefi() {
  let brut = null;
  try { brut = JSON.parse(lireCle(preferences(), CLE_DEFI_PERIMETRE) || "null"); } catch { brut = null; }
  const texte = (v) => (typeof v === "string" ? v : "");
  const formats = Array.isArray(brut?.formats) ? FORMATS_DEFI.filter((f) => brut.formats.includes(f)) : [];
  return {
    niveau: texte(brut?.niveau), matiere: brut ? texte(brut.matiere) : (etat.matiere ?? ""), notion: texte(brut?.notion),
    formats: formats.length ? formats : [...FORMATS_DEFI]
  };
}

/** Notions du catalogue dans le périmètre (mêmes règles que le serveur : jeux exclus). */
function notionsDefi({ niveau = "", matiere = "", notion = "" } = {}) {
  return etat.notions.filter((n) => n.matiere !== "jeux"
    && (!niveau || niveauDe(n) === niveau) && (!matiere || n.matiere === matiere) && (!notion || n.id === notion));
}

function remplirSelect(select, cleTous, options, valeur) {
  const tous = element("option", { cle: cleTous, attributs: { value: "" } });
  select.replaceChildren(tous, ...options.map(([v, texte]) => element("option", { texte, attributs: { value: v } })));
  select.value = options.some(([v]) => v === valeur) ? valeur : "";
}

function afficherConfigurateurDefi() {
  defi.etape = "config";
  const p = lirePerimetreDefi();
  const form = element("form", { classe: "defi-config", attributs: { id: "defi-config", novalidate: "" } });
  const champ = (id, cle) => {
    const bloc = element("div", { classe: "defi-config-champ" });
    const select = element("select", { attributs: { id, name: id } });
    bloc.append(element("label", { classe: "etiquette-champ", cle, attributs: { for: id } }), select);
    form.append(bloc);
    return select;
  };
  form.append(element("p", { classe: "doux", cle: "defiConfigIntro" }));
  const niveau = champ("defi-niveau", "defiConfigNiveau");
  const matiere = champ("defi-matiere", "defiConfigMatiere");
  const notion = champ("defi-notion", "defiConfigNotion");
  const formats = element("fieldset", { classe: "defi-config-formats", attributs: { "aria-describedby": "defi-config-erreur" } });
  formats.append(element("legend", { classe: "etiquette-champ", cle: "defiConfigFormats" }));
  for (const f of FORMATS_DEFI) {
    const label = element("label");
    const caseFormat = element("input", { attributs: { type: "checkbox", name: "defi-format", value: f } });
    caseFormat.checked = p.formats.includes(f);
    label.append(caseFormat, element("span", { cle: `defiFormat_${f}` }));
    formats.append(label);
  }
  const resume = element("p", { classe: "doux petit", attributs: { id: "defi-config-resume", role: "status" } });
  const erreur = element("p", { classe: "erreur-champ", attributs: { id: "defi-config-erreur", "aria-live": "assertive" } });
  const lancer = element("button", { classe: "bouton", attributs: { type: "submit", id: "defi-lancer" } });
  lancer.append(element("span", { cle: "defiLancer" }));
  const actions = element("div", { classe: "defi-suite" });
  actions.append(lancer);
  form.append(formats, resume, erreur, actions);

  const lire = () => ({
    niveau: niveau.value, matiere: matiere.value, notion: notion.value,
    formats: [...form.querySelectorAll("input[name=defi-format]:checked")].map((c) => c.value)
  });
  // Listes en cascade : matières du niveau choisi, notions du niveau et de la matière choisis.
  const actualiser = (choix) => {
    const niveaux = NIVEAUX.filter((v) => notionsDefi({ niveau: v }).length);
    remplirSelect(niveau, "defiConfigTousNiveaux", niveaux.map((v) => [v, t(`niveau_${v}`)]), choix.niveau);
    const matieres = [...new Set(notionsDefi({ niveau: niveau.value }).map((n) => n.matiere))].sort(ordreMatiere);
    remplirSelect(matiere, "defiConfigToutesMatieres", matieres.map((v) => [v, t(`matiere_${v}`)]), choix.matiere);
    const notions = notionsDefi({ niveau: niveau.value, matiere: matiere.value });
    remplirSelect(notion, "defiConfigToutesNotions", notions.map((n) => [n.id, n.titre]), choix.notion);
    const n = notionsDefi(lire()).length;
    resume.textContent = t("defiConfigResume", { n, r: defiIaRestantes() });
    erreur.textContent = "";
    lancer.disabled = n === 0;
  };
  actualiser(p);
  form.addEventListener("change", () => actualiser(lire()));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const choix = lire();
    if (!choix.formats.length) { erreur.textContent = t("defiConfigFormatsRequis"); return; }
    if (!notionsDefi(choix).length) return;
    ecrireCle(preferences(), CLE_DEFI_PERIMETRE, JSON.stringify(choix));
    void lancerDefiIa(choix);
  });
  $("#defi-corps").replaceChildren(form);
  rafraichirDefiTextes();
  rafraichirReglageDefi();
}

/** Ouverture du défi : configurateur si l'IA peut préparer des défis inédits, sinon questions fixes avec la raison. */
function ouvrirDefi() {
  ++defi.jeton;
  defi.index = 0; defi.bonnes = 0; defi.resultats = [];
  defi.source = "banque";
  defi.raison = raisonBanqueLocale();
  if (defiIaPossible() && notionsDefi().length) { afficherConfigurateurDefi(); return; }
  void afficherQuestionsDefi([]);
}

/* ---------- Révisions des notions dans le défi express (issue #187) ---------- */

const MAX_REVISIONS_DEFI = 3;
const contenusDefi = new Map();

/** Exercice QCM d'une notion d'après son identifiant d'événement : app-N (onglet application), defi-N (mise en situation). */
function exerciceDuContenu(contenu, exercice) {
  const [, genre, rang] = exercice.match(/^(app|defi)-(\d+)$/) ?? [];
  if (!genre) return null;
  const liste = genre === "app" ? contenu?.application?.exercices : contenu?.situation?.etapes;
  const ex = liste?.[Number(rang) - 1];
  const valide = ex?.type === "qcm" && Array.isArray(ex.choix) && ex.choix.length >= 2 && ex.choix.length <= 5
    && ex.choix.every((c) => typeof c === "string") && Number.isInteger(ex.bonne) && ex.bonne >= 0 && ex.bonne < ex.choix.length;
  return valide ? ex : null;
}

/**
 * Révisions dues des notions (cartes de Leitner du module partagé), transformées en questions du défi. Seuls les QCM
 * sont repris (le défi n'a pas de saisie de nombre) ; contenus lus dans dist/contenus/, même origine, mis en cache.
 */
async function questionsRevisionDefi() {
  const dues = evenements.revisionsDues(etat.evenements, progression.jourLocal(), ProgressionJeux.cartesDues);
  const questions = [];
  for (const { notion, exercice } of dues) {
    if (questions.length >= MAX_REVISIONS_DEFI) break;
    if (!contenusDefi.has(notion)) {
      try { contenusDefi.set(notion, await chargerJson(`contenus/${encodeURIComponent(notion)}.json`)); } catch { contenusDefi.set(notion, null); }
    }
    const ex = exerciceDuContenu(contenusDefi.get(notion), exercice);
    if (!ex) continue;
    questions.push({
      format: "qcm", revision: { notion, exercice }, notion, titre: notionParId(notion)?.titre ?? notion,
      enonce: { texte: ex.question }, explication: { texte: ex.explication ?? "" }, choix: ex.choix.map((c) => ({ texte: c })), bonne: ex.bonne
    });
  }
  return questions;
}

async function afficherQuestionsDefi(generes) {
  const jeton = defi.jeton;
  const revisions = await questionsRevisionDefi();
  if (jeton !== defi.jeton) return;
  defi.etape = "questions";
  const banque = [1, 2, 3, 4, 5].map(questionBanque);
  defi.questions = [...revisions, ...generes, ...banque].slice(0, NB_DEFIS);
  rendreQuestionDefi();
  rafraichirDefiTextes();
  rafraichirReglageDefi();
}

async function lancerDefiIa(perimetre) {
  const jeton = ++defi.jeton;
  let generes = [];
  defi.etape = "chargement";
  $("#defi-corps").replaceChildren(element("p", { classe: "defi-chargement doux", cle: "defiChargement", attributs: { role: "status" } }));
  rafraichirDefiTextes();
  try {
    const r = await fetch(`${etat.config.apiUrl}/api/defi`, {
      method: "POST", credentials: "include", headers: { "content-type": "application/json", ...enteteFamille() },
      body: JSON.stringify({
        langue: etat.langue, niveau: perimetre.niveau || null, matiere: perimetre.matiere || null,
        notion: perimetre.notion || null, formats: perimetre.formats, utiliserLlm: true
      })
    });
    const d = await r.json();
    if (jeton !== defi.jeton) return;
    if (Number.isInteger(d.quota?.restantes)) etat.defiIa.restantesServeur = d.quota.restantes;
    defi.raison = RAISONS_BANQUE[d.raison] ? d.raison : "ia-indisponible";
    if (d.source === "ia" && Array.isArray(d.defis)) {
      generes = d.defis.slice(0, NB_DEFIS).map(questionIa);
      defi.source = "ia";
      noterGenerationDefi();
    }
  } catch {
    defi.raison = "ia-indisponible";
    console.error("défi IA indisponible");
  }
  if (jeton !== defi.jeton) return;
  void afficherQuestionsDefi(generes);
}

function rafraichirDefiTextes() {
  const fait = etat.progres.defiJour === progression.jourLocal();
  $("#defi-sur-titre").textContent = fait ? t("defiFaitAujourdhui") : t("defiSurTitre", { n: NB_DEFIS * progression.XP_DEFI_BONNE });
  const compteur = $("#defi .defi-haut .math");
  if (compteur) compteur.textContent = t("defiProgression", { n: defi.index + 1, m: defi.questions.length });
  const source = $("#defi-source");
  if (source) {
    const cle = defi.etape === "config" || defi.etape === "chargement" ? "defiConfigSource"
      : defi.source === "ia" ? "defiSourceIa" : RAISONS_BANQUE[defi.raison] ?? "defiSourceBanque";
    source.textContent = t(cle);
  }
}

function pointsDefi() {
  const zone = element("div", { classe: "defi-points", attributs: { "aria-hidden": "true" } });
  defi.questions.forEach((_, i) => {
    const r = defi.resultats[i];
    zone.append(element("i", { classe: r === true ? "juste" : r === false ? "faux" : i === defi.index ? "courant" : "" }));
  });
  return zone;
}

function rendreQuestionDefi() {
  const corps = $("#defi-corps");
  const item = defi.questions[defi.index];
  const haut = element("div", { classe: "defi-haut" });
  haut.append(pointsDefi(), element("span", { classe: "doux petit math", texte: t("defiProgression", { n: defi.index + 1, m: defi.questions.length }) }));
  const etiquette = element("p", { classe: "defi-etiquette doux petit" });
  if (item.revision) etiquette.append(element("span", { classe: "defi-revision", cle: "defiRevision", attributs: { "data-revision": item.revision.notion } }), document.createTextNode(" · "));
  etiquette.append(element("span", { cle: `defiFormat_${item.format}` }));
  if (item.titre) etiquette.append(element("span", { texte: ` · ${item.titre}` }));
  const question = element("p", { classe: "defi-question", ...item.enonce, attributs: { id: "defi-question" } });
  const reponses = element("div", { classe: "reponses", attributs: { role: "group", "aria-labelledby": "defi-question" } });
  item.choix.forEach((c, i) => {
    const b = element("button", { classe: "reponse", attributs: { type: "button" } });
    b.append(element("span", { classe: "lettre", texte: "ABCDE"[i], attributs: { "aria-hidden": "true" } }), element("span", c));
    b.addEventListener("click", () => repondreDefi(i));
    reponses.append(b);
  });
  corps.replaceChildren(haut, etiquette, question, reponses, element("div", { attributs: { id: "defi-retour", "aria-live": "assertive" } }));
}

function repondreDefi(choix) {
  const item = defi.questions[defi.index];
  const juste = choix === item.bonne;
  defi.resultats[defi.index] = juste;
  if (juste) defi.bonnes += 1;
  if (item.revision) {
    // Révision d'un exercice de notion : sa carte de Leitner est replanifiée (juste → boîte suivante, faux → boîte 1).
    etat.evenements = evenements.reviser(etat.evenements, { ...item.revision, correct: juste, jour: progression.jourLocal(), planifier: ProgressionJeux.planifierCarte });
    evenements.sauver(stockage(), etat.evenements);
  }
  document.querySelectorAll("#defi .reponse").forEach((b, i) => {
    b.disabled = true;
    b.classList.add(i === item.bonne ? "juste" : i === choix ? "faux" : "estompee");
  });
  $("#defi .defi-points").replaceWith(pointsDefi());
  const retour = element("div", { classe: `retour-defi ${juste ? "juste" : "faux"}` });
  retour.append(element("strong", { cle: juste ? "defiJuste" : "defiFaux" }), element("span", item.explication));
  const fin = defi.index === defi.questions.length - 1;
  const suite = element("div", { classe: "defi-suite" });
  if (item.notion) {
    const revoir = element("button", { classe: "bouton secondaire-bouton", cle: "defiRevoirNotion", attributs: { type: "button" } });
    revoir.addEventListener("click", () => ouvrirNotion(notionParId(item.notion) ?? { id: item.notion, titre: item.titre }));
    const signaler = element("button", { classe: "bouton secondaire-bouton", cle: "defiSignaler", attributs: { type: "button" } });
    signaler.addEventListener("click", ouvrirSignalement);
    suite.append(signaler, revoir);
  }
  const b = bouton(fin ? "defiResultat" : "defiSuivante", "i-fleche");
  b.addEventListener("click", () => { if (fin) terminerDefi(); else { defi.index += 1; rendreQuestionDefi(); $("#defi .reponse")?.focus(); } });
  suite.append(b);
  $("#defi-retour").replaceChildren(retour, suite);
  b.focus();
}

function terminerDefi() {
  const resultat = progression.enregistrerDefi(etat.progres, defi.bonnes);
  appliquerResultat(resultat);
  const bloc = element("div", { classe: "resultat-defi" });
  const total = defi.questions.length;
  const general = defi.source === "ia" ? "General" : "";
  const message = `${defi.bonnes === total ? "defiParfait" : defi.bonnes >= 3 ? "defiBien" : "defiEncore"}${general}`;
  bloc.append(pointsDefi(), element("div", { classe: "score", texte: `${defi.bonnes}/${total}` }), element("p", { cle: message }),
    element("span", { classe: "pastille ok", ...(resultat.xpGagne ? { texte: t("xpGagne", { n: resultat.xpGagne }) } : { cle: "defiDejaFait" }) }));
  const actions = element("div", { classe: "defi-suite" });
  const recommencer = element("button", { classe: "bouton secondaire-bouton", cle: "defiRecommencer", attributs: { type: "button" } });
  recommencer.addEventListener("click", () => ouvrirDefi());
  const terminer = element("button", { classe: "bouton", cle: "defiTerminer", attributs: { type: "button" } });
  terminer.addEventListener("click", () => naviguer("education"));
  actions.append(recommencer, terminer);
  bloc.append(actions);
  $("#defi-corps").replaceChildren(bloc);
  terminer.focus();
}

demarrer();
