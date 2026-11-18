# ADR 0031 — Souscriptions composées et sous-module financier du back-office

- Date : 2026-11-18 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : l'ADR 0026 a préparé des « niveaux de souscription » dans le Harness (quatre limites de tokens et de
  générations). Le propriétaire veut un vrai module de souscriptions : composer une offre à partir des **rôles**, des
  **permissions** (fonctionnalités) et des **limites de consommation**, avec les offres pressenties **Gratuit**, **Solo**,
  **Parent** et **Professeur**, et un sous-module **financier** simple qui estime le coût et positionne la marge, à
  partir d'un prix de vente fourni ou l'inverse. Le paiement (chantier TVA et paiement, issue #121) reste hors périmètre.

## Décision

### 1. Une souscription = rôle + fonctionnalités + limites + hypothèses commerciales

`worker/src/souscriptions.js` définit une offre :

| Champ | Contenu |
|---|---|
| `id`, `libelle`, `description`, `statut` | `projet` ou `active` ; l'identifiant est aussi le **niveau** attribué aux comptes (`attributions_roles.niveau`) |
| `role` | rôle attribué aux abonnés (rôle système ou personnalisé) |
| `fonctionnalites` | fonctionnalités incluses, parmi celles du registre des permissions (`FONCTIONNALITES`) |
| `limites` | consommation (tokens par session et par réponse, défis et cahiers IA par jour), bornées par le registre (ADR 0019) ; plafond mensuel de cahiers IA (`cahiersMois`, 0 = sans plafond) ; structure (enfants, classes, élèves), déclarées |
| `usage` | hypothèse d'usage : jours actifs par mois, part du quota consommée |
| `prix` | mode `prix` (prix HT fourni → marge calculée) ou `marge` (marge visée → prix calculé), remise annuelle |

- **Gratuit** est permanent : ses limites de consommation sont celles du registre (réglées dans Harness), son prix vaut 0.
  Sa marge est négative : c'est le coût d'acquisition d'un utilisateur gratuit.
- Les offres pressenties sont proposées tant que rien n'est enregistré ; huit offres au plus.
- Stockage dans `reglages` (clés `souscriptions` et `finances`) : réglages à chaud, validés et bornés, sans migration.
  Les anciens niveaux (clé `niveaux`) sont repris automatiquement, puis la clé est retirée au premier enregistrement.
- Une offre attribuée à un compte ne se supprime pas ; un rôle personnalisé utilisé par une offre non plus.

### 2. Décision d'accès : le rôle **et** l'offre

Une fois `CONTROLE_ACCES_ACTIF` activé, `accesAutorise()` exige que la fonctionnalité soit permise par le rôle, puis
incluse dans la souscription du compte (raison `hors-souscription`), puis la stratégie. L'offre restreint, elle n'ajoute
rien au rôle : l'interface signale une fonctionnalité cochée hors des permissions du rôle. Le simulateur de « Rôles et
accès » en tient compte. Pendant la bêta, rien ne change : la décision répond toujours oui.

### 3. Sous-module financier : des fonctions pures, partagées

`web/admin/financier.js` (sans dépendance, comme `web/theme.js`) est utilisé par le Worker (réponse de l'API) et par
l'interface (recalcul immédiat pendant la saisie).

- **Coût variable** par module : jours actifs × volume quotidien × (prix de sortie + ratio entrée/sortie × prix
  d'entrée) / 1 000 000. Volume : tokens par session (tuteur) ; défis ou cahiers par jour × taille d'une génération
  (`MAX_TOKENS_DEFI`, `MAX_TOKENS_CAHIERS`) ; les cahiers du mois sont bornés par `cahiersMois` (Parent : 1 par jour,
  5 par mois). « Au plafond » : tout le quota ; « estimé » : × part consommée.
- **Coût de revient** = coût variable estimé + coûts fixes mensuels / utilisateurs actifs estimés.
- **Marge** = prix HT − coût de revient − frais de paiement (pourcentage + fixe) ; taux = marge / prix HT.
- **Marge visée → prix** : P = (coût de revient + frais fixe) / (1 − marge − frais %), arrondi au centime supérieur ;
  impossible si le dénominateur est nul ou négatif.
- Aussi : coefficient, prix TTC (taux de TVA), prix et marge annuels avec remise, marge si tout le quota est consommé,
  seuil de rentabilité (abonnés nécessaires pour couvrir les coûts fixes).
- Hypothèses par défaut, toutes modifiables : prix publics relevés le 2026-11-18 (Workers AI Llama 3.3 70B pour le
  tuteur, Claude Haiku 5.5 pour le défi, Claude Sonnet 5.5 pour les cahiers), TVA 20 %, frais de paiement 2,9 % + 0,30.

## Limites connues

- Estimations sur hypothèses, pas une comptabilité : ni amortissement, ni impôts, ni coût d'acquisition marketing.
- Les cahiers enrichis (jusqu'à 100 000 tokens par génération sur Sonnet 5.5) dominent le coût : la part consommée
  et la taille réelle des générations doivent être mesurées dans la télémétrie avant de fixer les prix.
- Aucune limite n'est appliquée : au-delà de 1 000 tokens par session, ou pour un plafond mensuel de cahiers, il faut
  la nouvelle table de quota (ADR 0026, « Limites ») ; les limites de structure ne sont pas encore lues par l'Espace famille ni par l'expérience Professeur.
- Une seule devise pour tous les montants ; pas de conversion.

## Conséquences

- Nouvel écran « Souscriptions » dans `/admin/` ; le bloc « Niveaux de souscription » du Harness et la route
  `PUT /api/admin/harness/niveaux` sont remplacés par `GET /api/admin/souscriptions`,
  `PUT|DELETE /api/admin/souscriptions/:id` et `PUT /api/admin/finances`. Chaque écriture est notée au journal.
- Aucune donnée personnelle : des offres et des hypothèses chiffrées, dans `reglages`.
- Action humaine : valider cet ADR, les offres et leurs prix (`docs/actions-manuelles.md`).
