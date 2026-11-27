# ADR 0044 — Sources ouvertes de l'Éducation nationale : évaluations nationales et programmes

- Date : 2026-11-24 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : le portail [data.education.gouv.fr](https://data.education.gouv.fr) publie 314 jeux de données (DEPP,
  DGESCO, DNE, Onisep, Pix…), presque tous sous Licence Ouverte 2.0 (Etalab). Le propriétaire demande lesquels servent
  KermicLab et un plan pour les exploiter. Chantier : [sources-ouvertes.md](../chantiers/sources-ouvertes.md).

## Décision

1. **Trois jeux retenus**, aucune donnée personnelle ni par établissement :
   - évaluations nationales Repères CP, CE1, CE2, CM1, CM2 (DEPP) : taux de maîtrise **nationaux** par compétence (ligne
     « NATIONAL », population « Ensemble », dernière année) ;
   - programmes d'enseignement du premier et du second degré (DGESCO) : textes en vigueur de l'école, du collège et du
     lycée général et technologique ;
   - calendrier scolaire (DNE) : périodes de vacances des élèves par zone (métropole, Corse, outre-mer).
2. **Instantanés versionnés** dans `referentiel/sources-ouvertes/` (`evaluations-nationales.json`, `programmes.json`,
   `calendrier-scolaire.json`),
   avec la licence, la date d'extraction et l'adresse de chaque jeu. Ils sont produits à la main par
   `npm run sources:importer` (réseau) ; la CI ne les télécharge jamais (déterminisme, CI hors réseau).
3. **Table de correspondance** `correspondances-evaluations.json` : chaque compétence nationale → notions du catalogue
   qui la travaillent. Statut `proposition` tant qu'un humain ne l'a pas relue. Liste vide = compétence sans notion
   (surtout l'oral) : candidate à une issue `maquette-manquante`.
4. **Usage** : un rapport généré, [docs/referentiel/sources-ouvertes.md](../referentiel/sources-ouvertes.md), classe
   les notions par taux de maîtrise (seuil 60 %) pour prioriser l'enrichissement et la relecture, liste les compétences
   sans notion et rattache chaque fiche à son texte officiel. Un test vérifie la table et que le rapport est à jour.
   Le build publie aussi deux fichiers statiques lus par le site :
   - `dist/reperes-nationaux.json` : pour chaque notion, la compétence nationale la moins maîtrisée. « Mes élèves »,
     « Suivi » et l'Espace famille l'affichent à côté des notions à revoir (« repère national CM2 : 38,7 % ») ;
   - `dist/calendrier-scolaire.json` : dans le cahier de vacances, le choix facultatif d'une zone préremplit les dates
     des prochaines vacances. La zone n'est ni conservée ni envoyée au serveur.
5. **Pas de dépendance** ajoutée : `fetch` de Node, fonctions pures dans `scripts/lib/sources-ouvertes.mjs`.
6. **Écartés** : annuaire et géolocalisation des établissements, IPS, IVAL/IVAC, résultats et effectifs par
   établissement, données RH, budgétaires et d'usage des plateformes. Futur Pro (familles de métiers) : licence non publiée au
   catalogue ; l'Espace Métiers est déjà alimenté par l'import ONISEP (ADR 0042, référentiel des métiers).

## Conséquences

- Les pages du catalogue ne changent pas : aucune version de fiche ne bouge. Les données servent au pilotage (priorités,
  relecture), au tableau de bord Professeur et au cahier de vacances.
- Les noms de zones et de périodes de vacances restent en français (contenu du jeu), comme le catalogue.
- Le jeu « programmes » s'arrête aux textes de 2020-2021 : il ne contient pas les programmes de cycles 1 à 3 publiés en
  2024 ni l'EMC 2024. Pour l'école et le collège, le texte rattaché est l'ancien ; le rapport le signale.
- Réimporter change les instantanés et peut renommer des compétences : le test signale alors les entrées de la table à
  mettre à jour.
- Attribution : le rapport cite le portail et la licence, comme l'exige la Licence Ouverte.
