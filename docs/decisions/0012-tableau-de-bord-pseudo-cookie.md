# ADR 0012 — Tableau de bord par défaut, pseudo et mémorisation par cookie local

- Date : 2026-11-03 — Statut : **accepté** (demande du propriétaire)
- Contexte : la maquette du tableau de bord élève (PR #80, #81) devient l'expérience par défaut. Le chat est intégré à la section Accueil. Les données affichées ne sont plus fictives : elles viennent de la session en cours. Public mineur (AGENTS.md §1) : aucune donnée personnelle collectée.

## Décision

1. **Accueil = tableau de bord** (`web/index.html`) : barre latérale (rail sur tablette, barre inférieure sur mobile), chat, « Reprendre ton Lab », suggestion, matières, activités, semaine, mini-lab du cercle trigonométrique. Le catalogue devient un tiroir « Explorer ». L'ancienne URL `/dashboard/` redirige vers `/` (`dist/_redirects`).
2. **Données réelles, calculées localement** par `web/progression.js` : XP, niveau, série, badges, notions explorées, plus deux ajouts :
   - `jours` : activité par jour `{ q, n, xp }` (31 jours au plus) pour le graphique de la semaine ;
   - `derniereNotion` (carte « Reprendre ») et `defiJour` (le défi express rapporte 5 XP par bonne réponse, une fois par jour).
   Rien n'est inventé : sans activité, le tableau affiche des états vides explicites.
3. **Pseudo obligatoire au premier lancement** (`web/profil.js`) : 2 à 20 caractères, lettres/chiffres/espaces/`-_.`, au moins une lettre, pas de suite de 6 chiffres ou plus (numéro de téléphone). Le pseudo n'est **jamais envoyé** au Worker.
4. **Persistance au choix de l'utilisateur** :
   - par défaut, `sessionStorage` : tout s'efface à la fermeture de l'onglet ;
   - case « Se souvenir de moi sur cet appareil » : cookie **local et fonctionnel** `kermiclab_memoire=1` (`Max-Age` un an, `Path=/`, `SameSite=Strict`, `Secure` en HTTPS). Tant qu'il existe, pseudo et progression sont gardés dans `localStorage`.
   - Le cookie ne contient **ni le pseudo ni la progression** : un cookie est envoyé au serveur à chaque requête (Cloudflare Pages) et limité à 4 Ko ; le pseudo d'un mineur n'a pas à transiter. Le cookie matérialise seulement l'accord et sa durée.
   - « Profil et paramètres » permet de changer de pseudo, de retirer le cookie (les données repassent en session) et de tout effacer (confirmation en deux clics).
   - Une progression enregistrée par une version précédente (stockage local sans cookie) est reprise dans la session ; la case est alors pré-cochée pour la garder.
5. Préférences d'affichage (langue, thème, matière du catalogue) : stockage local, sans donnée personnelle, comme avant.

## Conséquences

- La page de confidentialité est mise à jour (cookie optionnel, pseudo local).
- Tests : `tests/unit/profil.test.mjs`, nouveaux cas dans `progression.test.mjs`, `tests/e2e/tableau.test.mjs` ; les tests du chat entrent un pseudo de session avant de commencer.
- Un futur compte parent (ADR 0010) pourra reprendre ces données locales ; rien ne change côté Worker.
