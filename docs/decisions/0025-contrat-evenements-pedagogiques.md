# ADR 0025 — Contrat d'événements pédagogiques des pages (postMessage, v1)

- Date : 2026-11-07 — Statut : **proposé** (à valider par le propriétaire)
- Feuille de route : phase 1, [issue #181](https://github.com/Kermic974/trigoLab/issues/181)
- Contexte : une page autonome n'a pas de réseau (`connect-src 'none'`) et s'affiche dans une iframe isolée (origine
  opaque) du tableau de bord. Le pont « Mes trophées » (ADR 0015) ne transmet qu'un **instantané** (étoiles, XP) : il ne
  dit ni quelles notions ont été ouvertes, ni quels exercices ont demandé un indice, ni si l'élève a réussi après un
  indice. La maîtrise par notion, les révisions et le tuteur (phases 2 et 3) ont besoin de ces faits, sans jamais
  conserver ce que l'élève a écrit.

## Décision

### 1. Protocole

Une poignée de main, puis des événements envoyés **uniquement à l'origine vérifiée du parent** :

| Sens | Message |
|---|---|
| page → parent | `{ type: "kermiclab:evenements:pret", v: 1, notion }` (identifiant seul, avant de connaître l'origine) |
| parent → page | `{ type: "kermiclab:evenements:ecouter", v: 1, notion }` (fixe l'origine du parent ; mêmes contrôles que le pont des trophées : `http(s)`, `parentOrigin` et `allowedParentOrigins` des métadonnées) |
| page → parent | `{ type: "kermiclab:evenement", v: 1, notion, version, evenement, … }` |

Les événements émis avant la poignée de main sont gardés en file (50 au plus) puis envoyés. Une page ouverte seule
(hors iframe) n'émet rien. Le parent reconnaît le cadre par sa fenêtre (`contentWindow`), pas par l'origine opaque,
et refuse un message dont la `notion` n'est pas celle du cadre.

### 2. Événements (schéma v1)

| `evenement` | Champs en plus | Émis quand |
|---|---|---|
| `demarre` | — | à l'ouverture de la page (une fois) |
| `indice` | `exercice` (id), `rang` (1 à 10) | un indice est affiché |
| `reponse` | `exercice`, `correct` (booléen), `essai` (1 à 99) | une réponse est validée |
| `termine` | — | tous les exercices de la page sont réussis (une fois) |

**Jamais** de texte saisi par l'élève, de réponse, de contenu de la page ni d'horodatage précis. Tout champ en plus fait
refuser le message. Un changement de schéma incrémente `v` ; le parent ignore les versions qu'il ne connaît pas.

### 3. Enregistrement côté tableau de bord

`web/evenements.js` agrège **localement** par notion : version vue, nombre d'ouvertures, dernier jour (date seulement),
terminée ; par exercice : nombre de réponses, réussi, rang d'indice le plus élevé, réussi après un indice. Clé
`kermiclab:evenements`, avec le même stockage que la progression (session, ou appareil si « Se souvenir de moi »),
et le même effacement. **Rien n'est envoyé au serveur**, et ces données ne font pas partie de la synchronisation du
compte local (ADR 0024) : l'étendre demandera une décision.

### 4. Émetteurs

- Gabarit des notions (`gabarit/jeux/evenements.js`, inclus dans chaque page générée ; `VERSION_GABARIT` 1.1.0) :
  `demarre`, `reponse` (QCM et nombres), `indice` (indice d'un QCM après la première erreur, indices gradués des
  nombres), `termine` (toutes les étoiles).
- Pages écrites à la main : elles incluent le même module (`data-inclure="gabarit/jeux/evenements.js"`) et appellent
  `Evenements.emettre(...)`. Le cercle trigonométrique sera la première (issue #184).
- XP ludique, exercices réussis et maîtrise scolaire restent **distincts** : « Mes trophées » garde l'XP des jeux ;
  la maîtrise sera calculée à partir de ces événements (issue #185).

## Conséquences

- Les phases 2 et 3 disposent de faits fiables, sans réseau ni donnée personnelle.
- Toute page conforme au contrat devient mesurable sans toucher au tableau de bord.
- Correction associée : dans la bulle du tableau de bord (iframe isolée sans `allow-forms`), le navigateur ne déclenche
  pas l'événement `submit`. Les exercices « nombre » du gabarit (87 notions) ne se validaient donc pas depuis le tableau de
  bord ; ils se valident désormais par le bouton ou la touche Entrée, sans élargir l'isolement de l'iframe.
