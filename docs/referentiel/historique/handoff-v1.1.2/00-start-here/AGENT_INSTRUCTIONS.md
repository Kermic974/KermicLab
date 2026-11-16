# Instructions impératives pour l'agent de coding

## 1. Posture
Tu prends en charge un dépôt vivant. Tu dois inspecter le code, les données, les tests et la CI avant toute décision d'architecture. N'invente pas l'état du dépôt.

## 2. Règles de travail
1. Créer une branche dédiée.
2. Relever le commit de départ et l'environnement.
3. Exécuter les commandes existantes documentées dans `package.json` et les workflows, sans les remplacer prématurément.
4. Cartographier `.github/`, `catalogue/`, `gabarit/`, `Sample/`, `src/`, `tests/`, `web/`, `worker/`, `versions/` si ces zones existent.
5. Produire une matrice `keep/adapt/migrate/retire` avant modification structurelle.
6. Travailler en petits lots et commits atomiques.
7. Référencer les Rule IDs S4 dans les tests, rapports et PR.
8. Ne pas élargir le périmètre aux Labs, données apprenant ou moteur adaptatif.

## 3. Interdictions
- Ne pas recréer le dépôt depuis zéro.
- Ne pas imposer une nouvelle arborescence sans audit.
- Ne pas encoder cycle, classe, niveau ou version de programme dans les IDs du Knowledge Core.
- Ne pas stocker les Relations dans Notion/MicroSkill/Skill comme seconde source de vérité.
- Ne pas déduire `requires`, `extends` ou `relatedTo` du curriculum.
- Ne pas inclure `version` dans la clé sémantique d'un CurriculumMapping.
- Ne pas accepter `active` ou `retired` comme statuts canoniques.
- Ne pas convertir automatiquement des données historiques ambiguës.
- Ne pas déclarer un jalon acquis sans preuve exécutable.

## 4. Gestion des ambiguïtés
Ordre d'autorité : S1 > S2 pour les nœuds > S3.1 pour les Relations > S3.2 pour le curriculum > page S4 spécialisée > audit v1.1.1 > synthèse. S4.2 v1.1.2 est autoritaire pour cycle de vie et versionnement.

## 5. Format de compte rendu
Pour chaque lot : objectif, fichiers touchés, règles matérialisées, tests ajoutés, commandes exécutées, résultats, risques, dette restante, rollback.
