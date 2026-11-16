# Identifiants, cycle de vie et historique

## Identifiants
Pattern général : au moins trois segments séparés par `.` ; segments ASCII minuscules, chiffres et tirets internes. Pas d'espace, accent, underscore, segment vide, double tiret ou tiret terminal.

Namespaces : `notion`, `microskill`, `skill`, `relation`, `curriculum`, `stage`, `domain`, `curriculum-mapping`.

Knowledge Core :
- `notion.<discipline>.<semantic-path>`
- `microskill.<discipline>.<semantic-path>`
- `skill.<discipline>.<semantic-path>`

L'identifiant ne crée aucune relation et ne contient pas de positionnement curriculaire.

## Cycle
Transitions autorisées :
- `draft -> review`
- `review -> draft`
- `review -> validated`
- `validated -> deprecated`

## Références
Une nouvelle référence depuis un objet validated cible uniquement un objet validated. Une référence historique vers une cible devenue deprecated reste résoluble avec WARNING.

## replacedBy
Uniquement sur deprecated. Cible existante, distincte, validated, de même type et namespace compatible. Chaîne acyclique.

## Historique
IDs non réutilisables. Versions strictement croissantes. Pas de réécriture silencieuse. Rupture sémantique = nouvel ID et version 1.
