/* Progression commune des jeux (ADR 0014, 0015) : XP, niveaux, grades, étoiles, badges, série, objectif du jour,
   révisions espacées, défi du jour, forces et conseil personnalisé. Pur, sans DOM : la date est passée en paramètre.
   Module partagé, recopié dans chaque page par `npm run build` : modifier ce fichier, jamais sa copie dans une page. */
const ProgressionJeux = (() => {
  "use strict";
  const XP = Object.freeze({ parfait: 20, reussi: 10, avecIndice: 5, revision: 5, revisionRatee: 1, lecon: 30, objectif: 20, defi: 15 });
  // Révision espacée (boîtes de Leitner) : une carte réussie passe dans la boîte suivante, revue de plus en plus tard.
  const INTERVALLES = Object.freeze([1, 2, 4, 8, 16]);
  const OBJECTIFS = Object.freeze([1, 3, 5]);
  const MAX_JOURS = 31;
  const JOUR = /^\d{4}-\d{2}-\d{2}$/;
  const RESULTATS = Object.freeze({ victoire: "victoires", nulle: "nulles", defaite: "defaites" });

  /* ---------- Dates (AAAA-MM-JJ, calendrier de l'utilisateur fourni par l'appelant) ---------- */
  function ajouterJours(jour, n) {
    const [a, m, j] = jour.split("-").map(Number);
    return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
  }
  const estJour = (v) => typeof v === "string" && JOUR.test(v);
  const entier = (v, max = 1e9) => (Number.isInteger(v) && v >= 0 ? Math.min(v, max) : 0);
  const copie = (e) => JSON.parse(JSON.stringify(e));
  const exoId = (lecon, k) => `${lecon.id}/${k}`;
  const etoiles = ({ erreurs, indices }) => { const p = erreurs + 2 * indices; return p === 0 ? 3 : p <= 2 ? 2 : 1; };
  /* ---------- Boîtes de Leitner, partagées par les jeux et par les exercices des notions (issue #187) ---------- */
  /** Carte suivante : première réussite → boîte 1 ; réussite parfaite → boîte suivante ; sinon retour en boîte 1. */
  function planifierCarte(carte, parfait, jour) {
    const boite = !carte ? 1 : parfait ? Math.min(INTERVALLES.length, carte.boite + 1) : 1;
    return { boite, prochaine: ajouterJours(jour, INTERVALLES[boite - 1]) };
  }
  /** Identifiants des cartes dues à `jour`, de la plus en retard à la plus récente (puis la boîte la plus basse). */
  function cartesDues(cartes, jour) {
    return Object.entries(cartes)
      .filter(([, c]) => c.prochaine <= jour)
      .sort(([, a], [, b]) => a.prochaine.localeCompare(b.prochaine) || a.boite - b.boite)
      .map(([id]) => id);
  }
  /** Petit hachage déterministe : le même défi pour tout le monde le même jour, sans hasard ni réseau. */
  const hacher = (texte) => [...texte].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

  /** Crée l'API de progression d'un jeu à partir de son parcours (grades, leçons, thèmes, badges, niveaux de partie). */
  function creer(parcours) {
    const lecons = new Map(), exercices = new Map();
    parcours.grades.forEach((grade, gi) => grade.lecons.forEach((lecon) => {
      lecons.set(lecon.id, { lecon, grade, gi });
      lecon.exercices.forEach((exo, k) => exercices.set(exoId(lecon, k), { exo, lecon, grade, gi }));
    }));
    const EMBLEMES = Object.freeze(parcours.grades.map((g) => g.embleme));
    const NIVEAUX_PARTIE = parcours.parties?.niveaux ?? {};
    // Compteurs d'événements propres au jeu (capots, belotes…), déclarés par les badges de type « compteur ».
    const COMPTEURS = [...new Set((parcours.badges ?? []).filter((b) => b.condition.type === "compteur").map((b) => b.condition.nom))];
    const toutesLecons = parcours.grades.flatMap((g) => g.lecons);

    function etatInitial() {
      return {
        version: 1, xp: 0, lecons: {}, cartes: {}, themes: {}, serie: 0, serieMax: 0, dernierJour: null, jours: {},
        badges: [], objectif: 3, embleme: EMBLEMES[0], libre: false, revisions: 0, objectifsAtteints: 0, objectifsJours: [], defis: [],
        parties: Object.fromEntries(Object.keys(NIVEAUX_PARTIE).map((n) => [n, { victoires: 0, nulles: 0, defaites: 0, meilleur: null }])),
        compteurs: Object.fromEntries(COMPTEURS.map((n) => [n, 0]))
      };
    }

    /* ---------- Grades et niveaux ---------- */
    const gradeTermine = (e, grade) => grade.lecons.every((l) => e.lecons[l.id]);
    function gradesObtenus(e) {
      let n = 0;
      while (n < parcours.grades.length && gradeTermine(e, parcours.grades[n])) n += 1;
      return n;
    }
    function titre(e) {
      const n = gradesObtenus(e);
      return n === 0 ? "Débutant" : n === parcours.grades.length ? `${parcours.grades[n - 1].nom} : tu es un pro !` : parcours.grades[n - 1].nom;
    }
    function leconDebloquee(e, id) {
      const info = lecons.get(id);
      return !!info && (e.libre || info.gi === 0 || gradeTermine(e, parcours.grades[info.gi - 1]));
    }
    const emblemesDisponibles = (e) => EMBLEMES.slice(0, Math.max(1, gradesObtenus(e) + 1));

    /* ---------- Badges : communs à tous les jeux, puis propres au jeu (décrits dans le parcours) ---------- */
    const victoiresTotal = (e) => Object.values(e.parties).reduce((s, p) => s + p.victoires, 0);
    const lecDuTheme = (themes) => toutesLecons.filter((l) => themes.includes(l.theme));
    const COMMUNS = [
      { id: "premiers-pas", icone: "👣", nom: "Premiers pas", description: "Termine ta première leçon.", avance: (e) => [Object.keys(e.lecons).length, 1] },
      { id: "sans-faute", icone: "⭐", nom: "Sans faute", description: "Termine une leçon avec 3 étoiles.", avance: (e) => [Object.values(e.lecons).some((l) => l.etoiles === 3) ? 1 : 0, 1] },
      { id: "perfectionniste", icone: "🌟", nom: "Perfectionniste", description: "Obtiens 3 étoiles sur toutes les leçons d'un grade.",
        avance: (e) => [Math.max(...parcours.grades.map((g) => g.lecons.filter((l) => e.lecons[l.id]?.etoiles === 3).length / g.lecons.length)) >= 1 ? 1 : 0, 1] },
      { id: "pro", icone: "🏆", nom: "Du débutant au pro", description: `Obtiens les ${parcours.grades.length} grades.`, avance: (e) => [gradesObtenus(e), parcours.grades.length] },
      { id: "serie-3", icone: "🔥", nom: "Ça chauffe", description: "Entraîne-toi 3 jours de suite.", avance: (e) => [e.serieMax, 3] },
      { id: "serie-7", icone: "📅", nom: "Une semaine sans pause", description: "Entraîne-toi 7 jours de suite.", avance: (e) => [e.serieMax, 7] },
      { id: "regulier", icone: "🎯", nom: "Régulier", description: "Atteins 5 fois ton objectif du jour.", avance: (e) => [e.objectifsAtteints, 5] },
      { id: "memoire", icone: "🧠", nom: "Mémoire d'éléphant", description: "Fais 10 révisions.", avance: (e) => [e.revisions, 10] },
      { id: "bibliotheque", icone: "📚", nom: "Bibliothèque", description: "Maîtrise 10 stratégies (révisées plusieurs fois avec succès).",
        avance: (e) => [Object.values(e.cartes).filter((c) => c.boite >= 4).length, 10] },
      { id: "defis", icone: "⚡", nom: "Défis relevés", description: "Réussis 3 défis du jour.", avance: (e) => [e.defis.length, 3] }
    ];
    function versBadge({ id, icone, nom, description, condition: c }) {
      let avance;
      if (c.type === "themes") {
        avance = (e) => { const l = lecDuTheme(c.themes), faites = l.filter((x) => e.lecons[x.id]).length; return c.toutes === false ? [Math.min(1, faites), 1] : [faites, l.length]; };
      } else if (c.type === "victoires") {
        avance = (e) => [c.niveau ? e.parties[c.niveau]?.victoires ?? 0 : victoiresTotal(e), c.min];
      } else if (c.type === "compteur") {
        avance = (e) => [e.compteurs[c.nom] ?? 0, c.min];
      } else if (c.type === "record") {
        avance = (e) => { const m = e.parties[c.niveau]?.meilleur; return [m !== null && m !== undefined && m <= c.max ? 1 : 0, 1]; };
      } else throw new Error(`badge ${id} : condition « ${c.type} » inconnue`);
      return { id, icone, nom, description, avance };
    }
    const BADGES = [...COMMUNS, ...(parcours.badges ?? []).map(versBadge)];
    const ids = BADGES.map((b) => b.id);
    if (new Set(ids).size !== ids.length) throw new Error("badges en double");

    function badges(e) {
      return BADGES.map(({ avance, ...b }) => { const [actuel, cible] = avance(e); return { ...b, actuel: Math.min(actuel, cible), cible, obtenu: actuel >= cible }; });
    }

    /* ---------- Relecture d'un état stocké ---------- */
    const objet = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
    function normaliser(brut) {
      const base = etatInitial();
      if (!brut || typeof brut !== "object") return base;
      const e = { ...base, xp: entier(brut.xp), serie: entier(brut.serie), serieMax: entier(brut.serieMax), revisions: entier(brut.revisions),
        objectifsAtteints: entier(brut.objectifsAtteints), libre: brut.libre === true,
        objectif: OBJECTIFS.includes(brut.objectif) ? brut.objectif : base.objectif,
        embleme: EMBLEMES.includes(brut.embleme) ? brut.embleme : base.embleme,
        dernierJour: estJour(brut.dernierJour) ? brut.dernierJour : null };
      for (const [id, v] of Object.entries(objet(brut.lecons))) {
        if (lecons.has(id) && [1, 2, 3].includes(v?.etoiles)) e.lecons[id] = { etoiles: v.etoiles, jour: estJour(v.jour) ? v.jour : null };
      }
      for (const [id, v] of Object.entries(objet(brut.cartes))) {
        if (exercices.has(id) && Number.isInteger(v?.boite) && v.boite >= 1 && v.boite <= INTERVALLES.length && estJour(v.prochaine)) e.cartes[id] = { boite: v.boite, prochaine: v.prochaine };
      }
      for (const [t, v] of Object.entries(objet(brut.themes))) {
        if (parcours.themes[t]) { const essais = entier(v?.essais); e.themes[t] = { essais, premiers: Math.min(essais, entier(v?.premiers)) }; }
      }
      for (const [j, n] of Object.entries(objet(brut.jours))) if (estJour(j)) e.jours[j] = entier(n, 1000);
      e.badges = Array.isArray(brut.badges) ? [...new Set(brut.badges.filter((b) => ids.includes(b)))] : [];
      e.defis = Array.isArray(brut.defis) ? [...new Set(brut.defis.filter(estJour))].slice(-MAX_JOURS) : [];
      e.objectifsJours = Array.isArray(brut.objectifsJours) ? [...new Set(brut.objectifsJours.filter(estJour))].slice(-MAX_JOURS) : [];
      for (const n of Object.keys(NIVEAUX_PARTIE)) {
        const p = objet(objet(brut.parties)[n]);
        e.parties[n] = { victoires: entier(p.victoires), nulles: entier(p.nulles), defaites: entier(p.defaites), meilleur: Number.isInteger(p.meilleur) && p.meilleur >= 0 ? p.meilleur : null };
      }
      for (const n of COMPTEURS) e.compteurs[n] = entier(objet(brut.compteurs)[n]);
      return e;
    }

    /* ---------- Enregistrements : chaque fonction renvoie un nouvel état et ce qui a été gagné ---------- */
    function cloturer(e, avant, gains) {
      const obtenus = badges(e).filter((b) => b.obtenu).map((b) => b.id);
      gains.badges = obtenus.filter((id) => !avant.badges.includes(id)).map((id) => { const { avance, ...b } = BADGES.find((x) => x.id === id); return b; });
      e.badges = [...new Set([...avant.badges.filter((id) => ids.includes(id)), ...obtenus])];
      gains.niveauAvant = niveau(avant.xp).niveau;
      gains.niveauApres = niveau(e.xp).niveau;
      gains.gradesAvant = gradesObtenus(avant);
      gains.gradesApres = gradesObtenus(e);
      return { etat: e, gains };
    }
    /** Activité du jour : série de jours consécutifs, compteur du jour, bonus quand l'objectif est atteint. */
    function compterActivite(e, jour, gains) {
      if (e.dernierJour !== jour) {
        e.serie = e.dernierJour && ajouterJours(e.dernierJour, 1) === jour ? e.serie + 1 : 1;
        e.serieMax = Math.max(e.serieMax, e.serie);
        e.dernierJour = jour;
      }
      e.jours[jour] = (e.jours[jour] ?? 0) + 1;
      for (const j of Object.keys(e.jours).sort().slice(0, -MAX_JOURS)) delete e.jours[j];
      // Une seule récompense par date, même si le joueur change son objectif dans la journée.
      if (e.jours[jour] >= e.objectif && !e.objectifsJours.includes(jour)) {
        e.objectifsJours = [...e.objectifsJours, jour].slice(-MAX_JOURS);
        e.xp += XP.objectif; gains.xp += XP.objectif; gains.objectif = true; e.objectifsAtteints += 1;
      }
    }

    function enregistrerExercice(etat, { id, erreurs = 0, indice = false, jour, revision = false }) {
      const info = exercices.get(id);
      if (!info) throw new Error(`exercice inconnu : ${id}`);
      const e = copie(etat), gains = { xp: 0, objectif: false };
      const parfait = erreurs === 0 && !indice;
      const gain = revision ? (parfait ? XP.revision : XP.revisionRatee) : parfait ? XP.parfait : indice ? XP.avecIndice : XP.reussi;
      e.xp += gain; gains.xp += gain;
      const t = e.themes[info.lecon.theme] ?? { essais: 0, premiers: 0 };
      e.themes[info.lecon.theme] = { essais: t.essais + 1, premiers: t.premiers + (parfait ? 1 : 0) };
      e.cartes[id] = planifierCarte(e.cartes[id], parfait, jour);
      if (revision) e.revisions += 1;
      compterActivite(e, jour, gains);
      return cloturer(e, etat, gains);
    }

    function terminerLecon(etat, { id, etoiles: n, jour }) {
      if (!lecons.has(id)) throw new Error(`leçon inconnue : ${id}`);
      const e = copie(etat), gains = { xp: 0, objectif: false, premiereFois: !etat.lecons[id] };
      if (gains.premiereFois) { e.xp += XP.lecon; gains.xp += XP.lecon; }
      e.lecons[id] = { etoiles: Math.max(n, e.lecons[id]?.etoiles ?? 0), jour };
      return cloturer(e, etat, gains);
    }

    /** Partie terminée (contre l'ordinateur, ou partie de démineur). `temps` en secondes, pour les records. */
    function enregistrerPartie(etat, { resultat, niveau: n, jour, temps = null }) {
      const regle = NIVEAUX_PARTIE[n];
      if (!RESULTATS[resultat] || !regle || regle.xp[resultat] === undefined) throw new Error("partie invalide");
      const e = copie(etat), gains = { xp: 0, objectif: false, record: false };
      const gain = regle.xp[resultat];
      e.xp += gain; gains.xp += gain;
      const p = e.parties[n];
      p[RESULTATS[resultat]] += 1;
      if (resultat === "victoire" && Number.isInteger(temps) && temps >= 0 && (p.meilleur === null || temps < p.meilleur)) { p.meilleur = temps; gains.record = true; }
      compterActivite(e, jour, gains);
      return cloturer(e, etat, gains);
    }

    /** Événements de jeu (ex. un capot) : seulement les compteurs déclarés par les badges, sans XP ni activité. */
    function compter(etat, { compteurs = {} }) {
      const e = copie(etat), gains = { xp: 0, objectif: false };
      for (const [n, k] of Object.entries(compteurs)) if (COMPTEURS.includes(n) && Number.isInteger(k) && k > 0) e.compteurs[n] += k;
      return cloturer(e, etat, gains);
    }

    function enregistrerDefi(etat, { jour }) {
      const e = copie(etat), gains = { xp: 0, objectif: false };
      if (!e.defis.includes(jour)) { e.defis = [...e.defis, jour].slice(-MAX_JOURS); e.xp += XP.defi; gains.xp += XP.defi; }
      return cloturer(e, etat, gains);
    }

    function regler(etat, { objectif, embleme, libre }) {
      const e = copie(etat);
      if (OBJECTIFS.includes(objectif)) e.objectif = objectif;
      if (emblemesDisponibles(etat).includes(embleme)) e.embleme = embleme;
      if (typeof libre === "boolean") e.libre = libre;
      return e;
    }

    /* ---------- Lectures ---------- */
    const revisionsDues = (etat, jour) => cartesDues(etat.cartes, jour);
    function forces(etat) {
      return Object.entries(parcours.themes).map(([id, nom]) => {
        const t = etat.themes[id] ?? { essais: 0, premiers: 0 };
        return { id, nom, essais: t.essais, taux: t.essais >= 3 ? t.premiers / t.essais : null };
      });
    }
    /** Série encore valable aujourd'hui (elle est cassée si le dernier jour actif est avant-hier ou plus ancien). */
    const serieActuelle = (e, jour) => (e.dernierJour === jour || e.dernierJour === ajouterJours(jour, -1) ? e.serie : 0);
    /** Activité des `n` derniers jours, du plus ancien au plus récent. */
    const activite = (e, jour, n = 7) => Array.from({ length: n }, (_, k) => { const j = ajouterJours(jour, k - n + 1); return { jour: j, exercices: e.jours[j] ?? 0 }; });

    function defiDuJour(etat, jour) {
      // Liste commune, indépendante de la progression : vraiment le même défi pour tout le monde le même jour.
      const candidats = [...exercices.entries()].filter(([, x]) => x.exo.type !== "qcm").map(([id]) => id);
      if (!candidats.length) return null;
      return { id: candidats[hacher(jour) % candidats.length], fait: etat.defis.includes(jour) };
    }

    /** Conseil personnalisé : réviser, retravailler un point faible, avancer, se perfectionner, ou jouer. */
    function recommandation(etat, jour) {
      const dues = revisionsDues(etat, jour);
      const ouvertes = toutesLecons.filter((l) => leconDebloquee(etat, l.id));
      if (dues.length >= 3) return { type: "revision", nombre: dues.length, texte: `${dues.length} stratégies t'attendent pour une révision : c'est le meilleur moyen de les retenir pour toujours.` };
      const faibles = forces(etat).filter((f) => f.taux !== null && f.taux < 0.6).sort((a, b) => a.taux - b.taux);
      for (const f of faibles) {
        const lecon = ouvertes.filter((l) => l.theme === f.id).sort((a, b) => (etat.lecons[a.id]?.etoiles ?? 0) - (etat.lecons[b.id]?.etoiles ?? 0))[0];
        if (lecon && (etat.lecons[lecon.id]?.etoiles ?? 0) < 3) return { type: "faiblesse", lecon: lecon.id, theme: f.id, texte: `Ton point à travailler : ${f.nom.toLowerCase()} (${Math.round(f.taux * 100)} % réussi du premier coup). Refais « ${lecon.titre} ».` };
      }
      const suivante = ouvertes.find((l) => !etat.lecons[l.id]);
      if (suivante) return { type: "suite", lecon: suivante.id, texte: Object.keys(etat.lecons).length ? `Prochaine étape : « ${suivante.titre} ».` : `Bienvenue ! Commence par « ${suivante.titre} ».` };
      if (dues.length) return { type: "revision", nombre: dues.length, texte: `${dues.length} révision${dues.length > 1 ? "s" : ""} pour garder tes stratégies en tête.` };
      const aPerfectionner = ouvertes.find((l) => etat.lecons[l.id].etoiles < 3);
      if (aPerfectionner) return { type: "perfection", lecon: aPerfectionner.id, texte: `Vise les 3 étoiles sur « ${aPerfectionner.titre} ».` };
      if (gradesObtenus(etat) < parcours.grades.length) {
        const g = parcours.grades[gradesObtenus(etat)];
        return { type: "suite", lecon: g.lecons.find((l) => !etat.lecons[l.id])?.id ?? g.lecons[0].id, texte: `Termine le grade ${g.nom} pour progresser.` };
      }
      return { type: "jouer", texte: parcours.conseilFinal ?? "Tu as tout appris ! Mets tes stratégies en pratique en jouant." };
    }

    /** Règles de gain d'XP, pour les expliquer au joueur (transparence de la gamification). */
    function reglesXP() {
      const regles = [
        ["Exercice réussi du premier coup", XP.parfait], ["Exercice réussi après une erreur", XP.reussi], ["Exercice réussi avec un indice", XP.avecIndice],
        ["Leçon terminée (la première fois)", XP.lecon], ["Révision réussie du premier coup", XP.revision], ["Objectif du jour atteint", XP.objectif], ["Défi du jour réussi", XP.defi]
      ];
      for (const [, n] of Object.entries(NIVEAUX_PARTIE)) {
        for (const [r, xp] of Object.entries(n.xp)) regles.push([`Partie ${n.nom} : ${{ victoire: "victoire", nulle: "nulle", defaite: "défaite" }[r]}`, xp]);
      }
      return regles.map(([texte, xp]) => ({ texte, xp }));
    }

    return Object.freeze({
      parcours, EMBLEMES, BADGES: BADGES.map(({ avance, ...b }) => b), NIVEAUX_PARTIE, lecons, exercices,
      etatInitial, normaliser, niveau, gradesObtenus, titre, leconDebloquee, emblemesDisponibles, badges,
      enregistrerExercice, terminerLecon, enregistrerPartie, enregistrerDefi, compter, regler,
      revisionsDues, forces, serieActuelle, activite, defiDuJour, recommandation, reglesXP
    });
  }

  /** Niveau n atteint à 50 × n × (n − 1) XP : 0, 100, 300, 600, 1000… (chaque niveau demande un peu plus). */
  function niveau(xp) {
    let n = 1;
    while (50 * (n + 1) * n <= xp) n += 1;
    const debut = 50 * n * (n - 1), fin = 50 * (n + 1) * n;
    return { niveau: n, xpDansNiveau: xp - debut, xpPourNiveau: fin - debut };
  }

  return Object.freeze({ XP, INTERVALLES, OBJECTIFS, ajouterJours, exoId, etoiles, niveau, creer, planifierCarte, cartesDues });
})();
