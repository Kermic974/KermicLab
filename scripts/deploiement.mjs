// Sûreté du déploiement (feuille de route, phase 0 ; issue #178), appelée par le job « Déploiement Cloudflare » :
//   node scripts/deploiement.mjs instantane <fichier>   avant le déploiement : versions en production du Worker et de Pages
//   node scripts/deploiement.mjs fumee                  après : test de fumée de l'API et du site (sans écrire de KPI)
//   node scripts/deploiement.mjs retour <fichier>       si le test échoue : rétablit les versions de l'instantané
// Les migrations D1 ne sont jamais annulées : elles doivent rester compatibles avec la version précédente du Worker
// (ajouts seulement, voir worker/migrations/README.md), ce qui rend le retour arrière du Worker sûr.
import { readFile, writeFile } from "node:fs/promises";
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

/** Versions actuellement servies : déploiement courant du Worker (le plus récent) et déploiement Pages de production. */
export async function prendreInstantane(cf, { worker, projet }) {
  const { deployments = [] } = await cf("GET", `/workers/scripts/${worker}/deployments`);
  const courant = [...deployments].sort((a, b) => String(b.created_on).localeCompare(String(a.created_on)))[0];
  const pages = await cf("GET", `/pages/projects/${projet}/deployments?env=production&per_page=1`);
  return {
    worker: courant ? { nom: worker, versions: courant.versions.map(({ version_id, percentage }) => ({ version_id, percentage })) } : null,
    pages: pages?.[0] ? { projet, deploiement: pages[0].id } : null
  };
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

/**
 * Test de fumée : uniquement des lectures qui n'écrivent aucun KPI (ni /api/chat, ni journalisation).
 * Renvoie la liste des échecs (vide si tout va bien).
 */
export async function testerFumee({ api, site, fetch: f = fetch }) {
  const echecs = [];
  const verifier = async (nom, url, controle) => {
    try {
      const reponse = await f(url, { headers: { "cache-control": "no-cache" } });
      if (!reponse.ok) { echecs.push(`${nom} : HTTP ${reponse.status}`); return; }
      const erreur = await controle(reponse);
      if (erreur) echecs.push(`${nom} : ${erreur}`);
    } catch (e) { echecs.push(`${nom} : ${e.message}`); }
  };
  await verifier("API santé", `${api}/api/sante`, async (r) => {
    const d = await r.json();
    return d.ok === true && d.maquettes > 0 ? null : `réponse inattendue ${JSON.stringify(d)}`;
  });
  await verifier("API catalogue", `${api}/api/catalogue`, async (r) => {
    const d = await r.json();
    return Array.isArray(d.notions) && d.notions.length > 0 ? null : "catalogue vide";
  });
  await verifier("Page servie", `${api}/maquettes/trigo-cercle?lang=fr`, async (r) =>
    (await r.text()).includes('id="kermiclab-meta"') ? null : "métadonnées absentes");
  await verifier("Site", `${site}/`, async (r) => (/<title>KermicLab/.test(await r.text()) ? null : "titre absent"));
  await verifier("Configuration du site", `${site}/config.json`, async (r) => {
    const d = await r.json();
    return d.apiUrl === api ? null : `apiUrl ${d.apiUrl} ≠ ${api}`;
  });
  return echecs;
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
  const [commande, fichier] = process.argv.slice(2);
  const sansFin = (u) => String(u ?? "").replace(/\/$/, "");
  if (commande === "fumee") {
    const api = sansFin(process.env.KERMICLAB_API_URL), site = sansFin(process.env.KERMICLAB_SITE_URL);
    if (!api || !site) throw new Error("KERMICLAB_API_URL et KERMICLAB_SITE_URL sont requis");
    const echecs = await fumeeAvecReprises({ api, site });
    if (echecs.length) {
      for (const e of echecs) console.log(`::error::Test de fumée : ${e}`);
      process.exit(1);
    }
    console.log("Test de fumée réussi : API, page servie, site et configuration.");
    return;
  }
  const cf = clientCloudflare({ jeton: process.env.CLOUDFLARE_API_TOKEN, compte: process.env.CLOUDFLARE_ACCOUNT_ID });
  if (!fichier) throw new Error("fichier d'instantané requis");
  if (commande === "instantane") {
    const instantane = await prendreInstantane(cf, {
      worker: process.env.KERMICLAB_WORKER ?? "kermiclab-api", projet: process.env.CLOUDFLARE_PAGES_PROJECT || "kermiclab"
    });
    await writeFile(fichier, `${JSON.stringify(instantane, null, 2)}\n`);
    console.log(`Instantané : ${JSON.stringify(instantane)}`);
  } else if (commande === "retour") {
    const faits = await retablir(cf, JSON.parse(await readFile(fichier, "utf8")));
    console.log(faits.length ? `Retour arrière effectué : ${faits.join(" ; ")}` : "::warning::Instantané vide : rien à rétablir.");
  } else {
    throw new Error(`commande inconnue : ${commande}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
