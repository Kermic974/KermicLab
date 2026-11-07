import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readdir, readFile } from "node:fs/promises";

// Migrations D1 versionnées (feuille de route, phase 0 ; issue #178). Règles : worker/migrations/README.md.
const dossier = new URL("../../worker/migrations/", import.meta.url);
const SCHEMAS = ["schema.sql", "schema-comptes.sql", "schema-compte-local.sql"];
const fichiers = (await readdir(dossier)).filter((f) => f.endsWith(".sql")).sort();
const migrations = await Promise.all(fichiers.map(async (f) => ({ f, sql: await readFile(new URL(f, dossier), "utf8") })));
const schemas = await Promise.all(SCHEMAS.map((f) => readFile(new URL(`../../worker/${f}`, import.meta.url), "utf8")));

/** Structure d'une base : tables, colonnes (nom, type, non nul, défaut, clé) et index, indépendamment de l'ordre. */
function structure(db) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  return {
    tables: Object.fromEntries(tables.map(({ name }) => [name,
      db.prepare(`PRAGMA table_info("${name}")`).all().map((c) => [c.name, c.type, c.notnull, c.dflt_value, c.pk])])),
    index: db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name").all()
      .map(({ name, tbl_name }) => `${tbl_name}.${name}`)
  };
}
const base = (...scripts) => { const db = new DatabaseSync(":memory:"); for (const s of scripts) db.exec(s); return db; };

test("migrations : fichiers NNNN_description.sql numérotés à la suite depuis 0001", () => {
  assert.ok(fichiers.length >= 1);
  fichiers.forEach((f, i) => {
    assert.match(f, /^\d{4}_[a-z0-9_]+\.sql$/, f);
    assert.equal(Number(f.slice(0, 4)), i + 1, `${f} : numéro attendu ${String(i + 1).padStart(4, "0")}`);
  });
});

test("migrations : ajouts seulement (ni DROP, ni RENAME, ni suppression de données)", () => {
  for (const { f, sql } of migrations) {
    const code = sql.replace(/--.*$/gm, "");
    assert.doesNotMatch(code, /\bDROP\s+(TABLE|INDEX|COLUMN|VIEW|TRIGGER)\b/i, `${f} : DROP interdit`);
    assert.doesNotMatch(code, /\bRENAME\b/i, `${f} : RENAME interdit`);
    assert.doesNotMatch(code, /\b(DELETE\s+FROM|TRUNCATE)\b/i, `${f} : suppression de données interdite`);
  }
});

test("migrations : appliquées dans l'ordre, elles produisent exactement les schémas de référence", () => {
  assert.deepEqual(structure(base(...migrations.map((m) => m.sql))), structure(base(...schemas)));
});

test("migrations : 0001 est sans effet sur une base de production déjà créée par les schémas", () => {
  const production = base(...schemas);
  production.exec("INSERT INTO evenements (type) VALUES ('demande')");
  const avant = structure(production);
  production.exec(migrations[0].sql);
  assert.deepEqual(structure(production), avant);
  assert.equal(production.prepare("SELECT COUNT(*) AS n FROM evenements").get().n, 1, "données conservées");
});
