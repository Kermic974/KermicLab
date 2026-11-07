import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { lireRelecture, indicateurRelecture, GRILLES_RELECTURE } from "../../scripts/lib/catalogue.mjs";

// Relecture pédagogique tracée dans fiche.md (feuille de route, phase 0 ; issue #176).
const racine = new URL("../..", import.meta.url).pathname;
const options = { aujourdhui: "2026-11-07" };
const valider = (champs) => lireRelecture({ id: "fractions", version: "1.2.0", ...champs }, options);
const complete = { relue: "2026-11-07", "relue-version": "1.2.0", "relue-grille": "v1" };

test("relecture : absente → rien ; complète → date, version et grille", () => {
  assert.deepEqual(valider({}), {});
  assert.deepEqual(valider(complete), { relecture: { date: "2026-11-07", version: "1.2.0", grille: "v1" } });
  assert.deepEqual(valider({ ...complete, "relue-version": "1.1.3" }).relecture.version, "1.1.3", "une version antérieure reste valide (à revoir)");
});

test("relecture : champs incomplets ou invalides refusés", () => {
  const cas = [
    [{ relue: "2026-11-07" }, /vont ensemble/],
    [{ ...complete, relue: "07/11/2026" }, /AAAA-MM-JJ/],
    [{ ...complete, relue: "2026-02-30" }, /AAAA-MM-JJ/],
    [{ ...complete, relue: "2026-11-08" }, /futur/],
    [{ ...complete, "relue-version": "1.2" }, /X\.Y\.Z/],
    [{ ...complete, "relue-version": "1.3.0" }, /supérieure à la version/],
    [{ ...complete, "relue-grille": "v9" }, /inconnue/]
  ];
  for (const [champs, message] of cas) assert.throws(() => valider(champs), message, JSON.stringify(champs));
});

test("relecture : indicateur des notions relues et à revoir, jeux exclus", () => {
  const maquettes = [
    { id: "a", sujet: "mathematiques/a", version: "1.0.0", relecture: { version: "1.0.0" } },
    { id: "b", sujet: "mathematiques/b", version: "1.1.0", relecture: { version: "1.0.0" } },
    { id: "c", sujet: "mathematiques/c", version: "1.0.0" },
    { id: "echecs", sujet: "jeux/echecs", version: "1.0.0", relecture: { version: "1.0.0" } }
  ];
  assert.deepEqual(indicateurRelecture(maquettes), { notions: 3, relues: 1, aRevoir: 1 });
});

test("relecture : la grille publiée correspond aux versions acceptées", async () => {
  const doc = await readFile(`${racine}docs/chantiers/validation-maquettes.md`, "utf8");
  for (const grille of GRILLES_RELECTURE) assert.match(doc, new RegExp(`Grille de relecture ${grille}\\b`));
});
