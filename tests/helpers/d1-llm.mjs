import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

/** Exécute les vraies requêtes D1 de quota avec SQLite, sans service externe. */
export function creerD1Llm() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../../worker/schema.sql", import.meta.url), "utf8"));
  const lignes = [];
  return {
    sqlite, lignes,
    prepare(sql) {
      return {
        bind(...valeurs) {
          return {
            run: async () => {
              if (/INSERT INTO evenements/.test(sql)) lignes.push(valeurs);
              const resultat = sqlite.prepare(sql).run(...valeurs);
              return { meta: { changes: resultat.changes } };
            },
            first: async () => sqlite.prepare(sql).get(...valeurs) || null
          };
        }
      };
    }
  };
}
