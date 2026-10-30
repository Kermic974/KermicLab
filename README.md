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

## Développement

Le code source est dans `src/`, découpé en modules. `index.html` est **généré** à partir de ces modules : ne le modifiez pas à la main.

```bash
python3 scripts/build-standalone.py     # reconstruit index.html
npm run check                           # tout vérifier avant une PR (aucune installation requise)
```

Le dépôt est organisé pour deux agents aux rôles distincts, **Moteur** (calculs, pédagogie, méthodes) et **Interface** (page, rendu, interactions). Ils suivent un seul jeu d'instructions :

- `AGENTS.md` : règles, rôles, zones, contrat, méthode de travail (chargé par Claude Code via `CLAUDE.md`) ;
- `SPEC.md` : exigences fonctionnelles numérotées ;
- `ARCHITECTURE.md` : organisation du code, contrat des méthodes de résolution, construction et tests.

Dans VS Code : ouvrir `trigoLab.code-workspace`, puis lancer les tâches « Construire », « Tout vérifier » ou « Serveur local ».

## Test de référence

À 60° :

- radians : π/3 ;
- cos : 0,5 ;
- sin : √3/2 ≈ 0,866025 ;
- tan : √3 ≈ 1,732051 ;
- coordonnées : (0,5 ; 0,866025).

## GitHub Pages

Le workflow `.github/workflows/pages.yml` valide chaque PR : livrable à jour, frontières entre agents, tests, structure HTML. Après une fusion dans `main`, il publie la racine du dépôt.

## Licence

MIT.
