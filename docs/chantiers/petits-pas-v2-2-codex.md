# À petits pas V2.2 — cadrage et reprise Codex
Statut : première intégration locale en PR brouillon. La section « Reprise de la PR #451 » décrit le périmètre retenu après le cadrage initial. Public : adultes TDAH. Outil non médical, sans diagnostic ni promesse thérapeutique.
## Contexte
Capitaliser sur #448 (harness local) et #449 (profils Haiku/Opus), fusionnées. Examiner AGENTS.md, sources du lab, générateurs officiels, référentiel UX, catalogue et tests avant modification. Préserver les micro-skills et notions existants, les sauvegardes et les parcours sans IA. Vérifier les éventuelles dépendances à #442.
## P0 — assistance contextuelle
- Accueil : énergie déclarée, temps disponible (2/5/15/30 min), une seule action proposée, justification, alternative et possibilité de refuser.
- Décharge mentale : classer texte en tâches/idées/préoccupations/échéances, signaler doublons, ne rien enregistrer sans validation; ne pas inventer d'échéance.
- Petit pas : décomposition concrète et adaptée, minuteur facultatif, pause et fin sans pénalité.
- Je suis bloqué : accessible partout, proposer une piste à la fois (clarifier, réduire, changer, pause).
- Reprise : conserver localement étape, contexte et prochaine action après interruption.
- Modes douceur, focus, organisation, récupération : suggestion facultative, jamais imposée.
## UX cible
Quatre entrées principales Aujourd'hui, Pochette, Agir, Moi. Neuf espaces : accueil, décharge mentale, petit pas, blocage, reprise, stratégies, mieux me comprendre, bilan, mémoire/confidentialité. Mobile-first, contraste, clavier, focus visible, réduction des animations. Préférer HTML initial visible sans JS; amélioration progressive. Pas de score de productivité, streak obligatoire ni notification insistante.
## IA et données
Local d'abord (règles déterministes, stockage, minuteur). Haiku pour tri, reformulation, décomposition et aide rapide; Opus pour synthèse et analyse approfondie facultatives. Réutiliser le routage et les profils existants, vérifier leurs contrats réels; pas de clé côté client. Consentement explicite avant transmission, minimisation du contexte, validation des sorties structurées, délai maximal et fallback local; traiter le texte utilisateur comme données non fiables. Pas de collecte implicite de données sensibles. Mémoire consultable, modifiable, supprimable et exportable; distinguer préférences déclarées et observations hypothétiques.
## P1 / suite
V2.3 : mémoire et stratégies validées, bilan qualitatif. V2.4 : exercices de fonctions exécutives reliés au référentiel existant, validation pédagogique/clinique avant toute revendication thérapeutique. V3 : voix, mobile et hors ligne. Ne pas implémenter ces phases sans arbitrage.
## Livrable initial
Créer une maquette HTML autonome V2.2 sur données fictives cohérentes, sans appel réseau, avec simulations contextuelles et contenu visible sans JS. Scénarios : énergie basse et 2 min; dossier administratif et 15 min; blocage; interruption/reprise; décharge mentale et validation. Ensuite proposer intégration incrémentale dans les sources officielles, sans remplacer le lab de production avant validation.
## Critères d'acceptation
- [ ] Les neuf espaces sont lisibles et navigables même sans JS (liens internes); interactions fonctionnelles avec JS.
- [ ] Énergie et temps modifient réellement la sélection, sans dépasser le temps choisi; alternative et justification disponibles.
- [ ] Décharge mentale modifiable avant validation; reprise persistante et suppression effective.
- [ ] Données sample clairement identifiées; aucun appel réseau ni secret dans la maquette.
- [ ] Tests unitaires du moteur de sélection, validation des sorties et fallback; tests navigateur des scénarios, clavier, mobile 375/390 px, tablette et desktop, JS désactivé.
- [ ] Vérifier compatibilité des sauvegardes, références catalogue, CSP, accessibilité et absence de régression.
- [ ] Régénérer les artefacts UX avec le générateur officiel si les sources UX changent; vérifier idempotence, ne pas corriger manuellement les fichiers générés.
- [ ] Exécuter les commandes lint/build/test et contrôles CI documentés par le dépôt; consigner résultats et limites, ne pas déclarer un test iOS réel sans l'avoir effectué.
## Passage de relais
Codex : auditer l'existant, proposer un plan et identifier les fichiers exacts, puis implémenter le prototype P0 par commits ciblés sur cette branche. Préserver les changements concurrents; ne pas fusionner, déployer ou modifier les autres PR. Garder la PR draft jusqu'à validation humaine. Le cadrage ne constitue pas une implémentation ni une validation clinique. La maquette V2.1 de conversation n'est pas incluse dans ce commit; reconstruire la V2.2 à partir des exigences ci-dessus et des sources du dépôt.

## Reprise de la PR #451

Le propriétaire a demandé d’intégrer les données KermicLab. Cette tranche adapte directement le labo issu de #450 sur la branche de la PR. Le plan et la reprise utilisent les tâches, mini-étapes et priorités du navigateur. Le build embarque les champs publics `aRetenir` de `problemes-a-etapes-cm` et `algorithmes-programmation-cm` dans le plan du labo. La sauvegarde conserve la clé `petits-pas-v1` et la version de schéma 1, avec les propriétés optionnelles `reprise` et `pochetteNotes`.

- [x] Petit pas selon le temps et l’énergie, alternative, refus et minuteur facultatif.
- [x] Tri modifiable, validation explicite, reprise persistante et suppression.
- [x] Liens internes sans JavaScript, recette hors ligne et vérification de la sauvegarde ancienne.
- [x] Réutilisation de repères issus des contenus publics vérifiés au build.
- [ ] Valider le parcours en aperçu et coordonner l’intégration des micro-skills de #442.
- [ ] Arbitrer et implémenter une éventuelle inférence Haiku ou Opus, avec consentement et contrat serveur.

La navigation du labo reprend les onglets existants. Les modes donnent un repère facultatif. Le tri et les recommandations utilisent des règles locales. Aucun suivi UX généré n’est modifié, car les sources qu’il surveille restent identiques.
