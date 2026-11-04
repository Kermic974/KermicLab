/* Interface commune de l'Académie des jeux (ADR 0014, 0015) : synthèse, parcours, séances d'exercices et page
   « Ma progression ». Les exercices propres à un jeu (échiquier, grille…) sont fournis par des adaptateurs.
   Module partagé, recopié dans chaque page par `npm run build` : modifier ce fichier, jamais sa copie dans une page.
   Contenu affiché uniquement par textContent et createElement (jamais innerHTML). */
const VueAcademie = (() => {
  "use strict";

  function el(balise, attributs = {}, ...enfants) {
    const n = document.createElement(balise);
    for (const [k, v] of Object.entries(attributs)) {
      if (v === false || v === null || v === undefined) continue;
      if (k === "texte") n.textContent = v; else if (k === "classe") n.className = v; else n.setAttribute(k, v === true ? "" : v);
    }
    n.append(...enfants.filter((x) => x !== null && x !== undefined && x !== false));
    return n;
  }
  const etoilesTexte = (n) => `${"★".repeat(n)}${"☆".repeat(3 - n)}`;
  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;
  const jourLocal = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const dateCourte = (jour) => `${jour.slice(8, 10)}/${jour.slice(5, 7)}`;
  const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  const nomJour = (jour) => { const [a, m, j] = jour.split("-").map(Number); return JOURS[new Date(a, m - 1, j).getDay()]; };
  const formaterTemps = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  function barre(actuel, cible, libelle) {
    const b = el("div", { classe: "barre", role: "progressbar", "aria-label": libelle, "aria-valuemin": 0, "aria-valuemax": cible, "aria-valuenow": actuel }, el("span"));
    b.firstChild.style.width = `${cible ? Math.round((100 * actuel) / cible) : 0}%`;
    return b;
  }

  /**
   * Monte l'Académie dans un panneau d'onglet.
   * - progression : API créée par ProgressionJeux.creer(parcours)
   * - embleme(id) : nœud affichant un emblème (pièce d'échecs, symbole…)
   * - adaptateurs : { type: (outils) => ({ element, demarrer(exo), consigne?(exo), indice(exo), arreter?() }) }
   *   où outils = { reussir(), erreur(message?), retour(texte, classe) }
   */
  function monter({ panneau, progression: P, stockage, cle = "academie", embleme, adaptateurs = {}, ouvrirOnglet, stockageDisponible = true, jour = jourLocal }) {
    const parcours = P.parcours;
    let etat = P.normaliser(stockage.lire(cle));
    let session = null, ex = null, confirmationEffacement = false;
    const sauver = () => stockage.ecrire(cle, etat);

    /* ---------- Squelette ---------- */
    const toast = el("p", { classe: "toast", "data-sortie": "toast", role: "status", "aria-live": "polite" });
    const vues = { accueil: el("div", { "data-vue": "accueil" }), detail: el("div", { "data-vue": "detail", hidden: true }), session: el("div", { "data-vue": "session", hidden: true }) };
    panneau.append(toast, vues.accueil, vues.detail, vues.session);

    // Synthèse
    const synthese = el("section", { classe: "carte synthese", "aria-labelledby": "academie-titre" });
    const z = {}; // zones mises à jour
    z.embleme = el("div", { classe: "synthese-embleme", "aria-hidden": "true" });
    z.titre = el("h2", { id: "academie-titre", tabindex: "-1", "data-sortie": "titre" });
    z.niveau = el("p", { classe: "doux", "data-sortie": "niveau" });
    z.barre = el("div");
    z.chips = el("ul", { classe: "chips", "aria-label": "En bref", "data-sortie": "stats" });
    z.conseil = el("p", { classe: "conseil-texte", "data-sortie": "conseil" });
    z.actionConseil = el("button", { type: "button", classe: "action", "data-action": "conseil" });
    z.reviser = el("button", { type: "button", classe: "secondaire", "data-action": "reviser" });
    z.defi = el("button", { type: "button", classe: "secondaire", "data-action": "defi" });
    z.prochainBadge = el("p", { classe: "prochain-badge", "data-sortie": "prochain-badge" });
    const boutonDetail = el("button", { type: "button", classe: "lien", "data-action": "detail", texte: "📊 Ma progression détaillée →" });
    synthese.append(
      el("div", { classe: "synthese-tete" }, z.embleme, el("div", { classe: "synthese-identite" }, z.titre, z.niveau, z.barre), boutonDetail),
      z.chips,
      el("div", { classe: "conseil" }, el("p", { classe: "conseil-titre", texte: "✨ Pour toi aujourd'hui" }), z.conseil,
        el("div", { classe: "boutons" }, z.actionConseil, z.reviser, z.defi)),
      z.prochainBadge);
    z.parcours = el("ol", { classe: "parcours", "aria-label": "Parcours" });
    z.stockage = el("p", { classe: "doux", hidden: stockageDisponible, texte: "Ici, ta progression ne peut pas être gardée : ouvre la page en plein écran pour la conserver sur ton appareil." });
    vues.accueil.append(synthese, el("h2", { texte: "🗺️ Ton parcours, du débutant au pro" }), z.parcours, z.stockage);

    // Page détaillée
    const retourDetail = el("button", { type: "button", classe: "secondaire", "data-action": "retour", texte: "← Retour à l'Académie" });
    z.detailTitre = el("h2", { tabindex: "-1", texte: "📊 Ma progression", "data-sortie": "detail-titre" });
    const section = (titre, ...contenu) => el("section", { classe: "carte detail-section" }, el("h3", { texte: titre }), ...contenu);
    z.dNiveau = el("div", { "data-sortie": "detail-niveau" }); z.dRegles = el("table", { classe: "regles-xp" });
    z.dGrades = el("ol", { classe: "grades-liste" });
    z.dBadges = el("ul", { classe: "badges", "data-sortie": "badges" });
    z.dRegularite = el("div", { "data-sortie": "regularite" }); z.dActivite = el("ol", { classe: "activite", "aria-label": "Activité des 7 derniers jours", "data-sortie": "activite" });
    z.dCarnet = el("ul", { classe: "carnet", "data-sortie": "carnet" });
    z.dForces = el("ul", { classe: "forces" }); z.dParties = el("ul", { classe: "parties", "data-sortie": "parties" });
    z.dReglages = el("div");
    vues.detail.append(retourDetail, z.detailTitre,
      section("⬆️ Niveau et XP", z.dNiveau, el("details", {}, el("summary", { texte: "Comment gagner de l'XP ?" }), z.dRegles)),
      section("🎖️ Grades", el("p", { classe: "doux", texte: "Chaque grade obtenu ouvre le suivant et un nouvel emblème." }), z.dGrades),
      section("🏅 Badges", z.dBadges),
      section("🔥 Régularité", z.dRegularite, z.dActivite),
      section("📒 Carnet de stratégies", el("p", { classe: "doux", texte: "Chaque stratégie apprise revient en révision, de plus en plus espacée quand tu la réussis." }), z.dCarnet),
      section("📈 Points forts et points faibles", z.dForces, z.dParties),
      section("⚙️ Réglages", z.dReglages));

    // Séance
    z.fil = el("p", { classe: "doux fil", "data-sortie": "fil" });
    z.sTitre = el("h2", { tabindex: "-1", "data-sortie": "session-titre" });
    z.sTexte = el("p");
    z.retenir = el("p", { "data-sortie": "retenir" });
    z.zoneRetenir = el("div", { classe: "a-retenir" }, el("strong", { texte: "📌 À retenir" }), z.retenir);
    z.progression = el("p", { classe: "progression", "data-sortie": "progression" });
    z.consigne = el("p", { classe: "consigne", "data-sortie": "consigne" });
    z.qcm = el("ul", { classe: "qcm", hidden: true });
    z.zoneJeu = el("div", { classe: "zone-exercice" });
    z.retour = el("p", { classe: "message", role: "status", "aria-live": "polite", "data-sortie": "retour" });
    z.indice = el("button", { type: "button", classe: "secondaire", "data-action": "indice", texte: "💡 Indice" });
    z.suivant = el("button", { type: "button", classe: "action", "data-action": "suivant", hidden: true });
    z.exercice = el("div", { classe: "carte" }, z.progression, z.consigne, z.zoneJeu, z.qcm, z.retour, el("div", { classe: "boutons" }, z.indice, z.suivant));
    z.bTitre = el("h2", { tabindex: "-1", "data-sortie": "bilan-titre" }); z.bTexte = el("p", { "data-sortie": "bilan-texte" });
    z.bSuite = el("button", { type: "button", classe: "action", "data-action": "bilan-suite", hidden: true });
    const bRetour = el("button", { type: "button", classe: "secondaire", "data-action": "bilan-retour", texte: "Retour à l'Académie" });
    z.bilan = el("div", { classe: "carte bilan", hidden: true }, z.bTitre, z.bTexte, el("div", { classe: "boutons" }, z.bSuite, bRetour));
    const retourSession = el("button", { type: "button", classe: "secondaire", "data-action": "retour", texte: "← Retour à l'Académie" });
    vues.session.append(retourSession, z.fil, z.sTitre, z.sTexte, z.zoneRetenir, z.exercice, z.bilan);

    /* ---------- Gains ---------- */
    function appliquer({ etat: nouvel, gains }) {
      etat = nouvel; sauver();
      const morceaux = [];
      if (gains.xp) morceaux.push(`+${gains.xp} XP`);
      if (gains.record) morceaux.push("⏱️ Nouveau record");
      if (gains.objectif) morceaux.push("🎯 Objectif du jour atteint");
      if (gains.niveauApres > gains.niveauAvant) morceaux.push(`⬆️ Niveau ${gains.niveauApres} !`);
      if (gains.gradesApres > gains.gradesAvant) morceaux.push(`🎖️ Grade ${parcours.grades[gains.gradesApres - 1].nom} obtenu : nouvel emblème disponible`);
      for (const b of gains.badges) morceaux.push(`${b.icone} Badge « ${b.nom} »`);
      if (morceaux.length) toast.textContent = morceaux.join(" · ");
      return gains;
    }

    function montrer(nom) {
      for (const [k, v] of Object.entries(vues)) v.hidden = k !== nom;
      if (nom !== "session") { session?.adaptateur?.arreter?.(); session = null; ex = null; }
      if (nom === "accueil") afficherAccueil();
      if (nom === "detail") afficherDetail();
      ({ accueil: z.titre, detail: z.detailTitre, session: z.sTitre })[nom].focus();
    }

    /* ---------- Synthèse et parcours ---------- */
    function afficherAccueil() {
      const j = jour(), niv = P.niveau(etat.xp), grades = P.gradesObtenus(etat), tous = P.badges(etat);
      z.embleme.replaceChildren(embleme(etat.embleme));
      z.titre.textContent = P.titre(etat);
      z.niveau.textContent = `Niveau ${niv.niveau} · ${etat.xp} XP · encore ${niv.xpPourNiveau - niv.xpDansNiveau} XP pour le niveau ${niv.niveau + 1}`;
      z.barre.replaceChildren(barre(niv.xpDansNiveau, niv.xpPourNiveau, "Progression vers le niveau suivant"));
      const aujourdhui = etat.jours[j] ?? 0, serie = P.serieActuelle(etat, j);
      z.chips.replaceChildren(...[
        `🔥 ${pluriel(serie, "jour")} de suite`,
        `🎯 Aujourd'hui : ${Math.min(aujourdhui, etat.objectif)} / ${etat.objectif}${aujourdhui >= etat.objectif ? " ✓" : ""}`,
        `🎖️ Grades : ${grades} / ${parcours.grades.length}`,
        `🏅 Badges : ${tous.filter((b) => b.obtenu).length} / ${tous.length}`
      ].map((t) => el("li", { texte: t })));
      const conseil = P.recommandation(etat, j);
      z.conseil.textContent = conseil.texte;
      z.actionConseil.textContent = { revision: "Réviser maintenant", jouer: "Jouer une partie" }[conseil.type] ?? "C'est parti !";
      z.actionConseil.onclick = () => (conseil.type === "revision" ? reviser() : conseil.type === "jouer" ? ouvrirOnglet?.("application") : ouvrirLecon(conseil.lecon));
      const dues = P.revisionsDues(etat, j);
      z.reviser.textContent = `🧠 Révisions (${dues.length})`; z.reviser.disabled = dues.length === 0;
      const defi = P.defiDuJour(etat, j);
      z.defi.textContent = defi?.fait ? "⚡ Défi du jour relevé ✓" : `⚡ Défi du jour (+${ProgressionJeux.XP.defi} XP)`;
      z.defi.disabled = !defi || defi.fait;
      // Prochain badge : celui qui est le plus près d'être gagné.
      const prochain = tous.filter((b) => !b.obtenu).sort((a, b) => b.actuel / b.cible - a.actuel / a.cible)[0];
      z.prochainBadge.replaceChildren(...(prochain ? [el("span", { classe: "doux", texte: "Prochain badge : " }),
        el("strong", { texte: `${prochain.icone} ${prochain.nom}` }), el("span", { texte: ` — ${prochain.description} (${prochain.actuel} / ${prochain.cible})` })]
        : [el("strong", { texte: "🏆 Tous les badges sont gagnés. Bravo !" })]));
      // Parcours
      z.parcours.replaceChildren(...parcours.grades.map((g, gi) => {
        const faites = g.lecons.filter((l) => etat.lecons[l.id]).length, ouvert = P.leconDebloquee(etat, g.lecons[0].id);
        const etatGrade = faites === g.lecons.length ? "✓ obtenu" : ouvert ? `${faites} / ${g.lecons.length}` : `🔒 termine le grade ${parcours.grades[gi - 1].nom}`;
        return el("li", { classe: `grade${ouvert ? "" : " verrouille"}`, "data-grade": g.id },
          el("div", { classe: "grade-entete" }, el("span", { classe: "grade-embleme", "aria-hidden": "true" }, embleme(g.embleme)),
            el("div", {}, el("h3", { texte: `${gi + 1}. ${g.nom}` }), el("p", { classe: "doux", texte: g.sousTitre })),
            el("span", { classe: "grade-etat", texte: etatGrade })),
          el("ul", { classe: "lecons" }, ...g.lecons.map((l) => {
            const fait = etat.lecons[l.id], libre = P.leconDebloquee(etat, l.id);
            const b = el("button", { type: "button", classe: `lecon${fait ? " faite" : ""}`, "data-lecon": l.id, disabled: !libre,
              "aria-label": `${l.titre}, ${parcours.themes[l.theme]}, ${fait ? `${pluriel(fait.etoiles, "étoile")} sur 3` : libre ? "à faire" : "verrouillée"}` },
              el("span", { classe: "lecon-titre", texte: l.titre }), el("span", { classe: "lecon-theme", texte: parcours.themes[l.theme] }),
              el("span", { classe: "lecon-etoiles", "aria-hidden": "true", texte: fait ? etoilesTexte(fait.etoiles) : libre ? "Nouveau" : "🔒" }));
            b.addEventListener("click", () => ouvrirLecon(l.id));
            return el("li", {}, b);
          })));
      }));
    }

    /* ---------- Page détaillée « Ma progression » ---------- */
    function afficherDetail() {
      const j = jour(), niv = P.niveau(etat.xp), obtenus = P.gradesObtenus(etat);
      z.dNiveau.replaceChildren(
        el("p", {}, el("strong", { texte: `Niveau ${niv.niveau}` }), el("span", { texte: ` · ${etat.xp} XP au total · ${P.titre(etat)}` })),
        barre(niv.xpDansNiveau, niv.xpPourNiveau, "Progression vers le niveau suivant"),
        el("p", { classe: "doux", texte: `${niv.xpDansNiveau} / ${niv.xpPourNiveau} XP : encore ${niv.xpPourNiveau - niv.xpDansNiveau} XP pour le niveau ${niv.niveau + 1}.` }));
      z.dRegles.replaceChildren(el("tbody", {}, ...P.reglesXP().map((r) => el("tr", {}, el("td", { texte: r.texte }), el("td", { texte: `+${r.xp} XP` })))));
      z.dGrades.replaceChildren(...parcours.grades.map((g, gi) => {
        const faites = g.lecons.filter((l) => etat.lecons[l.id]).length;
        const statut = gi < obtenus ? "✓ obtenu" : gi === obtenus ? `en cours : ${faites} / ${g.lecons.length} leçons` : "🔒 à venir";
        return el("li", { classe: gi < obtenus ? "obtenu" : gi === obtenus ? "en-cours" : "verrouille" },
          el("span", { classe: "grade-embleme", "aria-hidden": "true" }, embleme(g.embleme)),
          el("strong", { texte: g.nom }), el("span", { classe: "doux", texte: ` — ${g.sousTitre} · ${statut}` }));
      }));
      const tous = P.badges(etat);
      z.dBadges.replaceChildren(...[...tous.filter((b) => b.obtenu), ...tous.filter((b) => !b.obtenu)].map((b) => el("li", { classe: b.obtenu ? "obtenu" : "verrouille" },
        el("span", { classe: "badge-icone", "aria-hidden": "true", texte: b.obtenu ? b.icone : "🔒" }),
        el("strong", { texte: b.nom }),
        el("span", { classe: "doux", texte: `${b.obtenu ? "✓ Gagné : " : "À gagner : "}${b.description}` }),
        b.obtenu || b.cible <= 1 ? null : barre(b.actuel, b.cible, `${b.nom} : ${b.actuel} sur ${b.cible}`))));
      const serie = P.serieActuelle(etat, j);
      z.dRegularite.replaceChildren(el("p", { texte: `Série actuelle : ${pluriel(serie, "jour")} · record : ${pluriel(etat.serieMax, "jour")} · objectif du jour : ${pluriel(etat.objectif, "exercice")} (atteint ${etat.objectifsAtteints} fois).` }));
      z.dActivite.replaceChildren(...P.activite(etat, j).map((a) => {
        const atteint = a.exercices >= etat.objectif;
        return el("li", { classe: atteint ? "atteint" : a.exercices ? "actif" : "", "aria-label": `${nomJour(a.jour)} ${dateCourte(a.jour)} : ${pluriel(a.exercices, "activité")}${atteint ? ", objectif atteint" : ""}` },
          el("span", { classe: "jour", texte: nomJour(a.jour) }), el("span", { classe: "compte", texte: atteint ? "✓" : String(a.exercices) }));
      }));
      const apprises = parcours.grades.flatMap((g) => g.lecons).filter((l) => etat.lecons[l.id]);
      z.dCarnet.replaceChildren(...(apprises.length ? apprises.map((l) => {
        const cartes = l.exercices.map((_, k) => etat.cartes[ProgressionJeux.exoId(l, k)]).filter(Boolean);
        const maitrise = cartes.length && cartes.every((c) => c.boite >= 4);
        const prochaine = cartes.map((c) => c.prochaine).sort()[0];
        const quand = maitrise ? "✓ maîtrisée" : !prochaine ? "à revoir demain" : prochaine <= j ? "à réviser aujourd'hui" : `à revoir le ${dateCourte(prochaine)}`;
        return el("li", {}, el("strong", { texte: `${etoilesTexte(etat.lecons[l.id].etoiles)} ${l.titre}` }), el("span", { classe: "doux", texte: quand ? ` · ${quand}` : "" }), el("p", { texte: l.retenir }));
      }) : [el("li", { classe: "doux", texte: "Termine une leçon : sa stratégie s'ajoute ici, pour la relire et la réviser." })]));
      z.dForces.replaceChildren(...P.forces(etat).map((f) => el("li", {}, el("span", { texte: f.nom }),
        f.taux === null
          ? el("span", { classe: "doux", texte: f.essais ? `${pluriel(f.essais, "essai")} : encore un peu de pratique` : "pas encore travaillé" })
          : el("span", { classe: "jauge", role: "img", "aria-label": `${Math.round(f.taux * 100)} % réussi du premier coup sur ${f.essais} essais` },
            Object.assign(el("span"), { style: `width:${Math.round(f.taux * 100)}%` }), el("b", { texte: `${Math.round(f.taux * 100)} %` })))));
      z.dParties.replaceChildren(...Object.entries(P.NIVEAUX_PARTIE).map(([id, n]) => {
        const p = etat.parties[id], nulles = n.xp.nulle !== undefined ? ` · ${pluriel(p.nulles, "nulle")}` : "";
        return el("li", { texte: `${n.nom} : ${pluriel(p.victoires, "victoire")}${nulles} · ${pluriel(p.defaites, "défaite")}${p.meilleur !== null ? ` · record ${formaterTemps(p.meilleur)}` : ""}` });
      }));
      afficherReglages();
    }

    function afficherReglages() {
      const objectif = el("fieldset", { classe: "choix" }, el("legend", { texte: "Mon objectif du jour" }), ...ProgressionJeux.OBJECTIFS.map((n) => {
        const r = el("input", { type: "radio", name: "objectif", value: n, checked: etat.objectif === n });
        r.addEventListener("change", () => { etat = P.regler(etat, { objectif: n }); sauver(); afficherDetail(); });
        return el("label", {}, r, pluriel(n, "exercice"));
      }));
      const dispo = P.emblemesDisponibles(etat);
      const emblemes = el("fieldset", { classe: "choix emblemes" }, el("legend", { texte: "Mon emblème (un nouveau à chaque grade)" }), ...P.EMBLEMES.map((id, i) => {
        const ouvert = dispo.includes(id), g = parcours.grades[i];
        const r = el("input", { type: "radio", name: "embleme", value: id, disabled: !ouvert, checked: etat.embleme === id, "aria-label": ouvert ? `Emblème ${g.nom}` : `Emblème ${g.nom}, verrouillé` });
        r.addEventListener("change", () => { etat = P.regler(etat, { embleme: id }); sauver(); afficherDetail(); });
        return el("label", { classe: ouvert ? "" : "verrouille", title: ouvert ? g.nom : `Grade ${parcours.grades[i - 1]?.nom} à obtenir` }, r, embleme(id));
      }));
      const libre = el("input", { type: "checkbox", name: "libre", checked: etat.libre });
      libre.addEventListener("change", () => { etat = P.regler(etat, { libre: libre.checked }); sauver(); afficherDetail(); });
      const effacer = el("button", { type: "button", classe: "secondaire danger", "data-action": "effacer", texte: confirmationEffacement ? "Confirmer : tout effacer" : "🗑️ Effacer ma progression" });
      effacer.addEventListener("click", () => {
        if (!confirmationEffacement) { confirmationEffacement = true; afficherReglages(); z.dReglages.querySelector('[data-action="effacer"]').focus(); return; }
        confirmationEffacement = false; etat = P.etatInitial(); sauver(); toast.textContent = "Progression effacée : nouveau départ !"; afficherDetail();
      });
      z.dReglages.replaceChildren(objectif, emblemes,
        el("label", { classe: "case-a-cocher" }, libre, "Je connais déjà les bases : ouvrir toutes les leçons"),
        el("p", { classe: "doux", texte: "Ta progression reste sur cet appareil. Elle ne contient aucune donnée personnelle." }), effacer);
    }

    /* ---------- Séances : leçon, révisions, défi du jour ---------- */
    const instances = {};
    const outils = {
      reussir: () => terminerExercice(),
      erreur: (message) => {
        ex.erreurs += 1;
        retour(message ?? (ex.erreurs >= 2 ? `Pas tout à fait. Indice : ${ex.exo.indice ?? "relis bien la question."}` : "Pas tout à fait : essaie encore !"), "ko");
      },
      retour: (texte, classe = "") => retour(texte, classe)
    };
    function adaptateur(type) {
      if (!adaptateurs[type]) throw new Error(`type d'exercice inconnu : ${type}`);
      if (!instances[type]) { instances[type] = adaptateurs[type](outils); z.zoneJeu.appendChild(instances[type].element); }
      return instances[type];
    }
    function retour(texte, classe) { z.retour.textContent = texte; z.retour.className = `message ${classe}`; }

    function ouvrirLecon(id) {
      const info = P.lecons.get(id);
      if (!info || !P.leconDebloquee(etat, id)) return;
      demarrerSession("lecon", info.lecon.exercices.map((_, k) => ProgressionJeux.exoId(info.lecon, k)), info.lecon);
    }
    function reviser() {
      const dues = P.revisionsDues(etat, jour()).slice(0, 8);
      if (dues.length) demarrerSession("revision", dues);
    }
    function demarrerSession(mode, file, lecon = null) {
      session = { mode, file, lecon, rang: 0, erreurs: 0, indices: 0 };
      const grade = lecon && P.lecons.get(lecon.id).grade;
      z.fil.textContent = mode === "lecon" ? `Grade ${grade.nom} · ${parcours.themes[lecon.theme]}` : mode === "defi" ? "Défi du jour" : "Révisions espacées";
      z.sTitre.textContent = mode === "lecon" ? lecon.titre : mode === "defi" ? "⚡ Le défi du jour" : "🧠 Tes révisions";
      z.sTexte.textContent = mode === "lecon" ? lecon.texte
        : mode === "defi" ? `Un exercice tiré du parcours, le même pour tout le monde aujourd'hui. Réussis-le pour gagner ${ProgressionJeux.XP.defi} XP de plus !`
        : "Retrouve la bonne réponse sans aide. Chaque réussite repousse la prochaine révision : c'est comme ça qu'on retient pour toujours.";
      z.zoneRetenir.hidden = mode !== "lecon";
      z.retenir.textContent = lecon?.retenir ?? "";
      z.exercice.hidden = false; z.bilan.hidden = true;
      toast.textContent = "";
      montrer("session");
      demarrerExercice();
    }

    function demarrerExercice() {
      const id = session.file[session.rang], { exo, lecon } = P.exercices.get(id);
      session.adaptateur?.arreter?.();
      ex = { id, exo, lecon, erreurs: 0, indice: false, fini: false };
      z.progression.textContent = `${session.mode === "lecon" ? "Exercice" : `${lecon.titre} ·`} ${session.rang + 1} / ${session.file.length}`;
      retour("", "");
      z.suivant.hidden = true; z.indice.hidden = false; z.indice.disabled = false;
      const qcm = exo.type === "qcm";
      for (const [type, inst] of Object.entries(instances)) inst.element.hidden = qcm || type !== exo.type;
      z.qcm.hidden = !qcm;
      if (qcm) {
        session.adaptateur = null;
        z.consigne.textContent = exo.question;
        z.indice.textContent = "💡 Retirer une mauvaise réponse";
        z.qcm.replaceChildren(...exo.choix.map((texte, i) => {
          const b = el("button", { type: "button", classe: "choix-qcm", "data-choix": i, texte });
          b.addEventListener("click", () => repondreQcm(i));
          return el("li", {}, b);
        }));
      } else {
        const a = adaptateur(exo.type);
        a.element.hidden = false;
        session.adaptateur = a;
        z.consigne.textContent = a.consigne ? a.consigne(exo) : exo.consigne;
        z.indice.textContent = "💡 Indice";
        a.demarrer(exo);
      }
    }

    function repondreQcm(i) {
      if (ex.fini) return;
      const b = z.qcm.querySelector(`[data-choix="${i}"]`);
      if (i !== ex.exo.bonne) { b.disabled = true; b.dataset.etat = "faux"; b.textContent = `✗ ${ex.exo.choix[i]}`; outils.erreur(); return; }
      b.dataset.etat = "juste"; b.textContent = `✓ ${ex.exo.choix[i]}`;
      for (const autre of z.qcm.querySelectorAll("button")) autre.disabled = true;
      terminerExercice();
    }

    z.indice.addEventListener("click", () => {
      if (!ex || ex.fini) return;
      ex.indice = true; z.indice.disabled = true;
      if (ex.exo.type === "qcm") {
        const faux = [...z.qcm.querySelectorAll("button:not(:disabled)")].find((b) => Number(b.dataset.choix) !== ex.exo.bonne);
        if (faux) { faux.disabled = true; faux.dataset.etat = "retire"; faux.textContent = `— ${faux.textContent}`; }
        retour("Une mauvaise réponse a été retirée.", "");
        return;
      }
      retour(`Indice : ${ex.exo.indice}`, "");
      session.adaptateur.indice(ex.exo);
    });

    function terminerExercice() {
      if (ex.fini) return;
      ex.fini = true;
      const j = jour();
      session.erreurs += ex.erreurs; session.indices += ex.indice ? 1 : 0;
      appliquer(P.enregistrerExercice(etat, { id: ex.id, erreurs: ex.erreurs, indice: ex.indice, jour: j, revision: session.mode === "revision" }));
      if (session.mode === "defi") appliquer(P.enregistrerDefi(etat, { jour: j }));
      const rappel = session.mode !== "lecon" ? ` À retenir : ${ex.lecon.retenir}` : "";
      retour(`${ex.erreurs === 0 && !ex.indice ? "Parfait ! " : "Réussi ! "}${ex.exo.explication}${rappel}`, "ok");
      z.indice.hidden = true;
      const fin = session.rang === session.file.length - 1;
      z.suivant.textContent = fin ? "Voir le bilan" : "Exercice suivant";
      z.suivant.hidden = false;
      z.suivant.focus();
    }
    z.suivant.addEventListener("click", () => {
      if (session.rang < session.file.length - 1) { session.rang += 1; demarrerExercice(); return; }
      afficherBilan();
    });

    function afficherBilan() {
      session.adaptateur?.arreter?.();
      z.exercice.hidden = true; z.bilan.hidden = false;
      const j = jour();
      if (session.mode === "lecon") {
        const n = ProgressionJeux.etoiles(session);
        appliquer(P.terminerLecon(etat, { id: session.lecon.id, etoiles: n, jour: j }));
        z.bTitre.textContent = `${etoilesTexte(n)} Leçon terminée !`;
        z.bTexte.textContent = `${n === 3 ? "Sans faute : bravo !" : n === 2 ? "Très bien ! Refais-la plus tard pour viser les 3 étoiles." : "Leçon réussie. Refais-la pour gagner des étoiles."} La stratégie « ${session.lecon.titre} » rejoint ton carnet : elle reviendra en révision demain.`;
      } else if (session.mode === "defi") {
        z.bTitre.textContent = "⚡ Défi relevé !"; z.bTexte.textContent = "Reviens demain pour un nouveau défi.";
      } else {
        z.bTitre.textContent = "🧠 Révisions terminées";
        z.bTexte.textContent = `${pluriel(session.file.length, "stratégie")} révisée${session.file.length > 1 ? "s" : ""}. Les bonnes réponses reviendront plus tard, les autres dès demain.`;
      }
      const ordre = parcours.grades.flatMap((g) => g.lecons);
      const prochaine = session.mode === "lecon" ? ordre.slice(ordre.findIndex((l) => l.id === session.lecon.id) + 1).find((l) => P.leconDebloquee(etat, l.id) && !etat.lecons[l.id]) : null;
      z.bSuite.hidden = !prochaine;
      if (prochaine) { z.bSuite.textContent = `Leçon suivante : ${prochaine.titre}`; z.bSuite.onclick = () => ouvrirLecon(prochaine.id); }
      z.bTitre.focus();
    }

    /* ---------- Commandes ---------- */
    z.reviser.addEventListener("click", reviser);
    z.defi.addEventListener("click", () => { const d = P.defiDuJour(etat, jour()); if (d && !d.fait) demarrerSession("defi", [d.id]); });
    boutonDetail.addEventListener("click", () => { confirmationEffacement = false; montrer("detail"); });
    for (const b of [retourDetail, retourSession, bRetour]) b.addEventListener("click", () => montrer("accueil"));

    afficherAccueil();
    return {
      etat: () => etat,
      /** Partie terminée dans l'onglet « Jouer » : enregistrée ici, et les gains sont renvoyés pour être affichés. */
      enregistrerPartie(partie) {
        const g = appliquer(P.enregistrerPartie(etat, { ...partie, jour: jour() }));
        if (!session) { if (vues.detail.hidden) afficherAccueil(); else afficherDetail(); }
        return g;
      }
    };
  }

  return Object.freeze({ monter, jourLocal });
})();
