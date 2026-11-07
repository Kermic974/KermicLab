import { test } from "node:test";
import assert from "node:assert/strict";
import { clientCloudflare, prendreInstantane, retablir, testerFumee, fumeeAvecReprises } from "../../scripts/deploiement.mjs";

// Sûreté du déploiement : instantané, test de fumée, retour arrière (issue #178). Aucun appel réseau réel.
const API = "https://kermiclab-api.kermic.workers.dev", SITE = "https://kermiclab.online";
const reponse = (corps, status = 200) => new Response(typeof corps === "string" ? corps : JSON.stringify(corps), { status });

function faussesApis(etat = {}) {
  const appels = [];
  const f = async (url, init = {}) => {
    appels.push({ url, methode: init.method ?? "GET", corps: init.body && JSON.parse(init.body), auth: init.headers?.authorization });
    const u = new URL(url);
    if (u.pathname.endsWith("/workers/scripts/kermiclab-api/deployments") && (init.method ?? "GET") === "GET") {
      return reponse({ success: true, result: { deployments: [
        { id: "ancien", created_on: "2026-11-01T00:00:00Z", versions: [{ version_id: "v-ancienne", percentage: 100 }] },
        { id: "courant", created_on: "2026-11-07T00:00:00Z", versions: [{ version_id: "v-courante", percentage: 100 }] }
      ] } });
    }
    if (u.pathname.endsWith("/pages/projects/kermiclab/deployments")) return reponse({ success: true, result: [{ id: "pages-courant" }] });
    if (init.method === "POST") return etat.refus ? reponse({ success: false, errors: [{ code: 10000, message: "refusé" }] }, 403) : reponse({ success: true, result: {} });
    if (url === `${API}/api/sante`) return etat.santeKo ? reponse("", 502) : reponse({ ok: true, maquettes: 174 });
    if (url === `${API}/api/catalogue`) return reponse({ notions: [{ id: "fractions" }] });
    if (url === `${API}/maquettes/trigo-cercle?lang=fr`) return reponse('<script type="application/json" id="kermiclab-meta">{}</script>');
    if (url === `${SITE}/`) return reponse("<title>KermicLab</title>");
    if (url === `${SITE}/config.json`) return reponse({ apiUrl: etat.apiUrl ?? API });
    return reponse("introuvable", 404);
  };
  return { f, appels };
}

test("instantané : déploiement courant du Worker (le plus récent) et déploiement Pages de production", async () => {
  const { f, appels } = faussesApis();
  const cf = clientCloudflare({ jeton: "jeton-test", compte: "compte", fetch: f });
  assert.deepEqual(await prendreInstantane(cf, { worker: "kermiclab-api", projet: "kermiclab" }), {
    worker: { nom: "kermiclab-api", versions: [{ version_id: "v-courante", percentage: 100 }] },
    pages: { projet: "kermiclab", deploiement: "pages-courant" }
  });
  assert.ok(appels.every((a) => a.auth === "Bearer jeton-test" && a.url.startsWith("https://api.cloudflare.com/client/v4/accounts/compte/")));
  assert.match(appels[1].url, /env=production/);
});

test("retour arrière : redéploie les versions du Worker puis restaure Pages", async () => {
  const { f, appels } = faussesApis();
  const cf = clientCloudflare({ jeton: "j", compte: "c", fetch: f });
  const faits = await retablir(cf, {
    worker: { nom: "kermiclab-api", versions: [{ version_id: "v-courante", percentage: 100 }] },
    pages: { projet: "kermiclab", deploiement: "pages-courant" }
  });
  assert.equal(faits.length, 2);
  assert.equal(appels[0].methode, "POST");
  assert.match(appels[0].url, /\/workers\/scripts\/kermiclab-api\/deployments$/);
  assert.deepEqual(appels[0].corps.versions, [{ version_id: "v-courante", percentage: 100 }]);
  assert.equal(appels[0].corps.strategy, "percentage");
  assert.match(appels[1].url, /\/pages\/projects\/kermiclab\/deployments\/pages-courant\/rollback$/);
  assert.deepEqual(await retablir(cf, { worker: null, pages: null }), [], "instantané vide : aucun appel");
});

test("API Cloudflare : une erreur est remontée avec son code, sans le jeton", async () => {
  const cf = clientCloudflare({ jeton: "secret-a-ne-pas-afficher", compte: "c", fetch: faussesApis({ refus: true }).f });
  await assert.rejects(() => retablir(cf, { worker: { nom: "kermiclab-api", versions: [{ version_id: "v", percentage: 100 }] } }),
    (e) => /HTTP 403 \(10000 refusé\)/.test(e.message) && !e.message.includes("secret-a-ne-pas-afficher"));
});

test("test de fumée : réussi quand API, page servie, site et configuration répondent", async () => {
  const { f, appels } = faussesApis();
  assert.deepEqual(await testerFumee({ api: API, site: SITE, fetch: f }), []);
  assert.ok(appels.every((a) => a.methode === "GET"), "lectures seulement : aucun KPI écrit");
  assert.ok(!appels.some((a) => a.url.includes("/api/chat")));
});

test("test de fumée : chaque échec est nommé", async () => {
  const { f } = faussesApis({ santeKo: true, apiUrl: "https://autre.example" });
  const echecs = await testerFumee({ api: API, site: SITE, fetch: f });
  assert.deepEqual(echecs, ["API santé : HTTP 502", `Configuration du site : apiUrl https://autre.example ≠ ${API}`]);
});

test("test de fumée : reprises le temps de la propagation, puis échec définitif", async () => {
  let n = 0;
  const { f } = faussesApis();
  const instable = async (url, init) => (url.endsWith("/api/sante") && n++ < 2 ? reponse("", 503) : f(url, init));
  const attentes = [];
  assert.deepEqual(await fumeeAvecReprises({ api: API, site: SITE, fetch: instable }, { dormir: async (ms) => attentes.push(ms) }), []);
  assert.equal(attentes.length, 2);
  const toujoursKo = faussesApis({ santeKo: true }).f;
  const echecs = await fumeeAvecReprises({ api: API, site: SITE, fetch: toujoursKo }, { essais: 3, dormir: async () => {} });
  assert.deepEqual(echecs, ["API santé : HTTP 502"]);
});
