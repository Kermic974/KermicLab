#!/usr/bin/env bash
# Crée (ou complète) un tableau GitHub Projects par projet de la feuille de route, à partir de .github/projets.json.
# Chaque tableau est lié au dépôt et reçoit les issues portant le label projet:<clé> (épique et sous-issues).
# Idempotent : un tableau existant (même titre) est réutilisé, une issue déjà présente n'est pas dupliquée.
# À lancer par le propriétaire avec la CLI `gh` authentifiée et le scope « project » :
#   gh auth refresh -s project
#   bash scripts/configurer-projets.sh
# Voir docs/projets.md et docs/actions-manuelles.md.
set -euo pipefail
cd "$(dirname "$0")/.."
REGISTRE=.github/projets.json
DEPOT=$(jq -r '.depot' "$REGISTRE")
PROPRIETAIRE=${DEPOT%%/*}
SITE="https://www.kermiclab.online/feuille-de-route.html"

existants=$(gh project list --owner "$PROPRIETAIRE" --limit 200 --format json)

jq -c '.projets | sort_by(.priorite)[]' "$REGISTRE" | while read -r projet; do
  cle=$(jq -r '.cle' <<<"$projet")
  titre="KermicLab · $(jq -r '.titre' <<<"$projet")"
  ancre=$(jq -r '.ancre' <<<"$projet")
  epic=$(jq -r '.epic' <<<"$projet")
  priorite=$(jq -r '.priorite' <<<"$projet")
  horizon=$(jq -r '.horizon' <<<"$projet")

  numero=$(jq -r --arg t "$titre" '.projects[] | select(.title == $t) | .number' <<<"$existants" | head -n1)
  if [ -z "$numero" ]; then
    numero=$(gh project create --owner "$PROPRIETAIRE" --title "$titre" --format json | jq -r '.number')
    echo "== créé : $titre (n° $numero)"
  else
    echo "== existant : $titre (n° $numero)"
  fi

  gh project link "$numero" --owner "$PROPRIETAIRE" --repo "$DEPOT" >/dev/null 2>&1 || true
  gh project edit "$numero" --owner "$PROPRIETAIRE" \
    --description "Priorité $priorite · horizon $horizon · label projet:$cle" \
    --readme "Feuille de route : $SITE#$ancre
Épique : https://github.com/$DEPOT/issues/$epic
Registre : https://github.com/$DEPOT/blob/main/docs/projets.md
Nouvelle tâche : label projet:$cle, puis sous-issue de l'épique ; relancer ce script pour l'ajouter au tableau." >/dev/null

  gh issue list --repo "$DEPOT" --label "projet:$cle" --state all --limit 500 --json url --jq '.[].url' |
    while read -r url; do
      gh project item-add "$numero" --owner "$PROPRIETAIRE" --url "$url" >/dev/null
      echo "   + $url"
    done
done
echo "Terminé. Tableaux visibles dans l'onglet Projects du dépôt : https://github.com/$DEPOT/projects"
