// Interface de chat Kermiclab : aucun texte en dur, tout vient de i18n/<langue>.json.
import * as progression from "./progression.js";

const $ = (s) => document.querySelector(s);
const etat = { config: null, langue: "fr", textes: {}, historique: [], envoiEnCours: false, progres: null, suggestions: [], notions: [], notionCourante: null, groupesFermes: new Set() };
const NIVEAUX = ["college", "seconde", "premiere", "terminale", "autres"];
const MATIERES = ["mathematiques", "physique-chimie", "svt"];
const CLE_MATIERE = "kermiclab:matiere";
const MAX_PUCES = 4;
const TAILLE_MAX_PUCE = 120;
const mouvementReduit = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function stockage() {
  try { return window.localStorage; } catch { return null; }
}

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
  try { return stockage()?.getItem("kermiclab:langue") ?? null; } catch { return null; }
}
function ecrirePreference(l) {
  try { stockage()?.setItem("kermiclab:langue", l); } catch { /* stockage indisponible */ }
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
  document.title = etat.textes.titre;
  await chargerSuggestions();
  rafraichirBienvenue();
  rafraichirPastille();
  rendreCatalogue();
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
  if (resultat.nouvelleNotion) rendreCatalogue();
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
  try { etat.matiere = stockage()?.getItem(CLE_MATIERE) || "mathematiques"; } catch { etat.matiere = "mathematiques"; }
  const visible = etat.notions.length > 0;
  $("#catalogue").hidden = !visible;
  $("#ouvrir-catalogue").hidden = !visible;
  document.body.classList.toggle("avec-catalogue", visible);
  rendreCatalogue();
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
      try { stockage()?.setItem(CLE_MATIERE, m); } catch { /* stockage indisponible */ }
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
}

function ouvrirCatalogue() {
  $("#catalogue").classList.add("ouvert");
  $("#voile-catalogue").hidden = false;
  $("#ouvrir-catalogue").setAttribute("aria-expanded", "true");
  $("#recherche-notion").focus();
}

function fermerCatalogue() {
  if (!$("#catalogue").classList.contains("ouvert")) return;
  $("#catalogue").classList.remove("ouvert");
  $("#voile-catalogue").hidden = true;
  $("#ouvrir-catalogue").setAttribute("aria-expanded", "false");
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
  etat.progres = progression.charger(stockage());
  const select = $("#langue");
  for (const l of etat.config.langues) {
    const o = document.createElement("option");
    o.value = l; o.textContent = l.toUpperCase();
    select.append(o);
  }
  select.value = langueInitiale(etat.config.langues);
  await appliquerLangue(select.value);
  select.addEventListener("change", async () => { ecrirePreference(select.value); await appliquerLangue(select.value); });

  // Emplacements préparés, masqués tant que l'authentification n'est pas activée (ADR 0010, phase C).
  $("#se-connecter").hidden = !etat.config.connexionActive;
  $("#mon-compte").hidden = !etat.config.connexionActive;

  ajouterBienvenue();
  await chargerCatalogue();
  $("#ouvrir-catalogue").addEventListener("click", () => ($("#catalogue").classList.contains("ouvert") ? fermerCatalogue() : ouvrirCatalogue()));
  $("#fermer-catalogue").addEventListener("click", () => { fermerCatalogue(); $("#ouvrir-catalogue").focus(); });
  $("#voile-catalogue").addEventListener("click", fermerCatalogue);
  $("#recherche-notion").addEventListener("input", rendreCatalogue);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("#catalogue").classList.contains("ouvert")) { fermerCatalogue(); $("#ouvrir-catalogue").focus(); }
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
  $("#ouvrir-progres").addEventListener("click", () => { remplirProgres(); dialogueProgres.showModal(); });
  brancherDialogue(dialogueProgres, $("#fermer-progres"));

  const dialogue = $("#signalement");
  $("#ouvrir-signalement").addEventListener("click", () => { $("#retour-signalement").textContent = ""; dialogue.showModal(); });
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
}

demarrer();
