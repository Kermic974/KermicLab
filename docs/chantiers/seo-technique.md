# Socle SEO statique

Le build de KermicLab produit `dist/robots.txt` et `dist/sitemap.xml` à partir des fichiers HTML réellement publiés sur Cloudflare Pages.

## Domaine et routes

L'origine retenue pour le site présenté par ce dépôt est \`https://www.kermiclab.online\`, conformément au déploiement documenté dans [README.fr.md](../../README.fr.md). Les routes sont construites selon la normalisation Pages : les fichiers \`index.html\` correspondent au dossier, les autres pages retirent l'extension \`.html\`. Les pages \`/admin/\` et \`404.html\` sont exclues du sitemap ; le back-office est explicitement \`noindex, nofollow\`.

Le sitemap n'inclut ni date de dernière modification inventée, ni pages servies seulement par l'API Worker. Il est généré à chaque build pour rester aligné avec les pages statiques publiées. Chaque HTML public reçoit une canonical et les balises Open Graph/Twitter dérivées de son title et de sa description.

## Limites

Cette génération décrit le build du dépôt et ne vérifie pas les réponses HTTP des domaines, les redirections, les en-têtes effectifs de production, l'indexation par les moteurs ou les Core Web Vitals. Elle ne change aucune configuration Cloudflare, DNS ou redirection. Les pages du catalogue renvoyées par le Worker ne sont pas ajoutées au sitemap Pages ; leur stratégie d'indexation reste à traiter avec l'inventaire des routes Worker.
