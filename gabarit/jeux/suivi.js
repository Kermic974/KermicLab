// Pont Jeux v2 proposé (ADR 0033). Aucun réseau, réponse, liste personnelle ou horodatage envoyé.
const SuiviJeux = (() => {
  "use strict";
  const meta = JSON.parse(document.getElementById("kermiclab-meta").textContent);
  const canaux = new Map(), file = [];
  let origine = null;
  const autorisees = new Set([meta.parentOrigin, ...(Array.isArray(meta.allowedParentOrigins) ? meta.allowedParentOrigins : [])].filter((o) => {
    try { const u = new URL(o); return ["https:", "http:"].includes(u.protocol) && u.origin === o; } catch { return false; }
  }));
  const actif = window.parent !== window && autorisees.size > 0;
  function envoyer(t, evenement, extra = {}) {
    if (!actif) return;
    const ev = { type: "kermiclab:evenement", v: 2, notion: meta.id, version: meta.version,
      tentative: t.id, activite: t.activite, mode: t.mode, sequence: t.sequence++, evenement, ...extra };
    if (origine) window.parent.postMessage(ev, origine);
    else if (file.length < 256) file.push(ev);
  }
  function uuid() {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map((n) => n.toString(16).padStart(2, "0")).join("");
    return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20)].join("-");
  }
  function preparer(activite, mode = "partie", canal = "partie") {
    abandonner(canal);
    canaux.set(canal, { id: uuid(), activite, mode, sequence: 0, commence: false, fini: false });
  }
  function agir(canal = "partie", interaction = true) {
    const t = canaux.get(canal);
    if (!t || t.fini) return null;
    if (!t.commence) { t.commence = true; envoyer(t, "demarre"); }
    if (interaction) envoyer(t, "interaction");
    return t;
  }
  function reponse(correct, canal = "partie") { const t = agir(canal, false); if (t) envoyer(t, "reponse", { correct }); }
  function indice(canal = "partie") { const t = agir(canal, false); if (t) envoyer(t, "indice"); }
  function terminer(resultat, canal = "partie") {
    const t = agir(canal, false); if (!t) return;
    envoyer(t, "termine", { resultat }); t.fini = true;
  }
  function abandonner(canal = "partie") {
    const t = canaux.get(canal);
    if (t?.commence && !t.fini) terminer("abandon", canal);
  }
  function effacer() {
    const definitions = [...canaux.entries()];
    canaux.clear();
    envoyer({ id: uuid(), activite: "effacement", mode: "partie", sequence: 0 }, "efface");
    for (const [canal, t] of definitions) preparer(t.activite, t.mode, canal);
  }
  if (actif) {
    window.addEventListener("message", (e) => {
      if (origine || e.source !== window.parent || !autorisees.has(e.origin) ||
          e.data?.type !== "kermiclab:evenements:ecouter" || e.data.v !== 2 || e.data.notion !== meta.id) return;
      origine = e.origin;
      for (const ev of file.splice(0)) window.parent.postMessage(ev, origine);
    });
    for (const o of autorisees) window.parent.postMessage({ type: "kermiclab:evenements:pret", v: 2, notion: meta.id }, o);
    window.addEventListener("pagehide", () => { for (const canal of canaux.keys()) abandonner(canal); });
  }
  return Object.freeze({ preparer, agir, reponse, indice, terminer, abandonner, effacer });
})();
