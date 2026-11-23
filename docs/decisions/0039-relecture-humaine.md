# ADR 0039 — Journal de relecture humaine des notions

- Date : 2026-11-23 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : la grille v1 est cochée dans la PR (chantier validation des maquettes) et les champs `relue*` de `fiche.md`
  tracent une relecture dans le dépôt, sans nom. Le propriétaire veut une confirmation humaine vérifiable, liée au compte
  du relecteur par son identifiant anonymisé, et visible sur la notion comme le suivi d'un contributeur.

## Décision

1. **Où.** Le bouton « Confirmer la relecture humaine » est dans l'application, sur la notion ouverte (bulle), pas dans
   la page autonome du catalogue : celle-ci reste sans réseau. Le badge de statut est au même endroit, visible de tous.
2. **Qui.** Un compte authentifié dont un rôle **attribué à la main** porte la permission `relecture.humaine`. Les rôles
   système `prof` et `admin` l'ont. Un rôle personnalisé l'a seulement si quelqu'un l'y ajoute, puis l'attribue au compte.
   La souscription « Professeur » ajoute le rôle `prof` aux permissions effectives : elle **ne** donne pas cette
   confirmation. Les comptes locaux sont acceptés sur le même modèle que les contributions (ADR 0023 §6 ter), parce que
   c'est ainsi que les rôles sont attribués aujourd'hui — point à confirmer.
3. **Journal.** Table `relectures_humaines`, une ligne par confirmation. Une correction est une nouvelle ligne. Des
   déclencheurs SQLite interdisent `UPDATE` et `DELETE`, sauf mettre `relecteur_id` à `NULL` (effacement du compte) :
   la décision, le code court, l'empreinte et le commentaire restent, sans lien réversible vers la personne.
4. **Ce qui est enregistré**, tout calculé par le Worker : identifiant anonymisé du compte (jamais l'e-mail ni le nom),
   rôle au moment de la confirmation, notion, version du catalogue, empreinte SHA-256 du contenu pédagogique (le JSON
   `#kermiclab-contenu`, ou la page entière si elle est écrite à la main), grille (`v1` ou `jeux-v1` selon le sujet),
   critères cochés, décision (`conforme` ou `a_corriger`), commentaire facultatif filtré par `donneesPersonnelles`,
   horodatage `datetime('now')`. Le navigateur ne peut pas fournir la version ni l'empreinte.
5. **Statut.** La dernière ligne de la notion fait foi. Empreinte identique et décision conforme : « relue le JJ/MM ·
   code ». Empreinte différente : « à revoir ». Décision « à corriger » sur l'empreinte actuelle : « à corriger ».
   Aucune ligne : « non relue ». Le code est le même code court que les contributions. Le commentaire ne sort pas sur
   la notion ; le relecteur le revoit dans son suivi.
6. **Sécurité.** `POST /api/relectures` exige une session de compte (cookie OAuth ou jeton de compte local) et le rôle.
   La clé partagée du back-office n'est pas consultée. Aucune route d'IA n'écrit dans le journal. « Conforme » exige
   les six critères de la grille ; « à corriger » en laisse au moins un décoché.
7. **Quatre yeux, limite.** Le Worker ne sait pas qui a écrit la dernière modification du catalogue : c'est un commit
   Git, dont l'auteur est une identité (nom, identifiant GitHub), pas un compte Kermiclab. Relier les deux identifierait
   une personne et sortirait du modèle. Le relecteur peut donc confirmer un contenu qu'il a lui-même modifié dans le
   dépôt. Ce qui est garanti : seul un humain connecté, avec un rôle attribué à la main, ajoute une ligne.
8. **Conservation proposée : 5 ans** après la relecture. La purge automatique n'est pas branchée : elle exigerait un
   `DELETE`, interdit tant que le propriétaire n'a pas confirmé la durée. Le lien vers le compte, lui, est retiré dès
   la suppression du compte.
9. **Hors de cette décision.** Les champs `relue`, `relue-version` et `relue-grille` de `fiche.md` ne sont pas écrits
   par le journal. Aucun nom n'entre dans le dépôt.

## Conséquences

- Migration `0010_relectures_humaines.sql`. Registre des traitements : table `relectures_humaines`.
- Le build continue de compter « à revoir » à partir des champs `relue*` du dépôt. Le badge de l'application suit
  l'empreinte du journal. Les deux traces sont complémentaires.
- Page Confidentialité : paragraphe « Relecture humaine des notions », à relire.

## Pont possible, non fait

Une PR ultérieure pourrait, après une confirmation « conforme », proposer les trois champs `relue*` (date, version,
grille) **sans nom**. Le CODEOWNER fusionnerait. Le journal resterait la trace vérifiable du qui ; le dépôt, la trace
de publication du quand.
