// Pont local des pages autonomes : aucun réseau, et aucun accès au stockage du parent.
const Trophees = (() => {
  function monter({ restaurer, resumer }) {
    if (window.parent === window) return () => {};
    const meta = JSON.parse(document.getElementById("kermiclab-meta").textContent);
    const module = meta.id;
    const origineParent = meta.parentOrigin || (document.referrer ? new URL(document.referrer).origin : null);
    if (!origineParent) return () => {};
    let pret = false;
    const publier = () => {
      if (pret) window.parent.postMessage({ type: "kermiclab:trophees:progres", module, ...resumer() }, origineParent);
    };
    window.addEventListener("message", (e) => {
      if (e.source !== window.parent || e.origin !== origineParent || e.data?.type !== "kermiclab:trophees:charger" || e.data.module !== module || pret) return;
      if (e.data.etat !== null) restaurer(e.data.etat);
      pret = true;
      publier();
    });
    window.parent.postMessage({ type: "kermiclab:trophees:pret", module }, origineParent);
    return publier;
  }
  return Object.freeze({ monter });
})();
