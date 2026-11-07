// Interface Kermiclab : tableau de bord élève avec un chat flottant.
// Aucun texte en dur : tout vient de i18n/<langue>.json. Toutes les données affichées viennent de la session en cours
// (pseudo, progression) : rien n'est envoyé à Kermiclab (ADR 0012).
import * as progression from "./progression.js";
import * as profil from "./profil.js";
import * as comptes from "./comptes.js";
import * as demoFamille from "./demo-famille.js";
import { monterCercle } from "./cercle.js";
import * as trophees from "./trophees.js";
import * as experiences from "./experiences.js";
import { creerMoteurTemps } from "./temps-actif.js";

const $ = (s) => document.querySelector(s);
const etat = {
  config: null, langue: "fr", textes: {}, envoiEnCours: false, progres: null, suggestions: [], notions: [],
  notionCourante: null, compte: null, enfants: [], familleChargee: false, familleErreur: false,
  memoire: false, pseudo: null, reprise: false, cercle: null, trophees: {},
  ecran: "accueil", registre: experiences.creerRegistre([]), ouverts: new Set(), moteur: null, llmActif: false, llmDisponible: false,
  defiIa: { ia: false, generationsParJour: 0, restantesServeur: null },
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
  for (const cle of [CLE_DEMO_ACTIVE, demoFamille.CLE_DEMO]) effacerCle(sessionPreferences(), cle);
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
}

function brancherBulle() {
  const bulle = $("#bulle-lab");
  brancherDialogue(bulle, $("#fermer-bulle"));
  // Fermée : on décharge la page pour arrêter ses animations et libérer la mémoire.
  bulle.addEventListener("close", () => {
    const id = bulle.dataset.notion;
    $("#bulle-cadre").removeAttribute("src");
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
    etat.skills = statut.skills && typeof statut.skills === "object" ? statut.skills : {};
    etat.configurationServeur = statut.configuration && Array.isArray(statut.configuration.modules) ? statut.configuration : false;
  } catch {
    etat.llmDisponible = false;
    etat.defiIa.ia = false;
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
  $(".pied").before($("#profil"), $("#famille"), $("#defi"), $("#progres"));
  etat.config = await chargerJson("config.json");
  initialiserSession();
  etat.trophees = trophees.charger(stockage());
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
  void verifierConnexion();

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
  if (active) document.cookie = profil.cookieMemoire({ securise: cookieSecurise() });
  else document.cookie = profil.cookieEffacement({ securise: cookieSecurise() });
  etat.memoire = active;
  for (const cle of [profil.CLE_PSEUDO, progression.CLE_STOCKAGE, trophees.CLE_STOCKAGE, CLE_CAHIERS]) effacerCle(ancien, cle);
  if (!active) effacerCle(preferences(), progression.CLE_STOCKAGE);
  sauverSession();
  if (cahiers) ecrireCle(stockage(), CLE_CAHIERS, cahiers);
}

function sauverSession() {
  if (etat.pseudo) ecrireCle(stockage(), profil.CLE_PSEUDO, etat.pseudo);
  progression.sauver(stockage(), etat.progres);
  trophees.sauver(stockage(), etat.trophees);
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
      for (const cle of [profil.CLE_PSEUDO, progression.CLE_STOCKAGE, trophees.CLE_STOCKAGE, CLE_CAHIERS]) effacerCle(zone, cle);
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
const ECRANS = [...DESTINATIONS, "defi"];
const PARENTS = { defi: "education", famille: "profil" };
/** Anciennes adresses (#notions, #labs, #badges…) : redirigées vers la destination qui les contient. */
const ALIAS_ECRANS = { catalogue: "education", notions: "education", labs: "education", cahiers: "education", badges: "progression" };
const ANCRES_ALIAS = { badges: "#progres", cahiers: "#ecran-cahiers" };
const sectionDe = (ecran) => PARENTS[ecran] ?? ecran;

function rafraichirEntete() {
  const accueil = etat.ecran === "accueil";
  $("#salut").textContent = accueil
    ? etat.pseudo ? t("salut", { pseudo: etat.pseudo }) : t("salutAnonyme")
    : t({ education: "navEducation", jeux: "navJeux", progression: "navProgression", defi: "navDefi", profil: "navProfil", famille: "familleTitre" }[etat.ecran]);
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

function cahiersEnregistres() {
  try {
    const cahiers = JSON.parse(lireCle(stockage(), CLE_CAHIERS) ?? "[]");
    return Array.isArray(cahiers)
      ? cahiers.filter((c) => c && typeof c.id === "string" && TYPES_CAHIERS.includes(c.type) && typeof c.creeLe === "string" && !Number.isNaN(Date.parse(c.creeLe)))
      : [];
  } catch { return []; }
}

function rendreCahiers() {
  const liste = $("#liste-cahiers");
  if (!liste || !etat.textes.titre) return;
  const cahiers = cahiersEnregistres();
  liste.replaceChildren(...cahiers.map((cahier) => {
    const titre = t(`cahier_${cahier.type}`);
    const carte = element("article", { classe: "carte cahier-enregistre" });
    const contenu = element("div");
    contenu.append(
      element("h4", { texte: titre }),
      element("p", { classe: "doux petit", texte: new Intl.DateTimeFormat(etat.langue, { dateStyle: "medium" }).format(new Date(cahier.creeLe)) })
    );
    const supprimer = element("button", { classe: "secondaire petit-bouton", cle: "cahierSupprimer", attributs: { type: "button", "data-supprimer-cahier": cahier.id } });
    supprimer.setAttribute("aria-label", t("cahierSupprimer", { titre }));
    carte.append(contenu, supprimer);
    return carte;
  }));
  $("#cahiers-vide").hidden = cahiers.length > 0;
}

function brancherCahiers() {
  document.querySelectorAll("[data-cahier-type]").forEach((bouton) => bouton.addEventListener("click", () => {
    const type = bouton.dataset.cahierType;
    if (!TYPES_CAHIERS.includes(type)) return;
    const cahiers = cahiersEnregistres();
    const id = window.crypto?.randomUUID?.() ?? `${Date.now()}-${cahiers.length}`;
    cahiers.unshift({ id, type, creeLe: new Date().toISOString() });
    ecrireCle(stockage(), CLE_CAHIERS, JSON.stringify(cahiers));
    rendreCahiers();
  }));
  $("#liste-cahiers").addEventListener("click", (e) => {
    const bouton = e.target.closest("[data-supprimer-cahier]");
    if (!bouton) return;
    const cahiers = cahiersEnregistres().filter((c) => c.id !== bouton.dataset.supprimerCahier);
    ecrireCle(stockage(), CLE_CAHIERS, JSON.stringify(cahiers));
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
