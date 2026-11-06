// Partagé avec les pages autonomes par le build ; aucun accès réseau ni stockage.
// L'idée est saisie dans le tableau de bord (formulaire natif, comme « Signaler un problème ») :
// - sur le tableau de bord, l'événement « kermiclab:idee » ouvre directement le formulaire ;
// - dans une page intégrée (iframe), le contexte est confié à la page parente par postMessage ;
// - dans une page ouverte seule, le lien mène au tableau de bord avec le contexte dans le fragment d'URL.
// Aucun compte GitHub n'est demandé : c'est le Worker qui crée l'issue.
(() => {
  const config = JSON.parse(document.getElementById("boite-idees-config").textContent);
  const textes = () => config.textes[document.documentElement.lang] ?? config.textes.fr;
  const SITE = config.site || "https://www.kermiclab.online/";
  // Visage pensif, main au menton, ampoule allumée au-dessus de la tête.
  const ICONE = '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">'
    + '<g class="boite-idees-rayons" fill="none" stroke="#f5a300" stroke-width="2.2" stroke-linecap="round">'
    + '<path d="M34 1.6v2.6M25.4 4.8l1.9 1.7M42.6 4.8l-1.9 1.7M23.6 11.6h2.5M44.4 11.6h-2.5"/></g>'
    + '<path d="M34 5.8a6 6 0 0 0-3.7 10.7c.8.6 1.2 1.4 1.2 2.3h5c0-.9.4-1.7 1.2-2.3A6 6 0 0 0 34 5.8z" fill="#ffe45c" stroke="#e39b00" stroke-width="1.4"/>'
    + '<path d="M31.9 20.6h4.2M32.4 22.6h3.2" fill="none" stroke="#6b7090" stroke-width="1.6" stroke-linecap="round"/>'
    + '<circle cx="21" cy="30.5" r="14.5" fill="#ffcc4d" stroke="#e0a100" stroke-width="1.4"/>'
    + '<path d="M11.8 23.4q3.2-2.6 6.4-1.1M23.6 20.4q3.4-1.9 6.6.4" fill="none" stroke="#664500" stroke-width="1.8" stroke-linecap="round"/>'
    + '<ellipse cx="15.6" cy="27.4" rx="1.8" ry="2.4" fill="#664500"/><ellipse cx="26.4" cy="26.6" rx="1.8" ry="2.4" fill="#664500"/>'
    + '<path d="M15.6 36.4l8.2-1.6" fill="none" stroke="#664500" stroke-width="1.9" stroke-linecap="round"/>'
    + '<path d="M8.6 41.2c1.2-3.1 4.6-4.9 7.9-4l4.6 1.2c1.1.3 1.1 1.9 0 2.2l-3 .6 3.4.4c1.1.1 1.3 1.7.2 2l-6.5 1.7c-3.2.8-6-.6-6.6-4.1z" fill="#f4900c" stroke="#c46a00" stroke-width="1.2" stroke-linejoin="round"/>'
    + "</svg>";
  const identifiant = (noeud) => noeud?.dataset.onglet ?? noeud?.dataset.tab ?? noeud?.dataset.nav
    ?? noeud?.dataset.matiere ?? noeud?.getAttribute("aria-controls") ?? noeud?.id ?? "";

  /** Où l'on se trouve (jamais de saisie de l'élève ni d'URL complète) : page, vue, onglet, dialogue. */
  function contexte(lien) {
    const dialogue = lien.closest("dialog");
    const zone = dialogue ?? document;
    const visible = (noeud) => noeud.getClientRects().length > 0
      && getComputedStyle(noeud).visibility === "visible";
    const onglets = (racine) => [...racine.querySelectorAll('[role="tab"][aria-selected="true"]')].find(visible);
    const onglet = onglets(zone) ?? (zone === document ? undefined : onglets(document));
    const navigation = document.querySelector('[data-nav][aria-expanded="true"]')
      ?? document.querySelector('[data-nav][aria-current="page"]');
    const cadre = dialogue?.querySelector("iframe[data-module]");
    const vues = [...zone.querySelectorAll("[data-vue]:not([hidden])")].filter(visible).map((n) => n.dataset.vue);
    const brut = {
      page: config.page,
      version: config.version,
      langue: document.documentElement.lang,
      navigation: identifiant(navigation),
      dialogue: dialogue?.id,
      module: cadre?.dataset.module,
      onglet: identifiant(onglet),
      vues: vues.join(", ")
    };
    return Object.fromEntries(Object.entries(brut).filter(([, valeur]) => valeur).map(([cle, valeur]) => [cle, String(valeur)]));
  }

  /** Repli sans tableau de bord : le formulaire du site, contexte dans le fragment (jamais envoyé au serveur). */
  function cible(infos) {
    const fragment = `#idee=${encodeURIComponent(JSON.stringify(infos))}`;
    return /^https?:$/.test(location.protocol) ? new URL(`/${fragment}`, location.origin).href : `${SITE}${fragment}`;
  }

  function actualiser(lien) {
    lien.href = cible(contexte(lien));
    lien.querySelector(".boite-idees-texte").textContent = textes().ideeAction;
    lien.title = textes().ideeAvertissement;
    lien.setAttribute("aria-label", `${textes().ideeAction} — ${textes().ideeAvertissement}`);
  }

  function proposer(lien, evenement) {
    const infos = contexte(lien);
    const demande = new CustomEvent("kermiclab:idee", { detail: infos, cancelable: true });
    if (!document.dispatchEvent(demande)) { evenement.preventDefault(); return; }
    if (window.parent !== window) {
      evenement.preventDefault();
      window.parent.postMessage({ type: "kermiclab:idee", contexte: infos }, "*");
      return;
    }
    lien.href = cible(infos);
  }

  function ajouter(hote, variante) {
    if (hote.querySelector(":scope > .boite-idees")) return;
    const lien = document.createElement("a");
    lien.className = `boite-idees boite-idees-${variante}`;
    lien.innerHTML = `<span class="boite-idees-icone">${ICONE}</span><span class="boite-idees-texte"></span>`;
    lien.addEventListener("click", (e) => proposer(lien, e));
    for (const evenement of ["pointerdown", "focus", "contextmenu"]) lien.addEventListener(evenement, () => actualiser(lien));
    hote.append(lien);
    actualiser(lien);
  }

  function monter() {
    ajouter(document.body, "flottante");
    document.querySelectorAll("[data-boite-idees-hote]").forEach((hote) => ajouter(hote, "integree"));
    document.querySelectorAll("dialog:not([data-sans-idees])").forEach((dialogue) => ajouter(dialogue, "dialogue"));
  }
  monter();
  new MutationObserver(monter).observe(document.body, { childList: true, subtree: true });
  new MutationObserver(() => document.querySelectorAll(".boite-idees").forEach(actualiser))
    .observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
})();
