# trigoLab

Laboratoire pédagogique web consacré à la trigonométrie.

## Version initiale

L'application actuelle est un cercle trigonométrique interactif autonome, pensé pour mobile et desktop.

### Fonctions

- déplacement direct du point sur le cercle ;
- souris, tactile, stylet et clavier ;
- angle, radians, cosinus, sinus, tangente et coordonnées synchronisés ;
- valeurs exactes aux angles remarquables ;
- projections x/y et secteur angulaire ;
- aimantation optionnelle ;
- contrôles ±1°, ±5° et ±15° ;
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
