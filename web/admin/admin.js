// Back-office KermicLab (ADR 0026). Interface en français seulement, comme le blog : outil interne de l'équipe.
// Tout le contenu est construit par le DOM (jamais innerHTML) ; aucune donnée n'est gardée hors de l'onglet.
import { THEME_PERSONNALISE, deriverVariables } from "../theme.js";

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
  fonctionnalites: { chat: "Poser une question", "ia.tuteur": "Tuteur IA", "ia.defi": "Défi express généré par l'IA", "ia.cahiers": "Cahiers enrichis par l'IA", "ia.idees": "Cadrage d'idée par l'IA", jeux: "Jeux", cahiers: "Mes cahiers", defi: "Défi express", "contributions.proposer": "Proposer une contribution", "contributions.relire": "Relire les contributions", famille: "Espace famille", synchronisation: "Compte et synchronisation", "admin.utilisateurs": "Back-office : utilisateurs", "admin.roles": "Back-office : rôles et accès", "admin.securite": "Back-office : sécurité", "admin.donnees": "Back-office : données personnelles", "admin.telemetrie": "Back-office : télémétrie", "admin.theme": "Back-office : charte graphique", "admin.contenus": "Back-office : contenus", "admin.harness": "Back-office : harness" },
  modes: { tous: "Tous les utilisateurs", roles: "Rôles ou niveaux choisis", personne: "Fermée" },
  types: { cours: "Cours", jeu: "Jeu", blog: "Article de blog", parcours: "Parcours", lab: "Lab" },
  statuts: { brouillon: "Brouillon", propose: "Proposé en revue", publie: "Publié", archive: "Archivé" },
  comptes: { compte: "Compte famille", "compte-local": "Compte local" },
  donnees: { aucune: "Aucune donnée personnelle", pseudonyme: "Pseudonyme", minimale: "Donnée personnelle minimale" },
  raisons: { "controle-inactif": "contrôle inactif", "ouverte-a-tous": "ouverte à tous", "role-autorise": "rôle autorisé", "niveau-autorise": "niveau autorisé", "permission-absente": "le rôle n'a pas cette permission", strategie: "réservée à d'autres rôles", "fonctionnalite-fermee": "fonctionnalité fermée", "role-inconnu": "rôle inconnu" },
  erreurs: {
    "cle-invalide": "Clé d'accès refusée.", "trop-de-tentatives": "Trop d'essais. Attends une minute.", "back-office-non-configure": "Le back-office n'est pas configuré sur ce serveur (secret BACKOFFICE_JETON absent).",
    "back-office-indisponible": "Le back-office est indisponible : la migration 0002 n'est peut-être pas appliquée.", "origine-refusee": "Cette adresse n'est pas autorisée à appeler l'API.",
    "role-inconnu": "Ce rôle n'existe pas.", "niveau-inconnu": "Ce niveau n'existe pas.", "role-attribue": "Ce rôle est encore attribué à un compte.", "niveau-attribue": "Ce niveau est encore attribué à un compte.",
    "identifiant-invalide": "Identifiant invalide : minuscules, chiffres et tirets.", "libelle-requis": "Le libellé est obligatoire.", "valeurs-refusees": "Certaines valeurs sont refusées : rien n'a été enregistré.",
    "hors-bornes": "hors des bornes permises", "alias-invalide": "identifiant de modèle invalide", "trop-long": "texte trop long", "booleen-attendu": "oui ou non attendu", "valeur-inconnue": "valeur inconnue", "parametre-inconnu": "paramètre inconnu",
    "donnees-personnelles": "Le texte contient une donnée personnelle (e-mail, téléphone, adresse, identité) : retire-la.", "contraire-au-socle": "Ce texte chercherait à lever le socle de sécurité : il est refusé.",
    "injection-indirecte": "Le texte contient une consigne dissimulée ou un balisage actif : il est refusé.", "couleur-invalide": "Couleur invalide : format #rrggbb attendu.", "titre-invalide": "Le titre est obligatoire (120 caractères au plus).",
    "corps-trop-long": "Le texte dépasse 20 000 caractères.", "etapes-invalides": "Les étapes doivent être des contenus du catalogue, sans doublon (30 au plus).", "publication-par-pr": "Ce contenu se publie par une PR fusionnée par le propriétaire : propose-le en revue.",
    "parcours-sans-revue": "Un parcours se publie directement.", "github-non-configure": "GitHub n'est pas configuré sur ce serveur.", "github-indisponible": "GitHub n'a pas répondu. Réessaie plus tard.", "introuvable": "Élément introuvable.", "etat-invalide": "État invalide.", reseau: "Le serveur ne répond pas."
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
const messageErreur = (e) => {
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
async function ecranUtilisateurs() {
  const donnees = await api("GET", "/utilisateurs");
  return rendreUtilisateurs(donnees);
}

function rendreUtilisateurs(donnees) {
  instantaneUtilisateurs = JSON.stringify(donnees);
  const { utilisateurs, roles, niveaux } = donnees;
  const zoneExport = h("pre", { hidden: true, tabindex: "0", "aria-label": "Données exportées" });
  const ligneActions = (u) => {
    const role = selecteur(roles.map((r) => [r.id, r.libelle]), u.role, { "aria-label": `Rôle du ${lib("comptes", u.type)} ${u.id.slice(0, 8)}` });
    const niveau = selecteur(niveaux.map((n) => [n, n]), u.niveau, { "aria-label": `Niveau du ${lib("comptes", u.type)} ${u.id.slice(0, 8)}` });
    for (const champ of [role, niveau]) champ.dataset.valeurInitiale = champ.value;
    return { role, niveau };
  };
  const lignes = utilisateurs.map((u) => ({ ...u, champs: ligneActions(u) }));
  return [
    h("p", { class: "admin-bandeau ok", text: "Aucun e-mail, aucun nom, aucune adresse IP n'est affiché ici : la base n'en contient pas. Un compte est identifié par un identifiant aléatoire." }),
    bloc("Comptes", tableau(`${utilisateurs.length} compte(s)`, [
      { titre: "Type", cellule: (u) => lib("comptes", u.type) },
      { titre: "Identifiant", cellule: (u) => h("code", { text: u.id.slice(0, 8), title: u.id }) },
      { titre: "Rôle", cellule: (u) => u.champs.role },
      { titre: "Niveau", cellule: (u) => u.champs.niveau },
      { titre: "Sécurité", cellule: (u) => pastille(lib("etats", u.etat), tonEtat[u.etat]) },
      { titre: "Créé le", cellule: (u) => dateCourte(u.creeLe) },
      { titre: "Dernière connexion", cellule: (u) => (u.type === "compte" ? dateCourte(u.derniereConnexion) : u.bloque ? "bloqué (essais)" : "—") },
      { titre: "Enfants", nombre: true, cellule: (u) => (u.type === "compte" ? nombre(u.enfants) : "—") },
      { titre: "Actions", cellule: (u) => h("div", { class: "admin-ligne" },
        h("button", { type: "button", class: "secondaire petit-bouton", onclick: () => agir(() => api("PATCH", `/utilisateurs/${u.type}/${u.id}`, { role: u.champs.role.value, niveau: u.champs.niveau.value }), "Rôle et niveau enregistrés.") }, "Enregistrer"),
        h("button", { type: "button", class: "secondaire petit-bouton", onclick: async () => {
          try {
            zoneExport.textContent = JSON.stringify(await api("GET", `/utilisateurs/${u.type}/${u.id}/export`), null, 2);
            zoneExport.hidden = false;
            zoneExport.focus();
            annoncer("Export affiché sous le tableau. L'export est noté au journal.");
          } catch (e) { annoncer(messageErreur(e), { erreur: true }); }
        } }, "Exporter les données"),
        h("button", { type: "button", class: "danger petit-bouton", onclick: () => {
          if (confirm(`Supprimer définitivement ce ${lib("comptes", u.type).toLowerCase()} et toutes ses données ?`)) agir(() => api("DELETE", `/utilisateurs/${u.type}/${u.id}`), "Compte supprimé avec ses données.");
        } }, "Supprimer")) }
    ], lignes, "Aucun compte pour le moment : les visiteurs utilisent un pseudo gardé dans leur navigateur."), zoneExport)
  ];
}

async function ecranRoles() {
  const [{ roles, permissions, controleActif }, { strategies }, harness] = await Promise.all([api("GET", "/roles"), api("GET", "/strategies"), api("GET", "/harness")]);
  const niveaux = harness.niveaux.map((n) => n.id);
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
  const roleSimule = selecteur(roles.map((r) => [r.id, r.libelle]), "visiteur", { id: "simulation-role" });
  const niveauSimule = selecteur(niveaux.map((n) => [n, n]), "gratuit", { id: "simulation-niveau" });
  const resultat = h("div", {});
  const simuler = async () => {
    try {
      const { decisions } = await api("POST", "/strategies/simuler", { role: roleSimule.value, niveau: niveauSimule.value });
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
      h("p", { class: "doux", text: "Vérifie ce qu'un rôle pourrait faire avant d'activer le contrôle d'accès." }),
      h("div", { class: "admin-ligne" },
        h("label", { class: "admin-champ" }, h("span", { text: "Rôle" }), roleSimule),
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

  // Niveaux de souscription
  const bornes = etat.bornesNiveaux;
  const champs = ["tokensSession", "tokensAppel", "defisJour", "cahiersJour"];
  const lignes = etat.niveaux.filter((n) => !n.applique).map((n) => ({ ...n }));
  const zone = h("div", {});
  const dessiner = () => zone.replaceChildren(tableau("Limites par niveau", [
    { titre: "Identifiant", cellule: (n) => (n.applique ? h("code", { text: n.id }) : h("input", { type: "text", value: n.id, maxlength: "21", "aria-label": "Identifiant du niveau", oninput: (e) => { n.id = e.target.value.trim(); } })) },
    { titre: "Libellé", cellule: (n) => (n.applique ? n.libelle : h("input", { type: "text", value: n.libelle, maxlength: "40", "aria-label": "Libellé du niveau", oninput: (e) => { n.libelle = e.target.value; } })) },
    ...champs.map((c, i) => ({ titre: ["Tokens par session", "Tokens par réponse", "Défis IA par jour", "Cahiers IA par jour"][i], nombre: true,
      cellule: (n) => (n.applique ? nombre(n[c]) : h("input", { type: "number", min: bornes[c].min, max: bornes[c].max, value: n[c], "aria-label": `${c} du niveau`, oninput: (e) => { n[c] = Number(e.target.value); } })) })),
    { titre: "", cellule: (n) => (n.applique ? pastille("Appliqué à tous", "ok") : h("button", { type: "button", class: "secondaire petit-bouton", onclick: () => { lignes.splice(lignes.indexOf(n), 1); dessiner(); } }, "Retirer")) }
  ], [etat.niveaux[0], ...lignes]));
  dessiner();

  return [
    h("p", { class: "admin-bandeau", text: "Les valeurs réglées ici remplacent celles du déploiement, dans les bornes du registre. Le socle de sécurité de chaque harness reste dans le code : il ne se modifie pas ici." }),
    ...modules,
    bloc("Niveaux de souscription",
      h("p", { class: "doux", text: "Le niveau « gratuit » reprend les paramètres ci-dessus et s'applique à tout le monde pendant la bêta. Les autres niveaux sont préparés ; ils seront appliqués avec le contrôle d'accès." }),
      zone,
      h("div", { class: "admin-ligne" },
        h("button", { type: "button", class: "secondaire", onclick: () => { lignes.push({ id: "", libelle: "", ...Object.fromEntries(champs.map((c) => [c, etat.niveaux[0][c]])) }); dessiner(); } }, "Ajouter un niveau"),
        h("button", { type: "button", class: "bouton", onclick: () => agir(() => api("PUT", "/harness/niveaux", { niveaux: lignes.map(({ id, libelle, ...limites }) => ({ id, libelle, ...Object.fromEntries(champs.map((c) => [c, limites[c]])) })) }), "Niveaux enregistrés.") }, "Enregistrer les niveaux")))
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
  harness: { titre: "Harness", intro: "Modèles, budgets de tokens, quotas, instructions et niveaux de souscription.", rendre: ecranHarness },
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
    && !zone.querySelector("pre:not([hidden])")
    && ![...zone.querySelectorAll("select[data-valeur-initiale]")].some((champ) => champ.value !== champ.dataset.valeurInitiale);
  if (miseAJourUtilisateurs || !disponible()) return;
  miseAJourUtilisateurs = true;
  try {
    const donnees = await api("GET", "/utilisateurs");
    if (disponible() && JSON.stringify(donnees) !== instantaneUtilisateurs) zone.replaceChildren(...rendreUtilisateurs(donnees));
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
