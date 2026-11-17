# ADR 0021 — Navigation en 5 destinations, temps actif local et découverte générique

- Date : 2026-11-06 — Statut : proposé (à valider par le propriétaire)
- Contexte : le tableau de bord avait accumulé une dizaine d'entrées de navigation (Accueil, Labs, Jeux, Notions,
  Mes cahiers, Défi, Progression, Mes trophées, Configuration, Signaler…), un accueil de huit blocs, des jeux rangés
  comme une « matière » du catalogue, une collection de trophées grisés pour des modules jamais lancés, et aucune
  mesure du temps passé. Le propriétaire demande une architecture Accueil / Éducation / Jeux / Progression / Profil,
  une progression qui grandit avec l'usage, un temps actif fiable et un modèle de découverte générique (aucune
  logique propre à un jeu).
- Décision :
  1. **Cinq destinations** accessibles en un geste. Profil s'ouvre via la carte de compte en bas de la barre
     latérale ; la barre mobile conserve son onglet Profil. Une seule destination visible est marquée `aria-current="page"`. Le défi express est un sous-écran
     d'Éducation, l'Espace famille un sous-écran de Profil. Les anciennes adresses (`#labs`, `#notions`,
     `#catalogue`, `#cahiers`, `#badges`) sont redirigées vers leur destination.
  2. **Éducation** construit l'arbre Niveau › Matière › Notions à partir des seules métadonnées du catalogue
     (`niveau`, catégorie du `sujet`) ; accordéons sur de vrais boutons (`aria-expanded`, `aria-controls`), fermés
     par défaut. **Jeux** liste les entrées de la catégorie `jeux/` du catalogue ; leur résumé vient d'un champ
     facultatif `resume` de la fiche, exposé par `/api/catalogue` seulement s'il existe.
  3. **Temps actif** : une seule source, `web/temps-actif.js` (logique pure, horloge injectée). Un instant compte si
     la page est visible et qu'une interaction a eu lieu depuis moins de **60 s** (`SEUIL_INACTIVITE_MS`) ; une page
     cachée suspend le compte, qui reprend à la prochaine interaction. Chaque intervalle est attribué une fois au
     total, et ventilé (jamais additionné) par section et par expérience. Les pages ouvertes en bulle (iframe
     sandboxée, interactions invisibles du parent) envoient `{ type: "kermiclab:activite" }` au plus toutes les 10 s
     (`web/signal-activite.js`, injecté au service comme la boîte à idées) ; le parent n'accepte que la fenêtre d'une
     iframe connue. Enregistrement local toutes les 15 s et à la fermeture ; **aucun appel réseau**.
  4. **Découverte générique** : `decouvertes[type][id] = { premiere, ouvertures }` pour tout type (section, matière,
     notion, jeu…). Le type d'une expérience est dérivé du catalogue (`web/experiences.js`) : aucune liste dupliquée,
     aucun `if` sur un contenu particulier. Les statistiques d'une expérience (ouvertures, temps, chiffres de son
     module de trophées) ne s'affichent que si elles existent.
  5. **Schéma de progression v2**, migration non destructive : les champs v1 sont conservés tels quels ; les notions
     v1 deviennent des découvertes sans date ni ouverture inventées ; un jeu enregistré autrefois comme notion est
     reclassé d'après le catalogue (XP et badges conservés). Seules les notions sont synchronisées pour un profil
     enfant (`{ notions: { id: {} } }`) ; temps et découvertes restent sur l'appareil.
  6. **Progression** : compteurs non nuls seulement, progression par matière sans pourcentage (dénominateur = notions
     publiées), expériences découvertes, et « Mes badges » limité aux badges obtenus, aux deux plus proches et aux
     modules réellement lancés. État vide explicite tant qu'il n'y a rien de réel à montrer.
- Conséquences : un test e2e de la collection de trophées « visible avant de jouer » (PR #138) est remplacé par son
  inverse ; `dist/trophees.json` reste produit mais n'est plus chargé par le tableau de bord. Le lien « Je participe »
  quitte la barre mobile (il reste dans le pied de la barre latérale et dans Profil). Badge « Explorateur » : première
  page interactive, notion ou jeu.
- Limites : les statistiques internes d'un jeu (victoires, record…) ne sont visibles que si le jeu publie un
  instantané de trophées ; il n'existe pas de contrat d'événements de jeu. Le temps passé dans une page ouverte
  depuis le fil du chat est compté pour la section courante, pas pour l'expérience. Résumés des jeux en français.
- English summary: five destinations (Home, Education, Games, Progress, Profile) with identical desktop and mobile
  navigation; Education is built from catalogue metadata; one pure, injectable-clock active-time engine (visible page +
  interaction within 60 s, paused when hidden, embedded pages send a content-free activity ping); a generic
  type/id discovery model derived from the catalogue; a non-destructive v2 progress schema; Progress grows with real
  usage and shows only launched modules. Time and discoveries never leave the device.
- Références : ADR 0012, ADR 0013, ADR 0015, ADR 0017, `docs/progression.md`.

## Complément (2026-11-07)

Les comptes de rôle contributeur, prof ou admin voient une sixième entrée « Contributions » (barre latérale et barre du bas), décrite par l'ADR 0023 §6 bis. Les cinq destinations restent identiques pour tous les autres profils.

## Complément (2026-11-16) : écran Profil unique et « À propos »

- **Un seul écran Profil.** La fenêtre « Ton profil » est supprimée : la carte du profil (barre latérale) et l'avatar
  mobile mènent à l'écran Profil, comme l'entrée « Profil » de la navigation. Le pseudo, « Se souvenir de moi », le
  type de profil et l'effacement des données s'y modifient sur place. L'écran est découpé en quatre blocs : Identité,
  Compte et accès, Configuration, Mes données (choix de la mesure d'audience, ADR 0027, et effacement). La fenêtre du
  premier lancement (choix du pseudo) est inchangée.
- **« À propos »** (`#apropos`) regroupe ce qui parle du site et non de l'élève : feuille de route, équipe, blog,
  participer, confidentialité, mentions légales, signaler un problème et les détails techniques de l'IA (lecture
  seule). C'est un **sous-écran de Profil**, pas une sixième destination : les cinq destinations restent identiques
  sur ordinateur et sur mobile. On l'ouvre depuis le bas de la barre latérale (à la place de « L'équipe »), le pied de
  page et le bas de l'écran Profil. « Je participe » garde son bouton dans la barre latérale.
- **Lien vers le back-office** : affiché dans « Compte et accès » seulement si le Worker indique, dans `/auth/me`
  (`compte.backOffice`), que le rôle du compte connecté a au moins une permission `admin.*` (`worker/src/roles.js`,
  rôles système ou surchargés dans le back-office). Le navigateur ne déduit rien du nom du rôle ; un compte de
  démonstration ne l'obtient jamais. Le lien n'ouvre aucun droit : le back-office reste fermé sans sa clé
  (ADR 0026). Tant que `connexionActive` vaut false, il n'apparaît chez personne.

## Complément (2026-11-17) : Labs redevient une destination

À la demande du propriétaire, les Labs ont leur propre entrée de navigation (`#labs`), entre Éducation et Jeux, sur
ordinateur et sur mobile : la navigation compte désormais **six destinations** (sept avec Contributions pour les
rôles concernés). L'écran Labs porte la carte du cercle trigonométrique (ses trois modes et le mini-lab) et un lien
« Consulter les Notions ». Dans Éducation, la carte du cercle ne lance plus rien : son bouton « Voir dans les Labs »
renvoie vers la section Labs. L'adresse `#labs` n'est plus un alias d'Éducation ; l'action « labs » proposée par
l'assistant ouvre la section Labs. Les libellés de la barre mobile sont resserrés sous 380 px pour tenir à 320 px.

English summary: Labs is a navigation destination again (six destinations); the Education card for the unit circle
now only links to the Labs section, which hosts the Lab's three modes and the mini-lab.

## Complément (2026-11-17) : entrées liées au compte et « Plus » sur mobile

Trois entrées s'ajoutent aux six destinations selon le compte et le rôle : « Ma famille » (compte local lié : Espace
famille pour un parent, sinon le bloc Famille de « Mon compte »), « Contributions » (rôle contributeur, prof ou admin,
ADR 0023) et « Suivi » (rôle Professeur, ADR 0030). Dans la barre latérale, elles s'affichent toutes. Dans la barre du
bas, au-delà de **sept entrées**, une entrée passerait sous 44 px à 320 px de large : une seule entrée liée au compte
reste dans la barre ; à partir de deux, elles sont regroupées sous **« Plus »** (septième entrée), qui ouvre un panneau
au-dessus de la barre (Échap, un clic ailleurs ou un choix le referment) et porte la page courante quand elle s'y trouve.

English summary: account- and role-based entries (My family, Contributions, Teacher) are always in the sidebar; on
mobile, two or more of them are grouped under a "More" entry so the bottom bar keeps seven 44 px targets at 320 px.
