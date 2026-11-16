# ADR 0027 — Google Analytics 4, soumis au consentement

- Date : 2026-11-16 — Statut : proposé (à valider par le propriétaire)
- Contexte : le propriétaire demande de configurer Google Analytics pour `kermiclab.online` (propriété GA4,
  identifiant de mesure `G-7ZGW294NN8`). Le site mesurait déjà son audience avec Cloudflare Web Analytics, sans
  cookie. Google Analytics dépose des cookies (`_ga`, `_ga_<flux>`) et envoie des données à Google : en France, ce
  traceur exige un consentement préalable, et le public du site est en partie mineur (AGENTS.md §1).
- Décision :
  1. **Refus par défaut** : aucun script de Google n'est chargé et aucun cookie n'est déposé avant un accord explicite
     dans un bandeau. « Refuser » et « Accepter » ont la même importance visuelle ; sans réponse, rien n'est envoyé.
  2. **Une seule source**, `web/audience.js` : il lit l'identifiant dans `config.json` (`mesureGoogle`), affiche le
     bandeau, garde le choix sur l'appareil (`localStorage`, clé `kermiclab_audience`, valeurs `accepte` / `refuse`,
     sans identifiant) et n'insère `gtag.js` qu'après accord. Le choix se modifie depuis le pied de page du tableau de
     bord et depuis la page Confidentialité ; un refus après accord désactive la mesure et efface les cookies `_ga*`.
  3. **Périmètre réduit** : le tableau de bord (`web/index.html`) et la page Confidentialité seulement. Les pages du
     catalogue (contrat §5 : aucun appel réseau), l'application `/cercle/`, le blog et le back-office ne chargent
     jamais Google Analytics.
  4. **Données minimales** : signaux Google et personnalisation des annonces désactivés, consentement publicitaire
     (`ad_storage`, `ad_user_data`, `ad_personalization`) toujours refusé, adresse de page réduite à l'origine et au
     chemin (jamais le fragment `#…`, qui peut porter le contexte d'une idée, ni les paramètres). Aucun événement
     propre au site, aucun pseudo, aucune question, aucune progression n'est envoyé.
  5. **Configuration au build** : identifiant public, valeur par défaut dans `scripts/build.mjs`, surchargeable par la
     variable `KERMICLAB_GA_ID` ; vide, la mesure est désactivée (ni bandeau, ni origine Google dans la CSP). La CSP du
     site n'autorise les origines de Google (`*.googletagmanager.com`, `*.google-analytics.com`,
     `*.analytics.google.com`) que si un identifiant est configuré ; toujours sans `'unsafe-inline'`.
  6. Cloudflare Web Analytics reste en place : il donne une mesure complète sans cookie, alors que Google Analytics
     ne compte que les visiteurs qui acceptent.
- Conséquences :
  - Le principe « aucune donnée personnelle collectée » (AGENTS.md §1) reçoit une exception explicite, limitée aux
    visiteurs qui acceptent : cookies et données de navigation traités par Google, avec transfert possible hors de
    l'Union européenne. La page Confidentialité et la fiche `docs/chantiers/rgpd.md` le décrivent.
  - Points de contrôle humains (`docs/actions-manuelles.md`) : validation juridique (base légale, mineurs de moins de
    15 ans, transfert), réglages de la propriété GA4 (conservation, signaux, partage de données) et vérification en
    production.
  - Pour retirer Google Analytics : vider `GA_PAR_DEFAUT` dans `scripts/build.mjs` (la CI ne transmet pas
    `KERMICLAB_GA_ID`, utile seulement pour un build local) ; le code et le bandeau restent alors inactifs.
- Tests : `tests/unit/audience.test.mjs` (identifiant, choix, effacement des cookies, CSP, absence dans les pages
  autonomes) et `tests/e2e/audience.test.mjs` (aucun appel à Google sans accord ni après refus, chargement après
  accord sous la CSP du site, changement de choix).
