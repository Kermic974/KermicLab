// Pont local des pages autonomes : aucun réseau, et aucun accès au stockage du parent.
const Trophees = (() => {
  function monter({ restaurer, resumer }) {
    if (window.parent === window) return () => {};
    const module = JSON.parse(document.getElementById("kermiclab-meta").textContent).id;
    let pret = false;
    const publier = () => {
      if (pret) window.parent.postMessage({ type: "kermiclab:trophees:progres", module, ...resumer() }, "*");
    };
    window.addEventListener("message", (e) => {
      if (e.source !== window.parent || e.data?.type !== "kermiclab:trophees:charger" || e.data.module !== module || pret) return;
      if (e.data.etat !== null) restaurer(e.data.etat);
      pret = true;
      publier();
    });
    window.parent.postMessage({ type: "kermiclab:trophees:pret", module }, "*");
    return publier;
  }
  return Object.freeze({ monter });
})();
