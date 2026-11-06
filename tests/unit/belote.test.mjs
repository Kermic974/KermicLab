// Moteur de la belote : extrait de la page (catalogue/belote/page.html) et exécuté dans un contexte sans DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { routerLocal } from "../../worker/src/router.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";
import { lireMetaHtml } from "../../scripts/lib/catalogue.mjs";

const html = await readFile(new URL("../../catalogue/belote/page.html", import.meta.url), "utf8");
const source = html.match(/<script id="moteur-belote">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source, "script du moteur présent");
const B = vm.runInNewContext(`${source}\nMoteurBelote`, { Math, Object, Array, Set, Number, String, Error, JSON });
const local = (x) => JSON.parse(JSON.stringify(x));
const graine = (n) => { let a = n >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const pli = (...cartes) => { const ordre = ["est", "nord", "ouest", "sud"]; return cartes.map((carte, i) => ({ joueur: ordre[i], carte })); };
const jouables = (main, p, atout, joueur = "sud") => { const r = B.cartesJouables(main, p, atout, joueur); return { cartes: [...r.cartes].sort(), regle: r.regle }; };

test("moteur : aucune dépendance au DOM", () => {
  assert.doesNotMatch(source, /\b(document|window|localStorage|navigator)\b/);
});

test("cartes : 32 cartes, 152 points en cartes quel que soit l'atout", () => {
  const p = B.paquet();
  assert.equal(p.length, 32);
  assert.equal(new Set(p).size, 32);
  for (const atout of B.COULEURS) assert.equal(p.reduce((s, c) => s + B.pointsCarte(c, atout), 0), 152, atout);
  assert.equal(B.pointsCarte("VC", "C"), 20);
  assert.equal(B.pointsCarte("9C", "C"), 14);
  assert.equal(B.pointsCarte("VC", "P"), 2);
  assert.equal(B.pointsCarte("9C", "P"), 0);
  assert.equal(B.nomCarte("VC"), "valet de cœur");
  assert.equal(B.texteCarte("10P"), "10♠");
  assert.deepEqual([...B.melanger(p, graine(1))].sort(), [...p].sort(), "mélange : mêmes cartes");
});

test("ordre des cartes : à l'atout Valet > 9 > As > 10 > Roi > Dame > 8 > 7, hors atout As > 10 > Roi > Dame > Valet > 9 > 8 > 7", () => {
  const ordre = (cartes, atout, demandee) => cartes.slice().sort((a, b) => B.force(b, atout, demandee) - B.force(a, atout, demandee));
  assert.deepEqual([...ordre(["7C", "AC", "VC", "RC", "9C", "8C", "10C", "DC"], "C", "C")], ["VC", "9C", "AC", "10C", "RC", "DC", "8C", "7C"]);
  assert.deepEqual([...ordre(["7P", "AP", "VP", "RP", "9P", "8P", "10P", "DP"], "C", "P")], ["AP", "10P", "RP", "DP", "VP", "9P", "8P", "7P"]);
});

test("pli : la plus forte carte de la couleur demandée gagne, sauf si un atout est joué", () => {
  assert.equal(B.gagnantPli(pli("RP", "AP", "10P", "7P"), "C"), 1);
  assert.equal(B.gagnantPli(pli("RP", "AP", "7C", "10P"), "C"), 2, "un petit atout bat l'as");
  assert.equal(B.gagnantPli(pli("RP", "AK", "DP", "7P"), "C"), 0, "une autre couleur ne gagne jamais");
  assert.equal(B.gagnantPli(pli("8C", "AC", "9C", "VC"), "C"), 3, "valet d'atout");
  assert.equal(B.pointsPli(pli("VC", "9C", "AP", "10K"), "C"), 20 + 14 + 11 + 10);
});

test("cartes jouables : fournir, monter, couper, surcouper, sous-couper, partenaire maître, défausse", () => {
  // Fournir
  assert.deepEqual(jouables(["7K", "RK", "AP", "VC"], pli("10K"), "P"), { cartes: ["7K", "RK"], regle: "fournir" });
  // Atout demandé : monter si possible…
  assert.deepEqual(jouables(["AC", "7C", "VP"], pli("10C", "8C", "RC"), "C"), { cartes: ["AC"], regle: "monter" });
  // … sinon n'importe quel atout (même sur son partenaire)
  assert.deepEqual(jouables(["8C", "7C", "VP"], pli("10C"), "C"), { cartes: ["7C", "8C"], regle: "fournir-atout" });
  assert.deepEqual(jouables(["AC", "7C"], [{ joueur: "nord", carte: "10C" }], "C"), { cartes: ["AC"], regle: "monter" }, "on monte même sur son partenaire");
  // Pas la couleur, adversaire maître : couper
  assert.deepEqual(jouables(["9C", "7C", "RK"], [{ joueur: "ouest", carte: "AT" }], "C"), { cartes: ["7C", "9C"], regle: "couper" });
  // L'adversaire a coupé : surcouper si possible, sinon sous-couper
  assert.deepEqual(jouables(["VC", "7C", "RK"], pli("AT", "7T", "8C"), "C"), { cartes: ["VC"], regle: "surcouper" }, "Ouest a coupé avec le 8");
  assert.deepEqual(jouables(["8C", "7C", "RK"], pli("AT", "7T", "VC"), "C"), { cartes: ["7C", "8C"], regle: "sous-couper" }, "Ouest a coupé avec le valet");
  // Partenaire maître : libre
  assert.deepEqual(jouables(["10K", "VC", "7T"], [{ joueur: "est", carte: "7P" }, { joueur: "nord", carte: "AP" }, { joueur: "ouest", carte: "8P" }], "C"), { cartes: ["10K", "7T", "VC"], regle: "partenaire-maitre" });
  // Ni couleur ni atout : défausse
  assert.deepEqual(jouables(["10K", "7T"], [{ joueur: "est", carte: "AP" }], "C"), { cartes: ["10K", "7T"], regle: "defausse" });
  // Entame : tout
  assert.equal(B.cartesJouables(["10K", "7T"], [], "C", "sud").regle, "entame");
  for (const regle of ["entame", "fournir", "monter", "fournir-atout", "couper", "surcouper", "sous-couper", "partenaire-maitre", "defausse"]) assert.ok(B.REGLES[regle], regle);
});

/** Paquet construit pour une distribution connue (donneur Ouest : Sud reçoit en premier). */
function paquetPour(mains, retournee, reste) {
  const ordre = ["sud", "est", "nord", "ouest"];
  return [...ordre.flatMap((j) => mains[j].slice(0, 3)), ...ordre.flatMap((j) => mains[j].slice(3, 5)), retournee, ...reste];
}

test("distribution et enchères : 5 cartes, carte retournée, deux tours, puis 8 cartes chacun", () => {
  const d0 = B.creerDonne({ donneur: "ouest", hasard: graine(4) });
  for (const j of B.JOUEURS) assert.equal(d0.mains[j].length, 5);
  assert.equal(d0.reste.length, 11);
  assert.equal(d0.parole, "sud", "le joueur qui suit le donneur parle en premier");
  assert.deepEqual([...B.choixPossibles(d0)], ["prendre", "passer"]);
  let d = d0;
  for (const j of ["sud", "est", "nord", "ouest"]) d = B.encherir(d, j, "passer");
  assert.equal(d.tour, 2);
  assert.deepEqual([...B.choixPossibles(d)], [...B.COULEURS.filter((c) => c !== B.couleur(d0.retournee)), "passer"]);
  assert.throws(() => B.encherir(d, "sud", B.couleur(d0.retournee)), /impossible/, "au 2e tour, pas la couleur refusée");
  assert.throws(() => B.encherir(d, "est", "passer"), /pas ton tour/);
  const autre = B.COULEURS.find((c) => c !== B.couleur(d0.retournee));
  d = B.encherir(B.encherir(d, "sud", "passer"), "est", autre);
  assert.equal(d.phase, "jeu");
  assert.equal(d.atout, autre);
  assert.equal(d.preneur, "est");
  assert.ok(d.mains.est.includes(d0.retournee), "le preneur reçoit la carte retournée");
  for (const j of B.JOUEURS) assert.equal(d.mains[j].length, 8, j);
  assert.equal(new Set(B.JOUEURS.flatMap((j) => d.mains[j])).size, 32);
  assert.equal(d.parole, "sud", "le joueur qui suit le donneur entame");
  let r = d0;
  for (let k = 0; k < 8; k++) r = B.encherir(r, r.parole, "passer");
  assert.equal(r.phase, "redonne");
});

test("belote et rebelote : annoncées par le joueur qui a le roi et la dame d'atout, 20 points gardés même dedans", () => {
  const mains = { sud: ["RC", "DC", "7P", "8P", "9P"], est: ["VC", "9C", "AC", "10C", "AP"], nord: ["7K", "8K", "9K", "10K", "VK"], ouest: ["7T", "8T", "9T", "10T", "VT"] };
  const reste = ["DK", "RK", "AK", "DT", "RT", "AT", "10P", "VP", "DP", "RP", "8C"];
  let d = B.creerDonne({ donneur: "ouest", cartes: paquetPour(mains, "7C", reste) });
  d = B.encherir(d, "sud", "passer");
  d = B.encherir(d, "est", "prendre");
  assert.equal(d.beloteJoueur, "sud");
  while (d.phase === "jeu") d = B.jouerCarte(d, d.parole, B.choisirCarte(d, d.parole));
  assert.equal(d.resultat.belote, "NS");
  assert.ok(d.resultat.marque.NS >= 20, "la belote reste à son équipe");
});

/** Donne finie construite à la main : 8 plis aux gagnants donnés, pour tester le décompte. */
function donneFinie({ preneur = "sud", atout = "C", plis, beloteJoueur = null }) {
  return { preneur, atout, beloteJoueur, plis };
}
const repartir = (points, gagnants) => gagnants.map((gagnant, i) => ({ gagnant, points: points[i] }));

test("décompte : contrat réussi, dedans, capot, égalité, et 162 points par donne", () => {
  const pts = [30, 25, 20, 20, 20, 15, 12, 10]; // 152
  let r = B.resultat(donneFinie({ plis: repartir(pts, ["sud", "nord", "sud", "est", "nord", "ouest", "sud", "nord"]) }));
  assert.deepEqual(local(r.cartes), { NS: 30 + 25 + 20 + 20 + 12 + 10, EO: 20 + 15 });
  assert.equal(r.der, "NS");
  assert.equal(r.total.NS + r.total.EO, 162);
  assert.equal(r.faite, true);
  assert.deepEqual(local(r.marque), local(r.total));
  // Dedans : la défense marque 162, le preneur garde sa belote
  r = B.resultat(donneFinie({ beloteJoueur: "nord", plis: repartir(pts, ["est", "est", "sud", "ouest", "ouest", "nord", "est", "ouest"]) }));
  assert.equal(r.faite, false);
  assert.deepEqual(local(r.marque), { NS: 20, EO: 162 });
  // Capot du preneur : 250 (+ belote)
  r = B.resultat(donneFinie({ beloteJoueur: "sud", plis: repartir(pts, Array(8).fill("nord")) }));
  assert.equal(r.capot, "NS");
  assert.deepEqual(local(r.marque), { NS: 270, EO: 0 });
  // Capot de la défense : le preneur est dedans
  r = B.resultat(donneFinie({ plis: repartir(pts, Array(8).fill("est")) }));
  assert.equal(r.faite, false);
  assert.deepEqual(local(r.marque), { NS: 0, EO: 250 });
  // Égalité 81-81 : le preneur est dedans (règle de cette page)
  r = B.resultat(donneFinie({ plis: repartir([41, 30, 10, 41, 20, 10, 0, 0], ["sud", "sud", "sud", "est", "est", "est", "est", "est"]) }));
  assert.equal(r.total.NS, 81); assert.equal(r.total.EO, 81);
  assert.equal(r.faite, false);
});

test("partie : scores cumulés, donneur qui tourne, gagnant à l'objectif", () => {
  let p = B.creerPartie({ objectif: 300, donneur: "ouest" });
  const fin = (marque) => ({ phase: "fin", resultat: { marque } });
  p = B.ajouterDonne(p, fin({ NS: 162, EO: 0 }));
  assert.equal(p.donneur, "sud");
  assert.equal(p.gagnant, null);
  p = B.ajouterDonne(p, { phase: "redonne" });
  assert.deepEqual(local(p.scores), { NS: 162, EO: 0 }, "une redonne ne marque rien");
  p = B.ajouterDonne(p, fin({ NS: 150, EO: 12 }));
  assert.equal(p.gagnant, "NS");
  assert.throws(() => B.ajouterDonne(p, { phase: "jeu" }), /non terminée/);
});

test("ordinateur : 3 000 donnes complètes, toujours légales, toujours 162 points, en moins de 10 ms en moyenne par coup", () => {
  const h = graine(9);
  let jouees = 0, tempsChoix = 0, choix = 0, faites = 0;
  for (let n = 0; n < 3000; n++) {
    let d = B.creerDonne({ donneur: B.JOUEURS[n % 4], hasard: h });
    while (d.phase === "encheres") d = B.encherir(d, d.parole, B.choisirEnchere(d, d.parole, { niveau: n % 2 ? "facile" : "normal", hasard: h }));
    if (d.phase === "redonne") continue;
    while (d.phase === "jeu") {
      const debut = performance.now();
      const c = B.choisirCarte(d, d.parole, { niveau: B.equipe(d.parole) === "NS" ? "normal" : "facile", hasard: h });
      tempsChoix += performance.now() - debut;
      choix += 1;
      d = B.jouerCarte(d, d.parole, c); // lève une erreur si la carte est interdite
    }
    const r = d.resultat;
    assert.equal(r.cartes.NS + r.cartes.EO, 152);
    assert.equal(r.total.NS + r.total.EO, 162 + (r.belote ? 20 : 0));
    jouees += 1; if (r.faite) faites += 1;
  }
  assert.ok(jouees > 1500, `${jouees} donnes jouées (les autres redistribuées)`);
  assert.ok(faites / jouees > 0.6 && faites / jouees < 0.98, `taux de contrats réussis : ${faites / jouees}`);
  assert.ok(tempsChoix / choix < 10, `${(tempsChoix / choix).toFixed(2)} ms en moyenne`);
});

test("ordinateur : le niveau Normal joue mieux que le niveau Facile", () => {
  const h = graine(21);
  const points = { NS: 0, EO: 0 };
  for (let n = 0; n < 1500; n++) {
    let d = B.creerDonne({ donneur: B.JOUEURS[n % 4], hasard: h });
    while (d.phase === "encheres") d = B.encherir(d, d.parole, B.choisirEnchere(d, d.parole, { hasard: h }));
    if (d.phase === "redonne") continue;
    while (d.phase === "jeu") d = B.jouerCarte(d, d.parole, B.choisirCarte(d, d.parole, { niveau: B.equipe(d.parole) === "NS" ? "normal" : "facile", hasard: h }));
    points.NS += d.resultat.marque.NS; points.EO += d.resultat.marque.EO;
  }
  assert.ok(points.NS > points.EO * 1.05, `Normal ${points.NS} contre Facile ${points.EO}`);
});

test("ordinateur : enchères selon la force de la main, carte maîtresse reconnue", () => {
  assert.ok(B.evaluerMain(["VC", "9C", "AC", "AP", "10T", "7K"], "C") > B.evaluerMain(["7C", "8C", "DT", "9K", "8K", "RC"], "C"));
  const d = { tour: 1, retournee: "AC", mains: { sud: ["VC", "9C", "AP", "10T", "7K"] } };
  assert.equal(B.choisirEnchere(d, "sud"), "prendre");
  assert.equal(B.choisirEnchere({ ...d, retournee: "RC", mains: { sud: ["7C", "8P", "DT", "9K", "8K"] } }, "sud"), "passer");
  const etat = { atout: "C", plis: [{ cartes: [{ joueur: "est", carte: "AP" }, { joueur: "nord", carte: "7P" }, { joueur: "ouest", carte: "8P" }, { joueur: "sud", carte: "9P" }] }], pli: [], mains: { sud: ["10P", "7K"] } };
  assert.equal(B.estMaitresse(etat, "sud", "10P"), true, "l'as est tombé : le 10 est maître");
  assert.equal(B.estMaitresse({ ...etat, plis: [] }, "sud", "10P"), false);
});

test("catalogue : métadonnées du jeu et routage des questions d'exemple", () => {
  const meta = lireMetaHtml(html);
  assert.equal(meta.id, "belote");
  assert.equal(meta.sujet, "jeux/belote");
  for (const q of ["je veux jouer à la belote", "c'est quoi l'atout à la belote ?", "BELOTE", "dix de der"]) assert.equal(routerLocal(q, CATALOGUE.index), "belote", q);
});
