import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

/** Analyse le front matter d'une fiche (sous-ensemble YAML : `cle: valeur`, `cle:` + `  - item`). */
export function lireFrontMatter(texte) {
  const m = texte.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new Error("front matter absent");
  const donnees = {};
  let cleListe = null;
  for (const ligne of m[1].split(/\r?\n/)) {
    if (!ligne.trim() || ligne.trim().startsWith("#")) continue;
    const item = ligne.match(/^\s+-\s+(.*)$/);
    if (item && cleListe) { donnees[cleListe].push(item[1].trim()); continue; }
    const kv = ligne.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) throw new Error(`ligne invalide : ${ligne}`);
    if (kv[2] === "") { cleListe = kv[1]; donnees[cleListe] = []; } else { cleListe = null; donnees[kv[1]] = kv[2].trim(); }
  }
  return donnees;
}

const liste = (v) => (Array.isArray(v) ? v : String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean));

export function lireMetaHtml(html) {
  const m = html.match(/<script type="application\/json" id="kermiclab-meta">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("métadonnées kermiclab-meta absentes");
  return JSON.parse(m[1]);
}

/** Scripts exécutables en ligne (hors JSON de métadonnées). */
export function scriptsEnLigne(html) {
  return [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .filter((s) => !/type="application\/json"/.test(s[1] ?? ""))
    .map((s) => ({ attributs: s[1] ?? "", contenu: s[2] }));
}

export function hashScript(contenu) {
  return `'sha256-${createHash("sha256").update(contenu, "utf8").digest("base64")}'`;
}

/** Recalcule les hashes de script-src dans la CSP de la page. */
export function appliquerCsp(html) {
  const hashes = scriptsEnLigne(html).map((s) => hashScript(s.contenu)).join(" ");
  return html.replace(/(<meta http-equiv="Content-Security-Policy" content="[^"]*script-src )[^;"]*/, `$1${hashes}`);
}

async function existe(p) { try { await stat(p); return true; } catch { return false; } }

/** Charge toutes les maquettes des dossiers donnés (dépôt public + éventuel dépôt privé). */
export async function chargerCatalogue(dossiers) {
  const maquettes = [];
  const pages = {};
  const sources = [];
  for (const dossier of dossiers) {
    if (!(await existe(dossier))) continue;
    for (const nom of (await readdir(dossier)).sort()) {
      const rep = path.join(dossier, nom);
      if (!(await stat(rep)).isDirectory() || !(await existe(path.join(rep, "fiche.md")))) continue;
      const fiche = lireFrontMatter(await readFile(path.join(rep, "fiche.md"), "utf8"));
      for (const champ of ["id", "titre", "sujet", "version", "langues", "onglets", "mots-cles", "questions"]) {
        if (!fiche[champ] || (Array.isArray(fiche[champ]) && !fiche[champ].length)) throw new Error(`${rep}: champ « ${champ} » manquant`);
      }
      if (fiche.id !== nom) throw new Error(`${rep}: l'id « ${fiche.id} » doit être égal au nom du dossier`);
      if (pages[fiche.id]) throw new Error(`id en double : ${fiche.id}`);
      const langues = liste(fiche.langues);
      if (!langues.includes("fr")) throw new Error(`${rep}: la version française est obligatoire`);
      pages[fiche.id] = {};
      for (const langue of langues) {
        const fichier = path.join(rep, langue === "fr" ? "page.html" : `page.${langue}.html`);
        const source = await readFile(fichier, "utf8");
        const html = appliquerCsp(source);
        sources.push({ fichier, aJour: source === html, html });
        const meta = lireMetaHtml(html);
        if (meta.id !== fiche.id || meta.version !== fiche.version) throw new Error(`${fichier}: id/version différents de la fiche`);
        pages[fiche.id][langue] = html;
      }
      maquettes.push({
        id: fiche.id, titre: fiche.titre, sujet: fiche.sujet, version: fiche.version, langues,
        onglets: liste(fiche.onglets), motsCles: liste(fiche["mots-cles"]), questions: liste(fiche.questions)
      });
    }
  }
  return { index: { maquettes }, pages, sources };
}
