#!/usr/bin/env bash
# Configure les options GitHub du dépôt (labels, sécurité, protection de main, discussions).
# À lancer par le propriétaire avec la CLI `gh` authentifiée (action manuelle, voir docs/actions-manuelles.md).
# Ne modifie JAMAIS la visibilité du dépôt.
set -euo pipefail
REPO="${1:-kermic974/trigoLab}"

echo "== Labels"
creer_label() { gh label create "$1" --repo "$REPO" --color "$2" --description "$3" --force; }
creer_label "maquette-manquante" "1f5fbf" "Une maquette serait pertinente mais n'existe pas"
creer_label "traduction-manquante" "5319e7" "Une maquette n'existe pas dans une langue demandée"
creer_label "support" "0e8a16" "Signalement d'un utilisateur"
creer_label "bug" "d73a4a" "Quelque chose ne fonctionne pas"
creer_label "good first issue" "7057ff" "Bon point de départ pour contribuer"
creer_label "help wanted" "008672" "Aide bienvenue"
creer_label "sécurité" "b60205" "Sujet de sécurité"
creer_label "dependencies" "0366d6" "Mise à jour de dépendances"

echo "== Sécurité"
gh api -X PUT "repos/$REPO/vulnerability-alerts"
gh api -X PUT "repos/$REPO/automated-security-fixes"
gh api -X PUT "repos/$REPO/private-vulnerability-reporting"
gh api -X PATCH "repos/$REPO" --input - <<'JSON' || echo "⚠ secret scanning : nécessite un dépôt public ou GitHub Advanced Security"
{ "security_and_analysis": { "secret_scanning": { "status": "enabled" }, "secret_scanning_push_protection": { "status": "enabled" } } }
JSON

echo "== Discussions"
gh api -X PATCH "repos/$REPO" -F has_discussions=true >/dev/null

echo "== Protection de main"
gh api -X PUT "repos/$REPO/branches/main/protection" --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["Lint, build, tests", "analyser", "Audit npm", "Scan des secrets"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "require_code_owner_reviews": true, "required_approving_review_count": 1, "dismiss_stale_reviews": true },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": true
}
JSON
gh api -X POST "repos/$REPO/branches/main/protection/required_signatures" >/dev/null

echo "== Workflows des forks : approbation requise pour les premiers contributeurs"
gh api -X PUT "repos/$REPO/actions/permissions/fork-pr-contributor-approval" -f approval_policy=first_time_contributors || echo "⚠ à régler dans Settings → Actions → General"

echo "Terminé. Visibilité du dépôt inchangée."
