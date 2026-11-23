import { navigateur } from "./outils.mjs";
const b = await navigateur(); const p = await b.newPage({ viewport: { width: 1280, height: 900 }, locale: "fr-FR" });
const log = []; const t0 = Date.now(); const ts = () => ((Date.now()-t0)/1000).toFixed(1);
p.on("response", r => { if (r.url().includes("workers.dev")) log.push(`${ts()} ${r.status()} ${r.url().replace(/.*\.dev/,"")}`); });
p.on("framenavigated", f => { if (f === p.mainFrame()) log.push(`${ts()} nav ${f.url()}`); });
await p.goto("https://www.kermiclab.online/"); await p.locator("#dialogue-pseudo[open]").waitFor();
await p.fill("#pseudo", "Testeur"); await p.click("#formulaire-pseudo button[type=submit]"); await p.locator("#dialogue-pseudo").waitFor({ state: "hidden" });
log.push(`${ts()} clic 1`); await p.click("#ouvrir-connexion");
for (let i = 0; i < 8; i++) { await p.waitForTimeout(500); log.push(`${ts()} url=${p.url().replace(/.*online/,"")} compte=${await p.locator("#compte").isVisible()}`); }
log.push(`${ts()} clic 2`); await p.click("#ouvrir-connexion"); await p.waitForTimeout(1500);
log.push(`${ts()} url=${p.url().replace(/.*online/,"")} compte=${await p.locator("#compte").isVisible()} creation=${await p.locator("#compte-creation").isVisible()}`);
console.log(log.join("\n")); await b.close(); process.exit(0);
