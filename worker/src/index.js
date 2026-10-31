import { CATALOGUE } from "./generated/catalogue.js";
import { routerLocal } from "./router.js";
import { analyser } from "./moderation.js";
import { messages, LANGUES } from "./messages.js";
import { creerLimiteur } from "./limiteur.js";
import { journaliser } from "./kpi.js";
import { sauvegarderKpi, jourPrecedent } from "./sauvegarde.js";
import { routerAvecClaude } from "./llm.js";
import { creerOuCommenterIssue, corpsMaquetteManquante, commentaireDemande } from "./github.js";

const TAILLE_MAX_PAR_DEFAUT = 500;
let limiteur = null;
let clientClaude = null; // injecté par les tests ; sinon créé par llm.js

function json(donnees, statut, cors) {
  return new Response(JSON.stringify(donnees), {
    status: statut,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors }
  });
}

function enTetesCors(requete, env) {
  const origine = requete.headers.get("origin");
  const autorisees = String(env.ORIGINES_AUTORISEES || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (origine && (autorisees.includes(origine) || autorisees.includes("*"))) {
    return { "access-control-allow-origin": origine, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" };
  }
  return {};
}

function langueValide(l) {
  return LANGUES.includes(l) ? l : "fr";
}

function maquetteParId(id) {
  return CATALOGUE.index.maquettes.find((m) => m.id === id);
}

function urlMaquette(requete, id, langue) {
  return `${new URL(requete.url).origin}/maquettes/${id}?lang=${langue}`;
}

/** Réponse "maquette servie" + signalement éventuel d'une traduction manquante. */
async function servirMaquette(requete, env, ctx, { id, langue, question, routage }) {
  const m = maquetteParId(id);
  const traduite = m.langues.includes(langue);
  ctx.waitUntil(journaliser(env, { type: "maquette_servie", maquetteId: id, sujet: m.sujet, langue, routage }));
  if (!traduite) {
    ctx.waitUntil(creerOuCommenterIssue(env, {
      label: "traduction-manquante", sujet: `${id} (${langue})`,
      corps: `La maquette \`${id}\` a été demandée en \`${langue}\` mais cette traduction n'existe pas.\n\nIssue créée automatiquement par le Worker Kermiclab.`,
      commentaire: commentaireDemande({ question, langue })
    }).catch((e) => console.error("issue traduction", e.message)));
  }
  const t = messages(langue);
  return {
    type: "maquette",
    texte: traduite ? t.maquette(m.titre) : `${t.traductionManquante} ${t.maquette(m.titre)}`,
    maquette: { id: m.id, titre: m.titre, version: m.version, langue: traduite ? langue : "fr", url: urlMaquette(requete, m.id, traduite ? langue : "fr") }
  };
}

async function traiterChat(requete, env, ctx) {
  let corps;
  try { corps = await requete.json(); } catch { return { statut: 400, donnees: { type: "erreur", texte: messages("fr").erreur } }; }
  let langue = langueValide(corps?.langue);
  const t = () => messages(langue);
  const message = String(corps?.message ?? "").trim();
  const tailleMax = Number(env.TAILLE_MAX_MESSAGE) || TAILLE_MAX_PAR_DEFAUT;

  if (!message) return { statut: 400, donnees: { type: "refus", texte: t().vide } };
  if (message.length > tailleMax) {
    ctx.waitUntil(journaliser(env, { type: "refus", langue, detail: "trop-long" }));
    return { statut: 413, donnees: { type: "refus", texte: t().tropLong } };
  }
  ctx.waitUntil(journaliser(env, { type: "demande", langue }));

  const moderation = analyser(message);
  if (!moderation.ok) {
    ctx.waitUntil(journaliser(env, { type: "refus", langue, detail: moderation.raison }));
    const texte = moderation.raison.startsWith("donnees-personnelles") ? t().donneesPersonnelles : t().inapproprie;
    return { statut: 200, donnees: { type: "refus", texte } };
  }

  // 1. Routage déterministe par mots-clés (zéro token).
  const idLocal = routerLocal(message, CATALOGUE.index);
  if (idLocal) {
    return { statut: 200, donnees: await servirMaquette(requete, env, ctx, { id: idLocal, langue, question: message, routage: "mots-cles" }) };
  }

  // 2. Routage par le modèle (sortie JSON structurée).
  if (!env.ANTHROPIC_API_KEY) {
    ctx.waitUntil(journaliser(env, { type: "reponse", langue, routage: "sans-modele" }));
    return { statut: 200, donnees: { type: "reponse", texte: t().indisponible } };
  }
  const historique = (Array.isArray(corps.historique) ? corps.historique : [])
    .filter((h) => (h?.role === "user" || h?.role === "assistant") && typeof h.content === "string" && analyser(h.content).ok)
    .slice(-6)
    .map((h) => ({ role: h.role, content: h.content.slice(0, tailleMax * 2) }));
  while (historique.length && historique[0].role !== "user") historique.shift();

  let r;
  try {
    r = await routerAvecClaude(env, { message, historique, index: CATALOGUE.index }, clientClaude);
  } catch (e) {
    console.error("llm", e?.message);
    ctx.waitUntil(journaliser(env, { type: "erreur", langue, detail: "llm" }));
    return { statut: 200, donnees: { type: "reponse", texte: t().indisponible } };
  }
  if (r.refus || r.intention === "inapproprie") {
    ctx.waitUntil(journaliser(env, { type: "refus", langue, detail: r.refus ? "refus-modele" : "intention-inappropriee" }));
    return { statut: 200, donnees: { type: "refus", texte: t().inapproprie } };
  }
  langue = langueValide(r.langue);
  if (r.maquette_id !== "aucune") {
    return { statut: 200, donnees: await servirMaquette(requete, env, ctx, { id: r.maquette_id, langue, question: message, routage: "modele" }) };
  }

  // Modération de sortie.
  let texte = String(r.reponse || "").trim();
  if (!texte || !analyser(texte).ok) {
    ctx.waitUntil(journaliser(env, { type: "refus", langue, detail: "sortie-filtree" }));
    texte = t().indisponible;
  }

  // 3. Boucle d'exception : maquette pertinente mais absente → issue GitHub.
  if (r.intention === "apprendre" && r.maquette_pertinente && r.sujet) {
    ctx.waitUntil(journaliser(env, { type: "exception", sujet: r.sujet, langue, routage: "modele" }));
    ctx.waitUntil(creerOuCommenterIssue(env, {
      label: "maquette-manquante", sujet: r.sujet,
      corps: corpsMaquetteManquante({ question: message, sujet: r.sujet, langue, planOnglets: r.plan_onglets }),
      commentaire: commentaireDemande({ question: message, langue })
    }).catch((e) => console.error("issue maquette", e.message)));
    return { statut: 200, donnees: { type: "reponse", texte: `${texte}\n\n${t().maquetteBientot}`, exception: true } };
  }
  ctx.waitUntil(journaliser(env, { type: "reponse", sujet: r.sujet || null, langue, routage: "modele" }));
  return { statut: 200, donnees: { type: "reponse", texte } };
}

async function traiterSupport(requete, env, ctx) {
  let corps;
  try { corps = await requete.json(); } catch { return { statut: 400, donnees: { ok: false } }; }
  const langue = langueValide(corps?.langue);
  const message = String(corps?.message ?? "").trim().slice(0, 2000);
  if (!message) return { statut: 400, donnees: { ok: false } };
  if (!analyser(message).ok) return { statut: 200, donnees: { ok: false, texte: messages(langue).donneesPersonnelles } };
  ctx.waitUntil(journaliser(env, { type: "support", langue }));
  try {
    await creerOuCommenterIssue(env, {
      label: "support", sujet: `Signalement ${new Date().toISOString().slice(0, 16)}`,
      corps: `Signalement envoyé depuis le chat (${langue}) :\n\n> ${message.replace(/\n/g, "\n> ")}\n\nIssue créée automatiquement par le Worker Kermiclab.`
    });
  } catch (e) {
    console.error("support", e.message);
    return { statut: 502, donnees: { ok: false, texte: messages(langue).erreur } };
  }
  return { statut: 200, donnees: { ok: true, texte: messages(langue).supportMerci } };
}

function servirPage(requete, env, id) {
  const m = maquetteParId(id);
  if (!m) return new Response("Not found", { status: 404 });
  const demandee = langueValide(new URL(requete.url).searchParams.get("lang"));
  const langue = m.langues.includes(demandee) ? demandee : "fr";
  const html = CATALOGUE.pages[id][langue];
  const ancetres = ["'self'", ...String(env.ORIGINES_AUTORISEES || "").split(",").map((s) => s.trim()).filter((s) => s && s !== "*")].join(" ");
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "content-security-policy": `frame-ancestors ${ancetres}`,
      "x-kermiclab-maquette": `${m.id}@${m.version}`
    }
  });
}

export default {
  async fetch(requete, env, ctx) {
    const url = new URL(requete.url);
    const cors = enTetesCors(requete, env);
    if (requete.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (requete.method === "GET" && url.pathname === "/api/sante") {
      return json({ ok: true, maquettes: CATALOGUE.index.maquettes.length }, 200, cors);
    }
    const page = url.pathname.match(/^\/maquettes\/([a-z0-9-]+)$/);
    if ((requete.method === "GET" || requete.method === "HEAD") && page) return servirPage(requete, env, page[1]);

    if (requete.method === "POST" && (url.pathname === "/api/chat" || url.pathname === "/api/support")) {
      limiteur ??= creerLimiteur({ maxParMinute: Number(env.LIMITE_PAR_MINUTE) || 20 });
      const ip = requete.headers.get("cf-connecting-ip") || "inconnue";
      if (!limiteur(ip)) {
        ctx.waitUntil(journaliser(env, { type: "refus", detail: "limite-debit" }));
        return json({ type: "refus", texte: messages("fr").tropDeDemandes }, 429, cors);
      }
      try {
        const { statut, donnees } = url.pathname === "/api/chat" ? await traiterChat(requete, env, ctx) : await traiterSupport(requete, env, ctx);
        return json(donnees, statut, cors);
      } catch (e) {
        console.error("erreur", e?.message);
        ctx.waitUntil(journaliser(env, { type: "erreur", detail: "interne" }));
        return json({ type: "erreur", texte: messages("fr").erreur }, 500, cors);
      }
    }
    // Hors API : fichiers statiques du chat (binding ASSETS), sinon 404.
    if (env.ASSETS && !url.pathname.startsWith("/api/")) return env.ASSETS.fetch(requete);
    return json({ erreur: "introuvable" }, 404, cors);
  },

  /** Cron quotidien (wrangler.toml) : sauvegarde des KPI de la veille dans R2. */
  async scheduled(evenement, env, ctx) {
    ctx.waitUntil(sauvegarderKpi(env, jourPrecedent(evenement.scheduledTime))
      .then((r) => console.log("sauvegarde kpi", JSON.stringify(r)))
      .catch((e) => console.error("sauvegarde kpi", e?.message)));
  }
};

/** Réinitialise l'état en mémoire (tests). */
export function _reinitialiser({ client = null } = {}) { limiteur = null; clientClaude = client; }
