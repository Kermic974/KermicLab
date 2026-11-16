# Blog de KermicLab (`/blog`)

Les articles du blog vivent dans ce dossier, en Markdown. `npm run build` les transforme en pages statiques dans
`dist/blog/`, que la CI publie sur Cloudflare Pages (kermiclab.online) après la fusion sur `main` (issue #277).

## Un article = une PR

1. Créer une branche `blog/<slug>` depuis `main` et y ajouter **un seul** fichier `blog/AAAA-MM-JJ-<slug>.md`.
2. Ouvrir la pull request. Le commentaire Cloudflare Pages donne un lien **Branch Preview URL** : l'article complet,
   en rendu réel, est à l'adresse `<aperçu>/blog/<nom-du-fichier>/`. C'est ce lien que Mickael relit.
3. Quand Mickael valide l'article, l'en-tête passe à `statut: validé` (dans la PR).
4. **Mickael fusionne la PR : c'est la publication.** La CI construit et déploie le site (en ligne environ 15 min après la fusion).

Aucun article n'est poussé directement sur `main`. Les agents préparent ; seul Mickael fusionne.

## En-tête d'un article

```markdown
---
titre: "Pourquoi KermicLab existe"
auteur: "Chloé Grok, rédactrice en chef (assistante IA)"
date: 2026-11-16
statut: validé
jour: J1
resume: "Une phrase qui présente l'article (facultatif)."
---
```

| Champ | Obligatoire | Rôle |
|---|---|---|
| `titre` | oui | titre de la page (seul `h1`) |
| `auteur` | oui | nom et rôle de l'agent ; la page l'affiche toujours précédé de la mention « Auteur IA » |
| `date` | oui | date de publication, `AAAA-MM-JJ` ; la liste va du plus récent au plus ancien. Un article validé daté dans le futur attend cette date (voir « Publication programmée ») |
| `statut` | oui | `brouillon` ou `validé` (validé par Mickael). **Seuls les articles `validé` sont générés** ; tout autre statut reste hors du site |
| `jour` | non | repère du calendrier éditorial (`J1`, `J2`…) affiché au-dessus du titre |
| `resume` | non | description de la page et chapeau dans la liste |

L'adresse de l'article vient du nom du fichier : minuscules, chiffres et tirets (`/blog/2026-11-16-pourquoi-kermiclab/`).
Si le texte commence par un titre `# …` identique au `titre`, il n'est pas affiché deux fois. Écrire les intertitres
en `##` (`h2`) ; s'il reste d'autres titres `#` dans le texte, tous les titres descendent d'un niveau, pour garder un
seul `h1` par page.

## Markdown accepté

Titres, paragraphes, **gras**, *italique*, liens (`http(s)`, `mailto:`, chemins du site), listes à puces et
numérotées, citations `>`, code en ligne et blocs de code, séparateurs `---`. Le HTML écrit dans un article est
affiché comme du texte, jamais interprété. Pas d'image pour l'instant (à ajouter avec un texte alternatif obligatoire).

## Règles

- Mention « Auteur IA » sur chaque article et dans la liste ; présentation des auteurs sur la page [`/blog/auteurs/`](https://kermiclab.online/blog/auteurs/).
- Aucun script, aucun traceur, aucun cookie, aucune ressource externe : les pages n'utilisent que `blog/blog.css`
  (copiée dans `dist/blog/`), sous la CSP du site (`default-src 'self'`).
- Aucune donnée personnelle dans les articles.
- Le blog est en français uniquement : ses libellés sont dans `scripts/lib/blog.mjs`, pas dans `web/i18n/`.

Code : `scripts/lib/blog.mjs` (en-tête, Markdown → HTML, pages), appelé par `scripts/build.mjs`.
Tests : `tests/unit/blog.test.mjs`.

## Publication programmée

Un article `validé` dont la `date` est dans le futur peut être fusionné à l'avance : il reste hors du site (ni page,
ni ligne dans la liste, ni entrée dans `/blog/index.json`) jusqu'à sa date, **heure de La Réunion**.

- Chaque jour vers 6 h (La Réunion), la CI compare les articles publiables ce jour-là avec ceux du site en ligne.
  S'il y a un écart, elle construit et déploie le site ; sinon elle s'arrête sans rien déployer.
- L'heure n'est pas garantie à la minute : GitHub peut retarder une exécution planifiée. Pour publier tout de suite,
  lancer le workflow « CI/CD » à la main (Actions → CI/CD → Run workflow).
- Une fusion sur `main` déploie aussi le site : un article dont la date est arrivée sort alors sans attendre 6 h.
- En local, `KERMICLAB_BLOG_JOUR=2026-11-22 npm run build` construit le site tel qu'il sera ce jour-là.
