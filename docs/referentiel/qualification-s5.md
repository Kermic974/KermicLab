# Qualification S5 v1.0.0

La norme a été adoptée dans la PR #369. La PR #374 ajoute le contrôle du catalogue CSV et l’index des sources. Les tests de couverture relient chaque diagnostic à sa fixture nommée et à sa sévérité.

## Reproductibilité Windows

Environnement local Node 22.23.5, dépendances verrouillées et catalogue public. Le lint, le build et le contrôle des 174 pages passent. Après synchronisation avec `main`, les 775 tests unitaires passent, dont l’historique Git avec chemin long et le rejet d’un dépôt incomplet. L’inventaire UX est identique aux sources et son registre est vérifié.

Les conversions de fichiers utilisent `fileURLToPath`. La lecture de l’historique utilise `git -c core.longpaths=true` pour chaque commande. Les tests de régression exécutent les mêmes contrôles sur Ubuntu en CI.

Les fichiers texte versionnés utilisent LF. Le fichier `.gitattributes` rend cette convention explicite pour les checkouts Windows et Linux, afin que les empreintes de sources UX soient reproductibles indépendamment de la configuration globale Git.

Le rapport canonique complet sur Windows est PASS, avec zéro erreur et zéro avertissement. Deux builds successifs produisent exactement les mêmes 732 fichiers du catalogue, du site et du Worker, avec un diff vide sur les pages du catalogue et `index.html`. Le serveur navigateur normalise ses chemins avant de vérifier leur appartenance au dossier servi. Les 11 tests ciblés des jeux concernés passent.

La qualification finale doit relever les tests navigateur Windows complets, la CI Ubuntu et le contrôle du catalogue public après déploiement. Les révisions et résultats seront consignés ici avant clôture.
