# Intégration de cinq laboratoires scientifiques

Cette branche est empilée sur la branche de la PR #430. Elle prépare l’intégration des cinq laboratoires autonomes fournis par le propriétaire du dépôt, sans déclarer leur contenu scientifiquement validé avant revue humaine.

## Laboratoires concernés

1. `kermiclab_laboratoire_de_cin_matique_chute_parabolique.html`
2. `kermiclab_laboratoire_de_g_n_tique_divisions_cellulaires.html`
3. `chute_libre_kermiclab.html`
4. `kermiclab_laboratoire_d_optique_g_om_trique.html`
5. `kermiclab_laboratoire_de_titrage_ph_m_trique.html`

## Identifiants S6 proposés

- `experience.mecanique.cinematique-chute-parabolique`
- `experience.svt.genetique-divisions-cellulaires`
- `experience.mecanique.chute-libre`
- `experience.optique.optique-geometrique`
- `experience.chimie.titrage-ph-metrique`

Les identifiants sont stables et indépendants des noms de fichiers. Chaque objet commence en `draft`. Le passage à `review`, puis à `validated`, exige les preuves prévues par S6.

## 1. Enrichissement pédagogique commun

Chaque laboratoire doit suivre une progression explicite et observable :

1. **Avant l’action** : annoncer l’objectif d’apprentissage, les prérequis, la question scientifique et les grandeurs manipulées.
2. **Prédiction** : demander une hypothèse ou une estimation avant la simulation.
3. **Manipulation guidée** : limiter d’abord les paramètres, fournir une consigne courte et expliciter l’effet attendu sans révéler le résultat.
4. **Investigation libre** : permettre de comparer plusieurs configurations et de conserver un tableau de mesures local à la session.
5. **Confrontation modèle-résultat** : afficher les grandeurs calculées, les unités, les hypothèses et l’écart entre prédiction et simulation.
6. **Institutionnalisation** : proposer une synthèse qui distingue observation, modèle, loi et domaine de validité.
7. **Évaluation courte** : une tâche de transfert, pas seulement la reproduction de la manipulation.
8. **Remédiation** : fournir une aide graduée et une activité plus simple ciblant l’erreur identifiée, sans stocker de profil apprenant dans S6.

### Déclinaison par laboratoire

| Laboratoire | Question directrice | Enrichissement prioritaire | Tâche de transfert |
| --- | --- | --- | --- |
| Chute parabolique | Comment les conditions initiales déterminent-elles la trajectoire ? | prédiction qualitative, décomposition selon les axes, confrontation trajectoire/équations | choisir vitesse et angle pour atteindre une zone cible et justifier |
| Divisions cellulaires | Comment les divisions conservent-elles ou modifient-elles l’information génétique ? | comparaison mitose/méiose, ploïdie, réplication préalable, séparation des chromosomes | expliquer un résultat chromosomique à partir d’une séquence d’étapes |
| Chute libre | Comment la position et la vitesse évoluent-elles dans un champ uniforme ? | tableaux `t`, `v`, `y`, variations de pas de temps, lien graphique/équation | retrouver une grandeur inconnue et discuter les hypothèses |
| Optique géométrique | Comment prévoir la position et la nature d’une image ? | tracé de rayons remarquables, convention de signes visible, comparaison tracé/calcul | déterminer une configuration produisant une image imposée |
| Titrage pH-métrique | Comment déterminer une concentration par équivalence ? | lecture de courbe, méthode des tangentes ou dérivée, unités, stœchiométrie | calculer la concentration inconnue et justifier l’équivalence retenue |

## 2. Contrôle de conformité scientifique

La revue scientifique est une revue de modèle, pas seulement une vérification d’affichage. Pour chaque laboratoire, produire une fiche de revue contenant :

- phénomène réel représenté ;
- système et référentiel ;
- variables d’entrée, de sortie et unités SI ;
- équations ou règles utilisées ;
- hypothèses simplificatrices ;
- domaine de validité ;
- cas limites et invariants ;
- valeurs de référence testées ;
- limites numériques ;
- source institutionnelle ou scientifique ;
- nom, date et décision du relecteur humain.

### Matrice de contrôle minimale

| Laboratoire | Invariants et cas tests à vérifier | Erreurs bloquantes |
| --- | --- | --- |
| Chute parabolique | `x(t)` affine sans frottements, accélération verticale constante, cohérence sommet/temps de vol/portée pour les cas compatibles | signe de `g`, mélange degrés/radians, unités incohérentes, trajectoire indépendante des conditions initiales |
| Divisions cellulaires | réplication avant division, mitose conservant la ploïdie, méiose comportant deux divisions après une réplication, séparation correcte des homologues puis chromatides | création/disparition inexpliquée d’ADN, confusion chromosome/chromatide, brassage présenté comme systématiquement identique |
| Chute libre | accélération constante dans le modèle choisi, cohérence entre position, vitesse et temps, comportement au temps zéro | valeurs impossibles, origine et sens de l’axe non déclarés, absence de domaine de validité |
| Optique géométrique | cohérence des rayons remarquables, relation de conjugaison et grandissement selon une convention de signes explicitée, cas objet au foyer | convention de signes implicite ou changeante, image réelle/virtuelle incohérente, division non gérée au voisinage du foyer |
| Titrage pH-métrique | conservation de matière, stœchiométrie à l’équivalence, monotonicité compatible avec le couple choisi, volumes et concentrations positifs | pH hors domaine physique sans explication, mauvaise stœchiométrie, équivalence confondue avec neutralité, unités absentes |

### Niveaux de verdict

- `ERROR` : contradiction scientifique, unité absente ou incohérente, invariant rompu, cas limite non géré, source introuvable.
- `WARNING` : hypothèse ou domaine de validité insuffisamment visible, précision numérique non documentée, simplification pédagogique acceptable mais non signalée.
- `PASS technique` : tous les contrôles automatisables passent. Ce verdict ne vaut pas validation scientifique humaine.

## 3. Accessibilité visée

Cible d’implémentation : WCAG 2.2 niveau AA, avec équivalence pédagogique des alternatives.

### Exigences communes

- toutes les fonctions disponibles au clavier, sans piège de focus ;
- ordre de focus logique et focus visible ;
- aucune information portée par la couleur seule ;
- contraste du texte conforme et contraste non textuel d’au moins 3:1 pour contrôles, états et graphiques significatifs ;
- pause ou désactivation des animations non essentielles et respect de `prefers-reduced-motion` ;
- valeurs et unités disponibles en texte, pas uniquement dans un canevas ou une animation ;
- messages de résultat annoncés par une région de statut appropriée ;
- libellés, noms accessibles et valeurs exposés pour chaque contrôle ;
- cibles tactiles suffisamment espacées et interface utilisable en zoom et reflow ;
- pas de glisser-déposer obligatoire : fournir sélection puis déplacement par boutons ou clavier ;
- graphiques accompagnés d’un tableau de données et d’une synthèse textuelle ;
- formules proposées sous forme lisible par les technologies d’assistance ;
- mode texte permettant d’atteindre le même objectif pédagogique que le mode visuel.

### Contrat d’interaction accessible

Chaque paramètre manipulable expose : `label`, `value`, `unit`, `min`, `max`, `step`, `description`, et une commande clavier standard. Chaque mise à jour significative produit un résumé textuel concis. Un changement continu ne doit pas déclencher une annonce vocale à chaque frame ; l’annonce est faite à la fin de l’action ou sur demande.

## 4. Préparation de l’intégration au modèle KermicLab

### Découpage recommandé

Un laboratoire S6 compose des expériences plus petites plutôt que de dupliquer tout le contenu dans un seul objet :

- un objet `lab` racine ;
- une `explanation` pour le modèle, les hypothèses et le domaine de validité ;
- une `visualization` pour la représentation et ses alternatives textuelles ;
- une `manipulation` pour les actions autorisées ;
- au moins une `mission` ou `guided-activity` pour l’investigation guidée ;
- un ou plusieurs `exercise` pour les prédictions, calculs et tâches de transfert ;
- une `remediation` ciblée si elle existe réellement dans la source.

Les résultats, tentatives, scores, sauvegardes et profils restent hors S6. Les objets S6 ne contiennent que le contenu préparé, ses objectifs, cibles, sources, interactions et critères de réussite.

### Exemple de squelette `lab`

```json
{
  "id": "experience.mecanique.cinematique-chute-parabolique",
  "type": "lab",
  "version": 1,
  "status": "draft",
  "label": "Cinématique de la chute parabolique",
  "description": "Étudier l’influence des conditions initiales dans le modèle sans frottements.",
  "objective": "Relier conditions initiales, équations horaires et trajectoire dans un champ de pesanteur uniforme.",
  "targets": ["notion-a-resoudre-dans-s4"],
  "provenance": {
    "type": "editorial",
    "references": [{"path": "docs/chantiers/revue-cinq-laboratoires-scientifiques.md", "anchor": "cinematique-chute-parabolique"}]
  },
  "sources": [{"path": "Sample/lab/cinematique-chute-parabolique.html", "anchor": "lab-root", "format": "html"}],
  "components": [
    {"id": "experience.mecanique.cinematique-chute-parabolique-modele", "version": 1},
    {"id": "experience.mecanique.cinematique-chute-parabolique-visualisation", "version": 1},
    {"id": "experience.mecanique.cinematique-chute-parabolique-manipulation", "version": 1},
    {"id": "experience.mecanique.cinematique-chute-parabolique-mission", "version": 1}
  ],
  "parameters": {"path": "Sample/lab/cinematique-chute-parabolique.html", "anchor": "lab-parameters", "format": "html"},
  "interactions": {"path": "Sample/lab/cinematique-chute-parabolique.html", "anchor": "lab-interactions", "format": "html"},
  "limits": {"path": "Sample/lab/cinematique-chute-parabolique.html", "anchor": "lab-limits", "format": "html"},
  "accessibility": {
    "modalities": ["text", "visual", "keyboard", "pointer"],
    "alternatives": [
      {"modality": "visual", "source": {"path": "Sample/lab/cinematique-chute-parabolique.html", "anchor": "lab-text-alternative", "format": "html"}},
      {"modality": "pointer", "source": {"path": "Sample/lab/cinematique-chute-parabolique.html", "anchor": "lab-keyboard-controls", "format": "html"}}
    ]
  }
}
```

Les cibles S4 sont à résoudre à partir du référentiel réel. Aucun ID factice ne doit être fusionné.

### Ancres HTML obligatoires proposées

- `lab-root`
- `lab-objective`
- `lab-prerequisites`
- `lab-model`
- `lab-hypotheses`
- `lab-parameters`
- `lab-interactions`
- `lab-limits`
- `lab-data-table`
- `lab-text-alternative`
- `lab-keyboard-controls`
- `lab-guided-mission`
- `lab-transfer-task`
- `lab-scientific-sources`

## 5. Règles et tests à ajouter

### Contrôles de données

- résolution de tous les `targets` S4 ;
- résolution exacte de tous les composants `{id, version}` ;
- conformité aux schémas S6 fermés ;
- existence et unicité de chaque ancre ;
- interdiction de publier un objet `draft` ;
- présence d’une alternative lorsque `visual`, `pointer`, `motion` ou `webgl` est requis ;
- revue humaine complète avant `validated`.

### Contrôles scientifiques automatisables

Créer des tests déterministes par laboratoire avec valeurs nominales, bornes et cas singuliers. Les fonctions scientifiques doivent être séparées du DOM afin d’être testables sans navigateur. Les tolérances sont justifiées et exprimées avec l’unité.

### Contrôles d’interface

- parcours E2E complet au clavier ;
- vérification des noms accessibles et statuts ;
- zoom 200 % et reflow mobile ;
- mode réduction des animations ;
- équivalence entre graphique et tableau de données ;
- absence de dépendance réseau, collecte et stockage de données personnelles ;
- tests tactiles sur les interactions principales.

## 6. Ordre d’implémentation

1. importer les HTML sans modifier leur comportement ;
2. créer les ancres sémantiques stables ;
3. isoler et tester les fonctions scientifiques ;
4. corriger les erreurs `ERROR` et documenter les `WARNING` ;
5. ajouter le parcours pédagogique commun ;
6. ajouter clavier, alternatives textuelles et tableau de données ;
7. créer les objets S6 et résoudre les cibles S4 ;
8. raccorder catalogue et routage ;
9. exécuter les contrôles complets ;
10. demander une revue scientifique, pédagogique et accessibilité humaine.

## Dépendance

Cette PR doit être relue et fusionnée après la PR #430. Tant que #430 n’est pas fusionnée, la base de comparaison reste sa branche de travail afin de garder un diff limité aux cinq nouveaux laboratoires.

## Contrôles attendus

```bash
npm ci
npm run lint
npm run build
npm run check:pages
npm run check:referentiel
npm run check:experiences
npm run check:artefacts
npm test
npm run test:e2e
npm run ci
```

La relecture pédagogique, scientifique, accessibilité et la validation du CODEOWNER restent obligatoires avant fusion.
