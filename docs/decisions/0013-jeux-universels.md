# ADR 0013 — Jeux universels : une matière « jeux », des pages écrites à la main avec un moteur testable

- Date : 2026-11-04 — Statut : **proposé** (premier jeu : Démineur, issue #85 ; à valider par le propriétaire)
- Contexte : Kermiclab accueille des jeux « universels » (Démineur d'abord, puis morpion, puissance 4, 2048, sudoku, memory…).
  Un jeu n'est pas une notion : pas de niveaux scolaires ni d'exercices QCM, donc le gabarit de notion (ADR 0011) ne
  s'applique pas. Un jeu a en revanche des règles qu'il faut pouvoir tester sans navigateur.

## Décision

1. **Même contrat que toute page** (AGENTS.md §5) : un dossier `catalogue/<id>/` avec `fiche.md` et un `page.html` écrit
   à la main, autonome (CSP à hashes posée par `npm run build`, aucune ressource ni appel réseau), registre d'onglets,
   stockage abstrait, bouton « Se connecter » masqué. Aucun nouveau mécanisme de build ni de service.
2. **Matière `jeux`** : `sujet: jeux/<id>` (la matière est le préfixe du sujet, comme pour les notions). Elle est rangée
   en dernier (`ORDRE_MATIERES` du Worker, `MATIERES` du chat) et libellée `matiere_jeux` dans `web/i18n/*.json`. Pas de
   champ `niveau` : un jeu est pour tous les âges (groupe « Autres »).
3. **Onglets de base réutilisés** : `explication` = règles, `application` = le jeu (onglet ouvert par défaut),
   `mise-en-situation` = petites énigmes ou défis autour du jeu. `self-test` reste déclaré et inactif.
4. **Moteur séparé du rendu, dans la page** : un premier `<script id="moteur-<id>">` définit un objet pur (état et règles,
   sans DOM, hasard injectable) ; le second script contient l'interface et le socle. Les tests unitaires extraient le
   moteur de `page.html` et l'exécutent dans un contexte `node:vm` sans `window` ni `document` : la page reste l'unique
   source, sans copie à synchroniser.

## Conséquences

- Ajouter un jeu = un dossier, deux tests (`tests/unit/<id>.test.mjs`, `tests/e2e/<id>.test.mjs`) ; guide `docs/jeux.md`.
- Pas de gabarit de jeu tant qu'il n'existe qu'un jeu : quand deux ou trois jeux partageront réellement du code (vue de
  grille, chronomètre, records), on l'extraira, sur le modèle de l'ADR 0011.
- Les records restent en `localStorage` par page (indisponible dans l'iframe isolée du chat, comme les scores de
  `trigo-cercle`) ; aucune donnée personnelle, aucune télémétrie.
