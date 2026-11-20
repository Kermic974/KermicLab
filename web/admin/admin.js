// Back-office KermicLab (ADR 0026). Interface en français seulement, comme le blog : outil interne de l'équipe.
// Tout le contenu est construit par le DOM (jamais innerHTML) ; aucune donnée n'est gardée hors de l'onglet.
import { THEME_PERSONNALISE, deriverVariables } from "../theme.js";
import { bilanPortefeuille, estimerSouscription, repartitionFixes } from "./financier.js";

const CLE_SESSION = "kermiclab:admin:cle";
const $ = (s) => document.querySelector(s);

/** Crée un élément : `h("td", { class: "nombre", text: "3" })`, `h("button", { onclick: f }, "Texte")`. */
function h(balise, props = {}, ...enfants) {
  const e = document.createElement(balise);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "value") e.value = v;
    // Styles par le CSSOM (permis par la CSP du site, qui interdit l'attribut `style` en ligne).
    else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
    else if (k === "checked" || k === "selected" || k === "disabled") e[k] = !!v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  e.append(...enfants.flat().filter((x) => x !== null && x !== undefined && x !== false));
  return e;
}

const LIBELLES = {
  categories: { requete: "Requêtes", "donnees-personnelles": "Données personnelles", sexuel: "Contenu sexuel", "contenu-dangereux": "Contenu dangereux", detresse: "Détresse", "injection-directe": "Injection directe", "injection-indirecte": "Injection indirecte" },
  comportements: { "messages-personnels": "Messages à caractère personnel", "contenu-sexuel": "Contenu sexuel", "contenu-dangereux": "Contenu dangereux", detresse: "Détresse", "injection-directe": "Tentative d'injection directe", "injection-indirecte": "Tentative d'injection indirecte", "consommation-elevee": "Consommation élevée", surconsommation: "Surconsommation" },
  etats: { normal: "Normal", surveille: "Surveillé", restreint: "Restreint (IA coupée)", suspendu: "Suspendu" },
  fonctionnalites: { chat: "Poser une question", "ia.tuteur": "Tuteur IA", "ia.defi": "Défi express généré par l'IA", "ia.cahiers": "Cahiers enrichis par l'IA", "ia.idees": "Cadrage d'idée par l'IA", jeux: "Jeux", cahiers: "Mes cahiers", defi: "Défi express", "contributions.proposer": "Proposer une contribution", "contributions.relire": "Relire les contributions", famille: "Espace famille", synchronisation: "Compte et synchronisation", professeur: "Expérience Professeur (classes et élèves)", "admin.utilisateurs": "Back-office : utilisateurs", "admin.roles": "Back-office : rôles et accès", "admin.securite": "Back-office : sécurité", "admin.donnees": "Back-office : données personnelles", "admin.telemetrie": "Back-office : télémétrie", "admin.theme": "Back-office : charte graphique", "admin.contenus": "Back-office : contenus", "admin.harness": "Back-office : harness" },
  modes: { tous: "Tous les utilisateurs", roles: "Rôles ou niveaux choisis", personne: "Fermée" },
  types: { cours: "Cours", jeu: "Jeu", blog: "Article de blog", parcours: "Parcours", lab: "Lab" },
  statuts: { brouillon: "Brouillon", propose: "Proposé en revue", publie: "Publié", archive: "Archivé" },
  comptes: { compte: "Compte famille", "compte-local": "Compte local" },
  donnees: { aucune: "Aucune donnée personnelle", pseudonyme: "Pseudonyme", minimale: "Donnée personnelle minimale" },
  actionsAssistant: { "modifier-roles-niveau": "Modifier les rôles et le niveau", "definir-etat-securite": "Définir l'état de sécurité", exporter: "Exporter les données", "reinitialiser-mot-de-passe": "Réinitialiser le mot de passe", supprimer: "Supprimer le compte" },
  ecartees: { "action-inconnue": "action non autorisée", doublon: "proposée deux fois", "type-de-compte": "impossible pour ce type de compte", "trop-d-actions": "au-delà de quatre actions", "role-inconnu": "rôle inconnu", "niveau-inconnu": "niveau inconnu", "sans-effet": "ne change rien", "etat-invalide": "état inconnu", "profil-absent": "profil de sécurité absent" },
  raisons: { "controle-inactif": "contrôle inactif", "ouverte-a-tous": "ouverte à tous", "role-autorise": "rôle autorisé", "niveau-autorise": "niveau autorisé", "permission-absente": "le rôle n'a pas cette permission", strategie: "réservée à d'autres rôles", "hors-souscription": "non incluse dans la souscription", "fonctionnalite-fermee": "fonctionnalité fermée", "role-inconnu": "rôle inconnu" },
  erreurs: {
    "cle-invalide": "Clé d'accès refusée.", "trop-de-tentatives": "Trop d'essais. Attends une minute.", "back-office-non-configure": "Le back-office n'est pas configuré sur ce serveur (secret BACKOFFICE_JETON absent).",
    "back-office-indisponible": "Le back-office est indisponible : la migration 0002 n'est peut-être pas appliquée.", "origine-refusee": "Cette adresse n'est pas autorisée à appeler l'API.",
    "role-inconnu": "Ce rôle n'existe pas.", "niveau-inconnu": "Ce niveau n'existe pas.", "role-dans-souscription": "Ce rôle est utilisé par une souscription : change d'abord son rôle.",
    "souscription-gratuite": "La souscription « Gratuit » est permanente : elle ne se supprime pas.", "trop-de-souscriptions": "Huit souscriptions au plus.", "statut-invalide": "Statut invalide.", "mode-prix-invalide": "Mode de calcul du prix invalide.", "devise-invalide": "Devise invalide.", "role-attribue": "Ce rôle est encore attribué à un compte.", "niveau-attribue": "Ce niveau est encore attribué à un compte.",
    "identifiant-invalide": "Identifiant invalide : minuscules, chiffres et tirets.", "libelle-requis": "Le libellé est obligatoire.", "valeurs-refusees": "Certaines valeurs sont refusées : rien n'a été enregistré.",
    "hors-bornes": "hors des bornes permises", "alias-invalide": "identifiant de modèle invalide", "trop-long": "texte trop long", "booleen-attendu": "oui ou non attendu", "valeur-inconnue": "valeur inconnue", "parametre-inconnu": "paramètre inconnu",
    "donnees-personnelles": "Le texte contient une donnée personnelle (e-mail, téléphone, adresse, identité) : retire-la.", "contraire-au-socle": "Ce texte chercherait à lever le socle de sécurité : il est refusé.",
    "injection-indirecte": "Le texte contient une consigne dissimulée ou un balisage actif : il est refusé.", "couleur-invalide": "Couleur invalide : format #rrggbb attendu.", "titre-invalide": "Le titre est obligatoire (120 caractères au plus).",
    "corps-trop-long": "Le texte dépasse 20 000 caractères.", "etapes-invalides": "Les étapes doivent être des contenus du catalogue, sans doublon (30 au plus).", "publication-par-pr": "Ce contenu se publie par une PR fusionnée par le propriétaire : propose-le en revue.",
    "parcours-sans-revue": "Un parcours se publie directement.", "github-non-configure": "GitHub n'est pas configuré sur ce serveur.", "github-indisponible": "GitHub n'a pas répondu. Réessaie plus tard.", "introuvable": "Élément introuvable.", "etat-invalide": "État invalide.", reseau: "Le serveur ne répond pas.",
    "assistant-desactive": "L'assistant IA est désactivé (Harness → Assistant IA des utilisateurs, ou IA coupée sur le site).", "assistant-indisponible": "L'assistant IA ne répond pas (AI Gateway indisponible). Réessaie plus tard.",
    "assistant-refus": "Le modèle a refusé de traiter cette consigne.", "assistant-reponse-invalide": "La réponse du modèle est inexploitable. Reformule la consigne.", "consigne-invalide": "Écris une consigne de 1 à 500 caractères."
  }
};
const lib = (famille, cle) => LIBELLES[famille]?.[cle] ?? cle;
const nombre = (n) => new Intl.NumberFormat("fr-FR").format(Number(n) || 0);
const dateCourte = (texte) => (texte ? String(texte).slice(0, 16).replace("T", " ") : "—");

// ---------- Client de l'API ----------

let apiUrl = "";
let libellesParametres = {};

async function api(methode, chemin, corps) {
  let reponse;
  try {
    reponse = await fetch(`${apiUrl}/api/admin${chemin}`, {
      method: methode,
      headers: { authorization: `Bearer ${sessionStorage.getItem(CLE_SESSION) ?? ""}`, ...(corps === undefined ? {} : { "content-type": "application/json" }) },
      ...(corps === undefined ? {} : { body: JSON.stringify(corps) })
    });
  } catch {
    throw Object.assign(new Error("reseau"), { code: "reseau" });
  }
  let donnees = null;
  try { donnees = await reponse.json(); } catch { /* réponse sans corps */ }
  if (!reponse.ok) {
    if (reponse.status === 401) fermerSession();
    throw Object.assign(new Error(donnees?.erreur ?? "erreur"), { code: donnees?.erreur ?? "erreur", details: donnees?.details, statut: reponse.status });
  }
  return donnees;
}

function annoncer(texte, { erreur = false } = {}) {
  const zone = $("#message");
  zone.textContent = texte;
  zone.classList.toggle("erreur", erreur);
  zone.hidden = !texte;
}
const CHAMPS_BORNES = {
  tokensSession: "tokens par session", tokensAppel: "tokens par réponse", defisJour: "défis IA par jour", cahiersJour: "cahiers IA par jour", cahiersMois: "cahiers IA par mois", enfantsMax: "enfants rattachés",
  classesMax: "classes", elevesMax: "élèves suivis", joursActifsMois: "jours d'usage par mois", tauxUtilisation: "part du quota consommée", prixMensuelHT: "prix mensuel HT",
  margeCible: "marge visée", remiseAnnuelle: "remise annuelle", tauxTva: "TVA", coutsFixesMensuels: "coûts fixes", utilisateursEstimes: "utilisateurs estimés",
  fraisPaiementPourcent: "frais de paiement (%)", fraisPaiementFixe: "frais de paiement fixes"
};
const messageErreur = (e) => {
  if (String(e.code).startsWith("hors-bornes:")) {
    const champ = e.code.slice(12);
    return `Valeur hors des bornes permises : ${CHAMPS_BORNES[champ] ?? champ.replace(/^(prix|ratio)-/, "$1 du module ")}.`;
  }
  const base = lib("erreurs", e.code);
  if (!e.details || typeof e.details !== "object" || Array.isArray(e.details.motifs)) return base;
  return `${base} ${Object.entries(e.details).map(([cle, code]) => `${libellesParametres[`configParam_${cle}`] ?? cle} : ${lib("erreurs", String(code).split(":")[0])}`).join(" ; ")}`;
};

/** Exécute une écriture puis recharge l'écran ; l'erreur éventuelle est annoncée, jamais avalée. */
async function agir(action, succes) {
  try {
    await action();
    await afficher(ecranCourant, { garderMessage: true });
    annoncer(succes);
  } catch (e) {
    annoncer(messageErreur(e), { erreur: true });
  }
}

// ---------- Petits composants ----------

const pastille = (texte, ton = "") => h("span", { class: `admin-pastille ${ton}`.trim(), text: texte });
const tonEtat = { normal: "ok", surveille: "attention", restreint: "danger", suspendu: "danger" };
const bloc = (titre, ...enfants) => h("section", { class: "carte admin-bloc" }, h("h2", { text: titre }), ...enfants);
const tuile = (valeur, legende) => h("div", { class: "carte admin-tuile" }, h("strong", { text: valeur }), h("span", { text: legende }));
const selecteur = (options, valeur, props = {}) => h("select", props, options.map(([v, texte]) => h("option", { value: v, selected: v === valeur, text: texte })));

/** Tableau accessible : `colonnes` = [{ titre, nombre?, cellule: (ligne) => noeud | texte }]. */
function tableau(legende, colonnes, lignes, vide = "Aucune donnée pour le moment.") {
  if (!lignes.length) return h("p", { class: "doux", text: vide });
  return h("div", { class: "admin-defilement" }, h("table", {},
    h("caption", { text: legende }),
    h("thead", {}, h("tr", {}, colonnes.map((c) => h("th", { scope: "col", class: c.nombre ? "nombre" : null, text: c.titre })))),
    h("tbody", {}, lignes.map((ligne) => h("tr", {}, colonnes.map((c) => {
      const contenu = c.cellule(ligne);
      return h("td", { class: c.nombre ? "nombre" : null }, contenu instanceof Node ? contenu : String(contenu ?? "—"));
    }))))
  ));
}
const jauge = (valeur, max) => h("meter", { min: 0, max: Math.max(1, max), value: valeur, title: nombre(valeur) });

// ---------- Écrans ----------

async function ecranApercu() {
  const [etat, telemetrie, securite, donnees, utilisateurs] = await Promise.all([api("GET", "/etat"), api("GET", "/telemetrie?jours=7"), api("GET", "/securite?jours=7"), api("GET", "/donnees"), api("GET", "/utilisateurs")]);
  const requetes = telemetrie.requetes.parJour.filter((l) => l.type === "demande").reduce((s, l) => s + l.n, 0);
  const signaux = securite.parJour.filter((l) => l.categorie !== "requete").reduce((s, l) => s + l.n, 0);
  return [
    h("div", { class: "admin-grille" },
      tuile(nombre(utilisateurs.utilisateurs.length), "comptes"),
      tuile(nombre(etat.contenus), "contenus au catalogue"),
      tuile(nombre(requetes), "questions sur 7 jours"),
      tuile(nombre(telemetrie.llm.total.appels), "appels aux modèles sur 7 jours"),
      tuile(nombre(telemetrie.llm.total.tokensEntree + telemetrie.llm.total.tokensSortie), "tokens sur 7 jours"),
      tuile(nombre(signaux), "signaux de sécurité sur 7 jours")),
    bloc("État du site",
      h("div", { class: "admin-pastilles" },
        pastille(etat.llmActif ? "IA activée" : "IA coupée", etat.llmActif ? "ok" : "attention"),
        pastille(etat.controleAcces ? "Contrôle d'accès appliqué" : "Accès : tous les utilisateurs (bêta)", etat.controleAcces ? "accent" : "attention"),
        pastille(etat.gardeFous ? "Garde-fous appliqués" : "Garde-fous en observation", etat.gardeFous ? "ok" : "attention"),
        pastille(donnees.controle.conforme ? "Aucune donnée personnelle conservée" : "Donnée personnelle détectée en base", donnees.controle.conforme ? "ok" : "danger")),
      h("p", { class: "doux", text: "Pendant la bêta, les rôles et les stratégies d'accès sont préparés mais ne limitent aucune fonctionnalité. Les garde-fous observent et classent ; ils n'agissent qu'une fois activés dans « Harness »." })),
    bloc("Profils à regarder", tableauProfils(securite, { lecture: true }))
  ];
}

let instantaneUtilisateurs;
/** Recherche par identifiant unique (donné par l'utilisateur depuis « Ce que Kermiclab sait de moi », ADR 0024 §3 ter). */
let rechercheUtilisateur = "";
const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
async function ecranUtilisateurs() {
  const donnees = await api("GET", rechercheUtilisateur ? `/utilisateurs?id=${rechercheUtilisateur}` : "/utilisateurs");
  return rendreUtilisateurs(donnees);
}

function rechercheParIdentifiant() {
  const champ = h("input", { type: "search", id: "recherche-utilisateur", value: rechercheUtilisateur, placeholder: "00000000-0000-4000-8000-000000000000", spellcheck: "false", autocomplete: "off", "aria-describedby": "recherche-utilisateur-aide" });
  const chercher = (valeur) => {
    const id = valeur.trim().toLowerCase();
    if (id && !FORMAT_UUID.test(id)) { annoncer("Identifiant unique invalide : 36 caractères, au format affiché dans « Ce que Kermiclab sait de moi ».", { erreur: true }); return; }
    rechercheUtilisateur = id;
    void afficher(ecranCourant);
  };
  return h("form", { class: "admin-ligne", onsubmit: (ev) => { ev.preventDefault(); chercher(champ.value); } },
    h("label", { for: "recherche-utilisateur", text: "Identifiant unique" }), champ,
    h("button", { type: "submit", class: "secondaire petit-bouton" }, "Rechercher"),
    rechercheUtilisateur ? h("button", { type: "button", class: "secondaire petit-bouton", onclick: () => chercher("") }, "Tout afficher") : null,
    h("p", { id: "recherche-utilisateur-aide", class: "doux petit", text: "L'utilisateur trouve cet identifiant dans Mon compte → « Ce que Kermiclab sait de moi ». Ne demandez jamais son mot de passe ni sa clé de récupération." }));
}

/**
 * Réinitialisation du mot de passe d'un compte local : le mot de passe provisoire n'est affiché qu'une fois, à
 * transmettre à l'utilisateur, qui devra le changer à sa prochaine connexion. Ses données synchronisées restent
 * chiffrées par une clé que le back-office ne connaît pas.
 */
async function reinitialiserMotDePasse(u, zone) {
  if (!confirm(`Réinitialiser le mot de passe du compte ${u.id} ?\n\nUn mot de passe provisoire sera affiché une seule fois. Les sessions du compte seront fermées et l'utilisateur devra choisir un nouveau mot de passe à sa prochaine connexion. Vérifiez d'abord que la demande vient bien du titulaire du compte.`)) return;
  try {
    const { motDePasse } = await api("POST", `/utilisateurs/compte-local/${u.id}/mot-de-passe`);
    zone.replaceChildren(
      h("p", { text: `Mot de passe provisoire du compte ${u.id} (affiché une seule fois, jamais enregistré en clair ni journalisé) :` }),
      h("p", { class: "code-provisoire" }, h("code", { text: motDePasse })),
      h("p", { class: "doux petit", text: "Transmettez-le à l'utilisateur par un canal sûr. À sa connexion, il devra en choisir un nouveau ; s'il synchronise ses données, il les retrouvera avec un code d'appairage ou son kit de récupération." }),
      h("button", { type: "button", class: "secondaire petit-bouton", onclick: () => { zone.replaceChildren(); zone.hidden = true; } }, "Masquer"));
    zone.hidden = false;
    zone.focus();
    annoncer("Mot de passe réinitialisé. La réinitialisation est notée au journal (sans le mot de passe).");
  } catch (e) { annoncer(messageErreur(e), { erreur: true }); }
}

async function exporterUtilisateur(u, zoneExport) {
  try {
    zoneExport.textContent = JSON.stringify(await api("GET", `/utilisateurs/${u.type}/${u.id}/export`), null, 2);
    zoneExport.hidden = false;
    zoneExport.focus();
    annoncer("Export affiché sous le tableau. L'export est noté au journal.");
  } catch (e) { annoncer(messageErreur(e), { erreur: true }); }
}

function supprimerUtilisateur(u) {
  if (confirm(`Supprimer définitivement ce ${lib("comptes", u.type).toLowerCase()} et toutes ses données ?`)) agir(() => api("DELETE", `/utilisateurs/${u.type}/${u.id}`), "Compte supprimé avec ses données.");
}

/**
 * Assistant IA (ADR 0035) : l'administrateur décrit ce qu'il veut faire sur un compte ; le modèle propose des actions
 * parmi celles de la ligne du tableau. Rien n'est exécuté sans un clic sur « Appliquer », qui passe par les mêmes
 * routes (et les mêmes confirmations) que les boutons de la ligne.
 */
function ouvrirAssistant(u, zone, { roles, zoneExport, zoneMotDePasse }) {
  const nomRole = (id) => roles.find((r) => r.id === id)?.libelle ?? id;
  const consigne = h("textarea", { id: "assistant-consigne", maxlength: "500", rows: "3", placeholder: "Ex. : passe ce compte en premium et ajoute le rôle bêta-testeur.", "aria-describedby": "assistant-aide" });
  const resultat = h("div", { class: "admin-assistant-resultat", "aria-live": "polite" });
  const appliquer = (a) => {
    if (a.action === "modifier-roles-niveau") return agir(() => api("PATCH", `/utilisateurs/${u.type}/${u.id}`, { roles: a.roles, niveau: a.niveau }), "Rôles et niveau enregistrés (proposition de l'assistant).");
    if (a.action === "definir-etat-securite") return agir(() => api("PUT", `/securite/profils/${u.profil}`, { etat: a.etat, jours: a.jours }), `État de sécurité : ${lib("etats", a.etat)} pour ${a.jours} jour(s).`);
    if (a.action === "exporter") return exporterUtilisateur(u, zoneExport);
    if (a.action === "reinitialiser-mot-de-passe") return reinitialiserMotDePasse(u, zoneMotDePasse);
    if (a.action === "supprimer") return supprimerUtilisateur(u);
  };
  const detail = (a) => {
    if (a.action === "modifier-roles-niveau") return `Rôles : ${a.roles.map(nomRole).join(" + ")} · niveau : ${a.niveau}`;
    if (a.action === "definir-etat-securite") return `${lib("etats", a.etat)} pendant ${a.jours} jour(s)`;
    return "";
  };
  const proposer = async (bouton) => {
    const texte = consigne.value.trim();
    if (!texte) { annoncer("Écris d'abord une consigne.", { erreur: true }); consigne.focus(); return; }
    bouton.disabled = true;
    resultat.replaceChildren(h("p", { class: "doux", text: "L'assistant prépare une proposition…" }));
    try {
      const plan = await api("POST", `/utilisateurs/${u.type}/${u.id}/assistant`, { consigne: texte });
      resultat.replaceChildren(
        h("p", { text: plan.resume || (plan.actions.length ? "Actions proposées :" : "Aucune action proposée.") }),
        plan.actions.length ? h("ol", { class: "admin-assistant-actions" }, plan.actions.map((a) => h("li", {},
          h("div", {}, h("strong", { text: lib("actionsAssistant", a.action) }), a.destructive ? pastille("irréversible", "danger") : null,
            detail(a) ? h("p", { class: "petit", text: detail(a) }) : null, a.motif ? h("p", { class: "doux petit", text: a.motif }) : null),
          h("button", { type: "button", class: `${a.destructive ? "danger" : "secondaire"} petit-bouton`, onclick: () => appliquer(a) }, "Appliquer")))) : null,
        plan.ecartees?.length ? h("p", { class: "doux petit", text: `Écarté par le serveur : ${plan.ecartees.map((e) => `${lib("actionsAssistant", e.action)} (${lib("ecartees", e.raison)})`).join(" ; ")}.` }) : null,
        h("p", { class: "doux petit", text: `Modèle : ${plan.modele}. Proposition notée au journal (sans la consigne).` }));
    } catch (e) {
      resultat.replaceChildren();
      annoncer(messageErreur(e), { erreur: true });
    } finally { bouton.disabled = false; }
  };
  const boutonProposer = h("button", { type: "button", onclick: (ev) => proposer(ev.currentTarget) }, "Proposer des actions");
  zone.replaceChildren(
    h("div", { class: "admin-ligne" }, h("h2", { text: "Assistant IA" }), h("code", { text: `${lib("comptes", u.type)} ${u.id}` })),
    h("label", { for: "assistant-consigne", class: "admin-champ" }, h("span", { text: "Que veux-tu faire sur ce compte ?" })), consigne,
    h("p", { id: "assistant-aide", class: "doux petit", text: "L'assistant propose ; tu appliques chaque action d'un clic. Il ne connaît ni l'identifiant ni aucune donnée personnelle du compte : seulement son type, ses rôles, son niveau et son état de sécurité. N'écris jamais de donnée personnelle dans la consigne." }),
    h("div", { class: "admin-ligne" }, boutonProposer,
      h("button", { type: "button", class: "secondaire petit-bouton", onclick: () => { zone.replaceChildren(); zone.hidden = true; } }, "Fermer")),
    resultat);
  zone.hidden = false;
  consigne.focus();
}

function rendreUtilisateurs(donnees) {
  instantaneUtilisateurs = JSON.stringify(donnees);
  const { utilisateurs, roles, niveaux } = donnees;
  const zoneExport = h("pre", { hidden: true, tabindex: "0", "aria-label": "Données exportées" });
  const zoneMotDePasse = h("div", { hidden: true, tabindex: "-1", class: "admin-bandeau zone-mot-de-passe", role: "status", "aria-label": "Mot de passe provisoire" });
  const zoneAssistant = h("section", { hidden: true, class: "carte admin-bloc zone-assistant", "aria-label": "Assistant IA" });
  const ligneActions = (u) => {
    // Rôles cumulatifs (ADR 0034) : plusieurs rôles cochés ; le rôle apporté par la souscription s'y ajoute.
    const choisis = u.roles ?? [u.role];
    const cases = roles.map((r) => h("input", { type: "checkbox", value: r.id, checked: choisis.includes(r.id), "data-role-compte": r.id }));
    const resume = h("summary", { text: choisis.map((id) => roles.find((r) => r.id === id)?.libelle ?? id).join(" + ") });
    const role = h("details", { class: "admin-roles", "aria-label": `Rôles du ${lib("comptes", u.type)} ${u.id.slice(0, 8)}` }, resume,
      h("fieldset", { class: "admin-cases" }, h("legend", { class: "visuellement-cache", text: "Rôles cumulés" }), cases.map((c) => h("label", {}, c, roles.find((r) => r.id === c.value).libelle))),
      u.roleOffre && !choisis.includes(u.roleOffre) ? h("p", { class: "doux petit", text: `+ ${roles.find((r) => r.id === u.roleOffre)?.libelle ?? u.roleOffre} (apporté par la souscription)` }) : null);
    role.addEventListener("change", () => {
      const liste = cases.filter((c) => c.checked).map((c) => roles.find((r) => r.id === c.value).libelle);
      resume.textContent = liste.length ? liste.join(" + ") : "Aucun rôle coché";
    });
    const niveau = selecteur(niveaux.map((n) => [n, n]), u.niveau, { "aria-label": `Niveau du ${lib("comptes", u.type)} ${u.id.slice(0, 8)}` });
    niveau.dataset.valeurInitiale = niveau.value;
    return { role, cases, niveau };
  };
  const rolesCoches = (u) => u.champs.cases.filter((c) => c.checked).map((c) => c.value);
  const lignes = utilisateurs.map((u) => ({ ...u, champs: ligneActions(u) }));
  return [
    h("p", { class: "admin-bandeau ok", text: "Aucun e-mail, aucun nom, aucune adresse IP n'est affiché ici : la base n'en contient pas. Un compte est identifié par un identifiant aléatoire." }),
    rechercheParIdentifiant(),
    zoneMotDePasse,
    zoneAssistant,
    bloc("Comptes", tableau(`${utilisateurs.length} compte(s)`, [
      { titre: "Type", cellule: (u) => lib("comptes", u.type) },
      { titre: "Identifiant", cellule: (u) => h("code", { text: rechercheUtilisateur ? u.id : u.id.slice(0, 8), title: u.id }) },
      { titre: "Rôles (cumulés)", cellule: (u) => u.champs.role },
      { titre: "Niveau", cellule: (u) => u.champs.niveau },
      { titre: "Sécurité", cellule: (u) => pastille(lib("etats", u.etat), tonEtat[u.etat]) },
      { titre: "Créé le", cellule: (u) => dateCourte(u.creeLe) },
      { titre: "Dernière connexion", cellule: (u) => (u.type === "compte" ? dateCourte(u.derniereConnexion) : u.bloque ? "bloqué (essais)" : u.provisoire ? "mot de passe provisoire" : "—") },
      { titre: "Enfants", nombre: true, cellule: (u) => (u.type === "compte" ? nombre(u.enfants) : "—") },
      { titre: "Actions", cellule: (u) => h("div", { class: "admin-ligne" },
        h("button", { type: "button", class: "secondaire petit-bouton", onclick: () => {
          const choisis = rolesCoches(u);
          if (!choisis.length) { annoncer("Coche au moins un rôle.", { erreur: true }); return; }
          agir(() => api("PATCH", `/utilisateurs/${u.type}/${u.id}`, { roles: choisis, niveau: u.champs.niveau.value }), "Rôles et niveau enregistrés.");
        } }, "Enregistrer"),
        h("button", { type: "button", class: "secondaire petit-bouton", onclick: () => exporterUtilisateur(u, zoneExport) }, "Exporter les données"),
        u.type === "compte-local" ? h("button", { type: "button", class: "secondaire petit-bouton", onclick: () => reinitialiserMotDePasse(u, zoneMotDePasse) }, "Réinitialiser le mot de passe") : null,
        h("button", { type: "button", class: "secondaire petit-bouton", "data-assistant": u.id, onclick: () => ouvrirAssistant(u, zoneAssistant, { roles, zoneExport, zoneMotDePasse }) }, "Assistant IA"),
        h("button", { type: "button", class: "danger petit-bouton", onclick: () => supprimerUtilisateur(u) }, "Supprimer")) }
    ], lignes, rechercheUtilisateur ? "Aucun compte avec cet identifiant unique." : "Aucun compte pour le moment : les visiteurs utilisent un pseudo gardé dans leur navigateur."), zoneExport)
  ];
}

async function ecranRoles() {
  const [{ roles, permissions, controleActif }, { strategies }, offres] = await Promise.all([api("GET", "/roles"), api("GET", "/strategies"), api("GET", "/souscriptions")]);
  // Les niveaux sont les souscriptions (ADR 0031).
  const niveaux = offres.souscriptions.map((s) => s.id);
  const toutes = [...permissions.fonctionnalites, ...permissions.administration];

  // Éditeur de rôle
  const choix = selecteur([...roles.map((r) => [r.id, `${r.libelle}${r.systeme ? "" : " (personnalisé)"}`]), ["", "Nouveau rôle…"]], roles[0].id, { id: "role-choisi" });
  const identifiant = h("input", { type: "text", id: "role-id", maxlength: "31", autocomplete: "off" });
  const libelle = h("input", { type: "text", id: "role-libelle", maxlength: "40", autocomplete: "off" });
  const description = h("input", { type: "text", id: "role-description", maxlength: "200", autocomplete: "off" });
  const cases = toutes.map((p) => h("input", { type: "checkbox", value: p }));
  const supprimer = h("button", { type: "button", class: "danger" }, "Supprimer");
  const remplir = () => {
    const r = roles.find((x) => x.id === choix.value);
    identifiant.value = r?.id ?? "";
    identifiant.disabled = !!r;
    libelle.value = r?.libelle ?? "";
    description.value = r?.description ?? "";
    cases.forEach((c) => { c.checked = !!r?.permissions.includes(c.value); });
    supprimer.hidden = !r || (r.systeme && !r.modifie);
    supprimer.textContent = r?.systeme ? "Revenir aux permissions d'origine" : "Supprimer ce rôle";
  };
  choix.addEventListener("change", remplir);
  supprimer.addEventListener("click", () => agir(() => api("DELETE", `/roles/${choix.value}`), "Rôle mis à jour."));
  remplir();

  // Stratégies
  const lignes = strategies.map((s) => ({
    ...s,
    mode: selecteur(Object.entries(LIBELLES.modes), s.mode, { "aria-label": `Accès à « ${lib("fonctionnalites", s.fonctionnalite)} »` }),
    roles: roles.map((r) => h("input", { type: "checkbox", value: r.id, checked: s.roles.includes(r.id) })),
    niveaux: niveaux.map((n) => h("input", { type: "checkbox", value: n, checked: s.niveaux.includes(n) }))
  }));
  const coches = (entrees) => entrees.filter((c) => c.checked).map((c) => c.value);
  // Les rôles et niveaux ne comptent que pour une stratégie réservée : ailleurs, les cases sont inactives.
  for (const s of lignes) {
    const ajuster = () => [...s.roles, ...s.niveaux].forEach((c) => { c.disabled = s.mode.value !== "roles"; });
    s.mode.addEventListener("change", ajuster);
    ajuster();
  }

  // Simulateur
  // Rôles cumulés (ADR 0034) : plusieurs rôles cochés ; le rôle de la souscription simulée s'y ajoute.
  const rolesSimules = roles.map((r) => h("input", { type: "checkbox", value: r.id, checked: r.id === "visiteur", "data-simulation-role": r.id }));
  const roleSimule = h("fieldset", { class: "admin-cases", id: "simulation-role" }, h("legend", { class: "visuellement-cache", text: "Rôles cumulés" }),
    rolesSimules.map((c) => h("label", {}, c, roles.find((r) => r.id === c.value).libelle)));
  const niveauSimule = selecteur(niveaux.map((n) => [n, n]), "gratuit", { id: "simulation-niveau" });
  const resultat = h("div", {});
  const simuler = async () => {
    try {
      const { decisions } = await api("POST", "/strategies/simuler", { roles: rolesSimules.filter((c) => c.checked).map((c) => c.value), niveau: niveauSimule.value });
      const decision = (d) => pastille(`${d.autorise ? "Autorisé" : "Refusé"} · ${lib("raisons", d.raison)}`, d.autorise ? "ok" : "danger");
      resultat.replaceChildren(tableau("Décision par fonctionnalité", [
        { titre: "Fonctionnalité", cellule: (d) => lib("fonctionnalites", d.fonctionnalite) },
        { titre: "Aujourd'hui", cellule: (d) => decision(d.enVigueur) },
        { titre: "Si le contrôle était activé", cellule: (d) => decision(d.siControleActif) }
      ], decisions));
    } catch (e) { annoncer(messageErreur(e), { erreur: true }); }
  };

  return [
    h("p", { class: `admin-bandeau${controleActif ? " ok" : ""}`, text: controleActif
      ? "Le contrôle d'accès est activé : les stratégies ci-dessous s'appliquent."
      : "Contrôle d'accès inactif : pendant la bêta, toutes les fonctionnalités sont ouvertes à tous les utilisateurs. Les rôles et les stratégies ci-dessous sont enregistrés et prêts, sans effet pour le moment." }),
    bloc("Rôles",
      tableau(`${roles.length} rôle(s)`, [
        { titre: "Rôle", cellule: (r) => h("strong", { text: r.libelle }) },
        { titre: "Identifiant", cellule: (r) => h("code", { text: r.id }) },
        { titre: "Origine", cellule: (r) => pastille(r.systeme ? (r.modifie ? "Système, modifié" : "Système") : "Personnalisé", r.systeme ? "" : "accent") },
        { titre: "Description", cellule: (r) => r.description },
        { titre: "Permissions", nombre: true, cellule: (r) => `${r.permissions.length} / ${toutes.length}` }
      ], roles),
      h("h3", { text: "Modifier ou créer un rôle" }),
      h("div", { class: "admin-ligne" },
        h("label", { class: "admin-champ" }, h("span", { text: "Rôle" }), choix),
        h("label", { class: "admin-champ" }, h("span", { text: "Identifiant" }), identifiant),
        h("label", { class: "admin-champ" }, h("span", { text: "Libellé" }), libelle),
        h("label", { class: "admin-champ" }, h("span", { text: "Description" }), description)),
      h("fieldset", { class: "admin-cases" }, h("legend", { class: "visuellement-cache", text: "Permissions du rôle" }),
        cases.map((c) => h("label", {}, c, lib("fonctionnalites", c.value)))),
      h("div", { class: "admin-ligne" },
        h("button", { type: "button", class: "bouton", onclick: () => agir(() => api("PUT", `/roles/${encodeURIComponent(identifiant.value.trim())}`, { libelle: libelle.value, description: description.value, permissions: coches(cases) }), "Rôle enregistré.") }, "Enregistrer le rôle"),
        supprimer)),
    bloc("Stratégies d'accès",
      tableau("Une stratégie par fonctionnalité", [
        { titre: "Fonctionnalité", cellule: (s) => lib("fonctionnalites", s.fonctionnalite) },
        { titre: "Accès", cellule: (s) => s.mode },
        { titre: "Rôles autorisés", cellule: (s) => h("div", { class: "admin-ligne" }, s.roles.map((c) => h("label", { class: "admin-ligne" }, c, roles.find((r) => r.id === c.value).libelle))) },
        { titre: "Niveaux autorisés", cellule: (s) => h("div", { class: "admin-ligne" }, s.niveaux.map((c) => h("label", { class: "admin-ligne" }, c, c.value))) },
        { titre: "", cellule: (s) => h("button", { type: "button", class: "secondaire petit-bouton", onclick: () => agir(() => api("PUT", `/strategies/${s.fonctionnalite}`, { mode: s.mode.value, roles: coches(s.roles), niveaux: coches(s.niveaux) }), "Stratégie enregistrée.") }, "Enregistrer") }
      ], lignes)),
    bloc("Simulateur",
      h("p", { class: "doux", text: "Vérifie ce qu'un compte pourrait faire avant d'activer le contrôle d'accès. Les rôles se cumulent : un compte reçoit l'union de leurs permissions, plus le rôle apporté par sa souscription." }),
      h("div", { class: "admin-ligne" },
        h("div", { class: "admin-champ" }, h("span", { text: "Rôles" }), roleSimule),
        h("label", { class: "admin-champ" }, h("span", { text: "Niveau" }), niveauSimule),
        h("button", { type: "button", class: "bouton", onclick: simuler }, "Simuler")),
      resultat)
  ];
}

function tableauProfils(securite, { lecture = false } = {}) {
  const lignes = securite.profils.map((p) => ({
    ...p,
    choix: selecteur(Object.entries(LIBELLES.etats), p.etat, { "aria-label": `État du profil ${p.profil.slice(0, 8)}` }),
    jours: h("input", { type: "number", min: "1", max: "90", value: "7", "aria-label": `Durée en jours pour le profil ${p.profil.slice(0, 8)}` })
  }));
  return tableau(`Profils pseudonymes avec des signaux sur ${securite.fenetreJours} jours`, [
    { titre: "Profil", cellule: (p) => h("code", { text: p.profil.slice(0, 8), title: p.profil }) },
    { titre: "État", cellule: (p) => h("div", { class: "admin-pastilles" }, pastille(lib("etats", p.etat), tonEtat[p.etat]), p.decidePar ? pastille(p.decidePar === "admin" ? "décision humaine" : "règles") : null) },
    { titre: "Comportements", cellule: (p) => h("div", { class: "admin-pastilles" }, p.comportements.map((c) => pastille(lib("comportements", c), c === "detresse" ? "accent" : "attention"))) },
    { titre: "Score", nombre: true, cellule: (p) => nombre(p.score) },
    { titre: "Requêtes", nombre: true, cellule: (p) => nombre(p.requetes) },
    { titre: "Jusqu'au", cellule: (p) => p.expireLe ?? "—" },
    ...(lecture ? [] : [{ titre: "Décider", cellule: (p) => h("div", { class: "admin-ligne" }, p.choix, p.jours, h("span", { class: "doux petit", text: "jours" }),
      h("button", { type: "button", class: "secondaire petit-bouton", onclick: () => agir(() => api("PUT", `/securite/profils/${p.profil}`, { etat: p.choix.value, jours: Number(p.jours.value) }), "Décision enregistrée.") }, "Appliquer")) }])
  ], lignes, "Aucun profil déviant sur la période.");
}

async function ecranSecurite() {
  const securite = await api("GET", "/securite?jours=7");
  const totaux = new Map();
  for (const { categorie, n } of securite.parJour) totaux.set(categorie, (totaux.get(categorie) ?? 0) + n);
  const requetes = totaux.get("requete") ?? 0;
  const modules = new Map();
  for (const { module, categorie, n } of securite.parModule) {
    const m = modules.get(module) ?? { module, requetes: 0, signaux: 0 };
    if (categorie === "requete") m.requetes += n; else m.signaux += n;
    modules.set(module, m);
  }
  const texte = h("textarea", { id: "essai-texte", maxlength: "2000", rows: "4" });
  const origine = selecteur([["utilisateur", "Message d'un utilisateur"], ["contenu", "Contenu (page, brouillon, document)"]], "utilisateur", { id: "essai-origine" });
  const sortie = h("div", { "aria-live": "polite" });
  const analyser = async () => {
    try {
      const r = await api("POST", "/securite/analyser", { texte: texte.value, origine: origine.value });
      sortie.replaceChildren(
        h("div", { class: "admin-pastilles" }, r.categories.length ? r.categories.map((c) => pastille(lib("categories", c), "attention")) : pastille("Aucun signal", "ok")),
        r.motifs.length ? h("p", { class: "doux", text: `Règles déclenchées : ${r.motifs.join(", ")}.` }) : null,
        h("p", {}, h("strong", { text: "Ce qui partirait vers un modèle : " })), h("pre", { text: r.apercuPseudonymise }),
        h("p", {}, h("strong", { text: "Ce qui serait conservé : " }), `${r.conserve.join(" ; ")}. Jamais le texte.`));
    } catch (e) { annoncer(messageErreur(e), { erreur: true }); }
  };
  return [
    h("p", { class: `admin-bandeau${securite.gardeFousActifs ? " ok" : ""}`, text: securite.gardeFousActifs
      ? "Garde-fous appliqués : un profil restreint n'a plus accès à l'IA, un profil suspendu ne peut plus poser de question."
      : "Garde-fous en observation : les profils sont classés, aucune restriction n'est appliquée. Activation dans « Harness », module Sécurité." }),
    bloc("Signaux des 7 derniers jours",
      h("p", { class: "doux", text: "Chaque requête est analysée avant tout traitement. Seule la catégorie incrémente un compteur : le texte n'est ni journalisé ni stocké." }),
      tableau(`${nombre(requetes)} requête(s) analysée(s)`, [
        { titre: "Catégorie", cellule: (c) => lib("categories", c) },
        { titre: "Signaux", nombre: true, cellule: (c) => nombre(totaux.get(c) ?? 0) },
        { titre: "Part des requêtes", cellule: (c) => jauge(totaux.get(c) ?? 0, requetes) }
      ], securite.categories),
      tableau("Par module", [
        { titre: "Module", cellule: (m) => m.module },
        { titre: "Requêtes", nombre: true, cellule: (m) => nombre(m.requetes) },
        { titre: "Signaux", nombre: true, cellule: (m) => nombre(m.signaux) }
      ], [...modules.values()])),
    bloc("Analyse comportementale des profils",
      h("p", { class: "doux", text: `Seuils sur ${securite.fenetreJours} jours : surveillance à partir d'un score de ${securite.seuils.surveillance}, restriction à ${securite.seuils.restriction} ; consommation élevée à ${nombre(securite.seuils.consoElevee)} requêtes par jour, surconsommation à ${nombre(securite.seuils.surconsommation)}. La suspension est toujours une décision humaine ; la détresse n'est jamais sanctionnée.` }),
      tableauProfils(securite)),
    bloc("Banc d'essai",
      h("p", { class: "doux", text: "Colle un texte pour voir ce que l'analyse détecte. Rien de ce que tu saisis ici n'est enregistré." }),
      h("label", { class: "admin-champ" }, h("span", { text: "Texte à analyser" }), texte),
      h("div", { class: "admin-ligne" }, h("label", { class: "admin-champ" }, h("span", { text: "Origine" }), origine), h("button", { type: "button", class: "bouton", onclick: analyser }, "Analyser")),
      sortie)
  ];
}

async function ecranDonnees() {
  const { registre, volumes, controle, conservation } = await api("GET", "/donnees");
  return [
    h("p", { class: `admin-bandeau ${controle.conforme ? "ok" : "danger"}`, text: controle.conforme
      ? `Contrôle du ${dateCourte(controle.controleLe)} : aucune donnée personnelle détectée et aucun texte libre dans les tables alimentées par les requêtes.`
      : `Contrôle du ${dateCourte(controle.controleLe)} : une donnée personnelle ou un texte libre a été détecté. Voir le détail ci-dessous.` }),
    bloc("Contrôle de non-conservation",
      h("p", { class: "doux", text: "Les tables alimentées par les requêtes sont relues avec les détecteurs de la pseudonymisation (e-mail, téléphone, adresse, identité, URL, identifiant). Le contrôle ne renvoie que des compteurs." }),
      tableau("Résultat par table", [
        { titre: "Table", cellule: (t) => h("code", { text: t.table }) },
        { titre: "Lignes lues", nombre: true, cellule: (t) => (t.absente ? "absente" : nombre(t.lignes)) },
        { titre: "Valeurs contrôlées", nombre: true, cellule: (t) => nombre(t.valeurs) },
        { titre: "Détections", nombre: true, cellule: (t) => nombre(t.detections) },
        { titre: "Textes libres", nombre: true, cellule: (t) => nombre(t.textesLibres) },
        { titre: "Verdict", cellule: (t) => pastille(t.detections || t.textesLibres ? "À examiner" : "Conforme", t.detections || t.textesLibres ? "danger" : "ok") }
      ], controle.tables)),
    bloc("Registre des traitements",
      tableau("Ce que chaque table contient, pourquoi et combien de temps", [
        { titre: "Table", cellule: (t) => h("code", { text: t.table }) },
        { titre: "Finalité", cellule: (t) => t.finalite },
        { titre: "Contenu", cellule: (t) => t.contenu },
        { titre: "Données", cellule: (t) => pastille(lib("donnees", t.donnees), t.donnees === "aucune" ? "ok" : t.donnees === "minimale" ? "attention" : "") },
        { titre: "Conservation", cellule: (t) => t.conservation },
        { titre: "Lignes", nombre: true, cellule: (t) => (volumes[t.table] === null ? "absente" : nombre(volumes[t.table])) }
      ], registre)),
    bloc("Conservation",
      h("p", { text: `Signaux de sécurité : ${conservation.signauxJours} jours. Télémétrie : ${conservation.telemetrieJours} jours. La purge tourne chaque nuit ; ces durées se règlent dans « Harness », module Sécurité.` }),
      h("div", { class: "admin-ligne" }, h("button", { type: "button", class: "secondaire", onclick: () => agir(() => api("POST", "/donnees/purger"), "Purge de conservation effectuée.") }, "Lancer la purge maintenant")))
  ];
}

let periodeTelemetrie = 7;
async function ecranTelemetrie() {
  const t = await api("GET", `/telemetrie?jours=${periodeTelemetrie}`);
  const total = t.llm.total;
  const maxTokens = Math.max(1, ...t.llm.parJour.map((j) => j.tokensEntree + j.tokensSortie));
  const types = new Map();
  for (const { type, n } of t.requetes.parJour) types.set(type, (types.get(type) ?? 0) + n);
  const periode = selecteur([["7", "7 jours"], ["30", "30 jours"], ["90", "90 jours"]], String(periodeTelemetrie), { id: "periode" });
  periode.addEventListener("change", () => { periodeTelemetrie = Number(periode.value); afficher("telemetrie"); });
  const colonnesTokens = [
    { titre: "Appels", nombre: true, cellule: (l) => nombre(l.appels) },
    { titre: "Tokens entrants", nombre: true, cellule: (l) => nombre(l.tokensEntree) },
    { titre: "Tokens sortants", nombre: true, cellule: (l) => nombre(l.tokensSortie) },
    { titre: "Durée moyenne", nombre: true, cellule: (l) => `${nombre(Math.round(l.dureeMs / Math.max(1, l.appels)))} ms` }
  ];
  return [
    h("p", { class: "admin-bandeau ok", text: "Télémétrie anonyme : compteurs agrégés à l'heure par module et par modèle. Aucun identifiant de session, de profil ou de requête, aucun texte." }),
    h("div", { class: "admin-ligne" }, h("label", { class: "admin-champ" }, h("span", { text: "Période" }), periode)),
    h("div", { class: "admin-grille" },
      tuile(nombre(total.appels), "appels aux modèles"),
      tuile(nombre(total.tokensEntree), "tokens entrants"),
      tuile(nombre(total.tokensSortie), "tokens sortants"),
      tuile(`${nombre(Math.round(total.dureeMs / Math.max(1, total.appels)))} ms`, "durée moyenne d'un appel"),
      tuile(nombre(total.pseudonymisations), "données remplacées avant envoi")),
    bloc("Modèles", tableau("Par fournisseur et modèle", [{ titre: "Fournisseur", cellule: (l) => l.fournisseur }, { titre: "Modèle", cellule: (l) => h("code", { text: l.modele }) }, ...colonnesTokens], t.llm.parModele, "Aucun appel à un modèle sur la période.")),
    bloc("Harness", tableau("Par module", [{ titre: "Module", cellule: (l) => l.module }, ...colonnesTokens], t.llm.parModule, "Aucun appel à un modèle sur la période."),
      tableau("Par résultat", [{ titre: "Résultat", cellule: (l) => l.statut }, { titre: "Appels", nombre: true, cellule: (l) => nombre(l.appels) }], t.llm.parStatut, "")),
    bloc("Tokens par jour", tableau("Tokens entrants et sortants", [
      { titre: "Jour", cellule: (l) => l.jour },
      { titre: "Appels", nombre: true, cellule: (l) => nombre(l.appels) },
      { titre: "Tokens", nombre: true, cellule: (l) => nombre(l.tokensEntree + l.tokensSortie) },
      { titre: "", cellule: (l) => jauge(l.tokensEntree + l.tokensSortie, maxTokens) }
    ], t.llm.parJour, "Aucun appel à un modèle sur la période.")),
    bloc("Requêtes du site",
      tableau("Événements par type", [{ titre: "Type", cellule: ([type]) => type }, { titre: "Nombre", nombre: true, cellule: ([, n]) => nombre(n) }], [...types.entries()].sort((a, b) => b[1] - a[1]), "Aucune requête sur la période."),
      tableau("Routage des réponses", [{ titre: "Routage", cellule: (l) => l.routage }, { titre: "Nombre", nombre: true, cellule: (l) => nombre(l.n) }], t.requetes.routages, ""),
      tableau("Refus par motif", [{ titre: "Motif", cellule: (l) => l.motif }, { titre: "Nombre", nombre: true, cellule: (l) => nombre(l.n) }], t.requetes.refus, ""))
  ];
}

async function ecranTheme() {
  const etat = await api("GET", "/theme");
  const accent = h("input", { type: "color", id: "theme-accent", value: etat.couleurs.accent });
  const secondaire = h("input", { type: "color", id: "theme-secondaire", value: etat.couleurs.secondaire });
  const radios = [...etat.themes.map((t) => ({ ...t })), { id: etat.personnalise, libelle: "Couleurs personnalisées" }].map((t) => {
    const radio = h("input", { type: "radio", name: "theme", value: t.id, checked: etat.theme.id === t.id });
    const pastilles = t.accent ? [t.accent, t.secondaire].map((c) => { const p = h("span", { class: "admin-pastille-couleur", "aria-hidden": "true" }); p.style.setProperty("--echantillon", c); return p; }) : [];
    return { radio, noeud: h("label", { class: "admin-theme" }, radio, ...pastilles, h("strong", { text: t.libelle })) };
  });
  const apercus = h("div", { class: "admin-apercus" });
  const contrastes = h("p", { class: "doux" });
  const choisi = () => {
    const id = radios.find((r) => r.radio.checked)?.radio.value ?? "indigo";
    return id === THEME_PERSONNALISE ? { id, accent: accent.value, secondaire: secondaire.value } : { id };
  };
  const rafraichir = () => {
    const theme = choisi();
    const couleurs = theme.id === THEME_PERSONNALISE ? theme : etat.themes.find((t) => t.id === theme.id);
    const variables = deriverVariables({ accent: couleurs.accent, secondaire: couleurs.secondaire });
    apercus.replaceChildren(...[["Mode clair", variables.clair, "#ffffff", "#141833"], ["Mode sombre", variables.sombre, "#161a30", "#eceefb"]].map(([titre, vars, surface, texte]) => {
      const carte = h("div", { class: "admin-apercu" }, h("strong", { text: titre }), h("span", { class: "faux-bouton", text: "Commencer" }), h("span", { class: "faux-doux", text: "C'est quoi le sinus ?" }), h("span", { class: "faux-lab", text: "Reprendre" }), h("span", { class: "faux-lien", text: "Ma progression" }));
      carte.style.setProperty("--apercu-surface", surface);
      carte.style.setProperty("--apercu-texte", texte);
      for (const [nom, valeur] of Object.entries(vars)) carte.style.setProperty(`--${nom}`, valeur);
      return carte;
    }));
    if (theme.id !== THEME_PERSONNALISE) { accent.value = couleurs.accent; secondaire.value = couleurs.secondaire; }
    contrastes.textContent = "Les couleurs sont ajustées automatiquement pour garder un contraste lisible (au moins 4,5 pour 1) en mode clair comme en mode sombre.";
    accent.disabled = secondaire.disabled = theme.id !== THEME_PERSONNALISE;
  };
  [...radios.map((r) => r.radio), accent, secondaire].forEach((e) => e.addEventListener("input", rafraichir));
  rafraichir();
  return [
    bloc("Thème de couleurs",
      h("p", { class: "doux", text: "Trois thèmes au choix, ou tes propres couleurs. Le thème s'applique à tout le site, pour tous les visiteurs, dans la minute." }),
      h("fieldset", { class: "admin-themes" }, h("legend", { class: "visuellement-cache", text: "Thème" }), radios.map((r) => r.noeud)),
      h("div", { class: "admin-ligne" },
        h("label", { class: "admin-champ" }, h("span", { text: "Couleur principale" }), accent),
        h("label", { class: "admin-champ" }, h("span", { text: "Couleur secondaire" }), secondaire)),
      h("h3", { text: "Aperçu" }), apercus, contrastes,
      h("div", { class: "admin-ligne" }, h("button", { type: "button", class: "bouton", onclick: () => agir(() => api("PUT", "/theme", choisi()), "Charte graphique enregistrée : le site l'applique dans la minute.") }, "Appliquer au site"))),
    h("p", { class: "doux", text: "Limite actuelle : les pages de notion, les jeux et le blog gardent leur propre habillage (pages autonomes, lisibles hors ligne)." })
  ];
}

let filtreContenus = { type: "", recherche: "" };
async function ecranContenus() {
  const { catalogue, brouillons, types } = await api("GET", "/contenus");
  let articles = [];
  try { const r = await fetch("../blog/index.json"); if (r.ok) articles = (await r.json()).articles ?? []; } catch { /* blog absent de cet aperçu */ }

  // Catalogue
  const recherche = h("input", { type: "search", id: "contenus-recherche", value: filtreContenus.recherche, placeholder: "Titre ou identifiant" });
  const type = selecteur([["", "Tous les types"], ["cours", "Cours"], ["jeu", "Jeux"]], filtreContenus.type, { id: "contenus-type" });
  const zone = h("div", {});
  const dessiner = () => {
    filtreContenus = { type: type.value, recherche: recherche.value };
    const mot = recherche.value.trim().toLowerCase();
    const lignes = catalogue.filter((c) => (!type.value || c.type === type.value) && (!mot || c.titre.toLowerCase().includes(mot) || c.id.includes(mot))).slice(0, 60)
      .map((c) => ({ ...c, ligne: h("input", { type: "checkbox", checked: c.enLigne, "aria-label": `${c.titre} en ligne` }), avant: h("input", { type: "checkbox", checked: c.enAvant, "aria-label": `${c.titre} mis en avant` }) }));
    zone.replaceChildren(tableau(`${lignes.length} contenu(s) affiché(s) sur ${catalogue.length}`, [
      { titre: "Titre", cellule: (c) => h("strong", { text: c.titre }) },
      { titre: "Type", cellule: (c) => lib("types", c.type) },
      { titre: "Matière", cellule: (c) => c.matiere },
      { titre: "Niveau", cellule: (c) => c.niveau },
      { titre: "Version", cellule: (c) => c.version },
      { titre: "En ligne", cellule: (c) => c.ligne },
      { titre: "Mis en avant", cellule: (c) => c.avant },
      { titre: "", cellule: (c) => h("button", { type: "button", class: "secondaire petit-bouton", onclick: () => agir(() => api("PUT", `/contenus/etats/${c.id}`, { enLigne: c.ligne.checked, enAvant: c.avant.checked }), `« ${c.titre} » mis à jour sur le site.`) }, "Enregistrer") }
    ], lignes, "Aucun contenu ne correspond."));
  };
  recherche.addEventListener("input", dessiner);
  type.addEventListener("change", dessiner);
  dessiner();

  // Éditeur de brouillon
  const identifiant = h("input", { type: "hidden", id: "brouillon-id" });
  const typeBrouillon = selecteur(types.map((t) => [t, lib("types", t)]), "blog", { id: "brouillon-type" });
  const titre = h("input", { type: "text", id: "brouillon-titre", maxlength: "120" });
  const corps = h("textarea", { id: "brouillon-corps", rows: "10", maxlength: "20000" });
  const description = h("input", { type: "text", id: "brouillon-description", maxlength: "500" });
  const etapes = h("textarea", { id: "brouillon-etapes", rows: "5", placeholder: "Un identifiant de contenu par ligne, dans l'ordre : perimetres-aires, puissances, pythagore…" });
  const champTexte = h("label", { class: "admin-champ" }, h("span", { text: "Texte (Markdown)" }), corps);
  const champsParcours = h("div", { class: "admin-champ" }, h("label", { class: "admin-champ" }, h("span", { text: "Description" }), description), h("label", { class: "admin-champ" }, h("span", { text: "Étapes" }), etapes));
  const basculer = () => { const parcours = typeBrouillon.value === "parcours"; champTexte.hidden = parcours; champsParcours.hidden = !parcours; };
  typeBrouillon.addEventListener("change", basculer);
  basculer();
  const charger = (b) => {
    identifiant.value = b?.id ?? "";
    typeBrouillon.value = b?.type ?? "blog";
    typeBrouillon.disabled = !!b;
    titre.value = b?.titre ?? "";
    corps.value = b?.corps ?? "";
    description.value = b?.description ?? "";
    etapes.value = (b?.etapes ?? []).join("\n");
    basculer();
    titre.focus();
  };
  const saisie = () => ({
    type: typeBrouillon.value, titre: titre.value,
    ...(typeBrouillon.value === "parcours" ? { description: description.value, etapes: etapes.value.split(/[\s,]+/).map((e) => e.trim()).filter(Boolean) } : { corps: corps.value })
  });
  const enregistrer = () => agir(() => (identifiant.value ? api("PUT", `/contenus/brouillons/${identifiant.value}`, saisie()) : api("POST", "/contenus/brouillons", saisie())), "Brouillon enregistré.");
  const action = (b, nom, succes) => h("button", { type: "button", class: "secondaire petit-bouton", onclick: () => agir(() => api("POST", `/contenus/brouillons/${b.id}/${nom.cle}`), succes) }, nom.texte);

  return [
    h("p", { class: "admin-bandeau", text: "Les cours, les jeux et les articles restent publiés par une PR validée et fusionnée par le propriétaire. Ici, tu masques ou mets en avant un contenu à chaud, tu publies des parcours, et tu prépares des brouillons qui partent en revue." }),
    bloc("Catalogue en ligne", h("div", { class: "admin-ligne" }, h("label", { class: "admin-champ" }, h("span", { text: "Rechercher" }), recherche), h("label", { class: "admin-champ" }, h("span", { text: "Type" }), type)), zone),
    bloc("Brouillons et parcours",
      tableau(`${brouillons.length} élément(s)`, [
        { titre: "Titre", cellule: (b) => h("strong", { text: b.titre }) },
        { titre: "Type", cellule: (b) => lib("types", b.type) },
        { titre: "Statut", cellule: (b) => pastille(lib("statuts", b.statut), b.statut === "publie" ? "ok" : b.statut === "propose" ? "accent" : "") },
        { titre: "Issue", cellule: (b) => (b.issue ? `#${b.issue}` : "—") },
        { titre: "Modifié le", cellule: (b) => dateCourte(b.majLe) },
        { titre: "Actions", cellule: (b) => h("div", { class: "admin-ligne" },
          h("button", { type: "button", class: "secondaire petit-bouton", onclick: () => charger(b) }, "Modifier"),
          b.type === "parcours"
            ? (b.statut === "publie" ? action(b, { cle: "depublier", texte: "Retirer du site" }, "Parcours retiré du site.") : action(b, { cle: "publier", texte: "Publier" }, "Parcours publié sur le site."))
            : (b.statut === "brouillon" ? action(b, { cle: "proposer", texte: "Proposer en revue" }, "Proposition envoyée : une issue GitHub a été créée.") : null),
          action(b, { cle: "archiver", texte: "Archiver" }, "Élément archivé.")) }
      ], brouillons, "Aucun brouillon. Rédige le premier ci-dessous."),
      h("h3", { text: "Rédiger" }),
      identifiant,
      h("div", { class: "admin-ligne" }, h("label", { class: "admin-champ" }, h("span", { text: "Type" }), typeBrouillon), h("label", { class: "admin-champ" }, h("span", { text: "Titre" }), titre)),
      champTexte, champsParcours,
      h("p", { class: "doux petit", text: "Tout texte est analysé avant l'enregistrement : une donnée personnelle ou une consigne dissimulée est refusée." }),
      h("div", { class: "admin-ligne" }, h("button", { type: "button", class: "bouton", onclick: enregistrer }, "Enregistrer le brouillon"), h("button", { type: "button", class: "secondaire", onclick: () => charger(null) }, "Nouveau"))),
    bloc("Articles de blog en ligne", tableau(`${articles.length} article(s) publié(s)`, [
      { titre: "Titre", cellule: (a) => h("a", { href: `../blog/${a.slug}/`, text: a.titre }) },
      { titre: "Auteur", cellule: (a) => a.auteur },
      { titre: "Date", cellule: (a) => a.date }
    ], articles, "Aucun article publié, ou blog absent de cet aperçu."))
  ];
}

async function ecranHarness() {
  const etat = await api("GET", "/harness");
  const modifies = new Map();
  const champ = (p) => {
    const noter = (valeur) => modifies.set(p.cle, valeur);
    if (p.type === "booleen") return h("label", { class: "admin-ligne" }, h("input", { type: "checkbox", checked: p.valeur, "data-parametre": p.cle, onchange: (e) => noter(e.target.checked) }), "Activé");
    if (p.type === "entier") {
      const max = Math.min(p.max, etat.plafondsSchema[p.cle] ?? p.max);
      return h("div", { class: "admin-ligne" }, h("input", { type: "number", min: p.min, max, value: p.valeur, "data-parametre": p.cle, "aria-label": p.cle, oninput: (e) => noter(e.target.value === "" ? null : Number(e.target.value)) }),
        h("span", { class: "doux petit", text: `de ${nombre(p.min)} à ${nombre(max)}${max < p.max ? " (plafond du schéma de la base)" : ""}` }));
    }
    if (p.type === "liste") return h("div", { class: "admin-cases" }, p.valeurs.map((v) => h("label", {}, h("input", { type: "checkbox", value: v, checked: p.valeur.includes(v), "data-parametre": p.cle, onchange: (e) => noter([...e.target.closest(".admin-cases").querySelectorAll("input:checked")].map((c) => c.value)) }), v)));
    if (p.type === "texte") return h("div", { class: "admin-champ" }, h("textarea", { maxlength: p.max, rows: "4", "data-parametre": p.cle, "aria-label": p.cle, oninput: (e) => noter(e.target.value) }, p.valeur), h("span", { class: "doux petit", text: `${p.max} caractères au plus. Ajouté après le socle de sécurité, qui prime toujours.` }));
    return h("input", { type: "text", value: p.valeur, maxlength: "100", "data-parametre": p.cle, "aria-label": p.cle, oninput: (e) => noter(e.target.value) });
  };
  const enregistrer = (cles) => agir(async () => {
    const valeurs = Object.fromEntries([...modifies.entries()].filter(([cle]) => cles.includes(cle)));
    if (!Object.keys(valeurs).length) throw Object.assign(new Error("rien"), { code: "Aucune modification à enregistrer dans ce module." });
    await api("PUT", "/harness/parametres", { valeurs });
  }, "Paramètres enregistrés : ils s'appliquent dans les 15 secondes.");

  const modules = etat.configuration.modules.map((m) => bloc(libellesParametres[`configModule_${m.id}`] ?? m.id,
    m.skills.length ? h("div", { class: "admin-pastilles" }, m.skills.map((s) => pastille(`${s.id} · ${s.prompt} · v${s.version}`, s.actif ? "ok" : ""))) : null,
    m.parametres.map((p) => h("div", { class: "admin-parametre" },
      h("div", {}, h("strong", { text: libellesParametres[`configParam_${p.cle}`] ?? p.cle }), h("p", { class: "doux" }, h("code", { text: p.cle })),
        etat.surcharges.includes(p.cle) ? h("div", { class: "admin-ligne" }, pastille("Réglé ici", "accent"),
          h("button", { type: "button", class: "lien petit", onclick: () => agir(() => api("PUT", "/harness/parametres", { valeurs: { [p.cle]: null } }), "Valeur du déploiement rétablie.") }, "Revenir à la valeur du déploiement")) : null),
      champ(p))),
    h("div", { class: "admin-ligne" }, h("button", { type: "button", class: "bouton", onclick: () => enregistrer(m.parametres.map((p) => p.cle)) }, "Enregistrer ce module"))));

  return [
    h("p", { class: "admin-bandeau", text: "Les valeurs réglées ici remplacent celles du déploiement, dans les bornes du registre. Le socle de sécurité de chaque harness reste dans le code : il ne se modifie pas ici." }),
    ...modules,
    bloc("Souscriptions",
      h("p", { class: "doux", text: "Les paramètres ci-dessus sont les limites de la souscription « Gratuit ». Les autres offres (rôle, fonctionnalités, limites, coût et prix) se composent dans l'écran « Souscriptions »." }),
      h("div", { class: "admin-ligne" }, h("button", { type: "button", class: "secondaire", onclick: () => afficher("souscriptions") }, "Ouvrir les souscriptions")))
  ];
}

// ---------- Souscriptions et financier (ADR 0031) ----------

const monnaie = (n, devise, decimales = 2) => (n === null || n === undefined ? "—"
  : new Intl.NumberFormat("fr-FR", { style: "currency", currency: devise, minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(n));
const pourcentage = (n) => (n === null || n === undefined ? "—" : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n)} %`);
const LIMITES_LIBELLES = {
  tokensSession: "Tokens par session", tokensAppel: "Tokens par réponse", defisJour: "Défis IA par jour", cahiersJour: "Cahiers IA par jour", cahiersMois: "Cahiers IA par mois (0 = sans plafond)",
  enfantsMax: "Enfants rattachés", classesMax: "Classes", elevesMax: "Élèves suivis"
};
const STATUTS_SOUSCRIPTION = { projet: "En projet", active: "Active" };
const copie = (o) => JSON.parse(JSON.stringify(o));
const tonMarge = (taux) => (taux === null ? "" : taux < 0 ? "danger" : taux < 30 ? "attention" : "ok");

/** Erreurs du chargement des tarifs Cloudflare, par modèle. */
const LIB_ERREURS_TARIFS = {
  "modele-invalide": "identifiant de modèle invalide", "modele-introuvable": "modèle absent du catalogue Cloudflare",
  "cloudflare-injoignable": "Cloudflare injoignable", "http-401": "jeton refusé", "http-403": "jeton sans la permission Workers AI Read"
};

// ---------- Graphiques (Finance simplifiée, ADR 0036) ----------
// Construits par le DOM, sans bibliothèque (CSP du site). Barres en HTML (lisibles sur téléphone), courbe en SVG.
// Chaque graphique a sa vue tableau ; l'infobulle (survol et focus clavier) n'est jamais le seul accès à une valeur.

const SVG = "http://www.w3.org/2000/svg";
const s = (balise, attributs = {}) => {
  const e = document.createElementNS(SVG, balise);
  for (const [k, v] of Object.entries(attributs)) e.setAttribute(k, v);
  return e;
};

/** Figure : titre, sous-titre, légende, corps, infobulle partagée et vue tableau. */
function figure({ titre, sousTitre, legende = [], corps, table }) {
  const infobulle = h("div", { class: "viz-infobulle", role: "status", hidden: true });
  const fig = h("figure", { class: "viz-figure" },
    h("figcaption", {}, h("strong", { text: titre }), sousTitre ? h("span", { class: "doux petit", text: sousTitre }) : null),
    legende.length ? h("ul", { class: "viz-legende" }, legende.map(([cle, texte]) => h("li", {}, h("span", { class: `viz-cle ${cle}`, "aria-hidden": "true" }), texte))) : null,
    corps, infobulle,
    h("details", { class: "viz-table" }, h("summary", { text: "Voir les données en tableau" }), table));
  return { fig, infobulle };
}

/** Rend une marque interactive : survol et focus clavier affichent la même infobulle. */
function interactive(marque, fig, infobulle, lignes) {
  marque.tabIndex = 0;
  marque.setAttribute("aria-label", lignes.join(", "));
  const montrer = () => {
    infobulle.replaceChildren(...lignes.map((l, i) => h(i === 0 ? "strong" : "span", { text: l })));
    infobulle.hidden = false;
    const cadre = fig.getBoundingClientRect();
    const m = marque.getBoundingClientRect();
    const gauche = Math.min(Math.max(0, m.left - cadre.left + m.width / 2 - infobulle.offsetWidth / 2), Math.max(0, cadre.width - infobulle.offsetWidth));
    infobulle.style.left = `${gauche}px`;
    infobulle.style.top = `${Math.max(0, m.top - cadre.top - infobulle.offsetHeight - 6)}px`;
  };
  const cacher = () => { infobulle.hidden = true; };
  marque.addEventListener("pointerenter", montrer);
  marque.addEventListener("focus", montrer);
  marque.addEventListener("pointerleave", cacher);
  marque.addEventListener("blur", cacher);
  return marque;
}

/** Barres horizontales divergentes autour de zéro (résultat positif ou négatif). */
function graphiqueDivergent({ titre, sousTitre, lignes, format, table }) {
  const max = Math.max(1e-9, ...lignes.map((l) => Math.abs(l.valeur)));
  const negatifs = lignes.some((l) => l.valeur < 0);
  const positifs = lignes.some((l) => l.valeur > 0);
  // Position du zéro : au milieu s'il y a des deux côtés, sinon au bord.
  const zero = negatifs && positifs ? 50 : negatifs ? 100 : 0;
  const echelle = negatifs && positifs ? 50 : 100;
  const corps = h("div", { class: "viz-barres" });
  const { fig, infobulle } = figure({ titre, sousTitre, legende: [["viz-positif", "Bénéfice"], ["viz-negatif", "Perte"]], corps, table });
  for (const l of lignes) {
    const largeur = Math.abs(l.valeur) / max * echelle;
    const barre = h("div", { class: `viz-barre ${l.valeur < 0 ? "viz-negatif negatif" : "viz-positif"}`,
      style: l.valeur < 0 ? { right: `${100 - zero}%`, width: `${largeur}%` } : { left: `${zero}%`, width: `${largeur}%` } });
    interactive(barre, fig, infobulle, [format(l.valeur), l.libelle, ...(l.details ?? [])]);
    corps.append(h("span", { class: "viz-libelle", text: l.libelle }),
      h("div", { class: "viz-piste" }, h("span", { class: "viz-zero", style: { left: `${zero}%` } }), barre),
      h("span", { class: "viz-valeur", text: format(l.valeur) }));
  }
  return fig;
}

/** Barres horizontales empilées (coûts), avec un repère pour le chiffre d'affaires. */
function graphiqueEmpile({ titre, sousTitre, series, lignes, repere, format, table }) {
  const max = Math.max(1e-9, ...lignes.map((l) => Math.max(series.reduce((t, sr) => t + l[sr.cle], 0), repere ? l[repere.cle] : 0)));
  const corps = h("div", { class: "viz-barres" });
  const legende = [...series.map((sr) => [sr.classe, sr.libelle]), ...(repere ? [["viz-cle-repere", repere.libelle]] : [])];
  const { fig, infobulle } = figure({ titre, sousTitre, legende, corps, table });
  for (const l of lignes) {
    const total = series.reduce((t, sr) => t + l[sr.cle], 0);
    const pile = h("div", { class: "viz-pile", style: { width: `${total / max * 100}%` } });
    for (const sr of series) {
      if (l[sr.cle] <= 0) continue;
      pile.append(interactive(h("span", { class: `viz-seg ${sr.classe}`, style: { flex: `${l[sr.cle]} 1 0` } }), fig, infobulle, [format(l[sr.cle]), `${l.libelle} · ${sr.libelle}`]));
    }
    const piste = h("div", { class: "viz-piste" }, pile);
    if (repere) piste.append(interactive(h("span", { class: "viz-repere", style: { left: `calc(${l[repere.cle] / max * 100}% - 1px)` } }), fig, infobulle, [format(l[repere.cle]), `${l.libelle} · ${repere.libelle}`]));
    corps.append(h("span", { class: "viz-libelle", text: l.libelle }), piste, h("span", { class: "viz-valeur", text: format(total) }));
  }
  return fig;
}

/** Barres classées, une seule teinte (part d'un tout, à comparer). */
function graphiqueClasse({ titre, sousTitre, lignes, format, table }) {
  const max = Math.max(1e-9, ...lignes.map((l) => l.valeur));
  const corps = h("div", { class: "viz-barres" });
  const { fig, infobulle } = figure({ titre, sousTitre, corps, table });
  for (const l of [...lignes].sort((a, b) => b.valeur - a.valeur)) {
    const barre = h("div", { class: "viz-barre viz-1", style: { left: "0", width: `${l.valeur / max * 100}%` } });
    interactive(barre, fig, infobulle, [format(l.valeur), l.libelle, ...(l.details ?? [])]);
    corps.append(h("span", { class: "viz-libelle", text: l.libelle }), h("div", { class: "viz-piste" }, barre), h("span", { class: "viz-valeur", text: format(l.valeur) }));
  }
  return fig;
}

/** Courbe : résultat selon le nombre d'abonnés, ligne de zéro, point mort et réticule qui suit le pointeur. */
function graphiqueCourbe({ titre, sousTitre, points, pointMort, formatX, formatY, table }) {
  const L = 600, H = 200;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const xMax = Math.max(1, ...xs);
  const yMin = Math.min(0, ...ys), yMax = Math.max(0, ...ys);
  const marge = (yMax - yMin) * 0.08 || 1;
  const bas = yMin - marge, haut = yMax + marge;
  const X = (x) => x / xMax * L;
  const Y = (y) => H - (y - bas) / (haut - bas) * H;
  const pct = (x, y) => ({ gauche: X(x) / L * 100, hautPct: Y(y) / H * 100 });
  // Graduations : zéro toujours, les extrêmes seulement s'ils ne touchent pas une graduation déjà placée (12 % de la hauteur).
  const graduations = [0];
  for (const v of [haut - marge, bas + marge]) if (graduations.every((w) => Math.abs(Y(w) - Y(v)) > H * 0.12)) graduations.push(v);
  const trace = s("svg", { viewBox: `0 0 ${L} ${H}`, preserveAspectRatio: "none", class: "viz-svg", "aria-hidden": "true" });
  for (const g of graduations) trace.append(s("line", { x1: 0, x2: L, y1: Y(g), y2: Y(g), class: g === 0 ? "viz-axe" : "viz-grille", "vector-effect": "non-scaling-stroke" }));
  trace.append(s("path", { d: points.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(2)},${Y(p.y).toFixed(2)}`).join(""), class: "viz-ligne", "vector-effect": "non-scaling-stroke" }));
  const zone = h("div", { class: "viz-zone" }, trace);
  for (const g of graduations) zone.append(h("span", { class: "viz-graduation", style: { top: `${Y(g) / H * 100}%` }, text: formatY(g) }));
  const reticule = h("span", { class: "viz-reticule", hidden: true });
  const point = h("span", { class: "viz-point viz-1", hidden: true });
  zone.append(reticule, point);
  if (pointMort) {
    const p = pct(pointMort.x, 0);
    zone.append(h("span", { class: "viz-point viz-mort", style: { left: `${p.gauche}%`, top: `${p.hautPct}%` } }),
      // Étiquette au-dessus du point quand il est dans le bas du graphique, pour ne pas toucher l'axe.
      h("span", { class: `viz-etiquette${p.hautPct > 60 ? " dessus" : ""}`, style: { left: `${Math.min(85, Math.max(15, p.gauche))}%`, top: `${p.hautPct}%` }, text: `Point mort : ${formatX(pointMort.x)}` }));
  }
  const axeX = h("div", { class: "viz-axe-x" }, h("span", { text: formatX(0) }), h("span", { text: formatX(xMax) }));
  const corps = h("div", { class: "viz-courbe" }, zone, axeX);
  const { fig, infobulle } = figure({ titre, sousTitre, corps, table });
  const montrer = (i) => {
    const p = points[i];
    const { gauche, hautPct } = pct(p.x, p.y);
    reticule.hidden = point.hidden = false;
    reticule.style.left = `${gauche}%`;
    point.style.left = `${gauche}%`;
    point.style.top = `${hautPct}%`;
    infobulle.replaceChildren(h("strong", { text: formatY(p.y) }), h("span", { text: formatX(p.x) }));
    infobulle.hidden = false;
    const cadre = fig.getBoundingClientRect(), z = zone.getBoundingClientRect();
    infobulle.style.left = `${Math.min(Math.max(0, z.left - cadre.left + z.width * gauche / 100 + 10), Math.max(0, cadre.width - infobulle.offsetWidth))}px`;
    infobulle.style.top = `${z.top - cadre.top}px`;
  };
  const cacher = () => { reticule.hidden = point.hidden = infobulle.hidden = true; };
  let courant = 0;
  zone.tabIndex = 0;
  zone.setAttribute("aria-label", `${titre}. Flèches gauche et droite pour parcourir les points.`);
  zone.addEventListener("pointermove", (e) => {
    const r = zone.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * xMax;
    courant = points.reduce((meilleur, p, i) => (Math.abs(p.x - x) < Math.abs(points[meilleur].x - x) ? i : meilleur), 0);
    montrer(courant);
  });
  zone.addEventListener("pointerleave", cacher);
  zone.addEventListener("focus", () => montrer(courant));
  zone.addEventListener("blur", cacher);
  zone.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    courant = Math.min(points.length - 1, Math.max(0, courant + (e.key === "ArrowRight" ? 1 : -1)));
    montrer(courant);
  });
  return fig;
}

async function ecranSouscriptions() {
  const etat = await api("GET", "/souscriptions");
  const finances = copie(etat.finances);
  const bornes = etat.bornes;
  const consommation = ["tokensSession", "tokensAppel", "defisJour", "cahiersJour"];
  const mensuel = ["cahiersMois"];
  const structure = ["enfantsMax", "classesMax", "elevesMax"];
  const nombreSaisi = (valeur) => (valeur === "" ? NaN : Number(valeur));
  // Abonnés visés par offre (ADR 0036) : ils pondèrent la répartition des coûts fixes et alimentent la finance
  // simplifiée. Modifiables dans l'éditeur comme dans la finance simplifiée ; les deux restent synchronisés.
  const cibles = new Map(etat.souscriptions.map((x) => [x.id, x.usage.utilisateursCibles ?? 0]));
  const portefeuille = (remplacee) => {
    const liste = etat.souscriptions.map((x) => ({ ...x, usage: { ...x.usage, utilisateursCibles: cibles.get(x.id) ?? 0 } }));
    if (!remplacee?.id) return remplacee ? [...liste, remplacee] : liste;
    return liste.some((x) => x.id === remplacee.id) ? liste.map((x) => (x.id === remplacee.id ? remplacee : x)) : [...liste, remplacee];
  };
  const estimer = (x) => estimerSouscription(x, finances, etat.tokensParGeneration, repartitionFixes(portefeuille(x), finances));

  // Vue comparée : recalculée à chaque changement d'hypothèse.
  const comparaison = h("div", {});
  const dessinerComparaison = () => comparaison.replaceChildren(tableau(`${etat.souscriptions.length} souscription(s), en ${finances.devise} hors taxes, par abonné et par mois`, [
    { titre: "Offre", cellule: (s) => h("div", { class: "admin-champ" }, h("div", { class: "admin-ligne" }, h("strong", { text: s.libelle }), pastille(STATUTS_SOUSCRIPTION[s.statut], s.statut === "active" ? "ok" : "")),
      h("span", { class: "doux petit", text: `Rôle ${etat.roles.find((r) => r.id === s.role)?.libelle ?? s.role} · ${s.fonctionnalites.length} fonctionnalité(s) sur ${etat.fonctionnalites.length}` })) },
    { titre: "Tokens · défis · cahiers / jour", nombre: true, cellule: (s) => `${nombre(s.limites.tokensSession)} · ${nombre(s.limites.defisJour)} · ${nombre(s.limites.cahiersJour)}${s.limites.cahiersMois > 0 ? ` (${nombre(s.limites.cahiersMois)} / mois)` : ""}` },
    { titre: "Abonnés visés", nombre: true, cellule: (s) => nombre(s.usage.utilisateursCibles) },
    { titre: "Part des coûts fixes / abonné", nombre: true, cellule: (s) => monnaie(estimer(s).partFixe, finances.devise) },
    { titre: "Coût de revient", nombre: true, cellule: (s) => monnaie(estimer(s).coutRevient, finances.devise) },
    { titre: "Prix HT", nombre: true, cellule: (s) => monnaie(estimer(s).prixMensuelHT, finances.devise) },
    { titre: "Marge", nombre: true, cellule: (s) => monnaie(estimer(s).marge, finances.devise) },
    { titre: "Taux de marge", cellule: (s) => { const e = estimer(s); return e.tauxMarge === null ? (e.marge < 0 ? pastille("Coût d'acquisition", "attention") : "—") : pastille(pourcentage(e.tauxMarge), tonMarge(e.tauxMarge)); } },
    { titre: "Comptes", nombre: true, cellule: (s) => nombre(s.comptes) },
    { titre: "", cellule: (s) => h("button", { type: "button", class: "secondaire petit-bouton", onclick: () => { choix.value = s.id; remplir(); editeur.scrollIntoView({ block: "start" }); libelle.focus({ preventScroll: true }); } }, "Composer") }
  ], portefeuille()));

  // Éditeur : une souscription en cours de composition.
  let courante;
  const choix = selecteur([...etat.souscriptions.map((s) => [s.id, s.libelle]), ["", "Nouvelle souscription…"]], etat.souscriptions[0].id, { id: "souscription-choisie" });
  const identifiant = h("input", { type: "text", id: "souscription-id", maxlength: "21", autocomplete: "off" });
  const libelle = h("input", { type: "text", id: "souscription-libelle", maxlength: "40", autocomplete: "off" });
  const description = h("input", { type: "text", id: "souscription-description", maxlength: "200", autocomplete: "off", size: "60" });
  const statut = selecteur(Object.entries(STATUTS_SOUSCRIPTION), "projet", { id: "souscription-statut" });
  const role = selecteur(etat.roles.map((r) => [r.id, r.libelle]), "visiteur", { id: "souscription-role" });
  const cases = etat.fonctionnalites.map((f) => h("input", { type: "checkbox", value: f, "data-fonctionnalite": f }));
  const horsRole = h("p", { class: "doux petit", "aria-live": "polite" });
  const champsLimites = Object.fromEntries([...consommation, ...mensuel, ...structure].map((c) => [c, h("input", { type: "number", min: bornes.limites[c][0], max: bornes.limites[c][1], step: "1", "data-limite": c, "aria-label": LIMITES_LIBELLES[c] })]));
  const noteLimites = h("p", { class: "doux petit", "aria-live": "polite" });
  const joursActifs = h("input", { type: "number", id: "souscription-jours", min: bornes.finances.joursActifsMois[0], max: bornes.finances.joursActifsMois[1], step: "1" });
  const tauxUtilisation = h("input", { type: "number", id: "souscription-taux", min: 0, max: 100, step: "1" });
  const abonnesVises = h("input", { type: "number", id: "souscription-abonnes", min: 0, max: bornes.finances.utilisateursCibles[1], step: "1" });
  const modes = ["prix", "marge"].map((m) => h("input", { type: "radio", name: "souscription-mode", value: m, id: `souscription-mode-${m}` }));
  const prixHT = h("input", { type: "number", id: "souscription-prix", min: 0, max: bornes.finances.prixMensuelHT[1], step: "0.01" });
  const margeCible = h("input", { type: "number", id: "souscription-marge", min: bornes.finances.margeCible[0], max: bornes.finances.margeCible[1], step: "0.5" });
  const remise = h("input", { type: "number", id: "souscription-remise", min: 0, max: bornes.finances.remiseAnnuelle[1], step: "1" });
  // Prix annuel saisi directement (ADR 0034) ; 0 = douze mois moins la remise.
  const prixAnnuel = h("input", { type: "number", id: "souscription-prix-annuel", min: 0, max: bornes.finances.prixAnnuelHT[1], step: "0.01" });
  const resultat = h("div", { class: "admin-financier", "aria-live": "polite" });
  const supprimer = h("button", { type: "button", class: "danger" }, "Supprimer cette souscription");
  const fixer = h("button", { type: "button", class: "secondaire petit-bouton" }, "Fixer ce prix de vente");
  const editeur = bloc("Composer une souscription");

  const lire = () => ({
    id: identifiant.value.trim(), libelle: libelle.value, description: description.value, statut: statut.value, role: role.value,
    fonctionnalites: cases.filter((c) => c.checked).map((c) => c.value),
    limites: Object.fromEntries(Object.entries(champsLimites).map(([c, champ]) => [c, nombreSaisi(champ.value)])),
    usage: { joursActifsMois: nombreSaisi(joursActifs.value), tauxUtilisation: nombreSaisi(tauxUtilisation.value), utilisateursCibles: nombreSaisi(abonnesVises.value) },
    prix: { mode: modes.find((m) => m.checked)?.value ?? "prix", prixMensuelHT: nombreSaisi(prixHT.value), margeCible: nombreSaisi(margeCible.value), remiseAnnuelle: nombreSaisi(remise.value), prixAnnuelHT: nombreSaisi(prixAnnuel.value || "0") }
  });

  const recalculer = () => {
    const s = lire();
    const gratuite = s.id === "gratuit";
    const permissions = etat.roles.find((r) => r.id === s.role)?.permissions ?? [];
    const exclues = s.fonctionnalites.filter((f) => !permissions.includes(f));
    horsRole.textContent = exclues.length
      ? `Hors des permissions du rôle, donc refusées une fois le contrôle activé : ${exclues.map((f) => lib("fonctionnalites", f)).join(", ")}.`
      : "Toutes les fonctionnalités cochées sont permises par le rôle.";
    const auDela = s.limites.tokensSession > etat.plafondsSchema.LIMITE_TOKENS_SESSION || s.limites.tokensAppel > etat.plafondsSchema.MAX_TOKENS_APPEL;
    noteLimites.textContent = [
      gratuite ? "« Gratuit » : ses limites de consommation sont celles appliquées à tous ; les enregistrer ici met aussi à jour « Harness » (même registre)." : "",
      auDela ? `Au-delà de ${nombre(etat.plafondsSchema.LIMITE_TOKENS_SESSION)} tokens par session (ou ${nombre(etat.plafondsSchema.MAX_TOKENS_APPEL)} par réponse), la limite demandera la nouvelle table de quota avant d'être appliquée.` : "",
      "Le plafond mensuel de cahiers et les limites de structure (enfants, classes, élèves) sont déclarés par l'offre et comptés dans l'estimation, pas encore appliqués."
    ].filter(Boolean).join(" ");
    // Tous les champs restent modifiables (ADR 0034) ; seul le champ calculé par le mode choisi est en lecture seule.
    const mode = s.prix.mode;
    prixHT.readOnly = mode === "marge";
    margeCible.readOnly = mode === "prix";
    remise.readOnly = s.prix.prixAnnuelHT > 0;
    const valide = [...Object.values(s.limites), ...Object.values(s.usage), s.prix.prixMensuelHT, s.prix.margeCible, s.prix.remiseAnnuelle, s.prix.prixAnnuelHT].every(Number.isFinite);
    if (!valide) { resultat.replaceChildren(h("p", { class: "doux", text: "Complète les nombres pour voir l'estimation." })); fixer.hidden = true; return; }
    const e = estimer(s);
    const d = finances.devise;
    fixer.hidden = mode !== "marge" || !e.atteignable;
    if (mode === "marge") prixHT.value = String(e.prixMensuelHT);
    resultat.replaceChildren(...[
      e.atteignable ? null : h("p", { class: "admin-bandeau danger", text: "Marge visée impossible : avec les frais de paiement, elle dépasse 100 % du prix. Baisse la marge visée." }),
      h("div", { class: "admin-grille" },
        tuile(monnaie(e.coutRevient, d), "coût de revient estimé / mois"),
        tuile(monnaie(e.prixMensuelHT, d), `prix HT / mois${mode === "marge" ? " (calculé)" : ""}`),
        tuile(monnaie(e.marge, d), "marge / abonné / mois"),
        tuile(pourcentage(e.tauxMarge), "taux de marge (sur le prix HT)"),
        tuile(e.seuilRentabilite === null ? "—" : nombre(e.seuilRentabilite), "abonnés pour couvrir les coûts fixes")),
      tableau("Coût variable par module (tokens d'entrée compris)", [
        { titre: "Module", cellule: (l) => l.libelle },
        { titre: "Tokens générés / mois au plafond", nombre: true, cellule: (l) => nombre(l.tokensMoisPlafond) },
        { titre: "Coût / million générés (entrée, cache et frais compris)", nombre: true, cellule: (l) => monnaie(l.coutMillion, d, 4) },
        { titre: "Au plafond", nombre: true, cellule: (l) => monnaie(l.plafond, d, 4) },
        { titre: `Estimé (${s.usage.tauxUtilisation} %)`, nombre: true, cellule: (l) => monnaie(l.estime, d, 4) }
      ], Object.entries(e.coutVariable.parModule).map(([m, l]) => ({ ...l, libelle: etat.modulesCout[m].libelle }))),
      tableau("Détail", [
        { titre: "Poste", cellule: (l) => l[0] },
        { titre: "Montant", nombre: true, cellule: (l) => l[1] }
      ], [
        ["Coût variable estimé", monnaie(e.coutVariable.estime, d, 4)],
        ["Part des coûts fixes (par abonné)", monnaie(e.partFixe, d, 4)],
        [`Coûts fixes portés par l'offre (${nombre(e.abonnesVises)} abonné(s) visé(s))`, monnaie(e.fixesAlloues, d)],
        ["Frais de paiement", monnaie(e.fraisPaiement, d, 4)],
        ["Coefficient (prix / coût de revient)", e.coefficient === null ? "—" : `× ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(e.coefficient)}`],
        [`Prix TTC / mois (TVA ${finances.tauxTva} %)`, monnaie(e.prixMensuelTTC, d)],
        [e.prixAnnuelSaisi ? `Prix annuel HT (saisi, remise effective ${e.remiseEffective} %)` : `Prix annuel HT (remise ${s.prix.remiseAnnuelle} %)`, monnaie(e.prixAnnuelHT, d)],
        ["Prix annuel TTC", monnaie(e.prixAnnuelTTC, d)],
        ["Marge annuelle / abonné", monnaie(e.margeAnnuelle, d)],
        ["Coût de revient si tout le quota est consommé", monnaie(e.coutRevientPlafond, d, 4)],
        ["Marge si tout le quota est consommé", monnaie(e.margeAuPlafond, d, 4)]
      ]),
      e.margeAuPlafond < 0 && e.prixMensuelHT > 0 ? h("p", { class: "admin-bandeau", text: "Un abonné qui consomme tout son quota coûterait plus qu'il ne rapporte : baisse les limites ou relève le prix." }) : null
    ].filter(Boolean));
  };

  const remplir = () => {
    const s = etat.souscriptions.find((x) => x.id === choix.value);
    courante = s;
    identifiant.value = s?.id ?? "";
    identifiant.disabled = !!s;
    libelle.value = s?.libelle ?? "";
    description.value = s?.description ?? "";
    statut.value = s?.statut ?? "projet";
    role.value = s?.role ?? "visiteur";
    const fonctionnalites = s?.fonctionnalites ?? etat.roles.find((r) => r.id === role.value)?.permissions ?? [];
    cases.forEach((c) => { c.checked = fonctionnalites.includes(c.value); });
    const modele = s ?? etat.souscriptions.find((x) => x.id === "gratuit");
    for (const [c, champ] of Object.entries(champsLimites)) champ.value = String(modele.limites[c] ?? 0);
    joursActifs.value = String(s?.usage.joursActifsMois ?? 12);
    tauxUtilisation.value = String(s?.usage.tauxUtilisation ?? 50);
    abonnesVises.value = String(s ? cibles.get(s.id) ?? 0 : 0);
    const prix = s?.prix ?? { mode: "marge", prixMensuelHT: 0, margeCible: 60, remiseAnnuelle: 0 };
    modes.forEach((m) => { m.checked = m.value === prix.mode; });
    prixHT.value = String(prix.prixMensuelHT);
    margeCible.value = String(prix.margeCible);
    remise.value = String(prix.remiseAnnuelle);
    prixAnnuel.value = String(prix.prixAnnuelHT ?? 0);
    supprimer.hidden = !s || s.id === "gratuit";
    recalculer();
  };

  choix.addEventListener("change", remplir);
  editeur.addEventListener("input", (e) => {
    if (e.target === choix) return;
    // Abonnés visés d'une offre existante : la répartition des coûts fixes change pour toutes les offres.
    if (e.target === abonnesVises && courante && Number.isInteger(nombreSaisi(abonnesVises.value))) {
      cibles.set(courante.id, nombreSaisi(abonnesVises.value));
      dessinerComparaison();
      dessinerFinance();
    }
    recalculer();
  });
  editeur.addEventListener("change", (e) => { if (e.target !== choix) recalculer(); });
  fixer.addEventListener("click", () => {
    modes.forEach((m) => { m.checked = m.value === "prix"; });
    recalculer();
    annoncer("Prix de vente fixé : la marge se calcule désormais à partir de ce prix. Pense à enregistrer.");
  });
  supprimer.addEventListener("click", () => {
    if (confirm(`Supprimer la souscription « ${courante.libelle} » ?`)) agir(() => api("DELETE", `/souscriptions/${courante.id}`), "Souscription supprimée.");
  });
  const reprendreRole = () => {
    const permissions = etat.roles.find((r) => r.id === role.value)?.permissions ?? [];
    cases.forEach((c) => { c.checked = permissions.includes(c.value); });
    recalculer();
  };

  editeur.append(
    h("div", { class: "admin-ligne" },
      h("label", { class: "admin-champ" }, h("span", { text: "Souscription" }), choix),
      h("label", { class: "admin-champ" }, h("span", { text: "Identifiant" }), identifiant),
      h("label", { class: "admin-champ" }, h("span", { text: "Libellé" }), libelle),
      h("label", { class: "admin-champ" }, h("span", { text: "Statut" }), statut)),
    h("label", { class: "admin-champ" }, h("span", { text: "Description" }), description),
    h("h3", { text: "Rôle et fonctionnalités" }),
    h("div", { class: "admin-ligne" },
      h("label", { class: "admin-champ" }, h("span", { text: "Rôle attribué aux abonnés" }), role),
      h("button", { type: "button", class: "secondaire petit-bouton", onclick: reprendreRole }, "Reprendre les permissions du rôle")),
    h("fieldset", { class: "admin-cases" }, h("legend", { class: "visuellement-cache", text: "Fonctionnalités incluses" }),
      cases.map((c) => h("label", {}, c, lib("fonctionnalites", c.value)))),
    horsRole,
    h("h3", { text: "Limites de consommation et de structure" }),
    h("div", { class: "admin-cases" }, Object.entries(champsLimites).map(([c, champ]) => h("label", { class: "admin-champ" },
      h("span", { text: LIMITES_LIBELLES[c] }), champ, h("span", { class: "doux petit", text: `de ${nombre(bornes.limites[c][0])} à ${nombre(bornes.limites[c][1])}` })))),
    noteLimites,
    h("h3", { text: "Financier" }),
    h("div", { class: "admin-ligne" },
      h("label", { class: "admin-champ" }, h("span", { text: "Jours d'usage par mois" }), joursActifs),
      h("label", { class: "admin-champ" }, h("span", { text: "Part du quota consommée (%)" }), tauxUtilisation),
      h("label", { class: "admin-champ" }, h("span", { text: "Abonnés visés (répartition des coûts fixes)" }), abonnesVises)),
    h("fieldset", { class: "admin-ligne" }, h("legend", { class: "visuellement-cache", text: "Mode de calcul du prix" }),
      h("label", { class: "admin-ligne" }, modes[0], "Je fixe le prix de vente : la marge est calculée"),
      h("label", { class: "admin-ligne" }, modes[1], "Je vise une marge : le prix est calculé")),
    h("div", { class: "admin-ligne" },
      h("label", { class: "admin-champ" }, h("span", { text: `Prix mensuel HT (${finances.devise})` }), prixHT),
      h("label", { class: "admin-champ" }, h("span", { text: "Marge visée (% du prix HT)" }), margeCible),
      h("label", { class: "admin-champ" }, h("span", { text: "Remise sur l'abonnement annuel (%)" }), remise),
      h("label", { class: "admin-champ" }, h("span", { text: `Prix annuel HT (${finances.devise}, 0 = selon la remise)` }), prixAnnuel),
      fixer),
    resultat,
    h("div", { class: "admin-ligne" },
      h("button", { type: "button", class: "bouton", onclick: () => {
        const s = lire();
        agir(() => api("PUT", `/souscriptions/${encodeURIComponent(s.id)}`, s), "Souscription enregistrée.");
      } }, "Enregistrer la souscription"),
      supprimer));

  // Finance simplifiée (ADR 0036) : compte de résultat mensuel du portefeuille, à abonnés visés, en graphiques.
  const champsCibles = new Map(etat.souscriptions.map((x) => [x.id, h("input", { type: "number", value: cibles.get(x.id), min: 0, max: bornes.finances.utilisateursCibles[1], step: "1", "data-cible": x.id, "aria-label": `Abonnés visés : ${x.libelle}` })]));
  for (const [id, champ] of champsCibles) {
    champ.addEventListener("input", () => {
      const v = nombreSaisi(champ.value);
      if (!Number.isInteger(v) || v < 0) return;
      cibles.set(id, v);
      if (courante?.id === id) abonnesVises.value = String(v);
      dessinerComparaison();
      dessinerFinance();
      recalculer();
    });
  }
  const finance = h("div", { class: "admin-champ" });
  const enregistrerCibles = h("button", { type: "button", class: "bouton", onclick: () => agir(async () => {
    const modifiees = etat.souscriptions.filter((x) => (x.usage.utilisateursCibles ?? 0) !== cibles.get(x.id));
    if (!modifiees.length) throw Object.assign(new Error("rien"), { code: "Aucun nombre d'abonnés visés modifié." });
    for (const x of modifiees) {
      const { estimation, comptes, ...offre } = x;
      await api("PUT", `/souscriptions/${encodeURIComponent(x.id)}`, { ...offre, usage: { ...offre.usage, utilisateursCibles: cibles.get(x.id) } });
    }
  }, "Abonnés visés enregistrés.") }, "Enregistrer les abonnés visés");
  const tableBilan = (b, d) => tableau(`Compte de résultat mensuel, en ${d} hors taxes`, [
    { titre: "Offre", cellule: (o) => o.libelle },
    { titre: "Abonnés visés", nombre: true, cellule: (o) => nombre(o.abonnes) },
    { titre: "Chiffre d'affaires", nombre: true, cellule: (o) => monnaie(o.revenus, d) },
    { titre: "Coûts variables", nombre: true, cellule: (o) => monnaie(o.variables, d) },
    { titre: "Coûts fixes alloués", nombre: true, cellule: (o) => monnaie(o.fixes, d) },
    { titre: "Frais de paiement", nombre: true, cellule: (o) => monnaie(o.frais, d) },
    { titre: "Résultat", nombre: true, cellule: (o) => monnaie(o.resultat, d) }
  ], [...b.offres, { libelle: "Total", ...b.total }]);
  const dessinerFinance = () => {
    const b = bilanPortefeuille(portefeuille(), finances, etat.tokensParGeneration);
    const d = b.devise;
    const f = (n) => monnaie(n, d);
    const t = b.total;
    const graphiques = [];
    if (!t.abonnes) {
      graphiques.push(h("p", { class: "admin-bandeau", text: "Indique des abonnés visés pour au moins une offre : la finance simplifiée compte le portefeuille à ces volumes." }));
    } else {
      graphiques.push(
        graphiqueDivergent({ titre: "Résultat mensuel par offre", sousTitre: "Chiffre d'affaires moins coûts variables, coûts fixes alloués et frais de paiement.",
          lignes: b.offres.map((o) => ({ libelle: o.libelle, valeur: o.resultat, details: [`${nombre(o.abonnes)} abonné(s) visé(s)`, `Chiffre d'affaires ${f(o.revenus)}`] })), format: f, table: tableBilan(b, d) }),
        graphiqueEmpile({ titre: "Coûts mensuels par offre, face au chiffre d'affaires", sousTitre: "Le trait marque le chiffre d'affaires : à sa droite, l'offre perd de l'argent.",
          series: [{ cle: "variables", libelle: "Coûts variables (IA)", classe: "viz-1" }, { cle: "fixes", libelle: "Coûts fixes alloués", classe: "viz-2" }, { cle: "frais", libelle: "Frais de paiement", classe: "viz-3" }],
          repere: { cle: "revenus", libelle: "Chiffre d'affaires" }, lignes: b.offres, format: f, table: tableBilan(b, d) }),
        graphiqueClasse({ titre: "Répartition des coûts fixes", sousTitre: `${f(t.fixes)} par mois, au prorata des abonnés visés (${f(b.repartition.partParAbonne)} par abonné).`,
          lignes: b.offres.map((o) => ({ libelle: o.libelle, valeur: o.fixes, details: [`${pourcentage(t.abonnes ? o.abonnes / t.abonnes * 100 : 0)} des abonnés visés`] })), format: f,
          table: tableau("Coûts fixes alloués", [
            { titre: "Offre", cellule: (o) => o.libelle },
            { titre: "Abonnés visés", nombre: true, cellule: (o) => nombre(o.abonnes) },
            { titre: "Part", nombre: true, cellule: (o) => pourcentage(t.abonnes ? o.abonnes / t.abonnes * 100 : 0) },
            { titre: "Coûts fixes alloués", nombre: true, cellule: (o) => f(o.fixes) }
          ], b.offres) }),
        graphiqueCourbe({ titre: "Résultat mensuel selon le nombre d'abonnés", sousTitre: "Même répartition entre les offres qu'aux abonnés visés.",
          points: b.projection.map((p) => ({ x: p.abonnes, y: p.resultat })), pointMort: b.pointMort ? { x: b.pointMort.abonnes } : null,
          formatX: (x) => `${nombre(x)} abonnés`, formatY: f,
          table: tableau("Projection", [
            { titre: "Abonnés (toutes offres)", nombre: true, cellule: (p) => nombre(p.abonnes) },
            { titre: "Résultat mensuel", nombre: true, cellule: (p) => f(p.resultat) }
          ], b.projection) }));
    }
    finance.replaceChildren(
      h("div", { class: "admin-grille" },
        tuile(f(t.revenus), "chiffre d'affaires HT / mois"),
        tuile(f(t.couts), "coûts totaux / mois"),
        tuile(f(t.resultat), `résultat / mois${t.tauxMarge === null ? "" : ` (${pourcentage(t.tauxMarge)})`}`),
        tuile(nombre(t.abonnes), "abonnés visés, toutes offres"),
        tuile(b.pointMort ? nombre(b.pointMort.abonnes) : "—", b.pointMort ? "abonnés au point mort (même répartition)" : "point mort hors d'atteinte : les offres ne couvrent pas leurs coûts variables")),
      h("div", { class: "viz-grille" }, graphiques));
  };
  const blocFinance = bloc("Finance simplifiée",
    h("p", { class: "doux", text: "Le portefeuille d'offres compté à ses abonnés visés : chiffre d'affaires, coûts, résultat et point mort, par mois et hors taxes. Change un nombre d'abonnés : tout se recalcule." }),
    h("div", { class: "admin-cases" }, [...champsCibles].map(([id, champ]) => h("label", { class: "admin-champ" }, h("span", { text: etat.souscriptions.find((x) => x.id === id).libelle }), champ))),
    h("div", { class: "admin-ligne" }, enregistrerCibles),
    finance);

  // Hypothèses financières communes à toutes les offres (ADR 0031, affinées par l'ADR 0034).
  const devise = selecteur(etat.devises.map((x) => [x, x]), finances.devise, { id: "finances-devise" });
  const champFinance = (cle, props = {}) => h("input", { type: "number", value: finances[cle], "data-finance": cle, min: bornes.finances[cle][0], max: bornes.finances[cle][1], step: "any", ...props });
  const hypotheses = [
    ["tauxTva", "TVA (%)"],
    ["fraisPaiementPourcent", "Frais de paiement (% du montant)"], ["fraisPaiementFixe", "Frais de paiement fixes (par transaction)"]
  ].map(([cle, texte]) => ({ cle, texte, champ: champFinance(cle) }));

  // Coûts fixes : postes mensuels détaillés, ajoutés ou retirés librement.
  const postes = h("div", { class: "admin-champ" });
  const totalFixes = h("p", { class: "doux petit", "aria-live": "polite" });
  const ligneFixe = (p = { libelle: "", montant: 0 }) => {
    const libellePoste = h("input", { type: "text", value: p.libelle, maxlength: "40", "data-poste": "libelle", "aria-label": "Poste de coût fixe" });
    const montant = h("input", { type: "number", value: p.montant, min: 0, max: bornes.finances.posteFixe[1], step: "any", "data-poste": "montant", "aria-label": "Montant mensuel" });
    const ligne = h("div", { class: "admin-ligne", "data-poste-fixe": "" }, libellePoste, montant,
      h("button", { type: "button", class: "secondaire petit-bouton", onclick: () => { ligne.remove(); lireFinances(); } }, "Retirer"));
    return ligne;
  };
  postes.append(...(finances.coutsFixes ?? []).map(ligneFixe));
  const ajouterPoste = h("button", { type: "button", class: "secondaire petit-bouton", onclick: () => { postes.append(ligneFixe()); postes.lastChild.querySelector("input").focus(); } }, "Ajouter un poste");

  // Modèles : identifiant au catalogue Cloudflare, prix, cache, frais de plateforme, taille moyenne d'une génération.
  const CHAMPS_MODELE = [
    ["entree", "Entrée / M", "prixMillion"], ["sortie", "Sortie / M", "prixMillion"], ["cache", "Entrée en cache / M", "prixMillion"],
    ["ratio", "Tokens d'entrée par token généré", "ratio"], ["partCache", "Part de l'entrée en cache (%)", "partCache"],
    ["fraisPlateforme", "Frais de plateforme (%)", "fraisPlateforme"], ["tokensParAppel", "Tokens par génération (0 = maximum du registre)", "tokensParAppel"]
  ];
  const mesures = etat.telemetrie?.mesures ?? {};
  const prixModeles = Object.keys(etat.modulesCout).map((module) => {
    const m = finances.modeles[module];
    const modele = h("input", { type: "text", value: m.modele ?? "", maxlength: "100", size: "28", spellcheck: "false", "data-modele": `${module}.modele`, "aria-label": `${etat.modulesCout[module].libelle} : modèle au catalogue Cloudflare` });
    const champs = Object.fromEntries(CHAMPS_MODELE.map(([cle, texte, borne]) => [cle, h("input", { type: "number", value: m[cle] ?? 0, min: bornes.finances[borne][0], max: bornes.finances[borne][1], step: "any", "data-modele": `${module}.${cle}`,
      "aria-label": `${etat.modulesCout[module].libelle} : ${texte}` })]));
    if (module === "tuteur") champs.tokensParAppel.disabled = true;
    return { module, modele, champs, etat: h("span", { class: "doux petit", "aria-live": "polite" }) };
  });
  const lireFinances = () => {
    finances.devise = devise.value;
    for (const { cle, champ } of hypotheses) finances[cle] = nombreSaisi(champ.value);
    finances.coutsFixes = [...postes.querySelectorAll("[data-poste-fixe]")].map((l) => ({ libelle: l.querySelector("[data-poste=libelle]").value, montant: nombreSaisi(l.querySelector("[data-poste=montant]").value) }));
    finances.coutsFixesMensuels = finances.coutsFixes.reduce((t, p) => t + (Number.isFinite(p.montant) ? p.montant : 0), 0);
    totalFixes.textContent = `Total des coûts fixes : ${monnaie(finances.coutsFixesMensuels, finances.devise)} par mois.`;
    for (const { module, modele, champs } of prixModeles) {
      finances.modeles[module].modele = modele.value.trim();
      for (const [cle] of CHAMPS_MODELE) finances.modeles[module][cle] = nombreSaisi(champs[cle].value);
    }
    const valides = [...hypotheses.map((x) => finances[x.cle]), ...finances.coutsFixes.map((p) => p.montant), ...prixModeles.flatMap((m) => CHAMPS_MODELE.map(([c]) => finances.modeles[m.module][c]))].every(Number.isFinite);
    if (valides) { dessinerComparaison(); recalculer(); dessinerFinance(); }
  };

  // Tarifs exposés par Cloudflare (catalogue de modèles commun à AI Gateway et Workers AI).
  const etatTarifs = h("p", { class: "doux petit", "aria-live": "polite", text: finances.tarifs?.chargeLe ? `Tarifs chargés depuis Cloudflare le ${dateCourte(finances.tarifs.chargeLe)}.` : "Tarifs saisis à la main (relevés publics du 18 novembre 2026)." });
  const chargerTarifs = h("button", { type: "button", class: "secondaire", disabled: !etat.tarifsCloudflare, onclick: async () => {
    lireFinances();
    chargerTarifs.disabled = true;
    try {
      const r = await api("POST", "/finances/tarifs-cloudflare", { modeles: Object.fromEntries(prixModeles.map((m) => [m.module, m.modele.value.trim()])) });
      let charges = 0;
      for (const m of prixModeles) {
        const t = r.modeles[m.module];
        if (t?.erreur) { m.etat.textContent = `Non chargé : ${LIB_ERREURS_TARIFS[t.erreur] ?? t.erreur}.`; continue; }
        m.champs.entree.value = String(t.entree);
        m.champs.sortie.value = String(t.sortie);
        if (t.cache !== null && t.cache !== undefined) m.champs.cache.value = String(t.cache);
        m.etat.textContent = "Chargé depuis Cloudflare.";
        charges += 1;
      }
      if (charges) finances.tarifs = { source: "cloudflare", chargeLe: r.chargeLe };
      etatTarifs.textContent = charges ? `Tarifs chargés depuis Cloudflare le ${dateCourte(r.chargeLe)} (${charges} modèle(s)). Vérifie-les puis enregistre les hypothèses.` : "Aucun tarif chargé : vérifie les identifiants des modèles.";
      lireFinances();
    } catch (e) { annoncer(messageErreur(e), { erreur: true }); }
    finally { chargerTarifs.disabled = !etat.tarifsCloudflare; }
  } }, "Charger les tarifs Cloudflare (AI Gateway)");

  const blocFinances = bloc("Hypothèses financières",
    h("p", { class: "doux", text: "Communes à toutes les souscriptions. La saisie met l'estimation à jour tout de suite ; « Enregistrer » la garde pour tout le monde." }),
    h("div", { class: "admin-ligne" }, h("label", { class: "admin-champ" }, h("span", { text: "Devise des montants" }), devise)),
    h("div", { class: "admin-cases" }, hypotheses.map(({ texte, champ }) => h("label", { class: "admin-champ" }, h("span", { text: texte }), champ))),
    h("h3", { text: "Coûts fixes mensuels" }),
    h("p", { class: "doux petit", text: "Les coûts fixes sont répartis entre les souscriptions au prorata de leurs abonnés visés : chaque abonné en porte la même part, quelle que soit son offre." }),
    postes, h("div", { class: "admin-ligne" }, ajouterPoste), totalFixes,
    h("h3", { text: "Modèles et tarifs" }),
    h("div", { class: "admin-ligne" }, chargerTarifs),
    etatTarifs,
    etat.tarifsCloudflare ? null : h("p", { class: "admin-bandeau", text: "Chargement des tarifs indisponible : le Worker attend CLOUDFLARE_ACCOUNT_ID et un jeton CLOUDFLARE_TARIFS_TOKEN en lecture seule (action manuelle)." }),
    tableau("Prix par million de tokens et hypothèses de consommation", [
      { titre: "Module", cellule: (l) => h("div", { class: "admin-champ" }, h("strong", { text: etat.modulesCout[l.module].libelle }), l.modele, l.etat) },
      ...CHAMPS_MODELE.map(([cle, texte]) => ({ titre: texte, cellule: (l) => l.champs[cle] })),
      { titre: "Mesuré (30 jours)", cellule: (l) => {
        const mesure = mesures[l.module];
        if (!mesure?.appels) return h("span", { class: "doux petit", text: "Aucun appel mesuré" });
        return h("div", { class: "admin-champ" },
          h("span", { class: "petit", text: `${nombre(mesure.appels)} appel(s) · ${nombre(mesure.tokensParAppel)} tokens générés / appel · ratio ${mesure.ratio}` }),
          h("button", { type: "button", class: "secondaire petit-bouton", onclick: () => {
            l.champs.ratio.value = String(mesure.ratio);
            if (l.module !== "tuteur") l.champs.tokensParAppel.value = String(mesure.tokensParAppel);
            lireFinances();
          } }, "Reprendre la mesure"));
      } }
    ], prixModeles),
    h("p", { class: "doux petit", text: `Taille maximale d'une génération (registre) : défi ${nombre(etat.tokensParGeneration.defi)} tokens, cahier ${nombre(etat.tokensParGeneration.cahiers)} tokens. Le tuteur consomme le budget de tokens de la session.` }),
    h("div", { class: "admin-ligne" },
      h("button", { type: "button", class: "bouton", onclick: () => { lireFinances(); agir(() => api("PUT", "/finances", { finances }), "Hypothèses financières enregistrées."); } }, "Enregistrer les hypothèses"),
      h("button", { type: "button", class: "secondaire", onclick: () => agir(() => api("PUT", "/finances", { reinitialiser: true }), "Hypothèses par défaut rétablies.") }, "Rétablir les valeurs par défaut")));
  blocFinances.addEventListener("input", lireFinances);
  blocFinances.addEventListener("change", lireFinances);
  lireFinances();

  dessinerComparaison();
  remplir();
  return [
    h("p", { class: `admin-bandeau${etat.controleActif ? " ok" : ""}`, text: etat.controleActif
      ? "Le contrôle d'accès est activé : la souscription d'un compte limite ses fonctionnalités."
      : "Contrôle d'accès inactif : pendant la bêta, aucune souscription ne limite le site et rien n'est facturé. Les offres sont composées et chiffrées ici, prêtes pour l'ouverture des comptes." }),
    etat.parDefaut ? h("p", { class: "admin-bandeau", text: "Offres pressenties (Gratuit, Solo, Parent, Professeur), pas encore enregistrées : ajuste-les puis enregistre chacune pour la valider." }) : null,
    bloc("Vue comparée", comparaison),
    blocFinance,
    editeur,
    blocFinances
  ];
}

async function ecranJournal() {
  const { entrees } = await api("GET", "/journal?limite=200");
  return [bloc("Journal des actions", h("p", { class: "doux", text: "Chaque modification faite dans le back-office est notée : l'action et sa cible, jamais le contenu." }),
    tableau(`${entrees.length} dernière(s) action(s)`, [
      { titre: "Date (UTC)", cellule: (e) => e.horodatage },
      { titre: "Acteur", cellule: (e) => (e.acteur === "cle-partagee" ? "Clé partagée" : e.acteur) },
      { titre: "Action", cellule: (e) => h("code", { text: e.action }) },
      { titre: "Cible", cellule: (e) => h("code", { text: e.cible }) }
    ], entrees, "Aucune action pour le moment."))];
}

const ECRANS = {
  apercu: { titre: "Vue d'ensemble", intro: "L'état du site, de la sécurité et des données, d'un coup d'œil.", rendre: ecranApercu },
  utilisateurs: { titre: "Utilisateurs", intro: "Les comptes, leur rôle, leur niveau, leurs données.", rendre: ecranUtilisateurs },
  roles: { titre: "Rôles et accès", intro: "Les rôles, leurs permissions et les stratégies d'accès aux fonctionnalités.", rendre: ecranRoles },
  securite: { titre: "Sécurité", intro: "Analyse des requêtes, comportement des profils et garde-fous.", rendre: ecranSecurite },
  donnees: { titre: "Données personnelles", intro: "Ce qui est conservé, pourquoi, combien de temps, et la preuve que rien d'autre ne l'est.", rendre: ecranDonnees },
  telemetrie: { titre: "Télémétrie", intro: "Tokens, modèles et requêtes, en compteurs anonymes.", rendre: ecranTelemetrie },
  theme: { titre: "Charte graphique", intro: "Les couleurs du site.", rendre: ecranTheme },
  contenus: { titre: "Contenus", intro: "Blog, cours, parcours, labs et jeux.", rendre: ecranContenus },
  souscriptions: { titre: "Souscriptions", intro: "Composer les offres à partir des rôles, des fonctionnalités et des limites, et en estimer le coût et la marge.", rendre: ecranSouscriptions },
  harness: { titre: "Harness", intro: "Modèles, budgets de tokens, quotas et instructions.", rendre: ecranHarness },
  journal: { titre: "Journal", intro: "La trace des actions du back-office.", rendre: ecranJournal }
};
let ecranCourant = "apercu";

let affichage = 0;
let miseAJourUtilisateurs = false;

async function actualiserUtilisateurs() {
  const zone = $("#ecran");
  const version = affichage;
  const disponible = () => affichage === version && ecranCourant === "utilisateurs" && !$("#application").hidden
    && !document.hidden && !zone.hasAttribute("aria-busy") && !zone.contains(document.activeElement)
    && !zone.querySelector("pre:not([hidden])") && !zone.querySelector(".zone-assistant:not([hidden])")
    && ![...zone.querySelectorAll("select[data-valeur-initiale]")].some((champ) => champ.value !== champ.dataset.valeurInitiale);
  if (miseAJourUtilisateurs || !disponible()) return;
  miseAJourUtilisateurs = true;
  try {
    const donnees = await api("GET", rechercheUtilisateur ? `/utilisateurs?id=${rechercheUtilisateur}` : "/utilisateurs");
    // Un mot de passe provisoire affiché (une seule fois) n'est jamais effacé par la mise à jour automatique.
    const motDePasseAffiche = !!zone.querySelector(".zone-mot-de-passe:not([hidden])");
    if (disponible() && !motDePasseAffiche && JSON.stringify(donnees) !== instantaneUtilisateurs) zone.replaceChildren(...rendreUtilisateurs(donnees));
  } catch { /* Le dernier résultat reste visible ; le prochain cycle réessaie. */ }
  finally { miseAJourUtilisateurs = false; }
}

async function afficher(cle, { garderMessage = false } = {}) {
  const version = ++affichage;
  ecranCourant = Object.hasOwn(ECRANS, cle) ? cle : "apercu";
  const ecran = ECRANS[ecranCourant];
  if (location.hash.slice(1) !== ecranCourant) history.replaceState(null, "", `#${ecranCourant}`);
  document.querySelectorAll("#navigation button").forEach((b) => { if (b.dataset.ecran === ecranCourant) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  $("#titre-ecran").textContent = ecran.titre;
  $("#intro-ecran").textContent = ecran.intro;
  document.title = `${ecran.titre} · Back-office · KermicLab`;
  if (!garderMessage) annoncer("");
  const zone = $("#ecran");
  zone.setAttribute("aria-busy", "true");
  try {
    const contenu = await ecran.rendre();
    if (version === affichage) zone.replaceChildren(...contenu);
  } catch (e) {
    if (version === affichage && e.statut !== 401) zone.replaceChildren(h("p", { class: "admin-bandeau danger", text: messageErreur(e) }));
  }
  if (version === affichage) zone.removeAttribute("aria-busy");
}

// ---------- Session ----------

function fermerSession() {
  sessionStorage.removeItem(CLE_SESSION);
  $("#application").hidden = true;
  $("#connexion").hidden = false;
  $("#cle").value = "";
  $("#cle").focus();
}

async function ouvrirSession() {
  const etat = await api("GET", "/etat");
  $("#etat-general").replaceChildren(...[
    pastille(etat.controleAcces ? "Accès contrôlé" : "Bêta : accès pour tous", etat.controleAcces ? "accent" : "attention"),
    pastille(etat.gardeFous ? "Garde-fous actifs" : "Garde-fous en observation", etat.gardeFous ? "ok" : "attention"),
    etat.migration ? null : pastille("Migration 0002 à appliquer", "danger")
  ].filter(Boolean));
  $("#connexion").hidden = true;
  $("#application").hidden = false;
  await afficher(location.hash.slice(1) || "apercu");
}

async function demarrer() {
  try {
    const config = await (await fetch("../config.json")).json();
    apiUrl = String(config.apiUrl ?? "").replace(/\/$/, "");
  } catch { apiUrl = ""; }
  try { libellesParametres = await (await fetch("../i18n/fr.json")).json(); } catch { libellesParametres = {}; }

  $("#navigation").replaceChildren(...Object.entries(ECRANS).map(([cle, e]) => h("button", { type: "button", "data-ecran": cle, onclick: () => { afficher(cle); $("#titre-ecran").focus({ preventScroll: true }); } }, e.titre)));
  $("#deconnexion").addEventListener("click", fermerSession);
  setInterval(actualiserUtilisateurs, 30_000);
  document.addEventListener("visibilitychange", actualiserUtilisateurs);
  window.addEventListener("hashchange", () => { if (!$("#application").hidden && location.hash.slice(1) !== ecranCourant) afficher(location.hash.slice(1)); });
  $("#formulaire-cle").addEventListener("submit", async (e) => {
    e.preventDefault();
    const cle = $("#cle").value.trim();
    if (!cle) { $("#cle-erreur").textContent = "Saisis la clé d'accès."; return; }
    sessionStorage.setItem(CLE_SESSION, cle);
    try {
      await ouvrirSession();
      $("#cle-erreur").textContent = "";
    } catch (erreur) {
      sessionStorage.removeItem(CLE_SESSION);
      $("#cle-erreur").textContent = lib("erreurs", erreur.code);
    }
  });

  if (sessionStorage.getItem(CLE_SESSION)) {
    try { await ouvrirSession(); return; } catch { /* clé expirée ou refusée : retour à la connexion */ }
  }
  fermerSession();
}

demarrer();
