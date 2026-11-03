// Interface Kermiclab : tableau de bord élève avec le chat intégré à l'accueil.
// Aucun texte en dur : tout vient de i18n/<langue>.json. Toutes les données affichées viennent de la session en cours
// (pseudo, progression) : rien n'est envoyé à Kermiclab (ADR 0012).
import * as progression from "./progression.js";
import * as profil from "./profil.js";
import { monterCercle } from "./cercle.js";

const $ = (s) => document.querySelector(s);
const etat = {
  config: null, langue: "fr", textes: {}, historique: [], envoiEnCours: false, progres: null, suggestions: [], notions: [],
  notionCourante: null, groupesFermes: new Set(), compte: null, eleves: [], eleveActif: null,
  memoire: false, pseudo: null, reprise: false, cercle: null
};
const NIVEAUX = ["college", "seconde", "premiere", "terminale", "autres"];
const MATIERES = ["mathematiques", "physique-chimie", "svt", "histoire", "geographie", "emc", "philosophie"];
const CLE_MATIERE = "kermiclab:matiere";
const CLE_THEME = "kermiclab:theme";
const DEFI_BONNES = [1, 0, 1, 0, 0];
const MAX_PUCES = 4;
const TAILLE_MAX_PUCE = 120;
const mouvementReduit = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Stockage des données de l'élève : local si le cookie de mémorisation existe, sinon limité à la session (onglet). */
function stockage() {
  try { return etat.memoire ? window.localStorage : window.sessionStorage; } catch { return null; }
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
  rafraichirTheme();
  etat.cercle?.rafraichir();
}

/* ---------- Auth & Compte ---------- */

async function verifierConnexion() {
  try {
    const r = await fetch(`${etat.config.apiUrl}/auth/me`, { credentials: "include" });
    if (!r.ok) return;
    const data = await r.json();
    if (data.connecte) {
      etat.compte = data.compte;
      await chargerEleves();
      mettreAJourUICompte();
    }
  } catch (e) {
    console.error("auth", e);
  }
}

function mettreAJourUICompte() {
  const connecte = !!etat.compte;
  $("#se-connecter").hidden = connecte;
  $("#mon-compte").hidden = !connecte;
  $("#compte-connecte").hidden = !connecte;
  $("#compte-non-connecte").hidden = connecte;
}

async function chargerEleves() {
  if (!etat.compte) return;
  const r = await fetch(`${etat.config.apiUrl}/api/eleves`, { credentials: "include" });
  if (r.ok) {
    etat.eleves = await r.json();
    afficherEleves();
  }
}

function afficherEleves() {
  const conteneur = $("#liste-eleves");
  if (!conteneur) return;
  conteneur.replaceChildren();
  for (const e of etat.eleves) {
    const btn = element("button", { classe: "eleve", texte: e.prenom_affiche, attributs: { type: "button" } });
    btn.addEventListener("click", () => selectionnerEleve(e));
    conteneur.append(btn);
  }
}

function selectionnerEleve(eleve) {
  etat.eleveActif = eleve;
  chargerProgressionDistante(eleve.id);
  $("#compte").close();
}

async function chargerProgressionDistante(eleveId) {
  const r = await fetch(`${etat.config.apiUrl}/api/progres?eleveId=${eleveId}`, { credentials: "include" });
  if (r.ok) {
    const data = await r.json();
    // Fusion simple : les notions distantes prennent le dessus
    const notions = {};
    for (const row of data) {
      notions[row.notion_id] = { score: row.score, etoiles: row.etoiles };
    }
    etat.progres = { ...etat.progres, notions: { ...(etat.progres.notions || {}), ...notions } };
    progression.sauver(stockage(), etat.progres);
    rafraichirPastille();
  }
}

async function synchroniserProgression() {
  if (!etat.eleveActif || !etat.progres) return;
  await fetch(`${etat.config.apiUrl}/api/progres`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      eleveId: etat.eleveActif.id,
      progres: etat.progres
    })
  });
}

function brancherAuth() {
  $("#se-connecter")?.addEventListener("click", () => $("#compte").showModal());
  $("#mon-compte")?.addEventListener("click", (e) => { e.preventDefault(); $("#compte").showModal(); });

  $("#login-google")?.addEventListener("click", () => {
    window.location.href = `${etat.config.apiUrl}/auth/login?provider=google`;
  });
  $("#login-microsoft")?.addEventListener("click", () => {
    window.location.href = `${etat.config.apiUrl}/auth/login?provider=microsoft`;
  });

  $("#deconnexion")?.addEventListener("click", async () => {
    await fetch(`${etat.config.apiUrl}/auth/logout`, { method: "POST", credentials: "include" });
    etat.compte = null;
    etat.eleves = [];
    etat.eleveActif = null;
    mettreAJourUICompte();
    $("#compte").close();
    location.reload();
  });

  $("#ajouter-eleve")?.addEventListener("click", () => {
    $("#consentement").showModal();
  });

  $("#valider-consentement")?.addEventListener("click", async (e) => {
    if (!$("#consent-check").checked) return;
    e.preventDefault();
    $("#consentement").close();
    const prenom = prompt("Prénom ou surnom de l’élève :");
    if (!prenom) return;
    const r = await fetch(`${etat.config.apiUrl}/api/eleves`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prenom_affiche: prenom, age_tranche: "11-13" })
    });
    if (r.ok) await chargerEleves();
  });

  $("#annuler-consentement")?.addEventListener("click", () => $("#consentement").close());
  brancherDialogue($("#compte"), $("#fermer-compte"));
  brancherDialogue($("#consentement"), $("#annuler-consentement"));
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
  li.scrollIntoView({ behavior: mouvementReduit() ? "auto" : "smooth", block: bloc });
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
  // Les scores sont conservés en ouvrant la page en plein écran.
  cadre.setAttribute("sandbox", "allow-scripts");
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

function ajouterReponse({ texte, maquette, suggestions, horsCatalogue }) {
  const { li, bulle } = creerMessage();
  bulle.append(element("p", { classe: "texte", texte }));
  if (maquette) {
    li.classList.add("maquette");
    li.dataset.maquette = maquette.id;
    bulle.append(carteMaquette(maquette));
  }
  const questions = pucesValides(suggestions);
  if (horsCatalogue) li.classList.add("hors-catalogue");
  if (questions.length) ajouterRelances(bulle, questions, horsCatalogue ? "horsCatalogueTitre" : "relancesTitre");
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
  // Synchronise si un élève est actif
  if (etat.eleveActif) synchroniserProgression();
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

/** Ouvre une notion directement dans le fil, sans passer par le chat (zéro token, comme le routage par mots-clés). */
function ouvrirNotion(n) {
  etat.notionCourante = n.id;
  const url = `${etat.config.apiUrl}/maquettes/${encodeURIComponent(n.id)}?lang=${encodeURIComponent(etat.langue)}`;
  ajouterReponse({ texte: t("voiciPage", { titre: n.titre }), maquette: { id: n.id, titre: n.titre, version: n.version, url } });
  fermerCatalogue();
  appliquerResultat(progression.enregistrerNotion(etat.progres, n.id));
  rendreCatalogue();
  rafraichirTableau();
}

let declencheurCatalogue = null;

function ouvrirCatalogue() {
  declencheurCatalogue = document.activeElement;
  $("#catalogue").classList.add("ouvert");
  $("#voile-catalogue").hidden = false;
  document.querySelectorAll("[aria-controls=catalogue]").forEach((b) => b.setAttribute("aria-expanded", "true"));
  $("#recherche-notion").focus();
}

function fermerCatalogue({ rendreFocus = false } = {}) {
  if (!$("#catalogue").classList.contains("ouvert")) return;
  $("#catalogue").classList.remove("ouvert");
  $("#voile-catalogue").hidden = true;
  document.querySelectorAll("[aria-controls=catalogue]").forEach((b) => b.setAttribute("aria-expanded", "false"));
  if (rendreFocus) declencheurCatalogue?.focus?.();
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
  try {
    const r = await fetch(`${etat.config.apiUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: question, langue: etat.langue, historique: etat.historique.slice(-6) })
    });
    const donnees = await r.json();
    attente.remove();
    const reussie = donnees.type === "reponse" || donnees.type === "maquette";
    ajouterReponse({ texte: donnees.texte ?? t("erreurReseau"), maquette: donnees.maquette, suggestions: donnees.suggestions, horsCatalogue: donnees.type === "hors-catalogue" });
    if (reussie) {
      etat.historique.push({ role: "user", content: question }, { role: "assistant", content: donnees.texte });
      appliquerResultat(progression.enregistrerQuestion(etat.progres));
      if (donnees.maquette?.id) appliquerResultat(progression.enregistrerNotion(etat.progres, donnees.maquette.id));
    }
  } catch {
    attente.remove();
    ajouterErreur(question);
  } finally {
    bouton.disabled = false;
    etat.envoiEnCours = false;
    document.body.classList.remove("occupe");
  }
}

/* ---------- Démarrage ---------- */

function brancherDialogue(dialogue, boutonFermer) {
  boutonFermer.addEventListener("click", () => dialogue.close());
  // Un clic sur le fond (hors du contenu) ferme la fenêtre.
  dialogue.addEventListener("click", (e) => { if (e.target === dialogue) dialogue.close(); });
}

async function demarrer() {
  etat.config = await chargerJson("config.json");
  initialiserSession();
  appliquerTheme(lireCle(preferences(), CLE_THEME));
  const select = $("#langue");
  for (const l of etat.config.langues) {
    const o = document.createElement("option");
    o.value = l; o.textContent = l.toUpperCase();
    select.append(o);
  }
  select.value = langueInitiale(etat.config.langues);
  await appliquerLangue(select.value);
  select.addEventListener("change", async () => { ecrirePreference(select.value); await appliquerLangue(select.value); });

  brancherProfil();
  if (!etat.pseudo) demanderPseudo();

  // Auth
  await verifierConnexion();
  brancherAuth();

  ajouterBienvenue();
  await chargerCatalogue();
  $("#fermer-catalogue").addEventListener("click", () => fermerCatalogue({ rendreFocus: true }));
  $("#voile-catalogue").addEventListener("click", () => fermerCatalogue());
  $("#recherche-notion").addEventListener("input", rendreCatalogue);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("#catalogue").classList.contains("ouvert")) fermerCatalogue({ rendreFocus: true });
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

  const dialogueProgres = $("#progres");
  $("#ouvrir-progres").addEventListener("click", ouvrirProgres);
  brancherDialogue(dialogueProgres, $("#fermer-progres"));

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
  brancherDefi();
  $("#bascule-theme").addEventListener("click", () => {
    const suivant = themeSombre() ? "light" : "dark";
    ecrireCle(preferences(), CLE_THEME, suivant);
    appliquerTheme(suivant);
  });
  etat.cercle = monterCercle($("#minilab"), { t, langue: () => etat.langue });
  $("#minilab-page").addEventListener("click", () => {
    const n = notionParId("trigo-cercle");
    if (n) ouvrirNotion(n); else location.href = "cercle/";
  });
  rafraichirTableau();
}

function ouvrirProgres() { remplirProgres(); $("#progres").showModal(); }
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
  for (const cle of [profil.CLE_PSEUDO, progression.CLE_STOCKAGE]) effacerCle(ancien, cle);
  if (!active) effacerCle(preferences(), progression.CLE_STOCKAGE);
  sauverSession();
}

function sauverSession() {
  if (etat.pseudo) ecrireCle(stockage(), profil.CLE_PSEUDO, etat.pseudo);
  progression.sauver(stockage(), etat.progres);
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
    rafraichirTableau();
    notifier(t("pseudoBienvenue", { pseudo: etat.pseudo }), "👋");
    $("#question").focus({ preventScroll: true });
  });

  const dialogue = $("#profil");
  brancherDialogue(dialogue, $("#fermer-profil"));
  dialogue.addEventListener("close", reinitialiserEffacement);
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
      for (const cle of [profil.CLE_PSEUDO, progression.CLE_STOCKAGE]) effacerCle(zone, cle);
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
  $("#profil").showModal();
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

function marquerNavigation(cle) {
  document.querySelectorAll(".nav-bouton[data-nav], .nav-mobile-bouton[data-nav]").forEach((b) => {
    if (b.dataset.nav === cle) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
}

function aller(cible) {
  $(cible)?.scrollIntoView({ behavior: mouvementReduit() ? "auto" : "smooth", block: "start" });
}

function brancherNavigation() {
  document.addEventListener("click", (e) => {
    const bouton = e.target.closest("[data-nav], [data-action]");
    if (!bouton || bouton.closest("dialog")) return;
    const cle = bouton.dataset.nav ?? bouton.dataset.action;
    if (cle === "accueil") { marquerNavigation("accueil"); aller("#haut"); }
    else if (cle === "progression") { marquerNavigation("progression"); aller("#semaine"); }
    else if (cle === "catalogue") ($("#catalogue").classList.contains("ouvert") ? fermerCatalogue() : ouvrirCatalogue());
    else if (cle === "defi") ouvrirDefi();
    else if (cle === "badges") ouvrirProgres();
    else if (cle === "profil") ouvrirProfil();
    else if (cle === "aide") ouvrirSignalement();
    else if (cle === "question") { marquerNavigation("accueil"); aller("#accueil"); $("#question").focus({ preventScroll: true }); }
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
  $("#salut").textContent = pseudo ? t("salut", { pseudo }) : t("salutAnonyme");
  const { niveau } = progression.niveau(etat.progres);
  document.querySelectorAll("[data-profil=initiale]").forEach((n) => { n.textContent = profil.initiale(pseudo); });
  document.querySelectorAll("[data-profil=pseudo]").forEach((n) => { n.textContent = pseudo || t("anonyme"); });
  document.querySelectorAll("[data-profil=niveau]").forEach((n) => { n.textContent = t("niveauLong", { n: niveau }); });
  rendreReprendre();
  rendreSuggestion();
  rendreMatieresTableau();
  rendreSemaine();
  $("#meta-explorer").textContent = etat.notions.length ? t("metaNotions", { n: etat.notions.length }) : "";
  $("#meta-question").textContent = t("metaQuestions", { n: etat.progres.questions });
  const defiFait = etat.progres.defiJour === progression.jourLocal();
  $("#meta-defi").textContent = defiFait ? t("defiFaitAujourdhui") : t("xpGagne", { n: 5 * progression.XP_DEFI_BONNE });
  $("#minilab-page").hidden = etat.notions.length > 0 && !notionParId("trigo-cercle");
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
    b.addEventListener("click", ouvrirCatalogue);
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

/* ---------- Défi express (5 questions, XP une fois par jour) ---------- */

const defi = { index: 0, bonnes: 0, resultats: [] };

function brancherDefi() {
  brancherDialogue($("#defi"), $("#fermer-defi"));
}

function ouvrirDefi() {
  defi.index = 0; defi.bonnes = 0; defi.resultats = [];
  const fait = etat.progres.defiJour === progression.jourLocal();
  $("#defi-sur-titre").textContent = fait ? t("defiFaitAujourdhui") : t("defiSurTitre", { n: 5 * progression.XP_DEFI_BONNE });
  rendreQuestionDefi();
  $("#defi").showModal();
  $("#defi .reponse")?.focus();
}

function pointsDefi() {
  const zone = element("div", { classe: "defi-points", attributs: { "aria-hidden": "true" } });
  DEFI_BONNES.forEach((_, i) => {
    const r = defi.resultats[i];
    zone.append(element("i", { classe: r === true ? "juste" : r === false ? "faux" : i === defi.index ? "courant" : "" }));
  });
  return zone;
}

function rendreQuestionDefi() {
  const corps = $("#defi-corps");
  const q = defi.index + 1;
  const haut = element("div", { classe: "defi-haut" });
  haut.append(pointsDefi(), element("span", { classe: "doux petit math", texte: t("defiProgression", { n: q, m: DEFI_BONNES.length }) }));
  const question = element("p", { classe: "defi-question", texte: t(`defiQ${q}`), attributs: { id: "defi-question" } });
  const reponses = element("div", { classe: "reponses", attributs: { role: "group", "aria-labelledby": "defi-question" } });
  [1, 2, 3].forEach((r, i) => {
    const b = element("button", { classe: "reponse", attributs: { type: "button" } });
    b.append(element("span", { classe: "lettre", texte: "ABC"[i], attributs: { "aria-hidden": "true" } }), element("span", { texte: t(`defiQ${q}R${r}`) }));
    b.addEventListener("click", () => repondreDefi(i));
    reponses.append(b);
  });
  corps.replaceChildren(haut, question, reponses, element("div", { attributs: { id: "defi-retour", "aria-live": "assertive" } }));
}

function repondreDefi(choix) {
  const q = defi.index + 1;
  const juste = choix === DEFI_BONNES[defi.index];
  defi.resultats[defi.index] = juste;
  if (juste) defi.bonnes += 1;
  document.querySelectorAll("#defi .reponse").forEach((b, i) => {
    b.disabled = true;
    b.classList.add(i === DEFI_BONNES[defi.index] ? "juste" : i === choix ? "faux" : "estompee");
  });
  $("#defi .defi-points").replaceWith(pointsDefi());
  const retour = element("div", { classe: `retour-defi ${juste ? "juste" : "faux"}` });
  retour.append(element("strong", { cle: juste ? "defiJuste" : "defiFaux" }), element("span", { texte: t(`defiQ${q}E`) }));
  const fin = defi.index === DEFI_BONNES.length - 1;
  const suite = element("div", { classe: "defi-suite" });
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
  const message = defi.bonnes === DEFI_BONNES.length ? "defiParfait" : defi.bonnes >= 3 ? "defiBien" : "defiEncore";
  bloc.append(pointsDefi(), element("div", { classe: "score", texte: `${defi.bonnes}/${DEFI_BONNES.length}` }), element("p", { cle: message }),
    element("span", { classe: "pastille ok", texte: resultat.xpGagne ? t("xpGagne", { n: resultat.xpGagne }) : t("defiDejaFait") }));
  const actions = element("div", { classe: "defi-suite" });
  const recommencer = element("button", { classe: "bouton secondaire-bouton", cle: "defiRecommencer", attributs: { type: "button" } });
  recommencer.addEventListener("click", () => { defi.index = 0; defi.bonnes = 0; defi.resultats = []; rendreQuestionDefi(); });
  const terminer = element("button", { classe: "bouton", cle: "defiTerminer", attributs: { type: "button" } });
  terminer.addEventListener("click", () => $("#defi").close());
  actions.append(recommencer, terminer);
  bloc.append(actions);
  $("#defi-corps").replaceChildren(bloc);
  terminer.focus();
}

demarrer();
