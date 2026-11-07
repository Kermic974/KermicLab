// Interface Kermiclab : tableau de bord élève avec un chat flottant.
// Aucun texte en dur : tout vient de i18n/<langue>.json. Toutes les données affichées viennent de la session en cours
// (pseudo, progression) : rien n'est envoyé à Kermiclab (ADR 0012).
import * as progression from "./progression.js";
import * as profil from "./profil.js";
import * as comptes from "./comptes.js";
import * as compteLocal from "./compte-local.js";
import * as demoFamille from "./demo-famille.js";
import * as contributions from "./contributions.js";
import * as demoContrib from "./demo-contributions.js";
import { monterCercle } from "./cercle.js";
import * as trophees from "./trophees.js";
import * as evenements from "./evenements.js";
import * as experiences from "./experiences.js";
import { creerMoteurTemps } from "./temps-actif.js";

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
  for (const cle of [CLE_DEMO_ACTIVE, demoFamille.CLE_DEMO, CLE_DEMO_CONTRIB_ACTIVE, demoContrib.CLE_DEMO]) effacerCle(sessionPreferences(), cle);
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

/** « Continuer avec Google / Microsoft » : connexion simulée en démonstration, sinon OAuth si le fournisseur est configuré. */
async function connecterParent(fournisseur) {
  if (demoActive()) {
    sauverDemo(demoFamille.connecter(etat.demo, fournisseur));
    await verifierConnexion();
    notifier(t("demoConnecte"), "🟢");
    return;
  }
  $("#famille-etat").textContent = t("familleChargement");
  try {
    const r = await fetch(urlApi("/auth/fournisseurs"), { cache: "no-store" });
    const disponibles = r.ok ? await r.json() : {};
    if (disponibles[fournisseur] === true) { window.location.href = urlApi(`/auth/login?provider=${fournisseur}`); return; }
  } catch { /* service des comptes injoignable */ }
  $("#famille-etat").textContent = t("connexionIndisponible");
  $("#essayer-demo").hidden = false;
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
  $("#ouvrir-famille").addEventListener("click", () => { $("#dialogue-profil").close(); naviguer("famille"); });
  rafraichirFamille();
}

/* ---------- Mon compte (ADR 0024) ---------- */
// Compte facultatif : identifiant + mot de passe, enregistré sur l'appareil (vérificateur PBKDF2, jamais le mot de
// passe). La synchronisation, sur demande, envoie un instantané chiffré sous un pseudonyme dérivé d'une phrase secrète
// qui ne quitte pas l'appareil. Aucun appel au Worker tant que l'utilisateur n'active pas ou n'utilise pas la synchro.
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
  $("#compte-creation").hidden = !!e;
  $("#compte-connexion").hidden = !e || !!s;
  $("#compte-ouvert").hidden = !e || !s;
  if (e && !s) $("#compte-connexion-texte").textContent = t("compteConnexionTexte", { identifiant: e.identifiant });
  if (!e || !s) return;
  const active = !!e.synchro;
  const deverrouillee = active && !!s.synchro;
  $("#compte-ouvert-texte").textContent = t("compteConnecte", { identifiant: e.identifiant });
  $("#synchro-statut").textContent = !active ? t("synchroInactive")
    : !deverrouillee ? t("synchroVerrouillee")
      : t("synchroActive", { version: e.synchro.version, maj: e.synchro.maj ? t("synchroMaj", { date: e.synchro.maj }) : "" });
  $("#synchro-activation").hidden = active;
  $("#synchro-deverrouillage").hidden = !active || deverrouillee;
  $("#synchro-actions").hidden = !deverrouillee;
  $("#compte-suppression-aide").textContent = t(!active ? "compteSuppressionAide" : deverrouillee ? "compteSuppressionAideSynchro" : "compteSuppressionAideVerrouille");
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
    compteEtat.enregistrement = await compteLocal.creerEnregistrement(id.identifiant, mdp);
    compteEtat.session = { identifiant: id.identifiant, synchro: null };
    sauverCompte();
  } finally {
    compteEtat.occupe = false;
  }
  $("#formulaire-compte-creer").reset();
  marquerReglesMdp();
  rafraichirCompte();
  notifier(t("compteCree"), "🔐");
}

async function connecterCompteLocal(ev) {
  ev.preventDefault();
  const e = compteEtat.enregistrement;
  const mdp = $("#compte-connexion-mdp").value;
  if (!erreurChamp("compte-connexion-mdp", mdp ? "" : t("compteMdpRequis"), "compte-connexion-erreur")) return;
  if (!erreurChamp("compte-connexion-mdp", await compteLocal.verifierMotDePasse(mdp, e) ? "" : t("compteMdpIncorrect"), "compte-connexion-erreur")) return;
  compteEtat.session = { identifiant: e.identifiant, synchro: null };
  sauverCompte();
  $("#formulaire-compte-connexion").reset();
  rafraichirCompte();
  notifier(t("compteConnecte", { identifiant: e.identifiant }), "🔓");
}

function deconnecterCompteLocal() {
  const jeton = compteEtat.session?.synchro?.jetonServeur;
  if (jeton) void apiCompte("deconnexion", { jeton }).catch(() => {});
  compteEtat.session = null;
  sauverCompte();
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
    if (e.synchro) {
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

/* ---------- Contributions au contenu des notions (ADR 0023) ---------- */
// Rôles contributeur et prof, scénario sans IA. Rien n'est appelé côté Worker tant que `connexionActive` vaut false ;
// `?demo=contributions` simule les deux rôles dans l'onglet (web/demo-contributions.js), sans OAuth ni réseau.
const CLE_DEMO_CONTRIB_ACTIVE = "kermiclab:demo-contributions:active";
const contrib = {
  demo: false, etatDemo: null, chargee: false, erreur: false, miennes: [], relecture: [],
  index: null, contenus: new Map(), filtre: { statut: "proposee", notion: "", matiere: "" }, edition: null,
  bulle: { notion: null, cible: null }
};
const demoContribActive = () => contrib.demo === true;
const contributionsActives = () => demoContribActive() || etat.config?.connexionActive === true;

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

/** Accès aux contributions : le Worker, ou le double de démonstration (mêmes formes de réponse). */
const apiContrib = {
  compte() {
    if (demoContribActive()) return demoContrib.moi(contrib.etatDemo).compte ?? null;
    return etat.compte;
  },
  async lister(vue) {
    if (demoContribActive()) return demoContrib.lister(contrib.etatDemo, vue);
    return reponseContrib(await fetch(urlApi(`/api/contributions?vue=${vue}`), { credentials: "include" }));
  },
  async creer(donnees) {
    if (demoContribActive()) {
      const r = demoContrib.creer(contrib.etatDemo, donnees);
      if (r.erreurs) throw new ErreurContrib(r.erreurs.quota ? "quota-atteint" : "contribution-invalide", r.erreurs);
      sauverDemoContrib(r.etat);
      return r.id;
    }
    return (await reponseContrib(await fetch(urlApi("/api/contributions"), {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(donnees)
    }))).id;
  },
  async agir(id, corps) {
    if (demoContribActive()) {
      const r = demoContrib.agir(contrib.etatDemo, id, corps);
      if (r.code) throw new ErreurContrib(r.code);
      if (r.erreurs) throw new ErreurContrib("contribution-invalide", r.erreurs);
      sauverDemoContrib(r.etat);
      return r.contribution;
    }
    return reponseContrib(await fetch(urlApi(`/api/contributions/${encodeURIComponent(id)}`), {
      method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(corps)
    }));
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
  if (!actif) return;
  const autorise = contributions.peutContribuer(role);
  $("#contrib-etat").textContent = !contrib.chargee ? t("familleChargement") : contrib.erreur ? t("familleErreur") : "";
  $("#contrib-invite").hidden = autorise;
  $("#contrib-role-requis").hidden = !compte || autorise;
  $("#contrib-demo-roles").hidden = !demoContribActive();
  $("#essayer-demo-contrib").hidden = demoContribActive();
  $("#contrib-espace").hidden = !autorise;
  if (!autorise) return;
  $("#contrib-role-nom").textContent = t(`contribRole_${role}`) + (compte.demo ? ` · ${t("demoPastille")}` : "");
  $("#contrib-role-aide").textContent = ` — ${t(contributions.peutRelire(role) ? "contribRoleAideProf" : "contribRoleAideContributeur")}`;
  $("#contrib-tableau").hidden = !contributions.peutRelire(role);
  if (contributions.peutRelire(role)) rendreTableau(compte);
  rendreListe($("#contrib-miennes"), contrib.miennes, { compte, mode: "miennes" });
  $("#contrib-miennes-vide").hidden = contrib.miennes.length > 0;
  remplirOptionsFormulaire();
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
    li.append(entete, meta, blocDiff(c));
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
    li.append(actionsContribution(c, compte, mode));
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
  contrib.bulle = { notion: null, cible: null };
  bouton.hidden = true;
  $("#bulle-edition").hidden = true;
  $("#bulle-lab").classList.remove("en-edition");
  if (!roleEdition()) return;
  const index = await indexContenus();
  if (!index.some((n) => n.id === notionId) || $("#bulle-lab").dataset.notion !== notionId) return;
  contrib.bulle.notion = notionId;
  bouton.hidden = false;
  const ouverte = lireCle(sessionPreferences(), CLE_EDITION_OUVERTE) !== "0";
  basculerEdition(ouverte, { memoriser: false });
  if (!contrib.chargee) await chargerContributions();
  await contenuNotion(notionId);
  rendreEdition();
}

function basculerEdition(ouverte, { memoriser = true } = {}) {
  $("#bulle-editer").setAttribute("aria-pressed", String(ouverte));
  $("#bulle-edition").hidden = !ouverte;
  $("#bulle-lab").classList.toggle("en-edition", ouverte);
  if (memoriser) ecrireCle(sessionPreferences(), CLE_EDITION_OUVERTE, ouverte ? "1" : "0");
}

function fermerEdition() {
  contrib.bulle = { notion: null, cible: null };
  $("#bulle-editer").hidden = true;
  $("#bulle-edition").hidden = true;
  $("#bulle-lab").classList.remove("en-edition");
  $("#edition-formulaire").hidden = true;
}

function rendreEdition() {
  const id = contrib.bulle.notion;
  const contenu = id ? contrib.contenus.get(id) : null;
  if (!contenu) { $("#edition-sections").replaceChildren(element("p", { classe: "doux", cle: "familleErreur" })); return; }
  const groupes = contributions.champsParOnglet(contenu, contributionsConnues(), id);
  const total = groupes.reduce((n, g) => n + g.champs.length, 0);
  const enCours = groupes.reduce((n, g) => n + g.champs.reduce((m, c) => m + c.enCours, 0), 0);
  $("#edition-resume").textContent = t(contributions.peutRelire(roleEdition()) ? "editionResumeProf" : "editionResume", { champs: total, n: enCours });
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
      const extrait = element("p", { classe: "doux", texte: c.valeur.length > 160 ? `${c.valeur.slice(0, 160)}…` : c.valeur });
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
  $("#bulle-editer").addEventListener("click", (e) => basculerEdition(e.currentTarget.getAttribute("aria-pressed") !== "true"));
  $("#edition-formulaire").addEventListener("submit", envoyerEdition);
  $("#edition-texte").addEventListener("input", apercuEdition);
  for (const r of document.querySelectorAll("input[name=edition-nature]")) r.addEventListener("change", apercuEdition);
  $("#edition-annuler").addEventListener("click", () => { $("#edition-formulaire").hidden = true; contrib.bulle.cible = null; });
  $("#edition-vers-contributions").addEventListener("click", () => {
    const notion = contrib.bulle.notion;
    $("#bulle-lab").addEventListener("close", () => {
      if (notion && contributions.peutRelire(roleEdition())) Object.assign(contrib.filtre, { statut: "tous", matiere: matiereNotion(notion), notion });
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
  if (!contributionsActives()) return;
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
  if (!$("#panneau-chat").hidden) li.scrollIntoView({ behavior: mouvementReduit() ? "auto" : "smooth", block: bloc });
}

function ouvrirChat() {
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

function rafraichirBienvenue() {
  const n = $("#texte-bienvenue");
  if (!n || !etat.progres) return;
  const serie = progression.serieCourante(etat.progres);
  n.textContent = etat.progres.questions > 0 && serie > 0 ? t("bienvenueRetour", { n: serie }) : t("bienvenue");
  const puces = $("#puces-bienvenue");
  if (puces) remplirPuces(puces, etat.suggestions.length ? etat.suggestions : ["suggestion1", "suggestion2", "suggestion3", "suggestion4"].map((c) => t(c)));
}

/**
 * Repart d'un fil vierge (message d'accueil et suggestions). Côté serveur, rien n'est effacé : le quota IA
 * de la session reste décompté, et aucun historique n'est envoyé au modèle de toute façon.
 */
function nouvelleConversation() {
  if (etat.envoiEnCours) return;
  $("#fil").replaceChildren();
  ajouterBienvenue();
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
const ACTIONS_ECRANS = { jeux: "navJeux", labs: "navEducation", notions: "navEducation", progression: "navProgression", badges: "mesBadges", defi: "navDefi" };

function actionsEcrans(actions) {
  // Deux actions qui mènent au même écran (labs et notions → Éducation) n'en font qu'une.
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
 * un indice, ouvertures, notion terminée. Des faits locaux, distincts des étoiles et de toute maîtrise.
 */
function activiteNotion(id) {
  const r = evenements.resumerNotion(etat.evenements?.notions?.[id]);
  if (!r || (!r.tentes && !r.ouvertures)) return null;
  const bloc = element("div", { classe: "trophee-activite", attributs: { "data-activite": id } });
  bloc.append(element("p", { classe: "doux petit", cle: "activiteTitre" }));
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
      etat.evenements = evenements.enregistrer(etat.evenements, ev, progression.jourLocal());
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
  rendreCatalogue();
  rafraichirTableau();
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
      id: `edu-${niveau}`, niveauTitre: 3, titre: t(`niveau_${niveau}`), detail: t("compteNotions", { n: total }), ouvert: Boolean(filtre),
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
  try {
    const r = await fetch(`${etat.config.apiUrl}/api/chat`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
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
  $(".pied").before($("#profil"), $("#compte"), $("#famille"), $("#contributions"), $("#defi"), $("#progres"));
  etat.config = await chargerJson("config.json");
  initialiserSession();
  etat.trophees = trophees.charger(stockage());
  etat.evenements = evenements.charger(stockage());
  brancherTrophees();
  appliquerTheme(lireCle(preferences(), CLE_THEME));
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
  brancherTestRoles();
  void verifierConnexion().then(rafraichirContributions);

  ajouterBienvenue();
  brancherTemps();
  await chargerCatalogue();
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
      method: "POST", credentials: "include", headers: { "content-type": "application/json" },
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
  document.querySelectorAll("[data-ouvrir-profil]").forEach((bouton) => bouton.addEventListener("click", ouvrirProfil));
  brancherDialogue($("#dialogue-profil"), $("#fermer-profil"));
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

function ouvrirProfil() {
  $("#profil-pseudo").value = etat.pseudo ?? "";
  $("#profil-pseudo").removeAttribute("aria-invalid");
  $("#profil-erreur").textContent = "";
  rafraichirEtatMemoire();
  reinitialiserEffacement();
  $("#dialogue-profil").showModal();
  $("#profil-pseudo").focus();
}

/* ---------- Thème ---------- */

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

/** Les 5 destinations de la navigation, puis les sous-écrans (rattachés à une destination). */
const DESTINATIONS = ["accueil", "education", "jeux", "progression", "profil"];
const ECRANS = [...DESTINATIONS, "defi", "compte"];
const PARENTS = { defi: "education", famille: "profil", compte: "profil" };
/** Anciennes adresses (#notions, #labs, #badges…) : redirigées vers la destination qui les contient. */
const ALIAS_ECRANS = { catalogue: "education", notions: "education", labs: "education", cahiers: "education", badges: "progression" };
const ANCRES_ALIAS = { badges: "#progres", cahiers: "#ecran-cahiers" };
const sectionDe = (ecran) => PARENTS[ecran] ?? ecran;

function rafraichirEntete() {
  const accueil = etat.ecran === "accueil";
  $("#salut").textContent = accueil
    ? etat.pseudo ? t("salut", { pseudo: etat.pseudo }) : t("salutAnonyme")
    : t({ education: "navEducation", jeux: "navJeux", progression: "navProgression", defi: "navDefi", profil: "navProfil", famille: "familleTitre", compte: "compteTitre", contributions: "contribTitre" }[etat.ecran]);
  $("#accroche").textContent = t(accueil ? "accroche" : `${etat.ecran}Intro`);
}

function afficherEcran(cle, { focus = true } = {}) {
  const demande = ALIAS_ECRANS[cle] ?? cle;
  const ecran = ECRANS.includes(demande) ? demande : "accueil";
  const changement = ecran !== etat.ecran;
  etat.ecran = ecran;
  if (changement && $("#bulle-lab").open) $("#bulle-lab").close();
  document.querySelectorAll("[data-ecrans]").forEach((zone) => {
    zone.hidden = !zone.dataset.ecrans.split(" ").includes(etat.ecran);
  });
  marquerNavigation(sectionDe(etat.ecran));
  rafraichirEntete();
  etat.moteur?.contexte({ section: sectionDe(etat.ecran) });
  decouvrirEnSilence("section", sectionDe(etat.ecran));
  if (etat.ecran === "defi" && changement) ouvrirDefi();
  if (etat.ecran === "progression") rendreProgression();
  if (etat.ecran === "contributions" && changement) void ouvrirContributions();
  if (etat.ecran === "compte") rafraichirCompte();
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
  document.querySelectorAll(".nav-bouton[data-nav], .nav-mobile-bouton[data-nav]").forEach((b) => {
    if (b.dataset.nav === cle) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
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
  const signal = () => etat.moteur.signal();
  for (const evenement of ["pointerdown", "keydown", "touchstart", "wheel"]) {
    document.addEventListener(evenement, signal, { capture: true, passive: true });
  }
  document.addEventListener("visibilitychange", () => {
    etat.moteur.visibilite(!document.hidden);
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
const constructeur = { type: null, envoi: false };

const texteBorne = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

/** Relit un cahier stocké : seuls les champs connus, bornés, sont gardés (le stockage local n'est pas une source sûre). */
function cahierValide(c) {
  if (!c || typeof c.id !== "string" || !TYPES_CAHIERS.includes(c.type) || typeof c.creeLe !== "string" || Number.isNaN(Date.parse(c.creeLe))) return null;
  const sections = Array.isArray(c.sections) ? c.sections.slice(0, MAX_NOTIONS_CAHIER).filter((s) => s && typeof s.notion === "string").map((s) => ({
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
    introduction: texteBorne(c.introduction, 500), conclusion: texteBorne(c.conclusion, 400), notes: texteBorne(c.notes, TAILLE_NOTES), sections
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
    const details = [t(`cahier_${cahier.type}`), cahier.sections.length ? t("cahierNotionsCompte", { n: cahier.sections.length }) : null,
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
}

/* Constructeur */

const notionsCahier = () => etat.notions.filter((n) => matiereDe(n) !== "jeux");
const cahierIaRestantes = () => etat.cahiersIa.restantesServeur ?? etat.cahiersIa.generationsParJour;
const cahierIaPossible = () => etat.llmDisponible && etat.llmActif && etat.cahiersIa.ia && cahierIaRestantes() > 0;

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
  const cle = !etat.llmDisponible || !etat.cahiersIa.ia ? "cahierIaIndisponible"
    : !etat.llmActif ? "cahierIaConsentement" : cahierIaRestantes() <= 0 ? "cahierIaQuota" : "cahierIaEtat";
  $("#cahier-ia-etat").textContent = t(cle, { n: cahierIaRestantes(), modele: etat.cahiersIa.modele });
}

function ouvrirConstructeur(type) {
  constructeur.type = type;
  $("#constructeur-titre").textContent = t("constructeurTitre", { type: t(`cahier_${type}`) });
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
  $("#cahier-titre").focus();
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
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
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
  const zone = $("#lecture-progression");
  const { total, reussis } = bilanExercices(cahier);
  zone.hidden = total === 0;
  if (!total) return;
  zone.querySelector("span").textContent = t("cahierProgression", { n: reussis, m: total });
  zone.querySelector("progress").max = total;
  zone.querySelector("progress").value = reussis;
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

function ouvrirLectureCahier(id, message = "") {
  const cahier = cahiersEnregistres().find((c) => c.id === id);
  if (!cahier) return;
  $("#lecture-titre").textContent = cahier.titre;
  const date = new Intl.DateTimeFormat(etat.langue, { dateStyle: "medium" }).format(new Date(cahier.creeLe));
  const source = cahier.source === "ia" ? t("cahierSourceIa", { modele: cahier.modele || "IA" }) : t("cahierSourceCatalogue");
  const univers = cahier.univers && cahier.univers !== "aucun" ? t(`cahierUnivers_${cahier.univers}`) : null;
  $("#lecture-meta").textContent = [t(`cahier_${cahier.type}`), univers, date, source].filter(Boolean).join(" · ");
  const corps = $("#lecture-corps");
  corps.replaceChildren();
  if (message) corps.append(element("p", { classe: "note-locale", texte: message, attributs: { role: "status" } }));
  if (cahier.introduction) corps.append(element("p", { classe: "intro-cahier", texte: cahier.introduction }));
  cahier.sections.forEach((s, i) => {
    const section = element("section", { classe: "section-cahier" });
    const tete = element("div", { classe: "tete-section-cahier" });
    tete.append(element("h3", { texte: s.titre }));
    if (notionParId(s.notion)) {
      const ouvrir = element("button", { classe: "secondaire petit-bouton", cle: "cahierOuvrirNotion", attributs: { type: "button" } });
      ouvrir.addEventListener("click", () => { $("#lecture-cahier").close(); ouvrirNotion(notionParId(s.notion)); });
      tete.append(ouvrir);
    }
    section.append(tete, ...s.blocs.map((b, j) => blocCahier(b, cahier.id, i, j)), zoneNotes(cahier.id, i, s.notes));
    corps.append(section);
  });
  if (cahier.conclusion) corps.append(element("p", { classe: "conclusion-cahier", texte: cahier.conclusion }));
  if (!cahier.sections.length || cahier.type === "brouillon") corps.append(zoneNotes(cahier.id, -1, cahier.notes));
  rafraichirProgressionCahier(cahier);
  if (!$("#lecture-cahier").open) $("#lecture-cahier").showModal();
}

function brancherCahiers() {
  document.querySelectorAll("[data-cahier-type]").forEach((b) => b.addEventListener("click", () => {
    if (TYPES_CAHIERS.includes(b.dataset.cahierType)) ouvrirConstructeur(b.dataset.cahierType);
  }));
  $("#cahier-matiere").addEventListener("change", () => { remplirNiveauxCahier(); rendreNotionsCahier(); });
  $("#cahier-niveau").addEventListener("change", rendreNotionsCahier);
  $("#cahier-notions").addEventListener("change", limiterNotionsCahier);
  $("#formulaire-cahier").addEventListener("submit", construireCahier);
  brancherDialogue($("#constructeur-cahier"), $("#fermer-constructeur"));
  brancherDialogue($("#lecture-cahier"), $("#fermer-lecture"));
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
  $("#reprendre").hidden = !n;
  zone.replaceChildren();
  if (!n) return;
  if (n.type === "jeu") zone.append(element("span", { classe: "fil-ariane", cle: "navJeux" }));
  else zone.append(filAriane(n));
  zone.append(element("h3", { texte: n.titre }));
  const b = bouton("reprendreBouton", "i-lecture");
  b.addEventListener("click", () => ouvrirNotion(n));
  zone.append(b);
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
  afficherQuestionsDefi([]);
}

function afficherQuestionsDefi(generes) {
  defi.etape = "questions";
  const banque = [1, 2, 3, 4, 5].map(questionBanque);
  defi.questions = [...generes, ...banque.slice(0, NB_DEFIS - generes.length)];
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
      method: "POST", credentials: "include", headers: { "content-type": "application/json" },
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
  afficherQuestionsDefi(generes);
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
  etiquette.append(element("span", { cle: `defiFormat_${item.format}` }));
  if (item.titre) etiquette.append(element("span", { texte: ` · ${item.titre}` }));
  const question = element("p", { classe: "defi-question", ...item.enonce, attributs: { id: "defi-question" } });
  const reponses = element("div", { classe: "reponses", attributs: { role: "group", "aria-labelledby": "defi-question" } });
  item.choix.forEach((c, i) => {
    const b = element("button", { classe: "reponse", attributs: { type: "button" } });
    b.append(element("span", { classe: "lettre", texte: "ABC"[i], attributs: { "aria-hidden": "true" } }), element("span", c));
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
