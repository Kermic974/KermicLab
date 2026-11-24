# ADR 0031 — Navigation : ordre configurable et « Mon tableau de bord »

- Date : 2026-11-18 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : la barre latérale s'allongeait avec les entrées liées au compte ou au rôle (Ma famille, Contributions,
  Tableau de bord professeur, Mes classes, Mes élèves), et trois sous-navigations distinctes coexistaient (Profil /
  Mon compte / Espace famille ; Tableau de bord / Mes classes / Mes élèves / Contributions ; écran Contributions sans
  sous-navigation). Le propriétaire demande de **contrôler la position des entrées** et de placer **« Mon tableau de
  bord »** sous l'Accueil par défaut, avec des vues filtrables.

> **Mise à jour (2026-11-23)** : l'ordre par défaut (§ 2) et l'entrée « Mon tableau de bord » sont remplacés par
> l'[ADR 0039 § 3](0039-refonte-ux.md) : cinq destinations, l'avatar « Mon espace » ouvre les vues personnelles.
> La clé `navigation`, les vues et leur barre de filtres (§ 1, 3 à 5) restent valables.

## Décision

1. **Ordre configurable** : la clé `navigation` de `web/config.json` liste les entrées, du haut vers le bas de la barre
   latérale (de gauche à droite dans la barre du bas sur mobile). Identifiants : `accueil`, `tableau-de-bord`,
   `education`, `labs`, `jeux`, `progression`, `profil` (barre du bas seulement), `famille`, `contributions`, `suivi`,
   `classes`, `eleves` (barre latérale seulement pour ces deux derniers). Une entrée absente est retirée de la barre ;
   une entrée liée au rôle n'apparaît que si elle est listée **et** que le compte y a droit. Liste absente ou invalide :
   ordre par défaut. Code : `web/navigation.js` (module pur, `tests/unit/navigation.test.mjs`).
2. **Ordre par défaut** : `accueil`, `tableau-de-bord`, `education`, `labs`, `jeux`, `progression`. Sur mobile, « Mon
   tableau de bord » remplace « Profil » dans la barre du bas (le profil reste accessible par l'avatar de l'en-tête et
   par les filtres), ce qui garde six entrées tactiles de 44 px à 320 px.
3. **Mon tableau de bord** regroupe les écrans personnels en **vues**, choisies dans une barre de filtres commune
   (`#navigation-personnelle`) : Profil, Mon compte, Espace famille (parent), Contributions (contributeur, prof,
   admin), Suivi de classe, Mes classes, Mes élèves (professeur). Chaque filtre suit les mêmes droits que l'ancienne
   entrée de navigation. L'entrée ouvre la dernière vue consultée si elle est encore proposée, sinon « Suivi de classe »
   pour un professeur, sinon le Profil. Les sous-navigations propres aux écrans professeur sont supprimées.
4. Le libellé « Tableau de bord » du professeur devient **« Suivi de classe »** pour ne pas se confondre avec « Mon
   tableau de bord ».
5. Les raccourcis de rôle restent disponibles : il suffit de les ajouter à `navigation` (les tests e2e des raccourcis et
   du panneau « Plus » utilisent cette configuration, `NAVIGATION_RACCOURCIS` de `tests/e2e/outils.mjs`).

## Conséquences

- Changer l'ordre ne demande aucune modification de code : une PR sur `web/config.json`.
- Les adresses existantes (`#profil`, `#compte`, `#contributions`, `#suivi`, `#classes`, `#eleves`…) restent valables ;
  `#tableau-de-bord` ouvre la vue par défaut.
- Piste : rendre l'ordre réglable à chaud depuis le back-office (table `reglages`, ADR 0026), si le besoin se confirme.
