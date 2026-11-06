// Signal d'activité d'une page intégrée au tableau de bord (iframe sandboxée).
// Le tableau de bord ne voit pas les interactions qui ont lieu dans une page ouverte en bulle : sans ce signal,
// le temps passé à jouer ou à manipuler une notion serait compté comme de l'inactivité.
// Le message ne contient AUCUNE donnée (ni touche, ni position, ni contenu) : seulement « quelqu'un interagit ».
// Au plus un message toutes les 10 secondes ; aucun appel réseau, aucun stockage ; inactif hors iframe.
(() => {
  if (window.parent === window) return;
  const INTERVALLE_MS = 10_000;
  let dernier = -Infinity;
  const signaler = () => {
    const maintenant = Date.now();
    if (maintenant - dernier < INTERVALLE_MS) return;
    dernier = maintenant;
    window.parent.postMessage({ type: "kermiclab:activite" }, "*");
  };
  for (const evenement of ["pointerdown", "keydown", "touchstart", "wheel"]) {
    window.addEventListener(evenement, signaler, { capture: true, passive: true });
  }
})();
