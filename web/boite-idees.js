// Partagé avec les pages autonomes par le build ; aucun accès réseau ni stockage.
(() => {
  const config = JSON.parse(document.getElementById("boite-idees-config").textContent);
  const textes = () => config.textes[document.documentElement.lang] ?? config.textes.fr;
  const identifiant = (noeud) => noeud?.dataset.onglet ?? noeud?.dataset.tab ?? noeud?.dataset.nav
    ?? noeud?.dataset.matiere ?? noeud?.getAttribute("aria-controls") ?? noeud?.id ?? "";

  function contextualiser(lien) {
    const dialogue = lien.closest("dialog");
    const zone = dialogue ?? document.querySelector("#catalogue.ouvert") ?? document;
    const visible = (noeud) => noeud.getClientRects().length > 0
      && getComputedStyle(noeud).visibility === "visible";
    const onglet = [...zone.querySelectorAll('[role="tab"][aria-selected="true"]')].find(visible);
    const navigation = document.querySelector('[data-nav][aria-expanded="true"]')
      ?? document.querySelector('[data-nav][aria-current="page"]');
    const cadre = dialogue?.querySelector("iframe[data-module]");
    const vues = [...zone.querySelectorAll("[data-vue]:not([hidden])")].filter(visible).map((n) => n.dataset.vue);
    const contexte = {
      page: config.page,
      version: config.version,
      langue: document.documentElement.lang,
      navigation: identifiant(navigation),
      dialogue: dialogue?.id,
      panneau: zone === document ? undefined : zone.id,
      module: cadre?.dataset.module,
      onglet: identifiant(onglet),
      vues: vues.join(", ")
    };
    const details = Object.entries(contexte).filter(([, valeur]) => valeur)
      .map(([cle, valeur]) => `- ${cle}: ${valeur}`).join("\n");
    const url = new URL("https://github.com/Kermic974/trigoLab/issues/new");
    url.searchParams.set("template", "feature.yml");
    url.searchParams.set("title", `[Feature] ${config.page} — `);
    url.searchParams.set("need", `${textes().ideeTrame}\n\n### Contexte\n${details}\n\n${textes().ideeAgent}`);
    lien.href = url.href;
    lien.textContent = textes().ideeAction;
    lien.title = textes().ideeAvertissement;
    lien.setAttribute("aria-label", `${textes().ideeAction} — ${textes().ideeAvertissement}`);
  }

  function ajouter(hote, flottant = false) {
    if (hote.querySelector(":scope > .boite-idees")) return;
    const lien = document.createElement("a");
    lien.className = `boite-idees${flottant ? " boite-idees-flottante" : ""}`;
    lien.target = "_blank";
    lien.rel = "noopener noreferrer";
    for (const evenement of ["click", "pointerdown", "focus", "contextmenu"]) {
      lien.addEventListener(evenement, () => contextualiser(lien));
    }
    hote.append(lien);
    contextualiser(lien);
  }

  function monter() {
    ajouter(document.body, true);
    document.querySelectorAll("dialog").forEach((dialogue) => ajouter(dialogue));
  }
  monter();
  new MutationObserver(monter).observe(document.body, { childList: true, subtree: true });
  new MutationObserver(() => document.querySelectorAll(".boite-idees").forEach(contextualiser))
    .observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
})();
