// Pont local des pages autonomes : aucun réseau, et aucun accès au stockage du parent.
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && window.parent !== window) {
    window.parent.postMessage({ type: "kermiclab:chat:fermer" }, "*");
  }
});

const Trophees = (() => {
  function monter({ restaurer, resumer }) {
    if (window.parent === window) return () => {};
    const meta = JSON.parse(document.getElementById("kermiclab-meta").textContent);
    const module = meta.id;
    const originesAutorisees = Array.isArray(meta.allowedParentOrigins) ? meta.allowedParentOrigins : null;
    let origineParent = null;
    let pret = false;
    const publier = () => {
      if (pret) window.parent.postMessage({ type: "kermiclab:trophees:progres", module, ...resumer() }, origineParent);
    };
    window.addEventListener("message", (e) => {
      if (e.source !== window.parent || e.data?.type !== "kermiclab:trophees:charger" || e.data.module !== module || pret) return;
      let origine;
      try { origine = new URL(e.origin); } catch { return; }
      if (!["https:", "http:"].includes(origine.protocol) || origine.origin !== e.origin ||
          (meta.parentOrigin && meta.parentOrigin !== e.origin) ||
          (originesAutorisees && !originesAutorisees.includes(e.origin))) return;
      // L'identité du parent et son origine viennent du message, même sans Referer.
      origineParent = e.origin;
      if (e.data.etat !== null) restaurer(e.data.etat);
      pret = true;
      publier();
    });
    // Seul l'identifiant du module est annoncé avant de connaître l'origine du parent.
    window.parent.postMessage({ type: "kermiclab:trophees:pret", module }, meta.parentOrigin || "*");
    return publier;
  }
  return Object.freeze({ monter });
})();
