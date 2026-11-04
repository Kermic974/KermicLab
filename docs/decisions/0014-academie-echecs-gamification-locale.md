# ADR 0014 — Académie des échecs : didacticiel progressif et gamification gardée dans la page

- Date : 2026-11-04 — Statut : **accepté** (validé par le propriétaire le 2026-11-04)
- Contexte : la page Échecs (ADR 0013) doit aussi faire progresser le joueur « du débutant au pro » : retenir les
  stratégies connues et s'améliorer, avec une gamification riche et personnalisée. Le tableau de bord a déjà sa propre
  progression (XP, série, badges : ADR 0012), mais une page autonome n'a aucun accès réseau (`connect-src 'none'`) et
  s'ouvre dans une iframe isolée ; le contrat d'événements `postMessage` entre pages et tableau de bord n'existe pas encore
  (feuille de route, phase 1).

## Décision

1. **Un onglet `academie`** dans la page Échecs (le registre d'onglets le permet sans toucher au socle), qui réutilise le
   moteur validé par perft et l'échiquier du jeu.
2. **Le parcours est une donnée** (`<script type="application/json" id="parcours-echecs">`) : 6 grades (Pion → Roi),
   20 leçons, chacune avec une explication courte, une stratégie « à retenir » et des exercices (QCM, coups à trouver,
   suites de plusieurs coups avec réponse automatique de l'adversaire, pièges expliqués). Les tests rejouent chaque
   solution avec le moteur et vérifient, en tactique, qu'elle est le meilleur coup selon une analyse à 3 demi-coups.
3. **La gamification est un module pur** (`<script id="academie-echecs">`, la date est passée en paramètre) : XP et niveaux,
   grades qui débloquent les leçons et des emblèmes, étoiles, 17 badges, série de jours, objectif du jour choisi par le
   joueur, révision espacée (boîtes de Leitner : 1, 2, 4, 8, 16 jours), défi du jour identique pour tous, statistiques par
   thème et conseil personnalisé (réviser, retravailler le point faible, avancer, se perfectionner, jouer). Les parties
   gagnées contre l'ordinateur rapportent de l'XP, une seule fois par partie.
4. **Stockage local uniquement**, par la couche `stockage` de la page (`kermiclab:echecs:academie`), relu et validé
   champ par champ. Aucune donnée personnelle : des compteurs et des identifiants de leçons. Pas de synchronisation avec
   la progression du tableau de bord pour l'instant.

## Conséquences

- La progression de l'Académie est gardée quand la page est ouverte en plein écran ; dans l'iframe du chat
  (`sandbox` sans `allow-same-origin`), elle dure le temps de la visite, et la page le signale.
- Quand le contrat `postMessage` existera, la page pourra émettre ses événements (leçon terminée, badge) pour que le
  tableau de bord les enregistre ; le module pur sera alors la source des événements, sans changer le contenu.
- Ajouter une leçon = compléter le JSON ; les tests vérifient la structure, les positions et les solutions.
