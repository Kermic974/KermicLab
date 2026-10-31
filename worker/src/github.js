/**
 * Boucle d'exception : création (ou commentaire) d'issues GitHub.
 * Dédoublonnage : une seule issue ouverte par (label, sujet) ; les demandes suivantes ajoutent un commentaire.
 */
const API = "https://api.github.com";

function entetes(env) {
  return {
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "kermiclab-worker",
    "content-type": "application/json"
  };
}

export function titreIssue(label, sujet) {
  return `[${label}] ${String(sujet).trim().slice(0, 120)}`;
}

export async function creerOuCommenterIssue(env, { label, sujet, corps, commentaire }, fetchImpl = fetch) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return { action: "desactive" };
  const titre = titreIssue(label, sujet);
  const liste = await fetchImpl(`${API}/repos/${env.GITHUB_REPO}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=100`, { headers: entetes(env) });
  if (!liste.ok) throw new Error(`github liste ${liste.status}`);
  const existantes = await liste.json();
  const existante = existantes.find((i) => i.title.trim().toLowerCase() === titre.toLowerCase());
  if (existante) {
    const r = await fetchImpl(`${API}/repos/${env.GITHUB_REPO}/issues/${existante.number}/comments`, {
      method: "POST", headers: entetes(env), body: JSON.stringify({ body: commentaire ?? corps })
    });
    if (!r.ok) throw new Error(`github commentaire ${r.status}`);
    return { action: "commentee", numero: existante.number };
  }
  const r = await fetchImpl(`${API}/repos/${env.GITHUB_REPO}/issues`, {
    method: "POST", headers: entetes(env), body: JSON.stringify({ title: titre, body: corps, labels: [label] })
  });
  if (!r.ok) throw new Error(`github creation ${r.status}`);
  const issue = await r.json();
  return { action: "creee", numero: issue.number };
}

export function corpsMaquetteManquante({ question, sujet, langue, planOnglets }) {
  const plan = (planOnglets?.length ? planOnglets : ["explication", "application", "mise-en-situation"])
    .map((o) => `- [ ] ${o}`).join("\n");
  return [
    "Issue créée automatiquement par le Worker Kermiclab.",
    "",
    `**Sujet détecté** : ${sujet}`,
    `**Langue** : ${langue}`,
    "",
    "**Question de l'utilisateur** (filtrée, sans donnée personnelle) :",
    `> ${String(question).replace(/\n/g, " ").slice(0, 500)}`,
    "",
    "**Proposition de plan d'onglets** :",
    plan,
    "",
    "Processus : branche → maquette candidate → tests → PR → validation humaine (voir AGENTS.md)."
  ].join("\n");
}

export function commentaireDemande({ question, langue }) {
  return `Nouvelle demande (${langue}) :\n> ${String(question).replace(/\n/g, " ").slice(0, 500)}`;
}
