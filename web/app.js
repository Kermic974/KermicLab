// Interface Kermiclab : tableau de bord élève avec un chat flottant.
// Aucun texte en dur : tout vient de i18n/<langue>.json. Toutes les données affichées viennent de la session en cours
// (pseudo, progression) : rien n'est envoyé à Kermiclab (ADR 0012).
import * as progression from "./progression.js";
import * as profil from "./profil.js";
import * as comptes from "./comptes.js";
import * as demoFamille from "./demo-famille.js";
import { monterCercle } from "./cercle.js";
import * as trophees from "./trophees.js";

const $ = (s) => document.querySelector(s);
const etat = {
  config: null, langue: "fr", textes: {}, envoiEnCours: false, progres: null, suggestions: [], notions: [],
  notionCourante: null, groupesFermes: new Set(), compte: null, enfants: [], familleChargee: false, familleErreur: false,
  memoire: false, pseudo: null, reprise: false, cercle: null, trophees: {}, collectionTrophees: null,
  erreurTrophees: false, chargementTrophees: false, ecran: "accueil", llmActif: false, llmDisponible: false,
  defiIa: { ia: false, generationsParJour: 0, restantesServeur: null }
};
const NIVEAUX = ["college", "seconde", "premiere", "terminale", "autres"];
const MATIERES = ["mathematiques", "physique-chimie", "svt", "histoire", "geographie", "emc", "philosophie", "jeux"];
const CLE_MATIERE = "kermiclab:matiere";
const CLE_THEME = "kermiclab:theme";
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
  if (etat.ecran === "badges") remplirProgres();
  rafraichirDefiTextes();
  rafraichirFamille();
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
    // La progression locale garde un tableau d'identifiants de notions : on y ajoute les notions distantes.
    const locales = Array.isArray(etat.progres.notions) ? etat.progres.notions : [];
    const distantes = lignes.map((l) => l?.notion_id).filter((id) => typeof id === "string" && id);
    etat.progres = { ...etat.progres, notions: [...new Set([...locales, ...distantes])] };
    progression.sauver(stockage(), etat.progres);
    rafraichirPastille();
  } catch { /* hors ligne : la progression locale reste utilisable */ }
}

async function synchroniserProgression() {
  const enfant = comptes.enfantActif(etat.enfants, lireCle(stockage(), comptes.CLE_ENFANT_ACTIF));
  if (!connexionActive() || !etat.compte || !enfant || !etat.progres) return;
  try {
    // L'API attend un dictionnaire { idNotion: { score, etoiles } } (worker/src/comptes.js, lignesProgres).
    const notions = Object.fromEntries((Array.isArray(etat.progres.notions) ? etat.progres.notions : []).map((id) => [id, {}]));
    await apiFamille.sauverProgres(enfant.id, { ...etat.progres, notions });
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
const ACTIONS_ECRANS = { jeux: "navJeux", labs: "navLabs", notions: "navNotions", progression: "navProgression", badges: "navBadges", defi: "navDefi" };

function actionsEcrans(actions) {
  const valides = (Array.isArray(actions) ? actions : []).filter((a) => Object.hasOwn(ACTIONS_ECRANS, a)).slice(0, 3);
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

function remplirProgres() {
  const p = etat.progres;
  const { niveau, xpDansNiveau, xpParNiveau } = progression.niveau(p);
  $("#progres-niveau-num").textContent = String(niveau);
  $("#progres-niveau").textContent = t("niveauLong", { n: niveau });
  $("#progres-xp").max = xpParNiveau; $("#progres-xp").value = xpDansNiveau;
  $("#progres-xp-texte").textContent = t("xpAvantNiveau", { n: xpParNiveau - xpDansNiveau, m: niveau + 1 });
  $("#stat-questions").textContent = String(p.questions);
  $("#stat-notions").textContent = String(p.notions.length);
  $("#stat-serie").textContent = String(progression.serieCourante(p));
  $("#stat-serie-max").textContent = t("statSerieMax", { n: p.serieMax });
  $("#note-memoire").textContent = t(etat.memoire ? "progressionMemoire" : "progressionSession");
  const liste = $("#liste-badges");
  liste.replaceChildren();
  for (const b of progression.BADGES) {
    const obtenu = p.badges.includes(b.id);
    const li = element("li", { classe: `badge ${obtenu ? "obtenu" : "verrouille"}` });
    li.append(
      element("span", { classe: "badge-icone", texte: obtenu ? b.icone : "🔒", attributs: { "aria-hidden": "true" } }),
      element("strong", { texte: t(`badge_${b.id}`) }),
      element("span", { classe: "doux petit", texte: obtenu ? t(`badge_${b.id}_desc`) : `${t("badgeVerrouille")} · ${t(`badge_${b.id}_desc`)}` })
    );
    liste.append(li);
  }
  rendreTrophees();
}

function rendreTrophees() {
  const ouverts = new Set([...document.querySelectorAll(".trophee-module details[open]")].map((n) => n.closest("[data-trophee-module]").dataset.tropheeModule));
  const modules = Object.entries({ ...etat.collectionTrophees, ...etat.trophees });
  const obtenus = etat.progres.badges.length + modules.reduce((s, [, m]) => s + m.badges.filter((b) => b.obtenu).length, 0);
  $("#trophees-resume").textContent = t("tropheesResume", { n: obtenus, m: modules.length });
  $("#trophees-etat").textContent = etat.erreurTrophees ? t("tropheesErreur") : etat.collectionTrophees ? "" : t("tropheesChargement");
  $("#trophees-reessayer").hidden = !etat.erreurTrophees;
  const titres = { notions: "tropheesNotions", labs: "tropheesLabs", jeux: "tropheesJeux" };
  for (const genre of ["notions", "labs", "jeux"]) {
    const zone = $(`#trophees-${genre}`);
    zone.replaceChildren();
    const selection = modules.filter(([, m]) => m.genre === genre);
    const obtenusCategorie = selection.reduce((s, [, m]) => s + m.badges.filter((b) => b.obtenu).length, 0);
    const totalCategorie = selection.reduce((s, [, m]) => s + m.badges.length, 0);
    $(`[data-trophees-categorie="${genre}"] summary`).textContent = totalCategorie
      ? `${t(titres[genre])} · ${t("tropheesBadges", { n: obtenusCategorie, m: totalCategorie })}`
      : t(titres[genre]);
    if (!selection.length) zone.append(element("p", { classe: "doux", cle: "tropheesVide" }));
    for (const [id, m] of selection) {
      const carte = element("article", { classe: "trophee-module", attributs: { "data-trophee-module": id } });
      const notion = notionParId(id);
      carte.append(element("h4", { texte: id === "mini-cercle" ? t("minilabTitre") : notion?.titre ?? etat.collectionTrophees?.[id]?.titre ?? id }));
      if (id === "mini-cercle") carte.append(element("p", { cle: "tropheesMiniLab" }));
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
      carte.append(chiffres);
      if (m.etoilesTotal) {
        const barre = element("progress", { attributs: { max: m.etoilesTotal, value: m.etoiles, "aria-label": t("tropheesEtoiles") } });
        carte.append(barre);
      }
      if (m.badges.length) {
        const details = element("details");
        details.open = ouverts.has(id);
        details.append(element("summary", { texte: t("tropheesBadges", { n: m.badges.filter((b) => b.obtenu).length, m: m.badges.length }) }));
        const badges = element("ul", { classe: "badges" });
        for (const b of m.badges) {
          const li = element("li", { classe: `badge ${b.obtenu ? "obtenu" : "verrouille"}` });
          li.append(element("strong", { texte: `${b.obtenu ? b.icone : "🔒"} ${b.nom}` }),
            element("span", { texte: b.description }),
            element("span", { texte: b.obtenu ? t("tropheesObtenu") : `${t("badgeVerrouille")} · ${b.actuel} / ${b.cible}` }),
            element("progress", { attributs: { max: b.cible, value: b.actuel, "aria-label": b.nom } }));
          badges.append(li);
        }
        details.append(badges); carte.append(details);
      }
      const cible = notion ?? (etat.collectionTrophees?.[id]?.titre ? { id, titre: etat.collectionTrophees[id].titre } : null);
      if (cible) {
        const reprendre = element("button", { classe: "secondaire", cle: etat.trophees[id] ? "reprendreBouton" : "commencer", attributs: { type: "button" } });
        reprendre.addEventListener("click", () => ouvrirNotion(cible));
        carte.append(reprendre);
      }
      zone.append(carte);
    }
  }
}

async function chargerCollectionTrophees() {
  if (etat.collectionTrophees || etat.chargementTrophees) return;
  etat.chargementTrophees = true;
  etat.erreurTrophees = false;
  rendreTrophees();
  try {
    etat.collectionTrophees = trophees.lireCollection(await chargerJson("trophees.json"));
  } catch (e) {
    console.error("trophees", e);
    etat.erreurTrophees = true;
  } finally {
    etat.chargementTrophees = false;
    if (etat.ecran === "badges") rendreTrophees();
  }
}

function brancherTrophees() {
  window.addEventListener("message", (e) => {
    // Une iframe sandboxée a une origine opaque (« null ») : l'identité de la fenêtre fait foi.
    const cadre = [...document.querySelectorAll("iframe[data-module]")].find((c) => c.contentWindow === e.source);
    if (!cadre || e.origin !== "null" || !cadre.hasAttribute("src")) return;
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
      if (etat.ecran === "badges") remplirProgres();
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
  etat.matiere = lireCle(preferences(), CLE_MATIERE) || "mathematiques";
  $("#catalogue-indisponible").hidden = etat.notions.length > 0;
  rendreCatalogue();
  rafraichirTableau();
}

const matiereDe = (n) => n.matiere || "mathematiques";

/** Onglets de matière (affichés seulement s'il y en a plusieurs). */
function rendreMatieres() {
  const zone = $("#catalogue-matieres");
  const presentes = [...new Set(etat.notions.map(matiereDe))].sort((a, b) => (MATIERES.indexOf(a) + 1 || 99) - (MATIERES.indexOf(b) + 1 || 99));
  if (!presentes.includes(etat.matiere)) etat.matiere = presentes[0];
  zone.hidden = presentes.length < 2;
  zone.replaceChildren(...presentes.map((m) => {
    const b = element("button", { classe: "matiere", cle: `matiere_${m}`, attributs: { type: "button", role: "tab", "aria-selected": String(m === etat.matiere), "data-matiere": m } });
    b.addEventListener("click", () => {
      etat.matiere = m;
      ecrireCle(preferences(), CLE_MATIERE, m);
      rendreCatalogue();
    });
    return b;
  }));
}

function rendreCatalogue() {
  const liste = $("#catalogue-liste");
  if (!liste || !etat.notions.length || !etat.progres) return;
  rendreMatieres();
  const filtre = sansAccents($("#recherche-notion").value.trim());
  const explorees = new Set(etat.progres.notions);
  liste.replaceChildren();
  let affichees = 0;
  // Une recherche porte sur toutes les matières ; sinon on affiche la matière choisie.
  const groupes = filtre
    ? [...new Set(etat.notions.map(matiereDe))].flatMap((m) => NIVEAUX.map((niveau) => [m, niveau]))
    : NIVEAUX.map((niveau) => [etat.matiere, niveau]);
  for (const [matiere, niveau] of groupes) {
    const notions = etat.notions.filter((n) => matiereDe(n) === matiere && (NIVEAUX.includes(n.niveau) ? n.niveau : "autres") === niveau && (!filtre || sansAccents(n.titre).includes(filtre)));
    if (!notions.length) continue;
    affichees += notions.length;
    const cleGroupe = `${matiere}/${niveau}`;
    const groupe = element("details", { classe: "groupe-niveau", attributs: { "data-niveau": niveau, "data-matiere": matiere } });
    // Une recherche ouvre tous les groupes ; sinon on garde ceux que l'utilisateur a refermés.
    groupe.open = Boolean(filtre) || !etat.groupesFermes.has(cleGroupe);
    groupe.addEventListener("toggle", () => { if (!filtre) etat.groupesFermes[groupe.open ? "delete" : "add"](cleGroupe); });
    const resume = element("summary");
    const vues = notions.filter((n) => explorees.has(n.id)).length;
    const titre = element("span");
    if (filtre) titre.append(element("span", { cle: `matiere_${matiere}` }), " · ");
    titre.append(element("span", { cle: `niveau_${niveau}` }));
    resume.append(titre, element("span", { classe: "compte", texte: `${vues}/${notions.length}` }));
    const ul = element("ul");
    for (const n of notions) {
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
      ul.append(li);
    }
    groupe.append(resume, ul);
    liste.append(groupe);
  }
  $("#catalogue-vide").hidden = affichees > 0;
  const total = etat.notions.length, vues = etat.notions.filter((n) => explorees.has(n.id)).length;
  $("#catalogue-compteur").textContent = t("notionsExplorees", { n: vues, m: total });
  $("#catalogue-progres").max = total;
  $("#catalogue-progres").value = vues;
}

/**
 * Ouvre une notion depuis le tableau de bord (catalogue, reprise, suggestion, mini-lab) dans une bulle par-dessus
 * la page, sans l'ajouter au fil du chat ni appeler le chat (zéro token, comme le routage par mots-clés).
 */
function ouvrirNotion(n) {
  etat.notionCourante = n.id;
  const url = `${etat.config.apiUrl}/maquettes/${encodeURIComponent(n.id)}?lang=${encodeURIComponent(etat.langue)}`;
  ouvrirBulle(n, url);
  appliquerResultat(progression.enregistrerNotion(etat.progres, n.id));
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
    if (etat.ecran === "jeux") document.querySelector(`[data-jeu="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
    if (etat.ecran === "badges") document.querySelector(`[data-trophee-module="${CSS.escape(id)}"] button`)?.focus({ preventScroll: true });
  });
  $("#bulle-question").addEventListener("click", () => {
    bulle.addEventListener("close", ouvrirChat, { once: true });
    bulle.close();
  });
}

/** « Notions » est un écran comme Labs ou Jeux ; une matière choisie ailleurs (carte du tableau de bord) le présélectionne. */
function ouvrirCatalogue({ matiere } = {}) {
  if (typeof matiere === "string") {
    etat.matiere = matiere;
    ecrireCle(preferences(), CLE_MATIERE, matiere);
    $("#recherche-notion").value = "";
    rendreCatalogue();
  }
  naviguer("notions");
}

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
      if (donnees.maquette?.id) appliquerResultat(progression.enregistrerNotion(etat.progres, donnees.maquette.id));
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
}

async function chargerStatutLlm() {
  try {
    const r = await fetch(`${etat.config.apiUrl}/api/llm/status`, { cache: "no-store" });
    if (!r.ok) throw new Error(`statut LLM ${r.status}`);
    const statut = await r.json();
    etat.llmDisponible = statut.actif === true;
    const n = statut.defi?.generationsParJour;
    etat.defiIa.ia = statut.defi?.ia === true;
    etat.defiIa.generationsParJour = Number.isInteger(n) ? Math.max(0, Math.min(10, n)) : 0;
  } catch {
    etat.llmDisponible = false;
    etat.defiIa.ia = false;
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
  $("#trophees-reessayer").addEventListener("click", chargerCollectionTrophees);
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

function ouvrirProgres() { naviguer("badges"); }
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
  const possible = etat.llmDisponible && etat.llmActif;
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
  if (active) document.cookie = profil.cookieMemoire({ securise: cookieSecurise() });
  else document.cookie = profil.cookieEffacement({ securise: cookieSecurise() });
  etat.memoire = active;
  for (const cle of [profil.CLE_PSEUDO, progression.CLE_STOCKAGE, trophees.CLE_STOCKAGE]) effacerCle(ancien, cle);
  if (!active) effacerCle(preferences(), progression.CLE_STOCKAGE);
  sauverSession();
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
      for (const cle of [profil.CLE_PSEUDO, progression.CLE_STOCKAGE, trophees.CLE_STOCKAGE]) effacerCle(zone, cle);
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

const ECRANS = ["accueil", "labs", "jeux", "notions", "progression", "defi", "badges", "profil"];
/** Anciennes adresses : le tiroir « catalogue » est devenu l'écran « notions ». */
const ALIAS_ECRANS = { catalogue: "notions" };

function rafraichirEntete() {
  const accueil = etat.ecran === "accueil";
  $("#salut").textContent = accueil
    ? etat.pseudo ? t("salut", { pseudo: etat.pseudo }) : t("salutAnonyme")
    : t({ labs: "navLabs", jeux: "navJeux", notions: "navNotions", progression: "navProgression", defi: "navDefi", badges: "navBadges", profil: "configurationTitre", famille: "familleTitre" }[etat.ecran]);
  $("#accroche").textContent = t(accueil ? "accroche" : etat.ecran === "badges" ? "tropheesIntro" : `${etat.ecran}Intro`);
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
  marquerNavigation(etat.ecran);
  rafraichirEntete();
  if (etat.ecran === "defi" && changement) ouvrirDefi();
  if (etat.ecran === "badges") { remplirProgres(); chargerCollectionTrophees(); }
  if (focus) {
    window.scrollTo({ top: 0, behavior: "instant" });
    $("#salut").focus({ preventScroll: true });
  }
}

function naviguer(cle) {
  if (location.hash !== `#${cle}`) history.pushState(null, "", `#${cle}`);
  afficherEcran(cle);
}

function marquerNavigation(cle) {
  document.querySelectorAll(".nav-bouton[data-nav], .nav-mobile-bouton[data-nav]").forEach((b) => {
    if (b.dataset.nav === cle) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
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

/* ---------- Tableau de bord : données de la session ---------- */

const notionParId = (id) => etat.notions.find((n) => n.id === id) ?? null;
const pourcent = (n, total) => (total ? Math.round((n / total) * 100) : 0);

function barre(valeur, classe = "") {
  const b = element("div", { classe: `barre ${classe}`.trim(), attributs: { "aria-hidden": "true" } });
  const i = element("i");
  i.style.width = `${Math.max(0, Math.min(100, valeur))}%`;
  b.append(i);
  return b;
}

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

function statsMatiere(matiere) {
  const notions = etat.notions.filter((n) => matiereDe(n) === matiere);
  const vues = notions.filter((n) => etat.progres.notions.includes(n.id)).length;
  return { total: notions.length, vues, pct: pourcent(vues, notions.length) };
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
  rendreMatieresTableau();
  rendreSemaine();
  rendreJeux();
  $("#meta-explorer").textContent = etat.notions.length ? t("metaNotions", { n: etat.notions.length }) : "";
  $("#meta-question").textContent = t("metaQuestions", { n: etat.progres.questions });
  const defiFait = etat.progres.defiJour === progression.jourLocal();
  $("#meta-defi").textContent = defiFait ? t("defiFaitAujourdhui") : t("xpGagne", { n: 5 * progression.XP_DEFI_BONNE });
  $("#minilab-page").hidden = etat.notions.length > 0 && !notionParId("trigo-cercle");
}

function rendreJeux() {
  if (!etat.progres) return;
  const jeux = etat.notions.filter((n) => matiereDe(n) === "jeux");
  const filtre = sansAccents($("#recherche-jeu").value.trim());
  const selection = jeux.filter((n) => sansAccents(n.titre).includes(filtre));
  const grille = $("#grille-jeux");
  grille.replaceChildren();
  $("#jeux-compteur").textContent = t("jeuxCompteur", { n: selection.length, m: jeux.length });
  $("#jeux-vide").hidden = selection.length > 0;
  $("#jeux-vide").textContent = t(!etat.notions.length ? "catalogueIndisponible" : jeux.length ? "aucunJeu" : "jeuxIndisponibles");
  for (const jeu of selection) {
    const carte = element("article", { classe: "carte jeu-carte" });
    carte.append(element("span", { classe: "sur-titre", cle: "navJeux" }), element("h3", { texte: jeu.titre }));
    const explore = etat.progres.notions.includes(jeu.id);
    if (explore) carte.append(element("span", { classe: "pastille ok", cle: "notionExploree" }));
    const ouvrir = element("button", { classe: "bouton doux-bouton", cle: explore ? "reprendreBouton" : "commencer", attributs: { type: "button", "data-jeu": jeu.id } });
    ouvrir.addEventListener("click", () => ouvrirNotion(jeu));
    carte.append(ouvrir);
    grille.append(carte);
  }
}

function filAriane(n) {
  const fil = element("div", { classe: "fil-ariane" });
  fil.append(element("span", { cle: `matiere_${matiereDe(n)}` }), element("span", { texte: "›", attributs: { "aria-hidden": "true" } }),
    element("b", { cle: `niveau_${NIVEAUX.includes(n.niveau) ? n.niveau : "autres"}` }));
  return fil;
}

function rendreReprendre() {
  const zone = $("#reprendre-contenu");
  const id = etat.progres.derniereNotion;
  const n = id ? notionParId(id) ?? { id, titre: id } : null;
  zone.replaceChildren();
  if (!n) {
    zone.append(element("h3", { cle: "reprendreVideTitre" }), element("p", { classe: "doux", cle: "reprendreVideTexte" }));
    const b = bouton("reprendreVideBouton", "i-boussole");
    b.addEventListener("click", () => ouvrirCatalogue());
    zone.append(b);
    return;
  }
  if (n.niveau || n.matiere) zone.append(filAriane(n));
  zone.append(element("h3", { texte: n.titre }));
  if (n.niveau || n.matiere) {
    const s = statsMatiere(matiereDe(n));
    const ligne = element("div", { classe: "progression-ligne" });
    ligne.append(
      element("span", { classe: "libelle", texte: t("reprendreProgression", { matiere: t(`matiere_${matiereDe(n)}`), n: s.vues, m: s.total }) }),
      element("span", { classe: "valeur", texte: `${s.pct} %` }),
      barre(s.pct)
    );
    zone.append(ligne);
  }
  zone.append(element("p", { classe: "doux", cle: "reprendreTexte" }));
  const b = bouton("reprendreBouton", "i-lecture");
  b.addEventListener("click", () => { if (notionParId(n.id)) ouvrirNotion(notionParId(n.id)); });
  b.disabled = !notionParId(n.id);
  zone.append(b);
}

/** Prochaine notion : même matière et même niveau que la dernière ouverte, sinon même matière, sinon le cercle trigo. */
function prochaineNotion() {
  const vues = new Set(etat.progres.notions);
  const libres = etat.notions.filter((n) => !vues.has(n.id));
  const derniere = notionParId(etat.progres.derniereNotion);
  if (derniere) {
    return libres.find((n) => matiereDe(n) === matiereDe(derniere) && n.niveau === derniere.niveau)
      ?? libres.find((n) => matiereDe(n) === matiereDe(derniere)) ?? libres[0] ?? null;
  }
  return libres.find((n) => n.id === "trigo-cercle") ?? libres[0] ?? null;
}

function rendreSuggestion() {
  const zone = $("#suggestion-contenu");
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
  zone.append(encart, element("p", { classe: "doux petit", cle: "suggestionNote" }));
}

function rendreMatieresTableau() {
  const grille = $("#grille-matieres");
  grille.replaceChildren();
  if (!etat.notions.length) { grille.append(element("p", { classe: "doux", cle: "catalogueIndisponible" })); return; }
  const matieres = [...new Set(etat.notions.map(matiereDe))].sort((a, b) => (MATIERES.indexOf(a) + 1 || 99) - (MATIERES.indexOf(b) + 1 || 99));
  for (const m of matieres) {
    const s = statsMatiere(m);
    const etatMatiere = s.vues === 0 ? ["neutre", "aDecouvrir"] : s.pct === 100 ? ["ok", "termine"] : s.pct >= 50 ? ["ok", "bienAvance"] : ["en-cours", "enCours"];
    const carte = element("button", { classe: `matiere-carte ${etatMatiere[0]}`, attributs: { type: "button", "data-matiere-carte": m } });
    const bas = element("div", { classe: "matiere-bas" });
    const pct = element("span", { classe: "pourcent", texte: String(s.pct) });
    pct.append(element("small", { texte: "%" }));
    const pastille = element("span", { classe: `pastille ${etatMatiere[0]}`, cle: etatMatiere[1] });
    bas.append(pct, pastille);
    carte.append(
      element("span", { classe: "compte", texte: t("notionsExplorees", { n: s.vues, m: s.total }) }),
      element("h3", { cle: `matiere_${m}` }), bas, barre(s.pct)
    );
    carte.setAttribute("aria-label", `${t(`matiere_${m}`)} : ${t("notionsExplorees", { n: s.vues, m: s.total })}, ${t(etatMatiere[1])}`);
    carte.addEventListener("click", () => {
      etat.matiere = m;
      ecrireCle(preferences(), CLE_MATIERE, m);
      rendreCatalogue();
      ouvrirCatalogue();
    });
    grille.append(carte);
  }
}

function rendreSemaine() {
  const jours = progression.activite(etat.progres);
  const somme = (cle) => jours.reduce((total, j) => total + j[cle], 0);
  const actifs = jours.filter((j) => j.q + j.n + j.xp > 0).length;
  const date = (j, options) => new Intl.DateTimeFormat(etat.langue, options).format(new Date(`${j}T12:00:00`));
  $("#semaine-periode").textContent = t("semainePeriode", { debut: date(jours[0].jour, { day: "numeric", month: "long" }), fin: date(jours[6].jour, { day: "numeric", month: "long" }) });
  const chiffres = $("#chiffres-semaine");
  chiffres.replaceChildren(...[
    ["statQuestions", String(somme("q"))],
    ["semaineNotions", String(somme("n"))],
    ["semaineXp", t("xpGagne", { n: somme("xp") }), "xp-chiffre"],
    ["semaineJours", t("joursSurSept", { n: actifs })]
  ].map(([cle, valeur, classe]) => {
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
const defi = { index: 0, bonnes: 0, resultats: [], questions: [], source: "banque", jeton: 0 };

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

async function ouvrirDefi() {
  const jeton = ++defi.jeton;
  defi.index = 0; defi.bonnes = 0; defi.resultats = [];
  let generes = [];
  defi.source = "banque";
  if (defiIaPossible()) {
    $("#defi-corps").replaceChildren(element("p", { classe: "defi-chargement doux", cle: "defiChargement", attributs: { role: "status" } }));
    rafraichirDefiTextes();
    try {
      const r = await fetch(`${etat.config.apiUrl}/api/defi`, {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ langue: etat.langue, matiere: etat.matiere, utiliserLlm: true })
      });
      const d = await r.json();
      if (jeton !== defi.jeton) return;
      if (Number.isInteger(d.quota?.restantes)) etat.defiIa.restantesServeur = d.quota.restantes;
      if (d.source === "ia" && Array.isArray(d.defis)) {
        generes = d.defis.slice(0, NB_DEFIS).map(questionIa);
        defi.source = "ia";
        noterGenerationDefi();
      }
    } catch {
      console.error("défi IA indisponible");
    }
    if (jeton !== defi.jeton) return;
  }
  const banque = [1, 2, 3, 4, 5].map(questionBanque);
  defi.questions = [...generes, ...banque.slice(0, NB_DEFIS - generes.length)];
  rendreQuestionDefi();
  rafraichirDefiTextes();
  rafraichirReglageDefi();
}

function rafraichirDefiTextes() {
  const fait = etat.progres.defiJour === progression.jourLocal();
  $("#defi-sur-titre").textContent = fait ? t("defiFaitAujourdhui") : t("defiSurTitre", { n: NB_DEFIS * progression.XP_DEFI_BONNE });
  const compteur = $("#defi .defi-haut .math");
  if (compteur) compteur.textContent = t("defiProgression", { n: defi.index + 1, m: defi.questions.length });
  const source = $("#defi-source");
  if (source) {
    const cle = defi.source === "ia" ? "defiSourceIa"
      : etat.llmDisponible && etat.defiIa.ia && !etat.llmActif ? "defiIaConsentement" : "defiSourceBanque";
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
  recommencer.addEventListener("click", () => { void ouvrirDefi(); });
  const terminer = element("button", { classe: "bouton", cle: "defiTerminer", attributs: { type: "button" } });
  terminer.addEventListener("click", () => naviguer("accueil"));
  actions.append(recommencer, terminer);
  bloc.append(actions);
  $("#defi-corps").replaceChildren(bloc);
  terminer.focus();
}

demarrer();
