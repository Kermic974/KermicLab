# Audit des compétences et des liens du référentiel

Audit automatique des MicroSkills et relecture des liens créés lors de la mise en canonique. Les constats corrigés sont indiqués ; ceux qui demandent une décision sont listés à la fin.

## Résultat de l'audit des compétences

- **1 962 MicroSkills** actives. Chaque notion en compte 3 à 5 (aucune moins de 3, aucune plus de 6), aucun libellé trop court ou trop long.
- **Libellés** : la forme « verbe d'action + objet précis » est respectée. Aucun verbe interdit (`connaître`, `comprendre`, `maîtriser`, `étudier`, `savoir`) ne subsiste dans les libellés des matières hors mathématiques après correction ; les verbes dominants sont distinguer, expliquer, identifier, calculer, décrire, analyser.
- **Mathématiques V0 (legacy)** : **113 libellés** étaient en minuscules et sans accents (« calculer une integrale », « etudier la fonction carre »). Ils sont corrigés (« Calculer une intégrale », « Étudier la fonction carré ») ; `status` et provenance inchangés, version incrémentée. Les verbes `étudier` des libellés de variations (fonctions de référence, suites, trinôme) sont conservés par prudence : la relecture mathématique décidera d'un remplacement par « analyser » ou « déterminer ».
- **4 libellés reformulés** dont le verbe était interdit (`comprendre` et `étudier` remplacés par exécuter, suivre, analyser, déterminer).

## Skills et justifications

- **259 Skills** : le libellé générique « Mobiliser les acquis de « titre » » est remplacé par un libellé observable propre à la notion (par exemple « Calculer le périmètre et l'aire de figures usuelles »).
- **365 justifications de liens** : le texte générique « Prérequis déclaré dans la fiche » est remplacé par une justification propre à la notion source. Les liens de **continuité chronologique** (histoire du cycle 3 surtout) l'indiquent explicitement : « Progression chronologique du programme (lien de continuité du parcours, pas un prérequis conceptuel strict) ».

## Qualité des QCM des notions ajoutées (cycles 2 à lycée)

Mesure sur **1 231 QCM** : la bonne réponse est la plus longue dans **39 %** des cas (43 % avant ; le hasard donne environ 25 à 30 %). Les écarts nets (bonne réponse au moins 1,4 fois plus longue que le plus long distracteur) passent de **100 à 24** : **78 QCM** ont été réécrits (distracteurs allongés, bonne réponse raccourcie, sens inchangé). Les 24 restants sont des noms propres ou des nombres (Gutenberg, 300 000 km/s, configurations électroniques) dont la longueur est imposée. Aucun doublon de choix. La version patch des 52 notions concernées est incrémentée.

## Constats à arbitrer (non modifiés)

1. **Liens chronologiques en histoire (cycle 3)** : la chaîne `gaulois-gallo-romains-cm` → `clovis-charlemagne-cm` → `louis-ix-cm` → `francois-ier-cm` → `henri-iv-cm` → `louis-xiv-cm` → `revolution-empire-cm` → `age-industriel-cm` → `republique-ecole-cm` → `guerres-mondiales-cm`, et sa suite en 6e et 5e, suit l'ordre du programme, pas une dépendance d'apprentissage. La règle de la mission (« chronologie ≠ prérequis ») recommanderait de les supprimer ou de les convertir en `relatedTo`. Ils nourrissent aujourd'hui la recommandation et le cahier de vacances.
2. **Compétences en double entre niveaux** : 37 libellés se retrouvent à deux niveaux (« Choisir entre a et à » au cycle 2 et au cycle 3 (CM), « Accorder le verbe avec son sujet »…). Ils sont qualifiés par le niveau pour garder des identifiants uniques. Une MicroSkill partagée, enseignée par deux notions (relation `teaches` multiple), serait plus fidèle au modèle.
3. **Quelques liens faibles hors histoire** (par exemple `biodiversite-et-chaines-cm` ← `classification-du-vivant-cm`, `reproduction-et-puberte-cm` ← `classification-du-vivant-cm`, `vocabulaire-et-dictionnaire-c2` ← `la-phrase-c2`) : déclarés dans les fiches, justification fragile. À relire.
4. **Libellés en `étudier`** (mathématiques V0, voir plus haut).
