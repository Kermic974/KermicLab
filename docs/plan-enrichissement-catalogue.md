# Plan d'enrichissement du catalogue

Objectif : enrichir chaque notion du catalogue (onglet **Mémo**, exercices, niveaux) sans casser l'existant.
Le gabarit commun supporte désormais un onglet `memo` optionnel (voir [gabarit.md](gabarit.md)).

## Checklist

- [x] Étendre le gabarit : onglet `memo` optionnel (`titresOnglets.memo`, section `memo`)
- [x] Valider la section `memo` dans `scripts/lib/gabarit.mjs`
- [x] Documenter dans `docs/gabarit.md`
- [x] Notion de référence enrichie : `catalogue/pythagore/`
- [ ] Ajouter un mémo aux notions du collège (`angles`, `fractions`, `proportionnalite`, `thales`, …)
- [ ] Ajouter un mémo aux notions du lycée
- [ ] Relire l'exactitude des formules (point de contrôle humain, public mineur)
- [ ] `npm run ci` vert à chaque étape

## Règles

- Un mémo est facultatif : une notion sans `memo` reste inchangée (pas d'onglet affiché).
- Une notion à la fois par PR ; ajouter `memo` dans `onglets` de `fiche.md`.
