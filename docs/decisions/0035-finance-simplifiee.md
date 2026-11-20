# ADR 0035 — Coûts fixes répartis par souscription et Finance simplifiée

- Date : 2026-11-20 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : le sous-module financier (ADR 0031, affiné par l'ADR 0034) répartissait les coûts fixes sur un nombre
  global d'« utilisateurs actifs estimés », sans lien avec les offres. Le propriétaire demande que les coûts fixes soient
  **répartis par souscription, pondérés par les utilisateurs cibles**, et un sous-module **Finance simplifiée** avec des
  graphiques.

## Décision

### 1. Abonnés visés par offre et répartition des coûts fixes

- Nouveau champ `usage.utilisateursCibles` (0 à 10 000 000) par souscription : les **abonnés visés** de l'offre.
  Offres pressenties : Gratuit 150, Solo 25, Parent 20, Professeur 5 (200 au total, l'ancien défaut global).
  Une offre enregistrée avant cet ADR reprend la valeur de l'offre pressentie de même identifiant, sinon 0.
- `repartitionFixes()` (`web/admin/financier.js`) : une offre porte coûts fixes × abonnés visés / total des abonnés
  visés. Chaque abonné porte donc la **même part**, quelle que soit son offre ; « Gratuit » porte sa part, qui devient
  un coût d'acquisition visible.
- `utilisateursEstimes` (hypothèses globales) ne sert plus que de repli si aucune offre n'a d'abonnés visés ; il
  disparaît de l'interface.
- Le prix calculé en mode « marge » dépend de cette part : `decrireSouscription()` reçoit toutes les offres, pour que le
  back-office et « Mon abonnement » affichent le même prix.

### 2. Un module IA n'est chiffré que si l'offre l'inclut

Correctif : `coutVariable()` ne compte le défi généré et les cahiers enrichis que si l'offre inclut `ia.defi` ou
`ia.cahiers` (le tuteur suit `ia.tuteur`). « Gratuit » était chiffré avec 2 cahiers IA par jour, limite du registre,
sans inclure la fonctionnalité : environ 5 $ par abonné gratuit et par mois de coût fictif.

### 3. Finance simplifiée

Bloc de l'écran « Souscriptions », sous la vue comparée. `bilanPortefeuille()` compte le portefeuille à ses abonnés
visés : par offre, chiffre d'affaires HT, coûts variables, coûts fixes alloués, frais de paiement et résultat ; totaux,
taux de marge, **point mort** (abonnés nécessaires, à la même répartition entre offres) et projection du résultat.

- Abonnés visés modifiables dans le bloc et dans l'éditeur (synchronisés) ; tout se recalcule pendant la saisie ;
  « Enregistrer les abonnés visés » écrit les offres modifiées.
- Quatre graphiques : résultat mensuel par offre (barres divergentes bénéfice / perte), coûts mensuels par offre face au
  chiffre d'affaires (barres empilées et repère), répartition des coûts fixes (barres classées), résultat selon le
  nombre d'abonnés (courbe, point mort, réticule au pointeur et aux flèches du clavier).
- Construits par le DOM, sans bibliothèque, sous la CSP du site : barres en HTML (lisibles sur téléphone), courbe en
  SVG ; positions par le CSSOM, jamais d'attribut `style` en ligne. Palette catégorielle validée en clair et en sombre
  (contraste, daltonisme) ; le texte garde les couleurs de texte. Chaque graphique a une **vue tableau**, et
  l'infobulle (survol et focus clavier) n'est jamais le seul accès à une valeur.

## Limites connues

- La répartition est proportionnelle au nombre d'abonnés : pas de poids par offre (un abonné Professeur qui demanderait
  plus de support porte la même part qu'un abonné Solo).
- La projection garde la répartition entre offres constante ; elle ne simule pas un changement de mélange.
- Ce sont des estimations mensuelles sur hypothèses ; ni trésorerie, ni saisonnalité, ni impôts.

## Conséquences

- Aucune migration : le champ vit dans la clé `souscriptions` de `reglages`.
- Action humaine : valider cet ADR et les abonnés visés de chaque offre (`docs/actions-manuelles.md`).
