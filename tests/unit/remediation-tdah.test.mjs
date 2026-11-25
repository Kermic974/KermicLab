import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { referencesRemediation, lierReferencesRemediation } from "../../scripts/lib/remediation-tdah.mjs";

const racine = fileURLToPath(new URL("../../", import.meta.url));
const lire = async fichier => JSON.parse(await readFile(new URL(`../../${fichier}`, import.meta.url), "utf8"));

test("Remédiation : huit références partagées réelles et six notions connexes sourcées", async () => {
  const donnees = await referencesRemediation(racine);
  assert.equal(donnees.microskills.length, 8);
  assert.equal(donnees.notions.length, 6);
  assert.equal(new Set(donnees.microskills.map(m => m.id)).size, 8);
  for (const m of donnees.microskills) {
    const canonique = await lire(m.fichierCanonique);
    assert.equal(canonique.id, m.id);
    assert.equal(canonique.label, m.label);
    assert.equal(canonique.status, "draft");
    assert.ok(m.retenir.length > 20);
    assert.ok(m.connexions.length > 0);
    for (const lien of m.connexions) {
      const n = donnees.notions.find(n => n.id === lien.notion);
      const contenu = await lire(n.source);
      assert.equal(n.retenir[lien.niveau].texte, contenu.niveaux[lien.niveau].aRetenir);
      assert.equal((await lire(lien.fichierCanonique)).id, lien.microskill);
      assert.equal(new URL(n.url).pathname, `/maquettes/${n.id}`);
    }
  }
});

test("Remédiation : version autonome embarquée à jour et reconstruction idempotente", async () => {
  const html = await readFile(new URL("../../Sample/lab/remediation-tdah.html", import.meta.url), "utf8");
  const embarque = JSON.parse(html.match(/id="remediation-microskills">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(embarque, await referencesRemediation(racine));
  const meta = JSON.parse(html.match(/id="kermiclab-meta">([\s\S]*?)<\/script>/)[1]);
  assert.equal(meta.version, "1.1.0");
  assert.ok(meta.onglets.includes("memo"));
  assert.deepEqual(meta.microskills, embarque.microskills.map(m => m.id));
  assert.equal(await lierReferencesRemediation(html, racine), html);
});
