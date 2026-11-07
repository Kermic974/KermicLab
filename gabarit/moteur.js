(() => {
  "use strict";
  // Moteur commun des pages Kermiclab générées depuis gabarit/ (voir docs/gabarit.md).
  // Le contenu de la notion est une donnée (script JSON #kermiclab-contenu) : le moteur ne l'interprète jamais comme du HTML.
  const META = JSON.parse(document.getElementById("kermiclab-meta").textContent);
  const C = JSON.parse(document.getElementById("kermiclab-contenu").textContent);
  const CONFIG = { connexionActive: false, stockage: "local" };

  /* ---------- Stockage abstrait : local (actif) / distant (stub) ---------- */
  const Stockage = {
    local: {
      lire(cle) { try { return JSON.parse(localStorage.getItem(`kermiclab:${META.id}:${cle}`)); } catch { return null; } },
      ecrire(cle, valeur) { try { localStorage.setItem(`kermiclab:${META.id}:${cle}`, JSON.stringify(valeur)); } catch { /* stockage indisponible (page en iframe isolée) */ } }
    },
    distant: {
      // Phase 4 : appellera le service web avec META.id et l'identifiant utilisateur.
      lire() { return null; },
      ecrire() { /* non activé */ }
    }
  };
  const stockage = Stockage[CONFIG.stockage];

  /* ---------- Registre des onglets ---------- */
  const registre = [];
  function enregistrerOnglet(def) { registre.push({ actif: true, ...def }); }

  /* ---------- Outils DOM (aucun innerHTML) ---------- */
  function h(balise, attributs, ...enfants) {
    const n = document.createElement(balise);
    for (const [k, v] of Object.entries(attributs ?? {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "classe") n.className = v; else n.setAttribute(k, v === true ? "" : v);
    }
    for (const e of enfants.flat()) if (e !== undefined && e !== null) n.append(e);
    return n;
  }
  /** Texte enrichi minimal : **gras** et *italique*, tout le reste est du texte brut. */
  function riche(texte) {
    const frag = document.createDocumentFragment();
    const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
    let dernier = 0, m;
    while ((m = re.exec(texte))) {
      if (m.index > dernier) frag.append(texte.slice(dernier, m.index));
      frag.append(m[1] ? h("strong", null, m[1]) : h("em", null, m[2]));
      dernier = re.lastIndex;
    }
    if (dernier < texte.length) frag.append(texte.slice(dernier));
    return frag;
  }
  const paragraphe = (t, classe) => h("p", { classe }, riche(t));
  const nombreFr = (x, decimales = 2) => {
    const arr = Math.round(x * 10 ** decimales) / 10 ** decimales;
    return (Object.is(arr, -0) ? 0 : arr).toLocaleString("fr-FR", { maximumFractionDigits: decimales });
  };
  /** Vrai si x s'écrit exactement avec au plus `decimales` chiffres après la virgule. */
  const exact = (x, decimales) => Math.abs(Math.round(x * 10 ** decimales) - x * 10 ** decimales) < 1e-9;
  const pgcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  const SVG = "http://www.w3.org/2000/svg";
  function s(nom, attributs, parent) {
    const n = document.createElementNS(SVG, nom);
    for (const [k, v] of Object.entries(attributs ?? {})) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  }

  /** Lit « 12 », « 3,5 », « -2.25 » ou « 3/4 ». Renvoie { valeur, fraction: [n, d] | null } ou null. */
  function lireNombre(saisie) {
    const t = String(saisie).trim().replace(/\s+/g, "").replace(",", ".");
    const f = t.match(/^(-?\d+)\/(-?\d+)$/);
    if (f) { const n = Number(f[1]), d = Number(f[2]); return d === 0 ? null : { valeur: n / d, fraction: [n, d] }; }
    if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
    return { valeur: Number(t), fraction: null };
  }

  /* ---------- Étoiles : une par exercice réussi, gardées dans le navigateur ---------- */
  const etoiles = new Set(Array.isArray(stockage.lire("etoiles")) ? stockage.lire("etoiles") : []);
  const totalExercices = [...(C.application?.exercices ?? []), ...(C.situation?.etapes ?? [])].length;
  const compteur = document.getElementById("etoiles");
  const publier = typeof Trophees === "undefined" ? () => {} : Trophees.monter({
    restaurer(brut) {
      if (!Array.isArray(brut)) return;
      etoiles.clear();
      for (const id of brut) if (idsExercices.has(id)) etoiles.add(id);
      majEtoiles();
      for (const onglet of registre.filter((o) => o.actif && ["application", "mise-en-situation"].includes(o.id))) {
        const panneau = document.getElementById(`panneau-${onglet.id}`);
        panneau.replaceChildren();
        onglet.rendu(panneau);
      }
    },
    resumer: () => ({ genre: "notions", etat: [...etoiles], etoiles: etoiles.size, etoilesTotal: totalExercices, badges: [] })
  });
  // Contrat d'événements pédagogiques v1 (ADR 0025, gabarit/jeux/evenements.js) : sans effet hors du tableau de bord.
  const signaler = typeof Evenements === "undefined" ? () => {} : Evenements.emettre;
  signaler("demarre");
  const idsExercices = new Set([
    ...(C.application?.exercices ?? []).map((_, i) => `app-${i + 1}`),
    ...(C.situation?.etapes ?? []).map((_, i) => `defi-${i + 1}`)
  ]);
  function majEtoiles() {
    compteur.textContent = `★ ${etoiles.size} / ${totalExercices}`;
    compteur.setAttribute("aria-label", `${etoiles.size} étoiles sur ${totalExercices}`);
  }
  function gagner(id) {
    if (etoiles.has(id)) return false;
    etoiles.add(id);
    stockage.ecrire("etoiles", [...etoiles]);
    majEtoiles();
    publier();
    if (etoiles.size === totalExercices) signaler("termine");
    compteur.classList.remove("brille"); void compteur.offsetWidth; compteur.classList.add("brille");
    return true;
  }

  /* ---------- Composants d'exercice ---------- */
  function retourZone() { return h("p", { classe: "retour", "aria-live": "polite" }); }
  function afficherRetour(zone, ok, texte) {
    zone.className = `retour ${ok ? "ok" : "ko"}`;
    zone.replaceChildren(riche(texte));
  }

  function exerciceQcm(ex, id, surReussite) {
    const zone = retourZone();
    const choix = h("div", { classe: "choix", role: "group", "aria-label": "Réponses possibles" });
    let essais = 0;
    ex.choix.forEach((libelle, i) => {
      const b = h("button", { type: "button", classe: "choix-bouton" }, riche(libelle));
      b.addEventListener("click", () => {
        if (choix.dataset.fini) return;
        essais += 1;
        signaler("reponse", { exercice: id, correct: i === ex.bonne, essai: essais });
        if (i === ex.bonne) {
          choix.dataset.fini = "1";
          b.classList.add("juste");
          choix.querySelectorAll("button").forEach((x) => { x.disabled = true; });
          afficherRetour(zone, true, `${gagner(id) ? "Bravo, +1 étoile ! " : "Bravo ! "}${ex.explication ?? ""}`);
          surReussite?.();
        } else {
          b.classList.add("faux"); b.disabled = true;
          if (ex.indice && essais === 1) signaler("indice", { exercice: id, rang: 1 });
          afficherRetour(zone, false, ex.indice ?? "Pas tout à fait. Relis bien l'énoncé et réessaie !");
        }
      });
      choix.append(b);
    });
    return [choix, zone];
  }

  function exerciceNombre(ex, id, surReussite) {
    const zone = retourZone();
    const champ = h("input", { type: "text", inputmode: "decimal", autocomplete: "off", "aria-label": "Ta réponse", placeholder: ex.fractionIrreductible ? "ex. 3/4" : "ta réponse" });
    // Pas de soumission de formulaire : dans la bulle du tableau de bord, l'iframe est isolée sans « allow-forms »
    // et le navigateur n'y déclenche jamais l'événement « submit ». Bouton et touche Entrée appellent soumettre().
    const valider = h("button", { type: "button", classe: "action" }, "Valider");
    const solution = h("button", { type: "button", classe: "lien", hidden: true }, "Voir la solution");
    const form = h("form", { classe: "reponse" }, champ, ex.unite ? h("span", { classe: "unite" }, ex.unite) : null, valider);
    let essais = 0, tentatives = 0, fini = false;
    const terminer = (ok) => {
      fini = true; champ.disabled = true; valider.disabled = true; solution.hidden = true;
      const texte = ok ? `${gagner(id) ? "Exact, +1 étoile ! " : "Exact ! "}${ex.solution ?? ""}` : `Solution : ${ex.solution ?? nombreFr(ex.reponse)}`;
      afficherRetour(zone, ok, texte);
      if (ok) surReussite?.();
    };
    function soumettre() {
      if (fini) return;
      const lu = lireNombre(champ.value);
      if (!lu) { afficherRetour(zone, false, ex.fractionIrreductible ? "Écris une fraction, par exemple 3/4." : "Écris un nombre, par exemple 12 ou 3,5."); return; }
      const juste = Math.abs(lu.valeur - ex.reponse) <= (ex.tolerance ?? 1e-9);
      const nonSimplifiee = juste && ex.fractionIrreductible && (!lu.fraction || pgcd(lu.fraction[0], lu.fraction[1]) !== 1);
      tentatives += 1;
      signaler("reponse", { exercice: id, correct: juste && !nonSimplifiee, essai: tentatives });
      if (nonSimplifiee) {
        afficherRetour(zone, false, "C'est la bonne valeur, mais la fraction n'est pas encore simplifiée au maximum !");
        return;
      }
      if (juste) { terminer(true); return; }
      essais += 1;
      const indices = ex.indices ?? [];
      if (essais <= indices.length) signaler("indice", { exercice: id, rang: essais });
      afficherRetour(zone, false, essais <= indices.length ? `Indice : ${indices[essais - 1]}` : "Pas encore. Tu peux réessayer ou voir la solution.");
      if (essais >= Math.max(indices.length, 1)) solution.hidden = false;
    }
    valider.addEventListener("click", soumettre);
    champ.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); soumettre(); } });
    form.addEventListener("submit", (e) => e.preventDefault());
    solution.addEventListener("click", () => terminer(false));
    return [form, solution, zone];
  }

  const TYPES_EXERCICE = { qcm: exerciceQcm, nombre: exerciceNombre };

  function carteExercice(ex, id, numero, surReussite) {
    const carte = h("article", { classe: "exercice", "data-exercice": id });
    const titre = h("h3", null, h("span", { classe: "numero" }, String(numero)), riche(ex.titre ?? "Exercice"));
    if (etoiles.has(id)) carte.classList.add("deja");
    carte.append(titre, paragraphe(ex.question), ...TYPES_EXERCICE[ex.type](ex, id, () => { carte.classList.add("deja"); surReussite?.(); }));
    return carte;
  }

  /* ---------- Figures interactives ---------- */
  function curseur(libelle, min, max, pas, valeur, surChangement) {
    const sortie = h("output", null);
    const entree = h("input", { type: "range", min, max, step: pas, value: valeur });
    const maj = () => { sortie.textContent = nombreFr(Number(entree.value)); surChangement(Number(entree.value)); };
    entree.addEventListener("input", maj);
    return { element: h("label", { classe: "curseur" }, h("span", null, `${libelle} : `, sortie), entree), maj, entree };
  }
  const tuile = (libelle, valeur, classe) => h("div", { classe: `tuile ${classe ?? ""}` }, h("span", null, libelle), h("b", null, valeur));

  const FIGURES = {};
  // @figure — scripts/lib/gabarit.mjs remplace cette ligne par la figure de la page (gabarit/figures/<type>.js), ou par rien.

  /* ---------- Onglet explication : niveaux dépliables, du plus intuitif au plus formel ---------- */
  enregistrerOnglet({ id: "explication", type: "explication", titre: C.titresOnglets?.explication ?? "Explication",
    rendu(panneau) {
      if (C.intro) panneau.append(paragraphe(C.intro, "intro"));
      C.niveaux.forEach((n, i) => {
        const bloc = h("details", { open: i === 0 }, h("summary", null, riche(n.titre), " ", h("span", { classe: "niveau" }, `– ${n.niveau}`)));
        for (const p of n.paragraphes ?? []) bloc.append(paragraphe(p));
        if (n.exemple) {
          bloc.append(h("div", { classe: "exemple" }, h("strong", null, riche(n.exemple.titre ?? "Exemple")),
            h("ol", null, ...n.exemple.etapes.map((e) => h("li", null, riche(e))))));
        }
        if (n.aRetenir) bloc.append(h("div", { classe: "retenir" }, h("strong", null, "À retenir"), paragraphe(n.aRetenir)));
        panneau.append(bloc);
      });
    } });

  /* ---------- Onglet mémo (optionnel) : formules et points clés ---------- */
  enregistrerOnglet({ id: "memo", type: "memo", titre: C.titresOnglets?.memo ?? "Mémo", actif: Boolean(C.memo),
    rendu(panneau) {
      const m = C.memo;
      if (!m) return;
      if (m.intro) panneau.append(paragraphe(m.intro, "intro"));
      if (m.formules?.length) {
        panneau.append(h("h2", null, "Formules"));
        for (const f of m.formules) {
          panneau.append(h("div", { classe: "exemple" }, h("strong", null, riche(f.titre)), paragraphe(f.formule), ...(f.explication ? [paragraphe(f.explication)] : [])));
        }
      }
      if (m.pointsCles?.length) {
        panneau.append(h("h2", null, "Points clés"));
        panneau.append(h("ul", null, ...m.pointsCles.map((p) => h("li", null, riche(p)))));
      }
    } });

  /* ---------- Onglet application : manipuler, puis s'entraîner ---------- */
  enregistrerOnglet({ id: "application", type: "application", titre: C.titresOnglets?.application ?? "S'entraîner",
    rendu(panneau) {
      const a = C.application;
      if (a.intro) panneau.append(paragraphe(a.intro, "intro"));
      if (a.figure) panneau.append(FIGURES[a.figure.type](a.figure));
      panneau.append(h("h2", null, "Entraîne-toi"));
      a.exercices.forEach((ex, i) => panneau.append(carteExercice(ex, `app-${i + 1}`, i + 1)));
    } });

  /* ---------- Onglet mise en situation : une histoire, des étapes qui se débloquent ---------- */
  enregistrerOnglet({ id: "mise-en-situation", type: "mise-en-situation", titre: C.titresOnglets?.["mise-en-situation"] ?? "Défi",
    rendu(panneau) {
      const sit = C.situation;
      panneau.append(h("h2", null, riche(sit.titre)));
      for (const p of sit.histoire) panneau.append(paragraphe(p));
      const progression = h("progress", { max: sit.etapes.length, value: 0, "aria-label": "Étapes réussies" });
      const fin = h("div", { classe: "bravo", hidden: true, role: "status" }, h("strong", null, "Mission accomplie !"), paragraphe(sit.conclusion));
      panneau.append(progression);
      const cartes = sit.etapes.map((ex, i) => carteExercice(ex, `defi-${i + 1}`, i + 1, () => debloquer(i + 1)));
      function debloquer(suivante) {
        const reussies = cartes.filter((c) => c.classList.contains("deja")).length;
        progression.value = reussies;
        if (cartes[suivante]) { cartes[suivante].hidden = false; }
        if (reussies === cartes.length) fin.hidden = false;
      }
      cartes.forEach((c, i) => { c.hidden = i > 0 && !cartes[i - 1].classList.contains("deja"); panneau.append(c); });
      panneau.append(fin);
      debloquer(-1);
    } });

  /* ---------- Onglet self-test (prévu, désactivé) ---------- */
  enregistrerOnglet({ id: "self-test", type: "self-test", titre: "Auto-évaluation", actif: false, questions: [], rendu() {} });

  /* ---------- Socle : construction des onglets ---------- */
  const liste = document.getElementById("onglets"), panneaux = document.getElementById("panneaux");
  const actifs = registre.filter((o) => o.actif);
  const boutons = actifs.map((o, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("role", "tab"); b.id = `onglet-${o.id}`; b.textContent = o.titre;
    b.setAttribute("aria-controls", `panneau-${o.id}`); b.dataset.onglet = o.id;
    const p = document.createElement("section");
    p.setAttribute("role", "tabpanel"); p.id = `panneau-${o.id}`; p.setAttribute("aria-labelledby", b.id); p.tabIndex = 0;
    o.rendu(p); panneaux.appendChild(p); liste.appendChild(b);
    b.addEventListener("click", () => choisir(i));
    return b;
  });
  function choisir(i) {
    boutons.forEach((b, j) => {
      const sel = i === j; b.setAttribute("aria-selected", String(sel)); b.tabIndex = sel ? 0 : -1;
      document.getElementById(b.getAttribute("aria-controls")).hidden = !sel;
    });
    stockage.ecrire("onglet", actifs[i].id);
  }
  liste.addEventListener("keydown", (e) => {
    const i = boutons.indexOf(document.activeElement); if (i < 0) return;
    const n = e.key === "ArrowRight" ? (i + 1) % boutons.length : e.key === "ArrowLeft" ? (i - 1 + boutons.length) % boutons.length : -1;
    if (n >= 0) { choisir(n); boutons[n].focus(); e.preventDefault(); }
  });
  const memo = actifs.findIndex((o) => o.id === stockage.lire("onglet"));
  choisir(memo >= 0 ? memo : 0);
  majEtoiles();

  document.getElementById("connexion").hidden = !CONFIG.connexionActive;
  window.kermiclab = { META, registre, CONFIG, lireNombre };
})();
