# Prêt à générer les pages de KermicLab ?

Note de l'assistant Symphony, 2026-11-10. Elle résume `docs/actions-manuelles.md` (lecture partielle : les actions numérotées 12 et suivantes n'ont pas été lues). Rien ici ne modifie le projet.

## Déjà en place

- Déploiement Cloudflare entièrement vert (run 42396707935, 2026-11-07) : instantané, migrations D1, Worker, Pages, test de fumée.
- Base D1 `kermiclab-kpi`, projet Pages `kermiclab`, jeton GitHub du Worker (`GITHUB_TOKEN`) créés.
- Crédits de facturation unifiée chargés sur AI Gateway ; `/api/defi` renvoie des défis générés par `custom/haiku`.
- Alias `custom/sonnet-5-5` créé pour le constructeur de cahiers.
- Compte local : secret `COMPTES_LOCAUX_SECRET` et schéma appliqués (ne jamais supprimer ni remplacer ce secret).
- Catalogue public : les pages actuelles sont publiques ; le dépôt privé `maquettes-catalogue` est reporté par décision du propriétaire.

## À faire par le propriétaire avant de considérer la génération comme sûre

1. **Protéger `main`** (action 8) : PR obligatoire, contrôles requis, revue CODEOWNER, pas de force push. Commande : `bash scripts/configurer-github.sh`.
2. **Ajouter le contrôle « Grille de relecture »** aux contrôles obligatoires de `main` (action 43).
3. **Relecture humaine** (public mineur, condition de sortie de la phase 0) : les 9 jeux (action 42) et les 20 notions les plus servies (action 40).
4. **Vérifier en production** : le défi express (journal AI Gateway en statut 200), le bloc « Mes cahiers », et `GET /api/compte-local/etat` qui doit renvoyer `{"disponible":true}`.
5. **Valider les contenus en attente** : PR #69 (catalogue d'histoire contemporaine, workflows à autoriser) et Poker Texas Hold'em v1.1.0.
6. **Autoriser** « Allow GitHub Actions to create and approve pull requests » pour l'actualisation automatique de la roadmap.
7. **Textes juridiques** : valider la charte du contributeur (action 36) et passer l'ADR 0024 à « accepté » (action 38).

## Facultatif

- Tableaux GitHub Projects (`gh auth refresh -s project` puis `bash scripts/configurer-projets.sh`).
- Clé Anthropic de repli pour le chat (action 5).
- Attribuer les premiers rôles Prof et Contributeur (action 35).
