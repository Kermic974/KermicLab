import { test } from "node:test";
import assert from "node:assert/strict";
import { FINANCES_PAR_DEFAUT, estimerSouscription, validerFinances } from "../../web/admin/financier.js";
import { SOUSCRIPTIONS_PAR_DEFAUT, validerListe, validerSouscription } from "../../worker/src/souscriptions.js";
import { ROLES_SYSTEME } from "../../worker/src/roles.js";

// Sous-module financier des souscriptions (ADR 0031) : calculs vérifiés à la main sur des hypothèses rondes.
const finances = {
  devise: "EUR", tauxTva: 20, coutsFixesMensuels: 100, utilisateursEstimes: 100, fraisPaiementPourcent: 0, fraisPaiementFixe: 0,
  modeles: { tuteur: { entree: 1, sortie: 2, ratio: 1 }, defi: { entree: 0, sortie: 0, ratio: 0 }, cahiers: { entree: 0, sortie: 0, ratio: 0 } }
};
const generation = { defi: 1500, cahiers: 100000 };
const offre = (prix) => ({
  limites: { tokensSession: 1_000_000, tokensAppel: 500, defisJour: 0, cahiersJour: 0 },
  usage: { joursActifsMois: 10, tauxUtilisation: 50 },
  prix: { mode: "prix", prixMensuelHT: 20, margeCible: 0, remiseAnnuelle: 0, ...prix }
});

test("prix fourni → coût de revient, marge, taux, coefficient, TTC, annuel et seuil de rentabilité", () => {
  // 1 M tokens/jour × (2 + 1 × 1) / 1 M = 3 €/jour ; 10 jours = 30 € au plafond, 15 € à 50 % ; + 1 € de coûts fixes.
  const e = estimerSouscription(offre(), finances, generation);
  assert.deepEqual([e.coutVariable.plafond, e.coutVariable.estime, e.partFixe, e.coutRevient], [30, 15, 1, 16]);
  assert.deepEqual([e.prixMensuelHT, e.prixMensuelTTC, e.marge, e.tauxMarge, e.coefficient], [20, 24, 4, 20, 1.25]);
  assert.deepEqual([e.prixAnnuelHT, e.margeAnnuelle, e.seuilRentabilite, e.margeAuPlafond], [240, 48, 20, -11]);
  assert.equal(estimerSouscription(offre({ remiseAnnuelle: 25 }), finances, generation).prixAnnuelHT, 180);
});

test("marge visée → prix calculé (au centime supérieur), frais de paiement compris", () => {
  assert.equal(estimerSouscription(offre({ mode: "marge", margeCible: 20 }), finances, generation).prixMensuelHT, 20);
  const avecFrais = { ...finances, fraisPaiementPourcent: 10, fraisPaiementFixe: 1 };
  const e = estimerSouscription(offre({ mode: "marge", margeCible: 20 }), avecFrais, generation);
  assert.equal(e.prixMensuelHT, 24.29, "(16 + 1) / (1 − 0,20 − 0,10) = 24,2857…");
  assert.ok(e.tauxMarge >= 20, "la marge atteinte n'est jamais inférieure à la marge visée");
  const impossible = estimerSouscription(offre({ mode: "marge", margeCible: 95 }), avecFrais, generation);
  assert.deepEqual([impossible.atteignable, impossible.prixMensuelHT], [false, 0]);
});

test("offre gratuite : marge négative (coût d'acquisition), sans taux ni seuil", () => {
  const e = estimerSouscription(offre({ prixMensuelHT: 0 }), finances, generation);
  assert.deepEqual([e.marge, e.tauxMarge, e.seuilRentabilite, e.fraisPaiement], [-16, null, null, 0]);
});

test("défis et cahiers : volume = générations par jour × taille d'une génération", () => {
  const prix = { ...finances, coutsFixesMensuels: 0, modeles: { tuteur: { entree: 0, sortie: 0, ratio: 0 }, defi: { entree: 0, sortie: 1, ratio: 0 }, cahiers: { entree: 1, sortie: 10, ratio: 0.2 } } };
  const e = estimerSouscription({ ...offre(), limites: { tokensSession: 1000, tokensAppel: 500, defisJour: 2, cahiersJour: 1 } }, prix, generation);
  assert.equal(e.coutVariable.parModule.defi.tokensMoisPlafond, 30000);
  assert.equal(e.coutVariable.parModule.defi.plafond, 0.03);
  assert.equal(e.coutVariable.parModule.cahiers.plafond, 10.2, "10 × 100 000 × (10 + 0,2 × 1) / 1 M");
});

test("cahiers : plafond mensuel (1 par jour, 5 par mois) ; 0 = sans plafond", () => {
  const prix = { ...finances, coutsFixesMensuels: 0, modeles: { tuteur: { entree: 0, sortie: 0, ratio: 0 }, defi: { entree: 0, sortie: 0, ratio: 0 }, cahiers: { entree: 0, sortie: 10, ratio: 0 } } };
  const avec = (cahiersMois, joursActifsMois = 15) => estimerSouscription({ ...offre(), usage: { joursActifsMois, tauxUtilisation: 100 },
    limites: { tokensSession: 1000, tokensAppel: 500, defisJour: 0, cahiersJour: 1, cahiersMois } }, prix, generation).coutVariable.parModule.cahiers;
  assert.deepEqual([avec(5).tokensMoisPlafond, avec(5).plafond], [500000, 5], "15 jours × 1 par jour, ramené à 5 par mois");
  assert.equal(avec(0).tokensMoisPlafond, 1500000, "sans plafond mensuel : 15 cahiers");
  assert.equal(avec(5, 3).tokensMoisPlafond, 300000, "3 jours actifs : 3 cahiers, sous le plafond");
});

test("hypothèses : défauts valides, bornes refusées", () => {
  assert.deepEqual(validerFinances(FINANCES_PAR_DEFAUT), { ok: true, finances: JSON.parse(JSON.stringify(FINANCES_PAR_DEFAUT)) });
  assert.equal(validerFinances({ ...FINANCES_PAR_DEFAUT, utilisateursEstimes: 0 }).code, "hors-bornes:utilisateursEstimes");
  assert.equal(validerFinances({ ...FINANCES_PAR_DEFAUT, fraisPaiementPourcent: "" }).code, "hors-bornes:fraisPaiementPourcent");
  assert.equal(validerFinances({ ...FINANCES_PAR_DEFAUT, modeles: { ...FINANCES_PAR_DEFAUT.modeles, cahiers: { entree: 1, sortie: 1, ratio: 99 } } }).code, "hors-bornes:ratio-cahiers");
});

test("offres pressenties : Gratuit, Solo, Parent, Professeur, toutes valides et rôles existants", () => {
  const roles = Object.keys(ROLES_SYSTEME);
  assert.deepEqual(SOUSCRIPTIONS_PAR_DEFAUT.map((s) => s.id), ["gratuit", "solo", "parent", "professeur"]);
  assert.equal(validerListe(SOUSCRIPTIONS_PAR_DEFAUT, { roles }).ok, true);
  for (const s of SOUSCRIPTIONS_PAR_DEFAUT) {
    // Une offre n'inclut que des fonctionnalités que son rôle permet (sinon elles seraient refusées, contrôle activé).
    assert.deepEqual(s.fonctionnalites.filter((f) => !ROLES_SYSTEME[s.role].permissions.includes(f)), [], s.id);
  }
  assert.equal(validerListe(SOUSCRIPTIONS_PAR_DEFAUT.slice(1), { roles }).ok, false, "« Gratuit » est obligatoire");
  assert.equal(validerSouscription("Solo", SOUSCRIPTIONS_PAR_DEFAUT[1], { roles }).code, "identifiant-invalide");
  assert.equal(validerSouscription("solo", { ...SOUSCRIPTIONS_PAR_DEFAUT[1], statut: "vendue" }, { roles }).code, "statut-invalide");
  assert.equal(validerSouscription("solo", { ...SOUSCRIPTIONS_PAR_DEFAUT[1], prix: { mode: "gratuit" } }, { roles }).code, "mode-prix-invalide");
  assert.equal(validerSouscription("solo", { ...SOUSCRIPTIONS_PAR_DEFAUT[1], limites: { ...SOUSCRIPTIONS_PAR_DEFAUT[1].limites, elevesMax: 5000 } }, { roles }).code, "hors-bornes:elevesMax");
  assert.equal(validerSouscription("solo", { ...SOUSCRIPTIONS_PAR_DEFAUT[1], limites: { ...SOUSCRIPTIONS_PAR_DEFAUT[1].limites, cahiersMois: 200 } }, { roles }).code, "hors-bornes:cahiersMois");
  const parent = SOUSCRIPTIONS_PAR_DEFAUT.find((x) => x.id === "parent");
  assert.deepEqual([parent.limites.cahiersJour, parent.limites.cahiersMois], [1, 5], "Parent : 1 cahier IA par jour, 5 par mois");
});

test("offres pressenties payantes : rentables avec les hypothèses par défaut, au mois comme à l'année", () => {
  const generation = { defi: 1500, cahiers: 100000 };
  for (const s of SOUSCRIPTIONS_PAR_DEFAUT.filter((x) => x.id !== "gratuit")) {
    const e = estimerSouscription(s, FINANCES_PAR_DEFAUT, generation);
    assert.ok(e.marge > 0, `${s.id} : marge mensuelle ${e.marge}`);
    assert.ok(e.margeAnnuelle > 0, `${s.id} : marge annuelle ${e.margeAnnuelle}`);
  }
});

// ---------- Coûts affinés (ADR 0034) ----------
import { coutParToken, taillesGeneration } from "../../web/admin/financier.js";

test("coût par token : entrée lue en cache au prix du cache, puis frais de plateforme", () => {
  const base = { entree: 2, sortie: 10, cache: 0.2, ratio: 1, partCache: 0, fraisPlateforme: 0 };
  assert.equal(coutParToken(base) * 1e6, 12);
  assert.equal(Math.round(coutParToken({ ...base, partCache: 50 }) * 1e6 * 1000) / 1000, 11.1, "10 + 1 × (0,5 × 2 + 0,5 × 0,2)");
  assert.equal(Math.round(coutParToken({ ...base, fraisPlateforme: 5 }) * 1e6 * 1000) / 1000, 12.6, "+ 5 % Unified Billing");
  assert.equal(coutParToken({ entree: 1, sortie: 1, ratio: 0 }) * 1e6, 1, "hypothèses anciennes : sans cache ni frais");
});

test("taille d'une génération : moyenne saisie, sinon le maximum du registre", () => {
  const f = JSON.parse(JSON.stringify(FINANCES_PAR_DEFAUT));
  assert.deepEqual(taillesGeneration(f, { defi: 1500, cahiers: 100000 }), { defi: 1500, cahiers: 100000 });
  f.modeles.cahiers.tokensParAppel = 12000;
  assert.deepEqual(taillesGeneration(f, { defi: 1500, cahiers: 100000 }), { defi: 1500, cahiers: 12000 });
  const offre = { limites: { tokensSession: 0, tokensAppel: 0, defisJour: 0, cahiersJour: 1, cahiersMois: 0 }, usage: { joursActifsMois: 10, tauxUtilisation: 100 }, prix: { mode: "prix", prixMensuelHT: 0, margeCible: 0, remiseAnnuelle: 0 } };
  assert.equal(estimerSouscription(offre, f, { defi: 1500, cahiers: 100000 }).coutVariable.parModule.cahiers.tokensMoisPlafond, 120000);
});

test("coûts fixes détaillés et hypothèses anciennes reprises sans perte", () => {
  const ancien = { ...JSON.parse(JSON.stringify(FINANCES_PAR_DEFAUT)), coutsFixes: undefined, coutsFixesMensuels: 42, tarifs: undefined };
  for (const m of Object.values(ancien.modeles)) { delete m.cache; delete m.partCache; delete m.fraisPlateforme; delete m.tokensParAppel; delete m.modele; }
  const v = validerFinances(ancien);
  assert.equal(v.ok, true);
  assert.deepEqual(v.finances.coutsFixes, [{ libelle: "Coûts fixes", montant: 42 }]);
  assert.equal(v.finances.modeles.defi.modele, "anthropic/claude-haiku-5.5", "modèle par défaut");
  const postes = validerFinances({ ...FINANCES_PAR_DEFAUT, coutsFixes: [{ libelle: "Workers", montant: 5 }, { libelle: "Domaine", montant: 1.25 }] });
  assert.equal(postes.finances.coutsFixesMensuels, 6.25);
  assert.equal(validerFinances({ ...FINANCES_PAR_DEFAUT, coutsFixes: [{ libelle: "", montant: 5 }] }).code, "libelle-requis:coutsFixes");
  assert.equal(validerFinances({ ...FINANCES_PAR_DEFAUT, modeles: { ...FINANCES_PAR_DEFAUT.modeles, defi: { ...FINANCES_PAR_DEFAUT.modeles.defi, partCache: 120 } } }).code, "hors-bornes:partCache-defi");
  assert.equal(validerFinances({ ...FINANCES_PAR_DEFAUT, modeles: { ...FINANCES_PAR_DEFAUT.modeles, defi: { ...FINANCES_PAR_DEFAUT.modeles.defi, modele: "x y" } } }).code, "modele-invalide:defi");
});

test("prix annuel saisi : remplace la remise, remise effective calculée", () => {
  const offre = { limites: { tokensSession: 0, tokensAppel: 0, defisJour: 0, cahiersJour: 0, cahiersMois: 0 }, usage: { joursActifsMois: 0, tauxUtilisation: 0 }, prix: { mode: "prix", prixMensuelHT: 10, margeCible: 0, remiseAnnuelle: 50, prixAnnuelHT: 96 } };
  const e = estimerSouscription(offre, FINANCES_PAR_DEFAUT, { defi: 0, cahiers: 0 });
  assert.deepEqual([e.prixAnnuelHT, e.prixAnnuelSaisi, e.remiseEffective], [96, true, 20]);
});
