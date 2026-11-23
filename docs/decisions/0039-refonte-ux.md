# ADR 0039 — Refonte UX/UI : espaces colorés, écran d'arrivée unifié, navigation par taille d'écran

- Date : 2026-11-21 — Statut : **accepté** (décisions D1 à D7 validées par le propriétaire le 2026-11-21)
- Contexte : une maquette « revisitée » (onglets en haut, tableau de bord à cartes de chiffres, bandeau coloré par
  espace) a été analysée dans [docs/chantiers/refonte-ux.md](../chantiers/refonte-ux.md). Elle apporte une identité
  par espace et un vrai tableau de bord, mais sa navigation ne tient pas sur mobile et plusieurs éléments contredisent
  les règles du projet (mesure d'audience, comptes, CSP, i18n).

## Décision

1. **D1 — Grand écran** : au-delà de 1 024 px, la navigation peut passer en onglets en haut, sur une seule ligne et six
   destinations au plus. En dessous, la barre latérale (rail d'icônes sur tablette) reste en place.
2. **D2 — Mobile** : la barre du bas est conservée (six entrées de 44 px, panneau « Plus »).
3. **D3 — Écran d'arrivée** : l'Accueil et « Mon tableau de bord » fusionnent en un écran unique (bandeau, cartes de
   chiffres, Reprendre, Suggestion, journal, accès rapides). Les vues personnelles (Profil, Mon compte, Famille,
   Contributions, Professeur) restent accessibles par l'avatar et la barre de filtres ; leurs adresses ne changent pas.
4. **D4 — Couleur par espace** : chaque espace a sa couleur, déclarée en jetons CSS clairs et sombres, avec un texte
   blanc qui respecte le contraste AA (4,5:1) sur tout le dégradé : Accueil (couleur d'accent de la charte),
   Éducation (bleu), Labs (violet), Jeux (ambre foncé), Progression (vert), Famille (sarcelle), Professeur (indigo),
   Contributions (orange brûlé). L'espace courant est porté par l'attribut `data-espace` de l'en-tête, calculé par
   `espaceDe` (`web/navigation.js`).
5. **D5 — Pas de simulation dans les listes** : les écrans Éducation et Jeux montrent des cartes d'aperçu qui ouvrent la
   vraie page (Labs, jeu) ; aucun labo ni jeu jouable n'y est intégré.
6. **D6 — Professeur et Contributions** restent des vues de « Mon tableau de bord » (ADR 0031 § 3), ajoutables à la
   navigation par la clé `navigation` de `web/config.json`.
7. **D7 — Catégories de jeux** : nouveau champ de fiche `categorie` (calcul, stratégie, mots), qui alimente des filtres
   dans l'écran Jeux.

8. **D8 — Progression des comptes suivis** (demande du propriétaire du 2026-11-23) : dans l'écran Progression, un
   parent ou un professeur choisit « Moi » ou l'un des comptes qu'il est autorisé à suivre (ses enfants ; ses élèves,
   groupés par classe puis cours particuliers). La progression d'un compte suivi s'affiche **en lecture seule**, à partir
   des bilans bornés déjà reçus (ADR 0029 §4, ADR 0030 §6) : aucune donnée nouvelle n'est demandée ni transmise. Le
   professeur ne voit que les notions de sa matière et pas les badges, comme dans « Mes élèves ». Liste construite par
   `comptesSuivis` (`web/famille.js`).

Hors décision, et écarté : carte de suivi d'audience visible des élèves, connexion Google ou Microsoft des parents,
phrase secrète de synchronisation, sélecteur de profils fictifs hors mode démo, gestionnaires `onclick` dans le HTML.

## Mise en œuvre

Par lots, une PR chacun, dans l'ordre de [docs/chantiers/refonte-ux.md § 8](../chantiers/refonte-ux.md) : jetons et
bandeaux (lot 1), écran d'arrivée (2), Progression (3), Éducation et Labs (4), Jeux (5), Professeur, Famille et
Contributions (6), navigation grand écran (7), passe accessibilité (8).

## Conséquences

- Chaque lot met à jour les squelettes `docs/ux/` et le suivi UX.
- La clé `navigation` de `web/config.json` (ADR 0031) reste la source de l'ordre des entrées, quelle que soit la
  forme de la navigation (barre latérale, onglets ou barre du bas).
- Le lot 7 touche les sélecteurs des tests e2e (`.barre-laterale`, `.nav-mobile`) : il vient en dernier.
