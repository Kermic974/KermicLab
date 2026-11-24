# ADR 0042 — Extension explicite de la migration S6

- Date : 2026-11-24.
- Statut : proposé pour adoption par la PR 04, après la fusion de [#421](https://github.com/Kermic974/KermicLab/pull/421).
- Suivi : [#384](https://github.com/Kermic974/KermicLab/issues/384).

## Contexte

D6-1 de l’[ADR 0033](0033-adoption-contrats-s6.md) retient tout le corpus public. Le relevé initial attestait 174 fiches et le lab solaire. À `6f121846a91f8629616a7e64f7860d19fcc7442a`, 312 notions supplémentaires sont publiques ; leurs cibles S4 et les compétences densifiées sont encore des propositions draft. La norme S6 interdit leur publication comme cibles draft et interdit une extension automatique de la dérogation historique.

## Proposition soumise à adoption

1. **D6-1 actualisé** : adopter l’[annexe fermée](../../experiences/perimetre-migration-v1.json) à la révision publique indiquée : 486 fiches (477 notions et 9 jeux), le lab solaire et les modules pédagogiques du cercle rattachés à sa fiche. Les chemins et empreintes figent la preuve de cet existant. Le relevé initial reste conservé.
2. **Cibles proposées en review** : soumettre à la revue humaine de cette PR 312 Notions, 1 849 MicroSkills et 312 Skills existantes, avec version augmentée d’une unité, ainsi que treize Notions éditoriales des jeux. Review signifie candidat ; aucun objet n’est déclaré validated et aucune attestation humaine n’est fabriquée. Les relations, rôles et placements ne changent pas. Le [journal](../experiences/cibles-et-extension-s6.md) expose la portée, les sources et les réserves.
3. **D6-3 inchangé** : autoriser, après adoption et seulement sous manifeste explicite, les expériences review issues de cette annexe avec des cibles review/validated. Aucune cible draft n’est rendue publiable. Le statut du contenu, sa publication historique et sa validation pédagogique restent distincts.
4. **Pas de propagation implicite** : ni une fiche créée après la révision figée, ni une source absente de l’annexe, ni une nouvelle unité pédagogique ne reçoit cette dérogation par simple inclusion dans un lot. Une extension supplémentaire doit être documentée et adoptée, ou suivre la publication validated prévue par S6.
5. **Conservation du contenu initial** : l’import doit démontrer le rapprochement avec les sources de l’annexe. L’ajout technique d’ancres `experienceId`, d’identifiants d’événements historiques et d’attributs HTML dédiés doit rester explicite, vérifié et sans changement d’énoncé, de correction, d’ordre pédagogique ou de règle préparée. Il ne dispense pas du versionnement S6. Un autre changement exige une revue de la dérogation et une révision ; aucune normalisation générale ne doit le masquer.

La [consolidation S6 v1.0.1](../referentiel/normes/S6-v1.0.1.md) est proposée avec cette annexe. Les familles, schémas d’expérience, transitions et invariants de variantes restent ceux adoptés en v1.0.0. La présente PR prépare les cibles et la preuve de périmètre ; elle ne crée ni expérience publiée, ni manifeste de publication, ni nouvelle navigation.

## Vérification et suite

Le schéma de l’annexe est fermé. Les tests contrôlent les empreintes dans Git à la révision figée, la fermeture des cibles, l’absence de doublons et la conservation des objets canoniques hors transitions/version listées. Les données avant/après sont comparées indépendamment de leurs chemins et formats de sérialisation.

Après adoption humaine de cette PR, la PR 05 ajoute les adaptateurs, ancres persistantes, correspondances d’événements, manifeste du pilote et export build. Elle devra refuser toute source ou cible hors de l’annexe pour la compatibilité historique. Un PASS sur l’annexe ne constitue pas une validation scientifique ni une attestation d’accessibilité.

English summary: propose an explicit, fingerprinted extension of the legacy-public migration scope, with candidate S4 targets and unchanged publication safeguards. Human adoption is required before the pilot uses this compatibility policy.
