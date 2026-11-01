# Rapport d’avancement — Roadmap trigoLab / Kermiclab
**Date :** 1er novembre 2026  
**Dépôt :** [Kermic974/trigoLab](https://github.com/Kermic974/trigoLab)  
**Version actuelle de l’application cercle :** 1.4.0

## Vue d’ensemble du projet

**trigoLab** (Kermiclab) est un agent conversationnel pédagogique (7-77 ans) qui sert des pages HTML autonomes et versionnées.  
L’application phare est le **cercle trigonométrique interactif** (publiée sous `/cercle/`), avec méthodes de résolution géométrique, algébrique et tabulaire, modes Explorer / Apprendre / Jouer, et déploiement Cloudflare (Worker + Pages).

Architecture à deux agents (Moteur / Interface), mode zéro-budget, CI/CD GitHub Actions, ADR, SPEC.md comme source unique des exigences.

## État de la feuille de route (SPEC.md)

| Version | Contenu | Statut |
|---------|---------|--------|
| v0.0 – v1.2 | Socle, stabilisation, modes éducatifs, architecture agents | Livrées |
| **v1.3** | Méthode algébrique + sélecteur de méthode | **Livrée** |
| **v1.4** | Méthode tabulaire, statut `unsupported`, vérification de concordance (`compareResults`) | **Livrée** |
| **v1.5** | Mode Comparer (deux méthodes côte à côte + résultat commun) | **Prochaine** |
| v2.0 | PWA et fonctionnement hors ligne | Planifiée |

## Plan d’exécution v1.3 → v1.4 (PLAN.md)

Tous les lots L0 à L6 sont **fermés** (issues #2 à #9) :

| Lot | Description | Issue | Statut |
|-----|-------------|-------|--------|
| L0 | Autotests de la page en CI | #3 | Fermée |
| L1 | Méthode algébrique + filtrage par mode (S-04, S-07) | #4 | Fermée |
| L2 | Sélecteur de méthode et étapes (A-04) | #5 | Fermée |
| L3 | Méthode tabulaire + statut unsupported (S-05, S-06) | #6 | Fermée |
| L4 | Comparaison des résultats `compareResults` / `resultNumber` (S-08) | #7 | Fermée |
| L5 | Mode Comparer (D-06) | #8 | Fermée* |
| L6 | Publications v1.3 puis v1.4 | #9 | Fermée |

\*Note : la PR L5 (#45) a été fusionnée, mais le mode Comparer n’a pas été intégré dans le code livré en v1.4. Il a été explicitement reporté en v1.5 dans le CHANGELOG, le README et la SPEC.

**Publications :**
- Archives : `versions/v1.3/standalone.html` et `versions/v1.4/standalone.html`
- VERSION dans `src/ui/main.js` = `1.4.0`
- CHANGELOG à jour avec sections [1.3.0] et [1.4.0] datées du 2026-11-01

## Livrables récents (1er novembre 2026)

- Méthode algébrique complète (conversion, réduction, formules, valeurs exactes/approchées)
- Sélecteur de méthode dans le panneau d’explication, avec étapes numérotées et gestion de `unsupported`
- Méthode tabulaire pour les angles remarquables
- Vérification de concordance des méthodes avec le moteur
- Autotests de page exécutés en CI
- Versions archivées et documentation (SPEC, ARCHITECTURE, README, CHANGELOG) mise à jour

## Prochaines étapes recommandées

1. **v1.5 — Mode Comparer**  
   Réaliser proprement l’onglet « ⚖️ Comparer » (deux colonnes / onglets mobile, bloc « Résultat commun » alimenté par `compute()` + `compareResults()`).  
   L’exigence D-06 est déjà rédigée dans la SPEC.

2. **v2.0 — PWA / hors ligne**  
   Rendre l’application autonome vraiment offline-capable.

3. **Chantiers transverses** (docs/chantiers/)  
   - CI/CD, sécurité, RGPD, KPI, juridique, support, validation des maquettes, TVA/paiement  
   Ces fiches existent ; à prioriser selon les besoins opérationnels.

4. **Nettoyage / cohérence**  
   Clarifier le statut du mode Comparer (code vs documentation) et mettre à jour PLAN.md si nécessaire.

## Indicateurs

- **Issues ouvertes :** 0  
- **Dernière activité :** 1er novembre 2026  
- **Release GitHub :** v0.0.1 (prerelease du MVP complet)  
- **Site :** [www.kermiclab.online](https://www.kermiclab.online) (chat + cercle)

---

*Rapport généré le 1er novembre 2026 à partir de SPEC.md, PLAN.md, CHANGELOG.md, issues et PRs du dépôt.*
