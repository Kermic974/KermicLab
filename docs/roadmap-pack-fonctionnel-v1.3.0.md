# Roadmap du pack documentaire fonctionnel v1.3.0

## Objectif
Faire évoluer le pack documentaire de KermicLab vers un référentiel fonctionnel complet, maintenable et exploitable, en prenant le dépôt comme source de vérité pour l'état effectivement implémenté.

## Principes
- Distinguer explicitement l'existant, l'expérimental et la cible.
- Relier les décisions structurantes aux ADR et documents spécialisés plutôt que les dupliquer.
- Maintenir la traçabilité entre fonctionnalités, sources, tests et documentation.
- Ne jamais présenter une fonctionnalité projetée comme déjà disponible.
- Préserver les exigences de sécurité, de confidentialité et de validation humaine applicables.

## Axe 1 — Cartographie fonctionnelle
- Recenser les fonctionnalités et parcours utilisateur visibles dans le dépôt.
- Cartographier accueil, Labs, jeux, défi, progression, trophées et configuration.
- Relier les interfaces au catalogue, au Worker et aux services externes concernés.
- Identifier les fonctionnalités actives, expérimentales et planifiées.

## Axe 2 — Référentiel des expériences pédagogiques
- Définir une fiche fonctionnelle homogène pour chaque expérience.
- Relier chaque expérience à ses objectifs, interactions, états et contraintes.
- Documenter les règles communes aux contenus et les exceptions propres aux Labs et jeux.
- Tracer la provenance des contenus et les besoins de validation humaine.

## Axe 3 — Parcours et progression
- Décrire les parcours utilisateur de bout en bout.
- Formaliser les règles de progression, défis et trophées à partir de l'implémentation.
- Identifier les dépendances entre navigation, stockage local et profil.
- Ajouter des critères d'acceptation vérifiables aux évolutions structurantes.

## Axe 4 — IA conversationnelle
- Documenter le routage déterministe et le recours éventuel à un modèle.
- Décrire conditions d'activation, limites et mécanismes de repli à partir de la configuration réelle.
- Relier le comportement fonctionnel aux ADR correspondants.
- Maintenir les exigences de sécurité, modération et minimisation des données.

## Axe 5 — UX, accessibilité et responsive
- Utiliser les wireframes versionnés comme support de vérification fonctionnelle.
- Maintenir la traçabilité entre vues, sources et versions.
- Décrire les principaux états des écrans et dialogues.
- Intégrer mobile, tactile, clavier et accessibilité aux critères d'acceptation concernés.

## Axe 6 — Architecture et intégrations
- Cartographier les frontières entre navigateur, Cloudflare Pages, Worker, catalogue et GitHub.
- Référencer les ADR plutôt que reproduire leurs décisions.
- Documenter les dépendances externes et leurs conséquences fonctionnelles.
- Distinguer clairement moteur public et contenus privés.

## Axe 7 — Sécurité, confidentialité et exploitation
- Relier les fonctions exposées à `SECURITY.md` et aux checklists opérationnelles.
- Documenter les comportements avec et sans services optionnels.
- Vérifier que la documentation ne contient ni secret ni donnée personnelle.
- Conserver les contrôles du dépôt et de la CI comme critères avant fusion.

## Livrables attendus
- Cartographie fonctionnelle consolidée.
- Inventaire des parcours utilisateur.
- Référentiel des expériences et fonctionnalités.
- Matrice de traçabilité fonctionnalité → source → test → documentation.
- Règles fonctionnelles transverses et critères d'acceptation.
- Liens vers ADR, sécurité, gouvernance et exploitation.
- Registre explicite des écarts entre documentation, implémentation et cible.

## Phases
### A. Inventaire
Examiner code et documentation existante, identifier les sources de vérité et relever les zones manquantes, obsolètes ou redondantes.

### B. Normalisation
Définir les structures communes, la terminologie, les statuts et les conventions de traçabilité.

### C. Consolidation
Compléter les domaines prioritaires à partir des sources réelles et séparer systématiquement comportement actuel et cible.

### D. Vérification
Contrôler liens, références et affirmations fonctionnelles contre le dépôt, puis exécuter les vérifications applicables avant fusion.

### E. Maintenance
Mettre à jour le référentiel avec les évolutions fonctionnelles majeures et réserver les décisions d'architecture aux ADR.

## Définition de terminé
La v1.3.0 est candidate à validation lorsque les domaines fonctionnels majeurs ont un point d'entrée documentaire, les affirmations sont traçables ou clairement marquées comme cibles, les contradictions importantes sont résolues ou signalées, les parcours majeurs disposent de critères vérifiables et les contrôles applicables du dépôt passent avant fusion.

## Hors périmètre
Cette roadmap ne prouve pas que toutes les fonctionnalités citées sont déployées. Le code, les tests, les ADR et les documents spécialisés restent les sources de référence pour leur domaine.
