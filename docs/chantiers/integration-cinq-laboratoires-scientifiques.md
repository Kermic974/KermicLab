# Intégration de cinq laboratoires scientifiques

Cette branche est empilée sur la branche de la PR #430. Elle est destinée à intégrer, dans une PR distincte, les cinq laboratoires autonomes fournis par le propriétaire du dépôt.

## Laboratoires concernés

1. `kermiclab_laboratoire_de_cin_matique_chute_parabolique.html`
2. `kermiclab_laboratoire_de_g_n_tique_divisions_cellulaires.html`
3. `chute_libre_kermiclab.html`
4. `kermiclab_laboratoire_d_optique_g_om_trique.html`
5. `kermiclab_laboratoire_de_titrage_ph_m_trique.html`

## Identifiants proposés

- `laboratoire-cinematique-chute-parabolique`
- `laboratoire-genetique-divisions-cellulaires`
- `laboratoire-chute-libre`
- `laboratoire-optique-geometrique`
- `laboratoire-titrage-ph-metrique`

## Périmètre d’intégration

- conserver des pages HTML autonomes utilisables hors ligne ;
- ajouter les fiches et métadonnées KermicLab ;
- ajouter et vérifier la CSP sans modifier manuellement les fichiers générés ;
- déclarer les expériences S6 de type `lab` avec paramètres, interactions, limites, provenance, accessibilité et cibles ;
- raccorder le catalogue et le routage existants ;
- ajouter les tests de sécurité, métadonnées, routage, interactions principales, mobile et tactile ;
- documenter les limites scientifiques et numériques de chaque simulation ;
- ne pas introduire de dépendance externe ni de collecte de données personnelles.

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

La relecture pédagogique, scientifique et la validation du CODEOWNER restent obligatoires avant fusion.
