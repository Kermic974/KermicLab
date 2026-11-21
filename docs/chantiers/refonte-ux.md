# Refonte UX/UI — analyse de la maquette « revisitée »

Maturité : **lot 1 livré**. Décisions D1 à D7 validées le 2026-11-21 ([ADR 0038](../decisions/0038-refonte-ux.md)).
Lot 1 (jetons et bandeaux) : bandeau d'en-tête coloré par espace (`data-espace`, `espaceDe` de `web/navigation.js`),
cartes de chiffres avec libellé au-dessus et liseré de l'espace. Prochain : lot 2, écran d'arrivée unifié.

## 1. Objet et sources

- Maquette reçue le 2026-11-21 : page HTML autonome (1 270 lignes, sans dépendance externe), écrans Dashboard,
  Progression (avec Espace famille), Éducation (avec mini-labo Système solaire), Jeux (avec un 2048 jouable),
  Professeur, Contributions, Profil, encart « Local-First ». Elle n'est pas versionnée dans le dépôt.
- Comparée à `main` au commit `f0a251b` : `web/index.html` (1 636 lignes), `web/app.js` (7 248), `web/style.css`
  (1 313), 1 494 clés i18n par langue, catalogue de 290 notions et 9 jeux, squelettes `docs/ux/`.
- Captures de la maquette à 390 px et 1 366 px (Chromium). Le site en production n'a pas été consulté.

## 2. Synthèse

La maquette apporte surtout une **identité visuelle par espace** et un **vrai tableau de bord** : notre entrée « Mon
tableau de bord » (ADR 0031) n'est aujourd'hui qu'une barre de filtres vers Profil, Mon compte, Famille, Contributions
et Professeur, sans aucun contenu de synthèse. Ces deux idées méritent d'être reprises.

En revanche, sa **navigation en onglets en haut** ne tient pas sur mobile (§ 5), plusieurs éléments **contredisent des
décisions du projet** (§ 4), et elle ignore le thème sombre, la traduction et les états vides ou d'erreur. Une refonte
complète est faisable par lots, mais elle touche le cœur de l'application (`app.js`, 146 références à la navigation
dans 13 fichiers de tests e2e) : elle doit partir d'un ADR et d'une maquette corrigée.

## 3. Comparaison écran par écran

| Écran | Maquette | Existant | Recommandation |
|---|---|---|---|
| En-tête et navigation | Logo, 7 onglets en pastilles, sélecteur de profils (Léo, Maya, Invité, Famille, Prof) | Barre latérale ordonnable par `web/config.json` (ADR 0031), barre du bas sur mobile (6 entrées de 44 px), pastilles série, niveau, XP, thème et langue en en-tête | Garder la barre latérale (ou la remplacer par des onglets **sur grand écran seulement**) et la barre du bas sur mobile. Pas de sélecteur de profils : les rôles viennent du compte |
| Dashboard | Bandeau d'accueil, 4 cartes de chiffres (XP, notions, jeux, suivi), journal d'activité, accès rapides colorés | Accueil : question, Reprendre, Suggestion, À la une, Parcours, aperçu de progression. « Mon tableau de bord » : filtres seulement | **Fusionner** : un seul écran d'arrivée qui reprend le bandeau, les cartes de chiffres (sans la carte « Suivi »), Reprendre et Suggestion, et un journal construit à partir des Découvertes existantes |
| Progression | Anneau d'XP, pastilles série, notions, jeux, carte « Reprise conseillée », avancement par matière filtré par niveau, barres 7 jours, badges à portée | Vue d'ensemble (compteurs), matières, semaine en graphique, découvertes, Mes trophées, fichier de progression | Reprendre l'anneau d'XP, le filtre par niveau sur les matières et les « badges à portée » (trophées les plus proches). Le reste existe déjà |
| Espace famille | Bandeau sarcelle dans Progression, cartes enfants, connexion Google ou Microsoft | Écran Espace famille (ADR 0029) dans Mon tableau de bord, comptes locaux, bilans bornés | Reprendre la mise en forme des cartes enfants et la couleur. **Pas** de connexion Google ou Microsoft |
| Éducation | Bandeau avec recherche, liste de notions, mini-labo Système solaire intégré, carnets locaux | Ma classe (CM1 à terminale), Niveau › Matière › Notions, défi express, renvoi vers les Labs, Mes cahiers | Reprendre le bandeau avec recherche et la colonne de droite (défi, cahiers). Le labo reste dans Labs : une carte d'aperçu qui y renvoie, pas un simulateur intégré |
| Labs | Absent (labo dans Éducation) | Écran Labs : cercle trigonométrique, Système solaire, mini-lab | Garder l'écran, lui appliquer le bandeau violet de la maquette |
| Jeux | Bandeau ambre, filtres par catégorie, cartes, 2048 jouable à droite | Recherche, grille de 9 jeux, Académie et trophées par jeu | Reprendre bandeau et filtres par catégorie (nouveau champ de fiche). Le 2048 jouable n'a pas d'intérêt pédagogique et doublonne la page du jeu : à écarter |
| Professeur | Bandeau indigo, tableau de classe, « Projeter un défi », revue pédagogique | Suivi de classe, Mes classes, Mes élèves (ADR 0030), activités assignées ; relecture dans Contributions | Reprendre bandeau et tableau compact. « Projeter un défi » correspond aux activités assignées existantes |
| Contributions | Formulaire, aperçu Avant / Après | Formulaire par champ du `contenu.json`, suivi, relecture (ADR 0023) | Reprendre l'aperçu Avant / Après côte à côte, qui manque aujourd'hui |
| Profil | Bandeau, pseudo, « Rester connecté », effacement, phrase secrète, raccourcis de rôle | Profil (pseudo, mémoire, effacement), Mon compte (compte local, clé de synchronisation, kit, famille, abonnement) | Reprendre la mise en page en deux colonnes. Remplacer la phrase secrète par la clé de synchronisation actuelle |
| Encart Local-First | Export JSON en pied de chaque écran | Fichier de progression (export et import) dans Progression | Garder l'emplacement actuel ; l'encart en pied de chaque écran alourdit tout |

## 4. Éléments incompatibles avec les règles du projet

1. **Mesure d'audience** : la carte « Suivi & Conversions : Actif · GTM-KCSF7G6G » montre un identifiant de mesure à
   des élèves et présente un suivi actif par défaut. ADR 0027 : Google Analytics ne se charge qu'après accord explicite,
   jamais dans les pages du catalogue. La carte est à supprimer.
2. **Connexion Google ou Microsoft pour les parents** : contraire au choix des comptes locaux sans donnée personnelle
   (ADR 0024, 0029) et au principe « public mineur » d'AGENTS.md.
3. **Phrase secrète de synchronisation** : méthode v1 remplacée par la clé de synchronisation et le kit de récupération.
4. **Sélecteur de profils fictifs** : utile pour une démonstration, mais les rôles réels viennent du compte et du
   back-office (ADR 0034). À réserver au mode démo existant (`?demo=…`).
5. **Gestionnaires `onclick` dans le HTML** : bloqués par la CSP du site (pas de `'unsafe-inline'`). Tout doit passer
   par `app.js`.
6. **Textes en dur** : contraire à la règle i18n (clés dans `web/i18n/fr.json` et `en.json`, parité vérifiée par le lint).

## 5. Défauts de la maquette elle-même

- **Mobile** : à 390 px, l'en-tête fixe mesure **232 px sur 844** (27 % de l'écran) car les 7 onglets et les 5 profils
  passent sur plusieurs lignes. **19 boutons sur 21** font moins de 44 px de haut (cible tactile recommandée).
- **Chiffres en dur et périmés** : « 165 notions », « 9 matières » ; le catalogue compte 290 notions dans 14 matières,
  primaire compris. Tout chiffre doit venir du catalogue.
- **Pas de thème sombre** alors que le site en a un, ni de thèmes de charte (ADR 0026, `web/theme.js`).
- **Aucun état vide, de chargement ou d'erreur** (catalogue indisponible, première visite, compte sans rôle).
- **Émojis comme seules icônes** dans la navigation : rendu inégal selon les systèmes, lecture bruyante par les
  lecteurs d'écran. Le site utilise un sprite SVG avec `aria-hidden`.
- **Langue mêlée** : « Dashboard », noms de planètes en anglais (« Earth (La Terre) »).
- **Niveaux incomplets** : filtres Collège / Première / Terminale, sans primaire ni Seconde, et « Collège » non découpé
  alors que le site propose déjà CM1 à 3e.

## 6. Coût et risques d'une refonte complète

- `web/app.js` concentre la navigation, les écrans et leurs états (7 248 lignes) ; `web/navigation.js` porte l'ordre
  configurable. Changer la structure de navigation touche les deux.
- 13 fichiers de tests e2e et 146 sélecteurs ciblent `.barre-laterale` ou `.nav-mobile` ; les squelettes `docs/ux/` et
  `docs/ux/suivi.json` sont contrôlés par `tests/e2e/ux.test.mjs`.
- Adresses à préserver : `#education`, `#progression`, `#profil`, `#compte`, `#contributions`, `#suivi`, `#tableau-de-bord`
  et les alias (`#catalogue`, `#badges`…), utilisées par les liens existants.
- Clé `navigation` de `web/config.json` (ADR 0031) : à conserver ou à remplacer explicitement par l'ADR de refonte.

## 7. Décisions à prendre (propriétaire)

| # | Question | Recommandation |
|---|---|---|
| D1 | Navigation sur grand écran : barre latérale ou onglets en haut ? | Onglets en haut possibles au-delà de 1 024 px, à condition de rester sur une ligne (6 destinations au plus) ; barre latérale sinon |
| D2 | Navigation mobile | Garder la barre du bas (6 entrées de 44 px, panneau « Plus ») |
| D3 | Accueil et « Mon tableau de bord » | Fusionner en un écran d'arrivée unique ; les vues personnelles restent accessibles par l'avatar et la barre de filtres |
| D4 | Couleur par espace (Éducation bleu, Labs violet, Jeux ambre, Famille sarcelle, Professeur indigo) | Oui, en jetons CSS clairs et sombres, contraste AA vérifié par `web/theme.js` |
| D5 | Labo et jeu jouables dans les écrans de liste | Non : cartes d'aperçu qui ouvrent la vraie page |
| D6 | Professeur et Contributions en onglets de premier niveau | Non par défaut (ADR 0031 § 3) ; possible par `navigation` pour les comptes concernés |
| D7 | Catégories de jeux | Oui, nouveau champ de fiche (`categorie` : calcul, stratégie, mots) |

## 8. Plan proposé, par lots (une PR chacun, CI verte, suivi UX mis à jour)

0. **ADR 0038** reprenant D1 à D7, et maquette corrigée versionnée dans `docs/ux/` (squelette « refonte »).
1. ✅ **Jetons et bandeaux** : palette par espace (clair et sombre), bandeau d'en-tête par écran, cartes de chiffres. Style
   seulement, aucune structure changée.
2. **Écran d'arrivée unifié** (D3) : bandeau, 3 cartes de chiffres, Reprendre et Suggestion, journal depuis les
   Découvertes, accès rapides. Redirection de `#accueil` et `#tableau-de-bord`.
3. **Progression** : anneau d'XP, filtre par niveau des matières, trophées « à portée ».
4. **Éducation et Labs** : recherche dans le bandeau, colonne de droite (défi, cahiers, aperçu du labo qui renvoie
   vers Labs).
5. **Jeux** : champ `categorie` des fiches, filtres, bandeau.
6. **Professeur, Famille, Contributions** : tableau compact, cartes enfants, aperçu Avant / Après.
7. **Navigation grand écran** (D1), si retenue : en dernier, une fois les écrans stabilisés, pour limiter la reprise des
   tests e2e.
8. **Passe finale** : accessibilité (cibles 44 px, contrastes, lecteurs d'écran), 320 px, thème sombre, anglais.
