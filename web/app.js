// Interface de chat Kermiclab : aucun texte en dur, tout vient de i18n/<langue>.json.
const $ = (s) => document.querySelector(s);
const etat = { config: null, langue: "fr", textes: {}, historique: [] };

async function chargerJson(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}

function lirePreference() {
  try { return localStorage.getItem("kermiclab:langue"); } catch { return null; }
}
function ecrirePreference(l) {
  try { localStorage.setItem("kermiclab:langue", l); } catch { /* stockage indisponible */ }
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
  document.title = etat.textes.titre;
}

function ajouterMessage({ auteur, texte, classe, maquette }) {
  const li = document.createElement("li");
  if (classe) li.className = classe;
  const a = document.createElement("span");
  a.className = "auteur";
  a.textContent = auteur;
  li.append(a, document.createTextNode(texte));
  if (maquette) {
    li.classList.add("maquette");
    li.dataset.maquette = maquette.id;
    const lien = document.createElement("a");
    lien.href = maquette.url; lien.target = "_blank"; lien.rel = "noopener";
    lien.textContent = `${etat.textes.ouvrirPage} — ${maquette.titre} (v${maquette.version})`;
    const cadre = document.createElement("iframe");
    cadre.src = maquette.url; cadre.title = maquette.titre; cadre.loading = "lazy";
    // Même origine que le chat : pas d'allow-same-origin, pour que la maquette reste isolée de la page.
    // Les scores sont conservés en ouvrant la page en plein écran.
    cadre.setAttribute("sandbox", "allow-scripts");
    li.append(document.createElement("br"), lien, cadre);
  }
  $("#fil").append(li);
  li.scrollIntoView({ behavior: "smooth", block: "start" });
  return li;
}

async function envoyer(question) {
  ajouterMessage({ auteur: etat.textes.vous, texte: question, classe: "moi" });
  const attente = ajouterMessage({ auteur: etat.textes.assistant, texte: etat.textes.chargement });
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
    ajouterMessage({ auteur: etat.textes.assistant, texte: donnees.texte ?? etat.textes.erreurReseau, maquette: donnees.maquette });
    if (donnees.type === "reponse" || donnees.type === "maquette") {
      etat.historique.push({ role: "user", content: question }, { role: "assistant", content: donnees.texte });
    }
  } catch {
    attente.remove();
    ajouterMessage({ auteur: etat.textes.assistant, texte: etat.textes.erreurReseau });
  } finally {
    bouton.disabled = false;
  }
}

async function demarrer() {
  etat.config = await chargerJson("config.json");
  const select = $("#langue");
  for (const l of etat.config.langues) {
    const o = document.createElement("option");
    o.value = l; o.textContent = l.toUpperCase();
    select.append(o);
  }
  select.value = langueInitiale(etat.config.langues);
  await appliquerLangue(select.value);
  select.addEventListener("change", async () => { ecrirePreference(select.value); await appliquerLangue(select.value); });

  // Emplacements préparés, masqués tant que l'authentification n'est pas activée.
  $("#se-connecter").hidden = !etat.config.connexionActive;
  $("#mon-compte").hidden = !etat.config.connexionActive;

  ajouterMessage({ auteur: etat.textes.assistant, texte: etat.textes.bienvenue });

  const champ = $("#question");
  $("#formulaire").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = champ.value.trim();
    if (!q) return;
    champ.value = "";
    envoyer(q);
  });
  champ.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#formulaire").requestSubmit(); }
  });

  const dialogue = $("#signalement");
  $("#ouvrir-signalement").addEventListener("click", () => { $("#retour-signalement").textContent = ""; dialogue.showModal(); });
  $("#fermer-signalement").addEventListener("click", () => dialogue.close());
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
      $("#retour-signalement").textContent = etat.textes.erreurReseau;
    }
  });
}

demarrer();
