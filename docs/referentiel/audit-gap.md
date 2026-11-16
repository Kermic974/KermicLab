# KermicLab — Audit du socle S1 à S5

Base : instantané public de `main`, commit `b1de38a4582310e549cbcb8eb7dbc79deeb89b56`. Sources : [archive Notion S1–S5](https://app.notion.com/p/41a0c40cec2881e18d5dc1e28eeb9ec0), [décisions #243](https://github.com/Kermic974/KermicLab/issues/243), [audit #244](https://github.com/Kermic974/KermicLab/issues/244). Les issues #245 à #257 donnent les contrats et l’ordre des travaux envisagés. La pièce S5 téléchargée est un flux binaire Microsoft Prague, malgré l’extension `.md` : les tickets complètent l’audit, mais ne prouvent pas la conformité à la source S5.

## Écart entre le dépôt et la cible

| Structure | Rôle observé et écart | Suite proposée et vérification |
| --- | --- | --- |
| `SPEC.md`, `ARCHITECTURE.md` | Contrats de l’application du cercle. Ne définissent pas le référentiel canonique. | Conserver. Documenter le périmètre S1–S5 séparément après D1. |
| `catalogue/*/fiche.md` | Source de vérité V0. 174 fiches ont un ID et une version éditoriale SemVer ; aucune n’a de `status`. 36 renseignent chacun des champs `prerequis`, `niveaux`, `competences`. Relations et niveaux vivent dans les fiches. | Migrer par lot. Conserver l’ID public et la SemVer des fiches ; définir la correspondance avec les IDs canoniques qualifiés et leurs révisions entières. Comparer les champs V0 avant/après. |
| `catalogue/*/contenu.json`, `page.html`, `gabarit/` | Contenu et rendu pédagogiques ; les niveaux de présentation ne définissent pas le Curriculum Graph. | Conserver les contrats du gabarit et les jeux. Ne déduire ni rôle curriculaire ni relation d’un niveau ou d’une activité. |
| `Sample/`, `src/`, `versions/` | Exemples de lab, application autonome et archives de versions. Pas de source canonique S4. | Conserver. Vérifier que build et contrôles de pages restent inchangés. |
| `scripts/lib/catalogue.mjs` | Parse et valide la V0. Recherche références manquantes et cycles, et bloque si le premier niveau d’un prérequis est plus avancé que celui de la notion. | Adapter après D5. Garder le contrôle V0 pendant la transition ; ne pas en déduire de règle bloquante S4 sans décision. |
| `scripts/build.mjs`, `scripts/check-pages.mjs` | Build du catalogue public et éventuellement privé, index, contenus et contrôles des pages dérivées. | Ajouter une projection S4 vers V0 et un contrôle d’obsolescence pour les seules fiches migrées (#256). Tester projection stable et retrait du lot. |
| `web/`, `worker/` | La recommandation, le cahier de vacances et l’API du catalogue lisent les champs V0. La progression est une responsabilité applicative distincte. | Garder les interfaces V0 et le même comportement ; exclure les données apprenant des objets S4. |
| `tests/` | Tests V0 dédiés dans `tests/unit/referentiel.test.mjs` et `tests/unit/graphe-prerequis.test.mjs`. | Conserver ; ajouter les fixtures S4 et comparer les sorties de recommandation et du cahier sur le pilote. |
| `.github/`, `package.json`, `package-lock.json`, `worker/package-lock.json` | Node 22 et npm ; workflows et dépendances existants. Pas de commande `check:referentiel`. | Fixer l’outil et le draft JSON Schema (D3) ; ajouter ensuite la commande et le contrôle CI sans retirer de contrôle existant. |
| `SECURITY.md`, `.env.example`, `.gitignore`, `.gitleaks.toml` | Politique de sécurité, exemple de configuration, exclusion des fichiers locaux et configuration du contrôle des secrets. | Conserver ; réserver les fixtures à des données synthétiques et ne pas introduire de contenu apprenant dans les artefacts. |

Les huit contrats S4 restent à introduire : Notion, MicroSkill, Skill, Relation, Curriculum, Stage, Domain et CurriculumMapping. Sur les fiches publiques, aucun champ de premier niveau `status`, `provenance`, `evidence` ou `projectionKey` n’a été trouvé ; il n’existe donc aucun jeu d’objets S4 à qualifier pour `active|retired`, la cardinalité de preuve ou les doublons de projection. Leur absence ne vaut pas validation. Les champs `niveaux`, `prerequis` et `competences` imbriqués dans les fiches sont bien l’écart V0 à traiter. Le catalogue privé n’a pas été inclus.

Le workflow `ci.yml` déclenche sur `pull_request` et configure installation racine et Worker, lint, build, contrôle CSP/pages, tests unitaires et Playwright Chromium. `securite-pr.yml` configure `npm audit --audit-level=high` et gitleaks avec sortie expurgée ; le dépôt configure aussi Dependabot et CodeQL. Le contrôle obligatoire est décrit dans `docs/chantiers/ci-cd.md` et `scripts/configurer-github.sh` ; la protection effective de `main` et les journaux des exécutions distantes ne sont pas attestés par cet instantané.

Vérification locale sous Windows avec Node **22.16.0** et npm **10.9.2** : `npm ci` et `npm ci --prefix worker` ont abouti et chacun a signalé **0 vulnérabilité**. `npm run ci` est sorti avec le code 1 dès le lint : `scripts/lint.mjs` construit un chemin `C:\C:\Users\…` (ENOENT). Les deux suites V0 ciblées ont également échoué avant l’exécution des assertions, sur le même type de chemin pour `gabarit/figures`. Le build, le contrôle des pages et les tests navigateur n’ont donc pas été atteints par cette commande. Rejouer la référence sous Ubuntu, la plateforme du workflow officiel, avant d’activer un nouveau contrôle S4.

Recherche de positionnement dans les IDs : `premiere-guerre-mondiale` et `seconde-guerre-mondiale` contiennent des mots qui sont aussi des codes scolaires ; ils désignent ici des événements historiques et ne doivent pas être rejetés comme des niveaux par une recherche de sous-chaîne.

## Premier changement après arbitrage

1. Consigner D1 à D8 dans un ADR et vérifier que les règles D4 sont assez précises pour les huit schémas. Le numéro `0026` proposé par #243 est déjà occupé par l’ADR du back-office ; choisir le prochain numéro libre au moment du changement.
2. Premier lot de code : primitives, catalogue des règles et fixtures (#245), sans conversion du catalogue. Les schémas (#246–#249), validateurs (#250–#253), rapport (#254) et contrôle CI (#255) viennent ensuite.
3. Pilote proposé : `trigo-cercle`, `pythagore`, `fractions`, `proportionnalite`. Leurs cibles directes hors sélection sont `angles`, `perimetres-aires`, `puissances` et `nombres-decimaux` ; vérifier la fermeture transitive avant migration. Comparer l’index et les résultats V0, faire choisir rôles et justifications par un humain et conserver les objets migrés en `draft` jusqu’à revue. Retour arrière : retirer le lot canonique et restaurer les valeurs V0 depuis la base ; vérifier que les sorties des consommateurs retrouvent la référence.

Décisions attendues du propriétaire dans [#243](https://github.com/Kermic974/KermicLab/issues/243) : source normative lisible (D1), emplacement canonique (D2), outil et draft (D3), contrats exacts de provenance, preuves, types et IDs (D4), niveau de sévérité du prérequis plus avancé (D5), périmètre du catalogue privé (D6), traitement de #179/#180 (D7) et vocabulaire fiche/Notion (D8).

Proposition à examiner : versionner le texte normatif lisible avec son numéro de version (D1), placer les objets JSON canoniques dans `referentiel/` (D2), conserver l’avertissement éditorial pour le prérequis plus avancé (D5), commencer par le corpus public pour obtenir un pilote reproductible (D6) et réserver « Notion » à l’objet canonique, « fiche » à la page du catalogue (D8). D3 demande de comparer la couverture des mots-clés JSON Schema et le coût de maintenance des deux options. D4 doit venir du texte autoritaire ou d’une décision explicite ; l’exemple de chaque forme doit alors devenir une fixture. D7 demande de couvrir les critères de #179/#180 par les nouveaux lots avant de décider de leur sort.

## Revalidation pour la PR d’adoption

La PR a été préparée sur `main` à `e741aa1d4d7e44b4d97515fea4c9277b465f5077`. La [comparaison avec la base de l’audit](https://github.com/Kermic974/KermicLab/compare/b1de38a4582310e549cbcb8eb7dbc79deeb89b56...e741aa1d4d7e44b4d97515fea4c9277b465f5077) montre cinq commits supplémentaires. Aucun fichier de catalogue, script du référentiel ou workflow CI n’est modifié par cet écart. Les décomptes du catalogue public et la description du flux de validation restent applicables. Les évolutions d’authentification relèvent du périmètre applicatif.

La référence Ubuntu/Node 22 sera relevée sur le job « Lint, build, tests » de la PR documentaire. Ce job exécute les étapes de validation du dépôt. Les résultats Windows ci-dessus restent distincts. L’accès au catalogue privé et l’état effectif de la protection de branche doivent être vérifiés pour conclure sur leur couverture.

### Résultats de référence

La [CI finale de la PR documentaire #327](https://github.com/Kermic974/KermicLab/actions/runs/43965113967) a réussi sur Ubuntu avec Node 22, au commit `ebfc82bc9c28af72435f05187d4307567b930eac`. Le workflow a exécuté l’installation racine et Worker, le lint, le build, le contrôle des pages et des empreintes CSP, les tests unitaires et les tests navigateur. Le catalogue privé et le déploiement ont été ignorés sur cette exécution de PR. Les workflows de sécurité des contributions et CodeQL ont également réussi.

L’API GitHub indique `protected: false` pour `main` au commit `118bd96c5c33eda56952c16dd7491b8383757f8e` et ne liste aucun contrôle obligatoire dans la protection de branche retournée. Cette réponse ne suffit pas à exclure les règles configurées hors de cette protection. La revue humaine et la vérification de la CI avant fusion restent des étapes du processus de contribution.

D6 limite le pilote au catalogue public. Le travail se poursuit avec les primitives et les huit schémas, puis avec la validation des références et des graphes avant le contrôle CI et la projection V0.
