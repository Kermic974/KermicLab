# ADR 0003 — Routage en deux étages

- Date : 2026-10-31 — Statut : accepté
- Décision : 1) routage déterministe par mots-clés sur l'index du catalogue (zéro token, testable en non-régression) ; 2) seulement si rien ne correspond, Claude Haiku 5.5 renvoie un JSON structuré (`output_config.format`, effort `low`) : langue, intention, ID de maquette ou « aucune », pertinence, sujet, plan d'onglets, réponse courte. Un ID inconnu renvoyé par le modèle est ignoré.
- Conséquence : le déterminisme est garanti pour toutes les questions d'exemple et les mots-clés des fiches.
