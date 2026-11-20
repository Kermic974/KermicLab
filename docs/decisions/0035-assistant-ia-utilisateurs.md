# ADR 0035 — Assistant IA de l'écran Utilisateurs du back-office

- Date : 2026-11-18 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : le propriétaire demande, dans l'écran « Utilisateurs » du back-office (ADR 0026), un module IA capable de
  réaliser les actions autorisées sur un compte utilisateur, avec accès à l'AI Gateway, modèle Haiku, 2 000 tokens.

## Décision

1. **L'IA propose, l'administrateur applique.** Un bouton « Assistant IA » sur chaque ligne ouvre un panneau : une
   consigne en français (500 caractères au plus) → `POST /api/admin/utilisateurs/:type/:id/assistant` → liste d'actions
   proposées. Chaque action s'applique d'un clic par les **routes existantes** du back-office (mêmes validations, mêmes
   confirmations, même journal). Le Worker n'exécute rien lors de la proposition : aucune action n'est prise par le
   modèle seul (principe « maintenance par IA, contrôle humain »).
2. **Actions autorisées** (`worker/src/assistant-utilisateurs.js`, `ACTIONS_ASSISTANT`) : exactement celles de la ligne
   du tableau — modifier les rôles (cumulatifs, ADR 0034) et le niveau, définir l'état de sécurité (1 à 90 jours),
   exporter les données, réinitialiser le mot de passe (compte local seulement), supprimer. Les deux dernières sont
   marquées irréversibles et gardent leur confirmation.
3. **Validation serveur** de chaque proposition contre l'état réel : action connue et permise pour ce type de compte,
   sans doublon, quatre au plus ; rôles et niveaux existants ; état de sécurité connu ; une modification sans effet est
   écartée. Les propositions écartées sont listées avec leur raison. Liens retirés des textes rendus.
4. **Modèle** : alias AI Gateway `custom/haiku` (`MODELE_ASSISTANT`), 2 000 tokens de sortie (`MAX_TOKENS_ASSISTANT`,
   500 à 4 000), sortie JSON structurée, appel par `appelerAliasGateway` de `llm.js` (pseudonymisation imposée,
   télémétrie sous le module `assistant-utilisateurs`). Interrupteur `ASSISTANT_UTILISATEURS_ACTIF` ; `LLM_ACTIF` à
   false coupe aussi l'assistant. Trois paramètres privés du registre (module `assistant`), réglables à chaud dans Harness.
5. **Données** : le modèle ne reçoit ni l'identifiant du compte ni aucune donnée personnelle — seulement son type, ses
   rôles, son niveau, son état de sécurité et des indicateurs (mot de passe provisoire, blocage, rôle dans la famille,
   nombre d'enfants). La consigne de l'administrateur est pseudonymisée et n'est ni stockée ni journalisée ; le journal
   note `assistant.proposition` avec le compte et les actions proposées.

## Conséquences

- Aucune nouvelle table, aucune migration. Coût : un appel Haiku par proposition, compté dans la télémétrie.
- Le modèle ne peut pas élargir son périmètre : une action hors liste est refusée par le schéma puis par le serveur, et
  rien ne s'exécute sans clic.
- Tests : `tests/unit/backoffice.test.mjs` (« assistant IA »).
