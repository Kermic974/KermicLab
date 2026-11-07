import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

/**
 * D1 factice sur SQLite avec le vrai schéma des comptes (`worker/schema-comptes.sql` par défaut), sans service externe.
 * @param {string} schema fichier de schéma du dossier `worker/` (ex. `schema-compte-local.sql`, ADR 0024).
 */
export function creerD1Comptes(schema = "schema-comptes.sql") {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL(`../../worker/${schema}`, import.meta.url), "utf8"));
  const lie = (sql, valeurs) => ({
    run: async () => ({ meta: { changes: sqlite.prepare(sql).run(...valeurs).changes } }),
    first: async () => sqlite.prepare(sql).get(...valeurs) || null,
    all: async () => ({ results: sqlite.prepare(sql).all(...valeurs) })
  });
  return {
    sqlite,
    prepare: (sql) => ({ bind: (...valeurs) => lie(sql, valeurs) }),
    batch: async (instructions) => {
      sqlite.exec("BEGIN");
      try {
        const r = [];
        for (const i of instructions) r.push(await i.run());
        sqlite.exec("COMMIT");
        return r;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    }
  };
}
