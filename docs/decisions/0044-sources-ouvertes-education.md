# ADR 0044 — Sources ouvertes de l'Éducation nationale : évaluations nationales et programmes

- Date : 2026-11-24 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : le portail [data.education.gouv.fr](https://data.education.gouv.fr) publie 314 jeux de données (DEPP,
  DGESCO, DNE, Onisep, Pix…), presque tous sous Licence Ouverte 2.0 (Etalab). Le propriétaire demande lesquels servent
  KermicLab et un plan pour les exploiter. Chantier : [sources-ouvertes.md](../chantiers/sources-ouvertes.md).

## Décision

1. **Deux familles retenues**, aucune donnée personnelle ni par établissement :
   - évaluations nationales Repères CP, CE1, CE2, CM1, CM2 (DEPP) : taux de maîtrise **nationaux** par compétence (ligne
     « NATIONAL », population « Ensemble », dernière année) ;
   - programmes d'enseignement du premier et du second degré (DGESCO) : textes en vigueur de l'école, du collège et du
     lycée général et technologique.
2. **Instantanés versionnés** dans `referentiel/sources-ouvertes/` (`evaluations-nationales.json`, `programmes.json`),
   avec la licence, la date d'extraction et l'adresse de chaque jeu. Ils sont produits à la main par
   `npm run sources:importer` (réseau) ; la CI ne les télécharge jamais (déterminisme, CI hors réseau).
3. **Table de correspondance** `correspondances-evaluations.json` : chaque compétence nationale → notions du catalogue
   qui la travaillent. Statut `proposition` tant qu'un humain ne l'a pas relue. Liste vide = compétence sans notion
   (surtout l'oral) : candidate à une issue `maquette-manquante`.
4. **Usage** : un rapport généré, [docs/referentiel/sources-ouvertes.md](../referentiel/sources-ouvertes.md), classe
   les notions par taux de maîtrise (seuil 60 %) pour prioriser l'enrichissement et la relecture, liste les compétences
   sans notion et rattache chaque fiche à son texte officiel. Un test vérifie la table et que le rapport est à jour.
5. **Pas de dépendance** ajoutée : `fetch` de Node, fonctions pures dans `scripts/lib/sources-ouvertes.mjs`.
6. **Écartés** : annuaire et géolocalisation des établissements, IPS, IVAL/IVAC, résultats et effectifs par
   établissement, données RH, budgétaires et d'usage des plateformes. Futur Pro (familles de métiers, utile à l'Espace
   Métiers) attend la vérification de sa licence, non indiquée au catalogue.

## Conséquences

- Les pages du catalogue ne changent pas : aucune version de fiche ne bouge. Les données servent au pilotage (priorités,
  relecture) et pourront nourrir le tableau de bord Professeur (repère national) dans un lot suivant.
- Le jeu « programmes » s'arrête aux textes de 2020-2021 : il ne contient pas les programmes de cycles 1 à 3 publiés en
  2024 ni l'EMC 2024. Pour l'école et le collège, le texte rattaché est l'ancien ; le rapport le signale.
- Réimporter change les instantanés et peut renommer des compétences : le test signale alors les entrées de la table à
  mettre à jour.
- Attribution : le rapport cite le portail et la licence, comme l'exige la Licence Ouverte.
