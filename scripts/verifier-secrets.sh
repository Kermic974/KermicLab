#!/usr/bin/env bash
set -euo pipefail

depot="${1:-${GITHUB_REPOSITORY:-kermic974/KermicLab}}"

if ! command -v gh >/dev/null 2>&1; then
  echo "Erreur : installez GitHub CLI (gh) pour vérifier les secrets du dépôt." >&2
  exit 2
fi

if ! gh auth status --hostname github.com >/dev/null 2>&1; then
  echo "Erreur : connectez GitHub CLI avec gh auth login." >&2
  exit 2
fi

if ! secrets="$(gh secret list --repo "$depot" --json name --jq '.[].name')"; then
  echo "Erreur : impossible de lire les noms des secrets du dépôt $depot." >&2
  exit 2
fi

manquants=0
for secret in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID; do
  if grep --fixed-strings --line-regexp --quiet "$secret" <<< "$secrets"; then
    printf '[présent] %s\n' "$secret"
  else
    printf '[manquant] %s\n' "$secret"
    manquants=1
  fi
done

if [[ "$manquants" -ne 0 ]]; then
  echo "Configurez les secrets manquants dans Settings → Secrets and variables → Actions." >&2
  exit 1
fi

echo "Les secrets Cloudflare requis sont configurés. Leurs valeurs n'ont pas été affichées."
