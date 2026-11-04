// Académie de la belote : parcours vérifié avec le moteur, et compteurs d'événements de la progression commune.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../../catalogue/belote/page.html", import.meta.url), "utf8");
const extraire = (id) => html.match(new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)</script>`))?.[1];
const contexte = { Math, Object, Array, Set, Map, Number, String, Error, Infinity, Date, JSON };
const B = vm.runInNewContext(`${extraire("moteur-belote")}\nMoteurBelote`, { ...contexte });
const G = vm.runInNewContext(`${extraire("progression-jeux")}\nProgressionJeux`, { ...contexte });
const P = JSON.parse(html.match(/<script type="application\/json" id="parcours-belote">([\s\S]*?)<\/script>/)[1]);
const A = G.creer(P);
const lecons = P.grades.flatMap((g) => g.lecons);
const local = (x) => JSON.parse(JSON.stringify(x));
const J = "2026-11-04";

test("parcours de la belote : cinq grades, textes complets, QCM valides", () => {
  assert.deepEqual(P.grades.map((g) => g.nom), ["Apprenti", "Joueur", "Équipier", "Stratège", "Champion"]);
  assert.equal(new Set(lecons.map((l) => l.id)).size, lecons.length);
  assert.equal(new Set(A.EMBLEMES).size, P.grades.length);
  for (const l of lecons) {
    assert.ok(P.themes[l.theme] && l.titre && l.texte && l.retenir && l.exercices.length, l.id);
    for (const e of l.exercices) {
      assert.ok(["qcm", "pli", "enchere"].includes(e.type), `${l.id} : type`);
      assert.ok(e.explication?.trim(), `${l.id} : explication`);
      if (e.type === "qcm") assert.ok(e.choix.length >= 2 && e.bonne < e.choix.length && new Set(e.choix).size === e.choix.length, `${l.id} : QCM`);
      else assert.ok(e.consigne && e.indice, `${l.id} : consigne et indice`);
    }
  }
  assert.doesNotMatch(JSON.stringify(P), /\b(fetch|eval)\s*\(|<\/script/i);
});

test("parcours de la belote : chaque pli est une vraie situation de jeu, et la solution est légale", () => {
  for (const l of lecons) for (const e of l.exercices.filter((x) => x.type === "pli")) {
    const toutes = [...e.main, ...e.pli.map((x) => x.carte), ...(e.tombees ?? [])];
    assert.ok(toutes.every(B.estCarte), `${l.id} : cartes valides`);
    assert.equal(new Set(toutes).size, toutes.length, `${l.id} : aucune carte en double`);
    assert.ok(B.COULEURS.includes(e.atout), l.id);
    assert.ok(e.pli.length <= 3, l.id);
    // Le pli suit le sens du jeu et c'est bien au tour de Sud.
    for (let k = 1; k < e.pli.length; k++) assert.equal(e.pli[k].joueur, B.suivant(e.pli[k - 1].joueur), `${l.id} : ordre du pli`);
    if (e.pli.length) assert.equal(B.suivant(e.pli.at(-1).joueur), "sud", `${l.id} : au tour de Sud`);
    const { cartes } = B.cartesJouables(e.main, e.pli, e.atout, "sud");
    const acceptees = e.accepte === "jouables" ? cartes : e.accepte;
    assert.ok(acceptees.length >= 1 && acceptees.every((c) => cartes.includes(c)), `${l.id} : solution légale`);
    for (const c of Object.keys(e.pieges ?? {})) {
      assert.ok(e.main.includes(c) && cartes.includes(c), `${l.id} : piège ${c} jouable`);
      assert.ok(!acceptees.includes(c), `${l.id} : piège ${c} refusé`);
    }
  }
});

test("parcours de la belote : les affirmations des exercices sont exactes", () => {
  const exo = (id, k = 0) => lecons.find((l) => l.id === id).exercices.find((x, i) => i === k);
  const gagne = (e, carte) => { const p = [...e.pli, { joueur: "sud", carte }]; return p[B.gagnantPli(p, e.atout)].joueur === "sud"; };
  // « Remporte le pli » : la solution gagne, les autres cartes jouables non.
  const force = exo("force", 2);
  assert.ok(gagne(force, "AP"));
  // Couper : le 7 et le 9 d'atout coupent tous les deux l'as (le piège est un gaspillage, pas une erreur).
  const couper = exo("couper");
  assert.ok(gagne(couper, "7C") && gagne(couper, "9C"));
  assert.ok(B.pointsCarte("9C", couper.atout) > B.pointsCarte("7C", couper.atout));
  // Partenaire maître : Nord gagne déjà le pli, et le 10 est la carte hors atout qui rapporte le plus.
  const charger = exo("partenaire-maitre");
  assert.equal(charger.pli[B.gagnantPli(charger.pli, charger.atout)].joueur, "nord");
  const horsAtout = charger.main.filter((c) => B.couleur(c) !== charger.atout);
  assert.equal(horsAtout.sort((a, b) => B.pointsCarte(b, charger.atout) - B.pointsCarte(a, charger.atout))[0], "10K");
  // Ne pas gâcher ses points : on ne peut pas gagner, et la solution vaut 0 point.
  const eco = exo("economiser");
  assert.ok(!B.cartesJouables(eco.main, eco.pli, eco.atout, "sud").cartes.some((c) => gagne(eco, c)));
  assert.equal(B.pointsCarte("9K", eco.atout), 0);
  // Faire tomber les atouts : le valet est l'atout maître.
  const tomber = exo("tomber-atouts");
  assert.equal(B.estMaitresse({ atout: tomber.atout, plis: [], pli: [], mains: { sud: tomber.main } }, "sud", "VP"), true);
  // Carte maîtresse : avec les cartes tombées, le 10 de pique est maître et plus aucun atout n'est en jeu.
  const maitresse = exo("maitresse");
  const etat = { atout: maitresse.atout, plis: [{ cartes: maitresse.tombees.map((carte) => ({ joueur: "est", carte })) }], pli: [], mains: { sud: maitresse.main } };
  assert.equal(B.estMaitresse(etat, "sud", "10P"), true);
  assert.equal(maitresse.tombees.filter((c) => B.couleur(c) === maitresse.atout).length, 8, "les 8 atouts sont tombés");
});

test("parcours de la belote : les réponses aux enchères sont celles de l'ordinateur niveau Normal", () => {
  for (const l of lecons) for (const e of l.exercices.filter((x) => x.type === "enchere")) {
    assert.equal(e.main.length, 5, l.id);
    assert.ok([...e.main, e.retournee].every(B.estCarte) && new Set([...e.main, e.retournee]).size === 6, l.id);
    const d = { tour: e.tour, retournee: e.retournee, mains: { sud: e.main } };
    assert.deepEqual(local(e.accepte), [B.choisirEnchere(d, "sud", { niveau: "normal" })], `${l.id} : ${e.accepte}`);
  }
});

test("progression commune : compteurs d'événements (contrats, belotes, capots) et badges propres à la belote", () => {
  let e = A.etatInitial();
  assert.deepEqual(local(e.compteurs), { contrats: 0, belotes: 0, capots: 0 });
  let r = A.compter(e, { compteurs: { belotes: 1, capots: 0, inconnu: 5 } }); e = r.etat;
  assert.deepEqual(local(r.gains.badges).map((b) => b.id), ["belote"]);
  assert.equal(r.gains.xp, 0, "un événement ne rapporte pas d'XP");
  assert.equal(e.compteurs.inconnu, undefined, "seuls les compteurs déclarés par les badges existent");
  for (let k = 0; k < 4; k++) e = A.compter(e, { compteurs: { contrats: 1 } }).etat;
  assert.ok(!e.badges.includes("preneur"));
  r = A.compter(e, { compteurs: { contrats: 1 } }); e = r.etat;
  assert.deepEqual(local(r.gains.badges).map((b) => b.id), ["preneur"]);
  assert.equal(A.compter(e, { compteurs: { capots: -3 } }).etat.compteurs.capots, 0, "valeurs négatives ignorées");
  r = A.enregistrerPartie(e, { resultat: "victoire", niveau: "normal", jour: J });
  assert.equal(r.gains.xp, 120);
  assert.ok(local(r.gains.badges).some((b) => b.id === "victoire-normal"));
  assert.deepEqual(local(A.normaliser({ compteurs: { capots: 2, belotes: -1, faux: 9 } }).compteurs), { contrats: 0, belotes: 0, capots: 2 });
  assert.ok(A.reglesXP().some((x) => x.texte === "Partie Normal : victoire" && x.xp === 120));
});
