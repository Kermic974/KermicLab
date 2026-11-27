import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { scriptsEnLigne } from "../../scripts/lib/catalogue.mjs";
const html = readFileSync(new URL("../../Sample/lab/remediation-tdah.html", import.meta.url), "utf8");
const harness = readFileSync(new URL("../../Sample/lab/petits-pas-harness.mjs", import.meta.url), "utf8").replace(/^export /gm, "");
test("harness autonome identique au module et CSP valide", () => {
  const scripts = scriptsEnLigne(html);
  assert.equal(scripts.length, 1);
  const script = scripts[0].contenu;
  assert.ok(script.includes(harness));
  assert.ok(html.includes("sha256-" + createHash("sha256").update(script).digest("base64")));
  assert.ok(html.includes("connect-src 'none'"));
});
