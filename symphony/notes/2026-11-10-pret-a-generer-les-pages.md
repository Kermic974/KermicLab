# Prêt à générer les pages de KermicLab ?

Note de l'assistant Symphony, 2026-11-10. Elle résume `docs/actions-manuelles.md` en entier. Les statuts sont ceux du document à cette date : l'état réel des demandes de fusion citées n'a pas été revérifié. Rien ici ne modifie le projet.

## Déjà en place

- Déploiement Cloudflare entièrement vert (run 42396707935, 2026-11-07) : instantané, migrations D1, Worker, Pages, test de fumée.
- Base D1 `kermiclab-kpi`, projet Pages `kermiclab`, bucket R2 `kermiclab-bucket`, domaine `kermiclab.online` relié à Pages, jeton GitHub du Worker.
- Cloudflare Access retiré du domaine nu ; anciens Workers `trigolab` supprimés ; déploiements Git automatiques de Pages désactivés.
- Crédits de facturation unifiée chargés sur AI Gateway ; alias `custom/haiku` et `custom/sonnet-5-5` créés.
- Compte local : secret `COMPTES_LOCAUX_SECRET` et schéma appliqués (ne jamais supprimer ni remplacer ce secret).
- Dépôt privé `maquettes-catalogue` : reporté par décision du propriétaire, les pages actuelles sont publiques.

## 1. Sécurité du dépôt (à faire)

- Protéger `main` (action 8) : PR obligatoire, contrôles requis, revue CODEOWNER, pas de force push. Commande : `bash scripts/configurer-github.sh`.
- Ajouter le contrôle « Grille de relecture » aux contrôles obligatoires (action 43).
- Autoriser « Allow GitHub Actions to create and approve pull requests » pour l'actualisation de la roadmap.

## 2. Relecture humaine des contenus (public mineur, condition de sortie de la phase 0)

- 9 jeux intégrés (action 42) et 20 notions les plus servies (action 40).
- Notions en attente de relecture et de validation CODEOWNER :
  - philosophie, 8 notions (PR 66) et 9 notions (PR 67) ;
  - histoire, 8 notions (PR 68, workflows à autoriser) ;
  - histoire contemporaine, 8 notions (PR 69) ;
  - géographie, 9 notions (G1) et 8 notions (PR 71, dépendances du Worker à traiter dans la CI) ;
  - SVT, 23 notions plus `evolution` (S1) ;
  - EMC, 12 notions (PR 74, workflows à autoriser) ;
  - Poker Texas Hold'em v1.1.0.
- Atelier UX : confirmer les liens des six fichiers de `docs/ux/` depuis un navigateur ; autoriser les workflows de la PR 119.

## 3. Intelligence artificielle (à faire avant l'activation en production)

- Action 28 : vérifier l'accès Workers AI, ses conditions pour mineurs et les coûts (le quota de 1 000 tokens par session n'est pas un plafond global).
- Action 29 : créer `LLM_SESSION_SECRET` (32 caractères aléatoires minimum) et vérifier la migration D1.
- Action 30 : déployer l'activation LLM et vérifier `/api/llm/status`.
- Action 31 : vérifier `kermiclab-gateway` (cache, journaux de contenu et exports désactivés) et créer `AI_GATEWAY_TOKEN` si Anthropic sert de repli.
- Action 13 : consigner une décision sur les exigences d'Anthropic pour les services accessibles aux mineurs.
- Vérifier en production : défi express (journal AI Gateway en statut 200), bloc « Mes cahiers ».

## 4. Comptes (à faire avant leur activation)

- Action 33 : servir l'API sur un sous-domaine du site (par exemple `api.kermiclab.online`), puis mettre à jour `KERMICLAB_API_URL`.
- Action 34 : inscrire les applications OAuth Google et Microsoft et déposer leurs quatre secrets (après l'action 33).
- Action 32 : passer les ADR 0010 et 0017 à « accepté ».
- Action 14 : valider juridiquement le consentement parental (moins de 15 ans), phase 3.
- Compte local : vérifier `GET /api/compte-local/etat` après déploiement ; passer l'ADR 0024 à « accepté ».
- Charte du contributeur (action 36) et premiers rôles Prof et Contributeur (action 35).

## Facultatif ou plus tard

- Tableaux GitHub Projects (`gh auth refresh -s project` puis `bash scripts/configurer-projets.sh`).
- Clé Anthropic de repli pour le chat (action 5).
- Passage du dépôt en public (action 17).
- Maquettes du cercle trigonométrique et référentiel des notions de maths (actions 9 et 11, dépôt privé reporté).
