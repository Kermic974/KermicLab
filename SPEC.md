# Spécification trigoLab v0.0

## Vision

Créer une application pédagogique interactive de trigonométrie où le graphique et toutes les valeurs restent synchronisés.

## Invariant principal

Toutes les entrées modifient une seule valeur d'état et déclenchent le même rendu :

```text
interaction → setAngle() → calculs → SVG + tableau + contrôles
```

## Mathématiques

```text
radians = degrés × π / 180
x = cos(θ)
y = sin(θ)
P = (cos θ, sin θ)
tan(θ) = sin(θ) / cos(θ)
```

La tangente est non définie lorsque cos(θ) ≈ 0.

## Test de référence 60°

```text
θ = 60°
radians = π/3
cos = 1/2 = 0,5
sin = √3/2 ≈ 0,866025
tan = √3 ≈ 1,732051
P = (0,5 ; 0,866025)
```

## Interactions

- toucher et drag ;
- souris/stylet via Pointer Events ;
- clavier ;
- slider ;
- saisie directe ;
- incréments ;
- angles remarquables ;
- aimantation optionnelle.

## Accessibilité

- focus visible ;
- contrôle SVG exposé comme slider ;
- aria-live ;
- contrôles tactiles confortables ;
- prefers-reduced-motion.

## Roadmap

- v0.0 : socle interactif autonome ;
- v0.1 : stabilisation et tests DOM étendus ;
- v0.2 : mode pédagogique enrichi ;
- v0.3 : PWA et fonctionnement hors ligne ;
- v1.0 : version stable — livrée (saisie en radians, axe des tangentes, repères en radians, corrections).
