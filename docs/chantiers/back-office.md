# Chantier : back-office

**Niveau actuel : 1 (bêta — API et interface en place, contrôle d'accès et garde-fous en observation)**

Décision : [ADR 0026](../decisions/0026-back-office.md). Interface : `https://kermiclab.online/admin/`. API : `/api/admin/`.

## Ce qui existe

| Écran | Ce qu'il fait | Code |
|---|---|---|
| Vue d'ensemble | État du site, volumes sur 7 jours, profils à regarder | `web/admin/admin.js` |
| Utilisateurs | Comptes famille et comptes locaux : rôle, niveau, état de sécurité, export des données (droit d'accès), suppression complète | `worker/src/backoffice.js` |
| Rôles et accès | Rôles système et personnalisés, permissions, stratégies par fonctionnalité, simulateur | `worker/src/roles.js` |
| Sécurité | Signaux par catégorie, profils classés, décision par profil, banc d'essai de l'analyse | `worker/src/analyse-requete.js`, `comportement.js` |
| Données personnelles | Contrôle de non-conservation, registre des traitements, purge | `worker/src/donnees.js` |
| Télémétrie | Tokens entrants et sortants, modèles, durée, requêtes, refus | `worker/src/telemetrie.js` |
| Charte graphique | Trois thèmes ou couleurs personnalisées, aperçu clair et sombre | `web/theme.js` |
| Contenus | Inventaire, masquage et mise en avant à chaud, parcours, brouillons envoyés en revue | `worker/src/contenus.js` |
| Souscriptions | Offres composées d'un rôle, de fonctionnalités et de limites ; sous-module financier (coût de revient, prix ↔ marge, seuil de rentabilité) — [ADR 0031](../decisions/0031-souscriptions-financier.md) | `worker/src/souscriptions.js`, `web/admin/financier.js` |
| Harness | Modèles, budgets, quotas, skills, instructions complémentaires (limites de l'offre « Gratuit ») | `worker/src/reglages.js`, `configuration.js` |
| Journal | Trace des actions (action et cible, jamais le contenu) | table `journal_admin` |

## Réglages par défaut pendant la bêta

- `CONTROLE_ACCES_ACTIF = false` : toutes les fonctionnalités sont ouvertes à tous les utilisateurs.
- `GARDE_FOUS_ACTIFS = false` : les profils sont classés, aucune restriction n'est appliquée.
- Accès au back-office : clé partagée `BACKOFFICE_JETON` ; sans clé, il est fermé.

## Preuves

- `tests/unit/backoffice.test.mjs` : accès, utilisateurs, rôles, signaux, garde-fous, télémétrie, charte, contenus,
  harness, et le test de non-conservation (requêtes piégées sur toutes les routes, aucune trace dans aucune table).
- `tests/unit/analyse-requete.test.mjs`, `comportement.test.mjs`, `roles-reglages.test.mjs`, `financier.test.mjs`
  (calculs du sous-module financier vérifiés à la main, offres pressenties).
- `tests/e2e/backoffice.test.mjs` : l'interface dans un navigateur, sous la CSP du site, contre le vrai code du Worker.

## Prochaines étapes

1. Mesurer les faux positifs des règles d'analyse sur le trafic de la bêta, ajuster les seuils, puis activer les
   garde-fous.
2. Ouvrir les comptes : remplacer la clé partagée par les permissions `admin.*`, puis brancher `accesAutorise()` sur
   les routes et activer `CONTROLE_ACCES_ACTIF`.
3. Nouvelle table de quota pour appliquer les limites des souscriptions (au-delà de 1 000 tokens par session, défis et
   cahiers par compte), puis brancher les limites de structure (enfants, classes, élèves) dans l'Espace famille et
   l'expérience Professeur. Valider les prix des offres avec le chantier TVA et paiement.
4. Côté site : parcours, contenus mis en avant et « Ma classe » sont en place (`web/parcours.js`) ; reste à étendre la charte aux pages de notion et au blog.
5. Contenus : créer la PR (branche et fichier) depuis un brouillon au lieu d'une issue ; type « lab » au catalogue.
6. Analyse : classification par un modèle en complément des motifs, sur le texte pseudonymisé, sans conservation.
