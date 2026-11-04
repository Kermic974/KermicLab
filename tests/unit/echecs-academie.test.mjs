// Académie des échecs : contenu du parcours (vérifié avec le moteur) et progression commune des jeux, sans DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../../catalogue/echecs/page.html", import.meta.url), "utf8");
const extraire = (id) => html.match(new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)</script>`))?.[1];
const contexte = { Math, Object, Array, Set, Map, Number, String, Error, Infinity, Date, JSON };
const M = vm.runInNewContext(`${extraire("moteur-echecs")}\nMoteurEchecs`, { ...contexte });
const G = vm.runInNewContext(`${extraire("progression-jeux")}\nProgressionJeux`, { ...contexte });
const P = JSON.parse(html.match(/<script type="application\/json" id="parcours-echecs">([\s\S]*?)<\/script>/)[1]);
const A = G.creer(P);
const local = (x) => JSON.parse(JSON.stringify(x)); // objets du contexte vm → objets ordinaires
const uci = (c) => `${M.nomCase(c.de)}${M.nomCase(c.vers)}${c.promotion ? M.typeDe(c.promotion) : ""}`;
const trouver = (p, u) => M.coupsLegaux(p).find((c) => uci(c) === u);
const lecons = P.grades.flatMap((g) => g.lecons);
const J = "2026-11-04";

test("progression : logique sans dépendance au DOM", () => {
  assert.doesNotMatch(extraire("progression-jeux"), /\b(document|window|localStorage|navigator)\b/);
});

test("parcours : six grades du débutant au pro, identifiants uniques, textes et thèmes complets", () => {
  assert.deepEqual(P.grades.map((g) => g.nom), ["Pion", "Cavalier", "Fou", "Tour", "Dame", "Roi"]);
  assert.equal(new Set(lecons.map((l) => l.id)).size, lecons.length);
  for (const g of P.grades) assert.ok(g.embleme && g.sousTitre && g.lecons.length >= 3, g.id);
  assert.equal(new Set(A.EMBLEMES).size, P.grades.length, "un emblème distinct par grade");
  for (const l of lecons) {
    assert.ok(P.themes[l.theme], `${l.id} : thème`);
    for (const champ of ["titre", "texte", "retenir"]) assert.ok(l[champ]?.trim(), `${l.id} : ${champ}`);
    assert.ok(l.exercices.length >= 1, `${l.id} : exercices`);
    for (const e of l.exercices) {
      assert.ok(["qcm", "coup"].includes(e.type), `${l.id} : type`);
      assert.ok(e.explication?.trim(), `${l.id} : explication`);
      if (e.type === "qcm") {
        assert.ok(e.question && e.choix.length >= 2 && Number.isInteger(e.bonne) && e.bonne < e.choix.length, `${l.id} : QCM`);
        assert.equal(new Set(e.choix).size, e.choix.length, `${l.id} : choix distincts`);
      } else assert.ok(e.consigne && e.indice && e.etapes.length >= 1, `${l.id} : exercice sur l'échiquier`);
    }
  }
  for (const theme of Object.keys(P.themes)) assert.ok(lecons.some((l) => l.theme === theme), theme);
  // Aucun mot qui déclencherait le contrôle de sécurité des pages.
  assert.doesNotMatch(JSON.stringify(P), /\b(fetch|eval)\s*\(|<\/script/i);
});

/** Tous les chemins de solution d'un exercice : chaque coup accepté doit être légal, chaque réponse aussi. */
function chemins(e) {
  const fins = [];
  const parcourir = (p, i, coups) => {
    if (i === e.etapes.length) { fins.push({ p, coups }); return; }
    const et = e.etapes[i];
    const candidats = et.but === "mat"
      ? M.coupsLegaux(p).filter((c) => M.statut(M.jouer(p, c)).etat === "mat")
      : et.accepte.map((u) => { const c = trouver(p, u); assert.ok(c, `${e.fen} : ${u} doit être légal`); return c; });
    assert.ok(candidats.length >= 1, `${e.fen} : étape ${i + 1} sans solution`);
    for (const c of candidats) {
      let q = M.jouer(p, c);
      const r = typeof et.reponse === "string" ? et.reponse : et.reponse?.[uci(c)];
      if (r) { const rc = trouver(q, r); assert.ok(rc, `${e.fen} : réponse ${r} illégale après ${uci(c)}`); q = M.jouer(q, rc); }
      if (i < e.etapes.length - 1) assert.equal(M.statut(q).fin, false, `${e.fen} : partie finie trop tôt`);
      parcourir(q, i + 1, [...coups, uci(c)]);
    }
  };
  parcourir(M.depuisFEN(e.fen), 0, []);
  return fins;
}

test("parcours : chaque position est valide et chaque solution jouable jusqu'au bout", () => {
  for (const l of lecons) for (const e of l.exercices.filter((x) => x.type === "coup")) {
    const p = M.depuisFEN(e.fen);
    assert.equal(M.statut(p).fin, false, `${l.id} : position déjà terminée`);
    const fins = chemins(e);
    if (e.etapes.at(-1).but === "mat") for (const { p: q } of fins) assert.equal(M.statut(q).etat, "mat", l.id);
  }
});

test("parcours : quand l'exercice demande de gagner du matériel, la solution est le meilleur coup selon le moteur", () => {
  // Les exercices d'ouverture (« fais le petit roque », « prends le centre ») suivent une consigne, pas un calcul.
  for (const l of lecons.filter((x) => x.theme === "tactique" || ["valeurs", "parer-echec", "compter"].includes(x.id))) {
    for (const e of l.exercices.filter((x) => x.type === "coup" && x.etapes[0].accepte)) {
      const p = M.depuisFEN(e.fen), analyse = M.analyser(p, 3), meilleur = analyse[0].score;
      for (const u of e.etapes[0].accepte) {
        const score = analyse.find((a) => uci(a.coup) === u).score;
        assert.ok(meilleur - score <= 20, `${l.id} : ${u} (${score}) contre ${M.notation(p, analyse[0].coup)} (${meilleur})`);
      }
    }
  }
});

test("parcours : les affirmations des explications sont exactes", () => {
  const exo = (id, k = 0) => lecons.find((l) => l.id === id).exercices[k];
  // Coup du berger : chaque défense acceptée évite le mat, alors que Cf6 le subit.
  const berger = M.depuisFEN(exo("berger").fen);
  const matEnUn = (p) => M.coupsLegaux(p).some((c) => M.statut(M.jouer(p, c)).etat === "mat");
  for (const u of exo("berger").etapes[0].accepte) assert.equal(matEnUn(M.jouer(berger, trouver(berger, u))), false, u);
  assert.equal(matEnUn(M.jouer(berger, trouver(berger, "g8f6"))), true, "Cf6 perd sur Dxf7#");
  // Clouage : après Txe5+, le cavalier d7 ne peut pas reprendre.
  const cloue = M.jouer(M.depuisFEN(exo("clouage").fen), trouver(M.depuisFEN(exo("clouage").fen), "e1e5"));
  assert.equal(trouver(cloue, "d7e5"), undefined);
  // Parer un échec en s'interposant : Ff1 (protégé par le roi) tient, Fd1 perd sur Txd1#.
  const interpose = M.depuisFEN(exo("parer-echec", 2).fen);
  assert.deepEqual([...M.coupsLegaux(interpose)].map(uci).sort(), ["e2d1", "e2f1"]);
  assert.equal(matEnUn(M.jouer(interpose, trouver(interpose, "e2d1"))), true, "Fd1 perd sur Txd1#");
  assert.equal(matEnUn(M.jouer(interpose, trouver(interpose, "e2f1"))), false);
  // Compter : Dxd5 perd la dame sur cxd5.
  const compter = M.depuisFEN(exo("compter").fen);
  assert.ok(trouver(M.jouer(compter, trouver(compter, "d1d5")), "c6d5"));
  // Règle du carré (QCM) : pion a5, roi e5, aux Noirs : le roi rattrape le pion.
  let carre = M.depuisFEN("8/8/8/P3k3/8/8/8/7K b - - 0 1");
  for (const u of ["e5d6", "a5a6", "d6c7", "a6a7", "c7b7", "a7a8q"]) carre = M.jouer(carre, trouver(carre, u));
  assert.ok(trouver(carre, "b7a8"), "le roi noir prend la nouvelle dame");
});

test("parcours : chaque piège est un coup légal, refusé, et son explication est exacte", () => {
  let n = 0;
  for (const l of lecons) for (const e of l.exercices.filter((x) => x.pieges)) {
    const p = M.depuisFEN(e.fen);
    for (const u of Object.keys(e.pieges)) {
      n += 1;
      assert.ok(trouver(p, u), `${l.id} : piège ${u} légal`);
      assert.ok(!e.etapes[0].accepte?.includes(u), `${l.id} : piège ${u} refusé`);
    }
  }
  assert.ok(n >= 4);
});

test("niveaux : seuils croissants (0, 100, 300, 600 XP…)", () => {
  assert.deepEqual(local(G.niveau(0)), { niveau: 1, xpDansNiveau: 0, xpPourNiveau: 100 });
  assert.equal(G.niveau(99).niveau, 1);
  assert.equal(G.niveau(100).niveau, 2);
  assert.equal(G.niveau(299).niveau, 2);
  assert.deepEqual(local(G.niveau(350)), { niveau: 3, xpDansNiveau: 50, xpPourNiveau: 300 });
});

test("exercices : XP selon la réussite, statistiques par thème, objectif du jour une seule fois", () => {
  let e = A.etatInitial();
  let r = A.enregistrerExercice(e, { id: "valeurs/0", jour: J }); e = r.etat;
  assert.equal(r.gains.xp, G.XP.parfait);
  r = A.enregistrerExercice(e, { id: "valeurs/1", erreurs: 2, jour: J }); e = r.etat;
  assert.equal(r.gains.xp, G.XP.reussi);
  r = A.enregistrerExercice(e, { id: "parer-echec/0", indice: true, jour: J }); e = r.etat;
  assert.equal(r.gains.xp, G.XP.avecIndice + G.XP.objectif, "3e exercice du jour : objectif atteint");
  assert.equal(r.gains.objectif, true);
  r = A.enregistrerExercice(e, { id: "parer-echec/1", jour: J }); e = r.etat;
  assert.equal(r.gains.objectif, false, "bonus une seule fois par jour");
  assert.deepEqual(local(e.themes.bases), { essais: 4, premiers: 2 });
  assert.equal(e.objectifsAtteints, 1);
  assert.throws(() => A.enregistrerExercice(e, { id: "inconnu/0", jour: J }), /inconnu/);
  assert.equal(A.etatInitial().xp, 0, "les enregistrements ne modifient pas l'état reçu");
});

test("objectif du jour : changer la cible ne récompense qu'une fois par date", () => {
  let e = A.regler(A.etatInitial(), { objectif: 1 });
  let r = A.enregistrerExercice(e, { id: "valeurs/0", jour: J }); e = r.etat;
  assert.equal(r.gains.objectif, true);
  e = A.regler(e, { objectif: 3 });
  r = A.enregistrerExercice(e, { id: "valeurs/1", jour: J }); e = r.etat;
  assert.equal(r.gains.objectif, false);
  r = A.enregistrerExercice(e, { id: "parer-echec/0", jour: J }); e = r.etat;
  assert.equal(r.gains.objectif, false);
  assert.equal(e.objectifsAtteints, 1);
  assert.deepEqual(local(e.objectifsJours), [J]);
});

test("révisions espacées : la carte monte d'une boîte quand elle est réussie, retombe à la première sinon", () => {
  let e = A.enregistrerExercice(A.etatInitial(), { id: "fourchette/0", jour: J }).etat;
  assert.deepEqual(local(e.cartes["fourchette/0"]), { boite: 1, prochaine: "2026-11-05" });
  assert.deepEqual([...A.revisionsDues(e, J)], []);
  assert.deepEqual([...A.revisionsDues(e, "2026-11-05")], ["fourchette/0"]);
  const boites = [], dates = [];
  let jour = "2026-11-05";
  for (let k = 0; k < 5; k++) {
    e = A.enregistrerExercice(e, { id: "fourchette/0", jour, revision: true }).etat;
    boites.push(e.cartes["fourchette/0"].boite);
    jour = e.cartes["fourchette/0"].prochaine; dates.push(jour);
  }
  assert.deepEqual(boites, [2, 3, 4, 5, 5], "boîte maximale : 5");
  // Intervalles 2, 4, 8, 16 puis 16 jours.
  assert.deepEqual(dates, ["2026-11-07", "2026-11-11", "2026-11-19", "2026-12-05", "2026-12-21"]);
  e = A.enregistrerExercice(e, { id: "fourchette/0", erreurs: 1, jour, revision: true }).etat;
  assert.equal(e.cartes["fourchette/0"].boite, 1, "une erreur renvoie en boîte 1");
  assert.equal(e.revisions, 6);
});

test("série de jours : consécutifs, cassée après un jour manqué, record conservé", () => {
  let e = A.etatInitial();
  for (const jour of ["2026-11-01", "2026-11-02", "2026-11-03"]) e = A.enregistrerExercice(e, { id: "valeurs/0", jour }).etat;
  assert.equal(e.serie, 3);
  assert.ok(e.badges.includes("serie-3"));
  e = A.enregistrerExercice(e, { id: "valeurs/0", jour: "2026-11-03" }).etat;
  assert.equal(e.serie, 3, "même jour : pas de double compte");
  e = A.enregistrerExercice(e, { id: "valeurs/0", jour: "2026-11-05" }).etat;
  assert.equal(e.serie, 1);
  assert.equal(e.serieMax, 3);
  assert.equal(G.ajouterJours("2026-12-31", 1), "2027-01-01");
  assert.equal(G.ajouterJours("2028-03-01", -1), "2028-02-29");
});

test("leçons, grades, emblèmes et déblocage", () => {
  let e = A.etatInitial();
  assert.equal(A.titre(e), "Débutant");
  assert.equal(A.leconDebloquee(e, "roque"), true);
  assert.equal(A.leconDebloquee(e, "fourchette"), false);
  let r = A.terminerLecon(e, { id: "valeurs", etoiles: 1, jour: J }); e = r.etat;
  assert.equal(r.gains.xp, G.XP.lecon);
  assert.deepEqual(local(r.gains.badges).map((b) => b.id), ["premiers-pas"]);
  r = A.terminerLecon(e, { id: "valeurs", etoiles: 3, jour: J }); e = r.etat;
  assert.equal(r.gains.xp, 0, "bonus seulement la première fois");
  r = A.terminerLecon(e, { id: "valeurs", etoiles: 2, jour: J }); e = r.etat;
  assert.equal(e.lecons.valeurs.etoiles, 3, "on garde le meilleur score");
  for (const id of ["parer-echec", "roque"]) { r = A.terminerLecon(e, { id, etoiles: 3, jour: J }); e = r.etat; }
  assert.equal(r.gains.gradesApres, 1);
  assert.equal(A.titre(e), "Pion");
  assert.ok(e.badges.includes("perfectionniste"));
  assert.equal(A.leconDebloquee(e, "mat-couloir"), true);
  assert.equal(A.leconDebloquee(e, "fourchette"), false);
  assert.deepEqual([...A.emblemesDisponibles(e)], ["p", "n"]);
  assert.equal(A.regler(e, { embleme: "k" }).embleme, "p", "emblème verrouillé refusé");
  assert.equal(A.regler(e, { embleme: "n" }).embleme, "n");
  assert.equal(A.leconDebloquee(A.regler(e, { libre: true }), "mat-tour"), true, "mode libre");
  for (const l of lecons) e = A.terminerLecon(e, { id: l.id, etoiles: 2, jour: J }).etat;
  assert.equal(A.titre(e), "Roi : tu es un pro !");
  for (const b of ["pro", "tacticien", "stratege", "finaliste", "premier-mat"]) assert.ok(e.badges.includes(b), b);
  assert.throws(() => A.terminerLecon(e, { id: "inconnue", etoiles: 3, jour: J }), /inconnue/);
});

test("parties contre l'ordinateur : XP et badges", () => {
  let e = A.etatInitial();
  let r = A.enregistrerPartie(e, { resultat: "defaite", niveau: "facile", jour: J }); e = r.etat;
  assert.equal(r.gains.xp, P.parties.niveaux.facile.xp.defaite);
  r = A.enregistrerPartie(e, { resultat: "victoire", niveau: "facile", jour: J }); e = r.etat;
  assert.equal(r.gains.xp, P.parties.niveaux.facile.xp.victoire);
  assert.deepEqual(local(r.gains.badges).map((b) => b.id), ["robot-facile"]);
  r = A.enregistrerPartie(e, { resultat: "victoire", niveau: "moyen", jour: J }); e = r.etat;
  assert.equal(r.gains.xp, P.parties.niveaux.moyen.xp.victoire + G.XP.objectif, "3e activité du jour");
  assert.deepEqual(local(e.parties), { facile: { victoires: 1, nulles: 0, defaites: 1, meilleur: null }, moyen: { victoires: 1, nulles: 0, defaites: 0, meilleur: null } });
  assert.throws(() => A.enregistrerPartie(e, { resultat: "abandon", niveau: "facile", jour: J }), /invalide/);
});

test("défi du jour : identique quel que soit le parcours et le mode libre, bonus une fois", () => {
  const e = A.etatInitial();
  const d = A.defiDuJour(e, J);
  assert.deepEqual(local(A.defiDuJour(e, J)), local(d));
  assert.deepEqual(local(A.defiDuJour(A.regler(e, { libre: true }), J)), local(d));
  let progresse = e;
  for (const id of ["valeurs", "parer-echec", "roque"]) progresse = A.terminerLecon(progresse, { id, etoiles: 3, jour: J }).etat;
  assert.deepEqual(local(A.defiDuJour(progresse, J)), local(d));
  const { exercices } = A;
  assert.equal(exercices.get(d.id).exo.type, "coup");
  const jours = new Set(Array.from({ length: 20 }, (_, k) => A.defiDuJour(e, G.ajouterJours(J, k)).id));
  assert.ok(jours.size > 1, "le défi change d'un jour à l'autre");
  let r = A.enregistrerDefi(e, { jour: J });
  assert.equal(r.gains.xp, G.XP.defi);
  assert.equal(A.defiDuJour(r.etat, J).fait, true);
  r = A.enregistrerDefi(r.etat, { jour: J });
  assert.equal(r.gains.xp, 0);
});

test("conseil personnalisé : bienvenue, révisions en attente, point faible, puis jouer", () => {
  let e = A.etatInitial();
  assert.equal(local(A.recommandation(e, J)).lecon, "valeurs");
  e = A.terminerLecon(e, { id: "valeurs", etoiles: 3, jour: J }).etat;
  assert.equal(A.recommandation(e, J).type, "suite");
  // Thème raté : 3 essais avec erreurs → la leçon de ce thème la moins réussie est proposée.
  let f = A.regler(A.etatInitial(), { libre: true });
  for (const id of ["fourchette/0", "fourchette/1", "clouage/0"]) f = A.enregistrerExercice(f, { id, erreurs: 1, jour: J }).etat;
  f = A.terminerLecon(f, { id: "fourchette", etoiles: 1, jour: J }).etat;
  const faible = local(A.recommandation(f, J));
  assert.equal(faible.type, "faiblesse");
  assert.equal(faible.theme, "tactique");
  assert.match(faible.texte, /0 %/);
  // Trois révisions dues passent en premier.
  const rev = local(A.recommandation(f, "2026-11-05"));
  assert.equal(rev.type, "revision");
  assert.equal(rev.nombre, 3);
  // Tout terminé avec 3 étoiles et rien à réviser : on propose de jouer.
  let g = A.etatInitial();
  for (const l of lecons) g = A.terminerLecon(g, { id: l.id, etoiles: 3, jour: J }).etat;
  assert.equal(A.recommandation(g, J).type, "jouer");
});

test("étoiles d'une leçon : 3 sans faute, 2 avec une ou deux erreurs (ou un indice), sinon 1", () => {
  assert.equal(G.etoiles({ erreurs: 0, indices: 0 }), 3);
  assert.equal(G.etoiles({ erreurs: 2, indices: 0 }), 2);
  assert.equal(G.etoiles({ erreurs: 0, indices: 1 }), 2);
  assert.equal(G.etoiles({ erreurs: 1, indices: 1 }), 1);
});

test("stockage : un état corrompu ou modifié à la main est relu sans danger", () => {
  assert.deepEqual(local(A.normaliser(null)), local(A.etatInitial()));
  const brut = {
    xp: -10, serie: "7", objectif: 4, embleme: "x", libre: "oui", badges: ["pro", "faux"],
    lecons: { valeurs: { etoiles: 3, jour: J }, inconnue: { etoiles: 3 }, roque: { etoiles: 9 } },
    cartes: { "valeurs/0": { boite: 2, prochaine: "2026-11-06" }, "valeurs/9": { boite: 1, prochaine: J }, "roque/0": { boite: 8, prochaine: J } },
    themes: { bases: { essais: 2, premiers: 5 }, magie: { essais: 1, premiers: 1 } },
    jours: { [J]: 2, hier: 3 }, objectifsJours: [J, "pas-un-jour", J], parties: { facile: { victoires: 2 } }, defis: [J, "pas-un-jour"]
  };
  const e = local(A.normaliser(brut));
  assert.equal(e.xp, 0); assert.equal(e.serie, 0); assert.equal(e.objectif, 3); assert.equal(e.embleme, "p"); assert.equal(e.libre, false);
  assert.deepEqual(e.badges, ["pro"]);
  assert.deepEqual(Object.keys(e.lecons), ["valeurs"]);
  assert.deepEqual(Object.keys(e.cartes), ["valeurs/0"]);
  assert.deepEqual(e.themes, { bases: { essais: 2, premiers: 2 } });
  assert.deepEqual(e.jours, { [J]: 2 });
  assert.deepEqual(e.objectifsJours, [J]);
  assert.deepEqual(e.parties.facile, { victoires: 2, nulles: 0, defaites: 0, meilleur: null });
  assert.deepEqual(e.defis, [J]);
  // Un état valide fait l'aller-retour sans perte.
  const ok = A.enregistrerExercice(A.terminerLecon(A.etatInitial(), { id: "valeurs", etoiles: 2, jour: J }).etat, { id: "valeurs/0", jour: J }).etat;
  assert.deepEqual(local(A.normaliser(local(ok))), local(ok));
});
