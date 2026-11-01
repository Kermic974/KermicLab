# Spécification fonctionnelle trigoLab

Ce document est **la seule source des exigences fonctionnelles**. Les deux agents (Moteur et Interface, voir `AGENTS.md`) travaillent à partir de lui. Chaque exigence porte un identifiant à citer dans les commits, les tests et les PR. Le *comment* (organisation du code) est décrit dans `ARCHITECTURE.md`.

Légende du responsable : **M** = Moteur, **I** = Interface, **M+I** = les deux.

## Vision

Une application pédagogique et ludique de trigonométrie où le cercle, les valeurs et les contrôles restent toujours synchronisés. Elle tient dans un seul fichier HTML qui s'ouvre sans serveur ni connexion.

## Invariant principal

```text
interaction → setAngle() → moteur de calcul → rendu (SVG + valeurs + contrôles)
```

| ID | Exigence | Resp. |
|---|---|---|
| F-01 | Une seule valeur d'angle dans l'état central ; aucune vue ni méthode ne garde sa propre copie. | M+I |
| F-02 | Toutes les valeurs affichées viennent du moteur de calcul ; aucune vue ne recalcule cos, sin ou tan. | M+I |
| F-03 | Le livrable `index.html` fonctionne ouvert directement depuis le disque, sans dépendance externe. | I |

## Mathématiques

```text
radians = degrés × π / 180
P = (cos θ ; sin θ)
tan θ = sin θ / cos θ, non définie lorsque cos θ = 0
```

| ID | Exigence | Resp. |
|---|---|---|
| M-01 | L'angle d'état est dans [0 ; 360]. 360 n'est conservé que s'il est demandé explicitement (saisie, curseur, touche Fin) ; sinon il devient 0. | M |
| M-02 | La normalisation n'ajoute aucun bruit flottant (12,3 reste 12,3). | M |
| M-03 | Valeurs exactes pour les 16 angles remarquables (multiples de 30° et de 45°) et pour 360°. | M |
| M-04 | La tangente vaut `null` quand cos θ = 0 (90°, 270°) ; l'affichage indique « non définie ». | M+I |
| M-05 | L'angle de référence est l'angle aigu entre le rayon et l'axe des abscisses (120° → 60°, 210° → 30°, 300° → 60°). | M |
| M-06 | Les nombres s'affichent à la française : virgule décimale, signe moins typographique « − », 6 décimales au plus. | M |

### Cas de référence 60°

```text
θ = 60°          radians = π/3
cos = 1/2 = 0,5  sin = √3/2 ≈ 0,866025  tan = √3 ≈ 1,732051
P = (0,5 ; 0,866025)
```

Saisies de référence communes à toutes les méthodes : `0, 30, 45, 60, 90, 120, 135, 150, 180, 270, 360, -30, 390, π/3, 2π/3, 22,5, 137,5`.

## Saisie et interactions

| ID | Exigence | Resp. |
|---|---|---|
| E-01 | Saisie en degrés (`45`, `22,5`, `−30°`) ou en multiples de π (`π/3`, `2pi/3`, `-π`), virgule acceptée. | M |
| E-02 | Une saisie vide ou invalide ne change pas l'angle et est signalée (`aria-invalid`, message d'aide). | I |
| E-03 | Le point se déplace à la souris, au doigt et au stylet (Pointer Events), y compris en glissant. | I |
| E-04 | Un appui dans la zone centrale (angle indéfini) est ignoré ; le clic droit aussi. | I |
| E-05 | Aimantation facultative à ±3° des angles remarquables. | I |
| E-06 | Curseur 0–360°, incréments ±1°, ±5°, ±15°, boutons des 16 angles remarquables. | I |
| E-07 | Clavier sur le cercle : flèches ±1° (Maj : ±5°), Page précédente/suivante ±15°, Début 0°, Fin 360°. | I |

## Affichage

| ID | Exigence | Resp. |
|---|---|---|
| A-01 | Valeurs affichées : angle, radians, cos, sin, tan, signes, angle de référence, coordonnées ; valeur exacte quand elle existe, sinon « valeur approchée ». | I |
| A-02 | Options : projections x/y, repères remarquables, repères en radians, axe des tangentes (point T = (1 ; tan θ)). | I |
| A-03 | Explication contextuelle fournie par la méthode géométrique (quadrant, projections, angle de référence, tangente). | M+I |
| A-04 | Le panneau « Ce que montre cet angle » propose de choisir la méthode parmi celles du mode courant. Il affiche ses étapes numérotées et ses avertissements. Le choix est conservé en changeant d'angle et de mode. Les valeurs du panneau « Valeurs » ne changent jamais selon la méthode. | I |

## Modes

| ID | Exigence | Resp. |
|---|---|---|
| D-01 | Trois modes en onglets : Explorer, Apprendre, Jouer. Chaque mode n'affiche que ses panneaux. | I |
| D-02 | Apprendre : 8 étapes (cercle unité, cosinus, sinus, cos² + sin² = 1, quadrants et signes, symétries, tangente, radians), chacune avec une consigne vérifiée automatiquement. Une consigne n'est jamais remplie dès l'ouverture de l'étape et reste toujours réalisable. | M (contenu, vérification) · I (affichage) |
| D-03 | Jouer, « Place le point » : 8 questions de difficulté croissante (θ en radians, puis cos/sin avec signe, puis tan avec signe) ; chaque énoncé désigne un seul angle ; pas de répétition dans une partie. Barème : ≤ 1,5° → 100, ≤ 5° → 70, ≤ 10° → 30. | M |
| D-04 | Jouer, « Quiz des valeurs » : 8 questions, 4 propositions distinctes dont la bonne, pièges pédagogiques (opposé, valeur échangée), explication après chaque réponse ; point verrouillé pendant le quiz. | M (questions) · I (verrouillage) |
| D-05 | Score, série, étoiles (85 % → 3, 55 % → 2, 25 % → 1, seuils inclus) et record conservé dans le navigateur (perte sans erreur si le stockage est indisponible). | M (barème) · I (record) |

## Méthodes de résolution

| ID | Exigence | Resp. |
|---|---|---|
| S-01 | Chaque méthode respecte le contrat commun (`ARCHITECTURE.md` § Contrat de solution) et donne le même résultat numérique que le moteur sur toutes les saisies de référence. | M |
| S-02 | Une méthode ne modifie jamais l'état ni son contexte. | M |
| S-03 | Méthode disponible : géométrique. Prévues : algébrique, tabulaire, puis un mode Comparer. | M+I |

## Accessibilité

| ID | Exigence | Resp. |
|---|---|---|
| X-01 | Focus visible, cercle exposé comme `slider` avec `aria-valuenow` et `aria-valuetext`. | I |
| X-02 | Annonces `aria-live` après une action volontaire (pas pendant le glissement ni en mode Jouer). | I |
| X-03 | Cibles tactiles d'au moins 44 px, pas de défilement horizontal de 360 px à 1 400 px. | I |
| X-04 | `prefers-reduced-motion` désactive transitions et animations. | I |

## Qualité

| ID | Exigence | Resp. |
|---|---|---|
| Q-01 | La page exécute ses autotests au démarrage et affiche le résultat (badge et diagnostic). | M+I |
| Q-02 | `npm run check` (ou les quatre commandes équivalentes, voir `AGENTS.md`) passe avant toute fusion. | M+I |

## Feuille de route

- v0.0 : socle interactif autonome — livrée ;
- v0.1 : stabilisation et tests DOM étendus — livrée (`versions/v0.1`) ;
- v1.0 : version stable (radians, axe des tangentes, corrections) — livrée ;
- v1.1 : orientation éducative et récréative (Explorer, Apprendre, Jouer) — livrée ;
- v1.2 : architecture à deux agents, sources modulaires, livrable généré — livrée ;
- v1.3 : méthode algébrique et sélecteur de méthode ;
- v1.4 : mode Comparer ;
- v2.0 : PWA et fonctionnement hors ligne.
