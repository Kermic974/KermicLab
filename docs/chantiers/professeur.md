# Chantier : Expérience Professeur (Mes classes, Mes élèves)

**Niveau actuel : 1 (livré pour les comptes locaux, à valider)**

Décision : [ADR 0030](../decisions/0030-experience-professeur.md). Complète le chantier
[Contributions](contributions.md) (relecture et décisions par le Professeur) et réutilise le socle de l'Espace famille
(ADR 0029 : session du compte local, bilan borné, codes d'invitation).

## État au 2026-11-17

| Élément | État |
|---|---|
| Permission `professeur`, donnée au rôle système « Professeur » (`prof`) | Fait (`worker/src/roles.js`, libellé dans le back-office) |
| Règles partagées `web/professeur.js` (profil, classes, liens, adhésion, bilan filtré, synthèse) | Fait, testé (`tests/unit/professeur.test.mjs`) |
| API `/api/professeur/` (`worker/src/professeur.js`), purge quotidienne des liens | Fait, testé (`tests/unit/professeur-worker.test.mjs`) |
| Migration `0004_professeur.sql`, registre des traitements, effacement en cascade, export | Fait ; migration appliquée au prochain déploiement |
| Interface : Profil professeur, « Mes classes », « Mes élèves », Mon compte → Mes professeurs, dialogue d'adhésion | Fait, testé de bout en bout avec le vrai Worker (`tests/e2e/professeur.test.mjs`) |
| Démonstration par « Tester les rôles → Prof » (`web/demo-professeur.js`) | Fait, testé (mobile) |
| Accord parental pour les moins de 15 ans | Non requis (décision du 2026-11-17, ADR 0030 §8) |
| Validation de l'ADR 0030, relecture juridique du texte d'accord | Actions manuelles |

## Plan

| Étape | Contenu | Statut |
|---|---|---|
| 1 | Profil, classes, liens d'invitation, adhésion avec accord, suivi filtré par matière, démo | Fait ([PR #355](https://github.com/Kermic974/KermicLab/pull/355), fusionnée) |
| 2 | Validation de l'ADR 0030 (accord parental : non requis, décidé le 2026-11-17) ; attribution des premiers rôles Professeur | À faire (propriétaire) |
| 3 | Assigner des notions ou des cahiers à une classe ; objectifs de classe | Backlog |
| 4 | Filtre du tableau de bord des contributions sur les matières du professeur ; co-enseignement ; export du suivi | Backlog |

## Ouvrir l'expérience à un professeur (processus)

1. Le professeur crée un compte local **lié en ligne** (Mon compte).
2. Back-office `/admin/` → Utilisateurs → son compte → rôle `prof`.
3. Il recharge le site : menus « Mes classes » et « Mes élèves » ; il remplit son **Profil professeur** (Profil).
4. Il crée ses classes et partage les liens ; chaque élève ouvre le lien depuis son compte lié et donne son accord.
