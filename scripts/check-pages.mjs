import { LABS_EXPERIENCES } from "./lib/labs-experiences.mjs";
import { fileURLToPath } from "node:url";
// Contrôle de sécurité des pages HTML du catalogue : CSP stricte à jour, aucun script ou ressource externe,
// aucun appel réseau, métadonnées et onglets de base présents.
import { readFile } from "node:fs/promises";
import { appliquerCsp, chargerCatalogue, lireMetaHtml } from "./lib/catalogue.mjs";

import { synchroniserProjectionV0 } from "./lib/referentiel-projection.mjs";

const racine = fileURLToPath(new URL("..", import.meta.url));
const fichesObsoletes = await synchroniserProjectionV0(racine);
if (fichesObsoletes.length) {
  console.error(fichesObsoletes.map(fiche => fiche + ": projection S4 obsolète — lancer npm run build").join("\n"));
  process.exit(1);
}
const { sources, pages } = await chargerCatalogue([`${racine}catalogue`, `${racine}catalogue-prive`]);
const publiees = Object.entries(pages).flatMap(([id, traductions]) =>
  Object.entries(traductions).map(([langue, html]) => ({ fichier: `Worker/${id}/${langue}`, aJour: true, html })));
const pilotes = await Promise.all(["systeme-solaire", "business-plan", "remediation-tdah"].map(async (id) => {
  const fichier = `${racine}Sample/lab/${id}.html`;
  const html = await readFile(fichier, "utf8");
  return { fichier, aJour: html === appliquerCsp(html), html };
}));
const experiences = await Promise.all(LABS_EXPERIENCES.map(async ({ source }) => {
  const fichier = racine + source;
  const html = await readFile(fichier, "utf8");
  return { fichier, aJour: html === appliquerCsp(html), html, experience: true };
}));
const ONGLETS_DE_BASE = ["explication", "application", "mise-en-situation"];
const erreurs = [];

for (const { fichier, aJour, html, experience } of [...sources, ...publiees, ...pilotes, ...experiences]) {
  const err = (m) => erreurs.push(`${fichier.replace(racine, "")}: ${m}`);
  if (!aJour) err("page obsolète (hashes CSP ou page générée depuis contenu.json) — lancer `npm run build` et committer");
  const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/)?.[1];
  if (!csp) err("CSP absente");
  else {
    for (const d of ["default-src 'none'", "connect-src 'none'", "base-uri 'none'", "form-action 'none'"]) if (!csp.includes(d)) err(`CSP : « ${d} » requis`);
    if (/script-src[^;]*'unsafe-(inline|eval)'/.test(csp)) err("CSP : 'unsafe-inline'/'unsafe-eval' interdits dans script-src");
  }
  if (/<script\b[^>]*\ssrc\s*=/i.test(html)) err("script externe interdit");
  if (/<(link|img|iframe|source|video|audio|embed|object)\b[^>]*\s(href|src|data)="(?!data:|#)/i.test(html)) err("ressource externe interdite");
  // Recherche sur tout le document (scripts, attributs on*, styles) : plus strict qu'un filtrage partiel.
  if (/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)\s*\(/.test(html)) err("appel réseau interdit");
  if (/\beval\s*\(|new Function\s*\(/.test(html)) err("eval/new Function interdits");
  if (!/<meta name="viewport"/.test(html)) err("meta viewport manquante (mobile)");
  try {
    const meta = lireMetaHtml(html);
    for (const c of ["id", "titre", "sujet", "version", "date", "onglets"]) if (!meta[c]) err(`métadonnée « ${c} » manquante`);
    for (const o of experience ? [] : ONGLETS_DE_BASE) if (!meta.onglets?.includes(o)) err(`onglet de base « ${o} » manquant`);
  } catch (e) { err(e.message); }
}

if (erreurs.length) { console.error(erreurs.join("\n")); process.exit(1); }
console.log(`Pages OK (${sources.length} sources, ${publiees.length} publiées, ${pilotes.length} pilote).`);
