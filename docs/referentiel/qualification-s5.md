# Qualification S5 v1.0.0

La norme a été adoptée dans la PR #369. La PR #374 ajoute le contrôle du catalogue CSV et l’index des sources. Les tests de couverture relient chaque diagnostic à sa fixture nommée et à sa sévérité.

## Reproductibilité Windows

Environnement local Node 22.23.5, dépendances verrouillées et catalogue public. Le lint passe sur 2 869 fichiers. Le build et le contrôle des 174 pages passent. Les 770 tests unitaires passent, dont l’historique Git avec chemin long et le rejet d’un dépôt incomplet. L’inventaire UX est identique aux sources et son registre est vérifié.

Les conversions de fichiers utilisent `fileURLToPath`. La lecture de l’historique utilise `git -c core.longpaths=true` pour chaque commande. Les tests de régression exécutent les mêmes contrôles sur Ubuntu en CI.

La qualification finale doit relever les tests navigateur Windows, le rapport canonique complet, la CI Ubuntu, l’idempotence du build et le contrôle du catalogue public après déploiement. Les révisions et résultats seront consignés ici avant clôture.
