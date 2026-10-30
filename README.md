# trigoLab

Laboratoire pédagogique web consacré à la trigonométrie.

Dépôt : https://github.com/Kermic974/trigoLab

## Version 1.1

Trois modes :

- **Explorer** : manipulation libre du cercle ;
- **Apprendre** : parcours guidé en 8 étapes avec consignes vérifiées automatiquement ;
- **Jouer** : défis « Place le point » et « Quiz des valeurs » avec score, séries, étoiles et record.

L'application est un cercle trigonométrique interactif autonome (un seul fichier `index.html`), pensée pour mobile et desktop. Les versions archivées sont dans `versions/`.

### Fonctions

- déplacement direct du point sur le cercle ;
- souris, tactile, stylet et clavier ;
- angle, radians, cosinus, sinus, tangente et coordonnées synchronisés ;
- valeurs exactes aux angles remarquables ;
- projections x/y et secteur angulaire ;
- aimantation optionnelle ;
- contrôles ±1°, ±5° et ±15° ;
- saisie en degrés (virgule acceptée) ou en radians (`π/3`, `2pi/3`) ;
- axe des tangentes optionnel ;
- repères en degrés ou en radians ;
- angle de référence et explication contextuelle ;
- diagnostic et autotests intégrés ;
- aucune dépendance externe obligatoire.

## Utilisation directe

Ouvrir `index.html` dans un navigateur moderne.

## Développement dans VS Code

Ouvrir `trigoLab.code-workspace`, puis exécuter la tâche `Serveur local` ou la configuration de débogage Edge.

## Test de référence

À 60° :

- radians : π/3 ;
- cos : 0,5 ;
- sin : √3/2 ≈ 0,866025 ;
- tan : √3 ≈ 1,732051 ;
- coordonnées : (0,5 ; 0,866025).

## GitHub Pages

Le workflow dans `.github/workflows/pages.yml` publie la racine du dépôt après validation de la structure HTML.

## Licence

MIT.
