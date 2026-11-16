// Sûreté du déploiement (feuille de route, phase 0 ; issue #178), appelée par le job « Déploiement Cloudflare » :
//   node scripts/deploiement.mjs instantane   avant le déploiement : versions en production du Worker et de Pages,
//                                             publiées en sortie d'étape GitHub (`instantane`), jamais dans un fichier
//   node scripts/deploiement.mjs fumee        après : test de fumée de l'API et du site (sans écrire de KPI)
//   node scripts/deploiement.mjs retour       si le test échoue : rétablit l'instantané reçu dans la variable INSTANTANE
// Les migrations D1 ne sont jamais annulées : elles doivent rester compatibles avec la version précédente du Worker
// (ajouts seulement, voir worker/migrations/README.md), ce qui rend le retour arrière du Worker sûr.
import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const API_CLOUDFLARE = "https://api.cloudflare.com/client/v4";

/** Client minimal de l'API Cloudflare (enveloppe { success, errors, result }). */
export function clientCloudflare({ jeton, compte, fetch: f = fetch }) {
  return async (methode, chemin, corps) => {
    const reponse = await f(`${API_CLOUDFLARE}/accounts/${compte}${chemin}`, {
      method: methode,
      headers: { authorization: `Bearer ${jeton}`, "content-type": "application/json" },
      ...(corps && { body: JSON.stringify(corps) })
    });
    const donnees = await reponse.json().catch(() => ({}));
    if (!reponse.ok || donnees.success === false) {
      const detail = (donnees.errors ?? []).map((e) => `${e.code} ${e.message}`).join(" ; ");
      throw new Error(`API Cloudflare ${methode} ${chemin} : HTTP ${reponse.status}${detail ? ` (${detail})` : ""}`);
    }
    return donnees.result;
  };
}

/**
 * Versions actuellement servies : déploiement courant du Worker (le plus récent) et dernier déploiement Pages de
 * production **réussi**. Un déploiement en échec, annulé ou ignoré ne peut pas servir de cible de retour arrière
 * (Cloudflare : « You cannot rollback to a failed deployment »).
 */
export async function prendreInstantane(cf, { worker, projet }) {
  const { deployments = [] } = await cf("GET", `/workers/scripts/${worker}/deployments`);
  const courant = [...deployments].sort((a, b) => String(b.created_on).localeCompare(String(a.created_on)))[0];
  const pages = await cf("GET", `/pages/projects/${projet}/deployments?env=production&per_page=25`);
  const servi = [...(pages ?? [])]
    .filter((d) => d.environment === "production" && !d.is_skipped &&
      d.latest_stage?.name === "deploy" && d.latest_stage?.status === "success")
    .sort((a, b) => String(b.created_on).localeCompare(String(a.created_on)))[0];
  return {
    worker: courant ? { nom: worker, versions: courant.versions.map(({ version_id, percentage }) => ({ version_id, percentage })) } : null,
    pages: servi ? { projet, deploiement: servi.id } : null
  };
}

const NOM = /^[a-z0-9][a-z0-9-]{0,62}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Valide un instantané relu depuis le disque avant tout appel : noms attendus (Worker et projet Pages de ce déploiement),
 * identifiants au format UUID, pourcentages entre 0 et 100 dont la somme vaut 100. Rien d'autre n'est transmis.
 */
export function validerInstantane(instantane, { worker, projet }) {
  const valide = { worker: null, pages: null };
  if (instantane?.worker) {
    const { nom, versions } = instantane.worker;
    if (nom !== worker || !NOM.test(nom)) throw new Error(`instantané : Worker inattendu « ${nom} »`);
    if (!Array.isArray(versions) || !versions.length || versions.some((v) => !UUID.test(v?.version_id) ||
        typeof v.percentage !== "number" || v.percentage <= 0 || v.percentage > 100) ||
        Math.abs(versions.reduce((t, v) => t + v.percentage, 0) - 100) > 1e-9) throw new Error("instantané : versions du Worker invalides");
    valide.worker = { nom, versions: versions.map(({ version_id, percentage }) => ({ version_id, percentage })) };
  }
  if (instantane?.pages) {
    const { projet: p, deploiement } = instantane.pages;
    if (p !== projet || !NOM.test(p)) throw new Error(`instantané : projet Pages inattendu « ${p} »`);
    if (!UUID.test(deploiement)) throw new Error("instantané : identifiant de déploiement Pages invalide");
    valide.pages = { projet: p, deploiement };
  }
  return valide;
}

/** Rétablit l'instantané : redéploie les versions du Worker, puis restaure le déploiement Pages de production. */
export async function retablir(cf, instantane) {
  const faits = [];
  if (instantane.worker?.versions?.length) {
    await cf("POST", `/workers/scripts/${instantane.worker.nom}/deployments`, {
      strategy: "percentage", versions: instantane.worker.versions,
      annotations: { "workers/message": "Retour arrière automatique : test de fumée en échec" }
    });
    faits.push(`Worker ${instantane.worker.nom} → ${instantane.worker.versions.map((v) => v.version_id).join(", ")}`);
  }
  if (instantane.pages?.deploiement) {
    await cf("POST", `/pages/projects/${instantane.pages.projet}/deployments/${instantane.pages.deploiement}/rollback`);
    faits.push(`Pages ${instantane.pages.projet} → ${instantane.pages.deploiement}`);
  }
  return faits;
}

/** Diagnostic borné et sur une ligne : jamais un corps de réponse entier dans le journal. */
const expurger = (texte) => String(texte).replace(/\s+/g, " ").slice(0, 200);

/**
 * Test de fumée (issues #178 et #261) : uniquement des lectures qui n'écrivent aucun KPI et n'appellent aucun modèle
 * (ni /api/chat, ni /api/defi, ni /api/cahier, ni journalisation). Renvoie la liste des échecs (vide si tout va bien).
 * `rapport`, s'il est fourni, reçoit une ligne par contrôle : { etape, route, statut, dureeMs, diagnostic }.
 */
export async function testerFumee({ api, site, fetch: f = fetch, rapport = [], horloge = () => Date.now() }) {
  const echecs = [];
  rapport.length = 0;
  const verifier = async (etape, url, controle) => {
    const debut = horloge();
    const ligne = { etape, route: url, statut: "—", dureeMs: 0, diagnostic: "" };
    let resultat;
    try {
      const reponse = await f(url, { headers: { "cache-control": "no-cache", "user-agent": "kermiclab-test-de-fumee (CI)" } });
      ligne.statut = String(reponse.status);
      if (!reponse.ok) ligne.diagnostic = `HTTP ${reponse.status}`;
      else {
        const sortie = await controle(reponse);
        if (typeof sortie === "string") ligne.diagnostic = expurger(sortie); else resultat = sortie;
      }
    } catch (e) { ligne.diagnostic = expurger(e.message); }
    ligne.dureeMs = horloge() - debut;
    rapport.push(ligne);
    if (ligne.diagnostic) echecs.push(`${etape} : ${ligne.diagnostic}`);
    return resultat;
  };
  await verifier("API santé", `${api}/api/sante`, async (r) => {
    const d = await r.json();
    return d.ok === true && d.maquettes > 0 ? null : `réponse inattendue ${JSON.stringify(d)}`;
  });
  await verifier("API catalogue", `${api}/api/catalogue`, async (r) => {
    const d = await r.json();
    return Array.isArray(d.notions) && d.notions.length > 0 ? null : "catalogue vide";
  });
  // Chat : questions d'exemple servies par le catalogue (aucun message envoyé, aucun modèle appelé).
  await verifier("API suggestions du chat", `${api}/api/suggestions?lang=fr`, async (r) => {
    const d = await r.json();
    return Array.isArray(d.suggestions) ? null : "liste des suggestions absente";
  });
  // IA et défi express : état seulement. Générer un défi appellerait un modèle : volontairement non testé.
  await verifier("API état de l'IA et du défi", `${api}/api/llm/status`, async (r) => {
    const d = await r.json();
    return typeof d.actif === "boolean" && typeof d.defi?.ia === "boolean" ? null : "état de l'IA ou du défi absent";
  });
  await verifier("Page servie", `${api}/maquettes/trigo-cercle?lang=fr`, async (r) =>
    (await r.text()).includes('id="kermiclab-meta"') ? null : "métadonnées absentes");
  const ressources = await verifier("Site", `${site}/`, async (r) => {
    const html = await r.text();
    if (!/<title>KermicLab/.test(html)) return "titre absent";
    // Ressources essentielles telles que la page les référence (avec leur empreinte de contenu).
    return ["app.js", "style.css"].map((nom) => html.match(new RegExp(`(?:src|href)="(${nom.replace(".", "\\.")}(?:\\?v=[0-9a-f]+)?)"`))?.[1] ?? nom);
  });
  for (const ressource of ressources ?? []) {
    await verifier(`Ressource ${ressource.split("?")[0]}`, `${site}/${ressource}`, async (r) => ((await r.text()).trim() ? null : "fichier vide"));
  }
  await verifier("Configuration du site", `${site}/config.json`, async (r) => {
    const d = await r.json();
    return d.apiUrl === api ? null : `apiUrl ${d.apiUrl} ≠ ${api}`;
  });
  await verifier("Textes du site", `${site}/i18n/fr.json`, async (r) => {
    const d = await r.json();
    return d && typeof d === "object" && Object.keys(d).length > 0 ? null : "textes absents";
  });
  await verifier("Blog", `${site}/blog/`, async (r) => (/<h1>/.test(await r.text()) ? null : "titre absent"));
  return echecs;
}

/** Rapport du test de fumée en Markdown (résumé de l'étape GitHub) : étape, route, statut, durée, diagnostic. */
export function rapportFumee(rapport) {
  const cellule = (t) => String(t).replace(/\|/g, "\\|");
  const lignes = rapport.map((l) => `| ${l.diagnostic ? "❌" : "✅"} | ${cellule(l.etape)} | \`${cellule(l.route)}\` | ${l.statut} | ${l.dureeMs} ms | ${cellule(l.diagnostic || "—")} |`);
  const echecs = rapport.filter((l) => l.diagnostic).length;
  return [
    "### Test de fumée après déploiement",
    "",
    echecs ? `**${echecs} contrôle(s) en échec sur ${rapport.length}.**` : `${rapport.length} contrôles réussis.`,
    "",
    "| | Étape | Route | Statut | Durée | Diagnostic |",
    "|---|---|---|---|---|---|",
    ...lignes,
    ""
  ].join("\n");
}

/** Répète le test de fumée (propagation du déploiement) avant de conclure à un échec. */
export async function fumeeAvecReprises(options, { essais = 5, attente = 15000, dormir = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let echecs = [];
  for (let i = 1; i <= essais; i++) {
    echecs = await testerFumee(options);
    if (!echecs.length) return [];
    if (i < essais) await dormir(attente);
  }
  return echecs;
}

async function main() {
  const [commande] = process.argv.slice(2);
  const sansFin = (u) => String(u ?? "").replace(/\/$/, "");
  if (commande === "fumee") {
    const api = sansFin(process.env.KERMICLAB_API_URL), site = sansFin(process.env.KERMICLAB_SITE_URL);
    if (!api || !site) throw new Error("KERMICLAB_API_URL et KERMICLAB_SITE_URL sont requis");
    // Le rapport décrit la dernière tentative ; il est publié dans le résumé de l'étape, réussite ou échec.
    const rapport = [];
    const echecs = await fumeeAvecReprises({ api, site, rapport });
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, rapportFumee(rapport));
    for (const l of rapport) console.log(`${l.diagnostic ? "ÉCHEC" : "ok"} · ${l.etape} · ${l.route} · ${l.statut} · ${l.dureeMs} ms${l.diagnostic ? ` · ${l.diagnostic}` : ""}`);
    if (echecs.length) {
      for (const e of echecs) console.log(`::error::Test de fumée : ${e}`);
      process.exit(1);
    }
    console.log(`Test de fumée réussi : ${rapport.length} contrôles (API, page servie, site, ressources, blog).`);
    return;
  }
  const cf = clientCloudflare({ jeton: process.env.CLOUDFLARE_API_TOKEN, compte: process.env.CLOUDFLARE_ACCOUNT_ID });
  if (commande === "instantane") {
    const instantane = await prendreInstantane(cf, {
      worker: process.env.KERMICLAB_WORKER ?? "kermiclab-api", projet: process.env.CLOUDFLARE_PAGES_PROJECT || "kermiclab"
    });
    // Sortie d'étape sur une ligne (JSON compact) : transmise à l'étape de retour arrière par le workflow.
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `instantane=${JSON.stringify(instantane)}\n`);
    console.log(`Instantané : ${JSON.stringify(instantane)}`);
  } else if (commande === "retour") {
    const attendus = { worker: process.env.KERMICLAB_WORKER ?? "kermiclab-api", projet: process.env.CLOUDFLARE_PAGES_PROJECT || "kermiclab" };
    if (!process.env.INSTANTANE) throw new Error("variable INSTANTANE absente : rien à rétablir");
    const faits = await retablir(cf, validerInstantane(JSON.parse(process.env.INSTANTANE), attendus));
    console.log(faits.length ? `Retour arrière effectué : ${faits.join(" ; ")}` : "::warning::Instantané vide : rien à rétablir.");
  } else {
    throw new Error(`commande inconnue : ${commande}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
