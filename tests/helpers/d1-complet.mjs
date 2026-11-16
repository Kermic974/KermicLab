import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const SCHEMAS = ["schema.sql", "schema-comptes.sql", "schema-compte-local.sql", "schema-backoffice.sql"];

/** D1 factice sur SQLite avec tous les schémas de référence (KPI, comptes, compte local, back-office). */
export function creerD1Complet() {
  const sqlite = new DatabaseSync(":memory:");
  for (const schema of SCHEMAS) sqlite.exec(readFileSync(new URL(`../../worker/${schema}`, import.meta.url), "utf8"));
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
    },
    /** Toutes les valeurs textuelles de toutes les tables : sert à prouver qu'un texte n'a été conservé nulle part. */
    toutLeTexte() {
      const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
      return tables.flatMap(({ name }) => sqlite.prepare(`SELECT * FROM "${name}"`).all()
        .flatMap((ligne) => Object.values(ligne).filter((v) => typeof v === "string").map((valeur) => ({ table: name, valeur }))));
    }
  };
}
