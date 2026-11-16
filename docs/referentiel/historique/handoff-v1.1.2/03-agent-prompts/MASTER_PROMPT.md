# Prompt maître pour GitHub Copilot ou Claude Code

Tu prends le relais sur le dépôt KermicLab. Lis d'abord tous les fichiers de ce paquet dans l'ordre indiqué par `00-start-here/README.md`.

Ta première mission n'est pas de refactorer. Elle est d'auditer le dépôt réel et de produire :
1. l'état reproductible du build/tests/CI ;
2. l'inventaire des zones concernées ;
3. la matrice d'écart existant vers S4 ;
4. la classification keep/adapt/migrate/retire ;
5. les risques de régression ;
6. un plan de PRs atomiques ;
7. la liste des questions réellement bloquantes, après inspection du code.

Contraintes : ne repars pas de zéro ; ne modifies pas la sémantique normative ; applique S4.2 v1.1.2 ; exclue `version` de projectionKey ; utilise une provenance structurée ; ne prétends pas que JSON Schema couvre les règles interobjets ; préserve les contrôles existants ; n'effectue aucune migration massive avant audit.

Après l'audit, propose le plus petit premier lot implémentable avec critères d'acceptation et rollback. N'effectue ce lot que si l'environnement permet de le vérifier intégralement.
