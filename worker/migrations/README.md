# Migrations D1 (`kermiclab-kpi`)

Les migrations sont appliquées **dans l'ordre** par le job « Déploiement Cloudflare », avant le déploiement du Worker :
`wrangler d1 migrations apply kermiclab-kpi --remote`. D1 note les migrations appliquées dans sa table `d1_migrations` :
chacune ne s'exécute qu'une fois.

## Règles

1. **Un fichier par changement**, numéroté à la suite : `NNNN_description.sql` (`0002_ajouter_table_x.sql`).
   Créer le fichier avec `cd worker && npx wrangler d1 migrations create kermiclab-kpi ajouter_table_x`.
2. **Une migration fusionnée n'est jamais modifiée** : corriger avec une nouvelle migration.
3. **Ajouts seulement** : `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE … ADD COLUMN` (colonne facultative ou avec valeur
   par défaut). Pas de `DROP`, ni de `RENAME`, ni de changement de type : la version précédente du Worker doit continuer à
   fonctionner avec le nouveau schéma, car le retour arrière automatique (test de fumée en échec) ne restaure que le
   Worker et le site, **jamais la base**. Une suppression se fait en deux temps : le code cesse d'utiliser la table, puis
   une migration ultérieure, validée par le propriétaire, la supprime.
4. **Reporter le changement dans le schéma de référence** (`worker/schema*.sql`), utilisé par les tests : le test
   `tests/unit/migrations.test.mjs` vérifie que les migrations et les schémas de référence produisent la même base.
5. Ni IP ni texte de message dans D1 (AGENTS.md §4).

## 0001 : schéma initial

`0001_schema_initial.sql` réunit les trois schémas appliqués jusqu'ici (`schema.sql` par la CI, `schema-comptes.sql` et
`schema-compte-local.sql` à la main). Uniquement des `CREATE … IF NOT EXISTS` : sur la base de production existante,
elle ne crée que les tables éventuellement manquantes et ne modifie aucune donnée.
