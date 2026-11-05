import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chargerCatalogue } from "./lib/catalogue.mjs";
import { collectionTrophees } from "./lib/trophees.mjs";

const racine = fileURLToPath(new URL("../", import.meta.url));
const echapper = (texte) => String(texte).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const lire = (fichier) => readFile(path.join(racine, fichier), "utf8");

async function sources(dossier) {
  const fichiers = [];
  for (const entree of await readdir(path.join(racine, dossier), { withFileTypes: true })) {
    const nom = `${dossier}/${entree.name}`;
    if (entree.isDirectory()) fichiers.push(...await sources(nom));
    else fichiers.push(nom);
  }
  return fichiers;
}

export async function construireInventaire() {
  const catalogue = await chargerCatalogue([path.join(racine, "catalogue")]);
  const modules = new Map(collectionTrophees(catalogue).modules.map((m) => [m.id, m.progression]));
  const index = await lire("web/index.html");
  const fr = JSON.parse(await lire("web/i18n/fr.json"));
  const { apiUrl } = JSON.parse(await lire("web/config.json"));
  const fichiers = (await Promise.all(["web", "catalogue", "gabarit", "src"].map(sources))).flat().sort();
  const empreinte = createHash("sha256");
  for (const fichier of fichiers) empreinte.update(fichier).update("\0").update(await readFile(path.join(racine, fichier))).update("\0");
  const dialogues = [...index.matchAll(/<dialog id="([^"]+)"/g)].map((m) => m[1]);
  const navigation = [...new Set([...index.matchAll(/data-nav="([^"]+)"/g)].map((m) => m[1]))];
  const lignes = [];
  for (const notion of catalogue.index.maquettes) {
    const html = catalogue.pages[notion.id].fr;
    const contenu = html.match(/<script type="application\/json" id="kermiclab-contenu">([\s\S]*?)<\/script>/)?.[1];
    const c = contenu ? JSON.parse(contenu) : null;
    const jeu = notion.sujet.startsWith("jeux/");
    const onglets = c ? notion.onglets.map((id) => c.titresOnglets?.[id] ?? id) :
      [...html.matchAll(/enregistrerOnglet\(\{\s*id:\s*"([^"]+)"[^}]*?titre:\s*"([^"]+)"([^}]*?)[,}]/g)]
        .filter((m) => m[1] !== "self-test").map((m) => m[2]);
    if (!onglets.length) throw new Error(`Inventaire UX : onglets absents pour ${notion.id}`);
    const cible = jeu ? `jeux.html#jeu-${notion.id}` : notion.id === "trigo-cercle" ? "notion.html#cercle-catalogue" : "notion.html";
    const p = modules.get(notion.id);
    const progression = !p ? "Non compatible avec Mes trophées" :
      [p.genre, p.etoilesTotal === undefined ? "" : `${p.etoilesTotal} étoiles`,
        p.leconsTotal === undefined ? "" : `${p.leconsTotal} leçons`,
        p.gradesTotal === undefined ? "" : `${p.gradesTotal} grades`,
        p.record === undefined ? "" : "record", `${p.badges.length} badges`].filter(Boolean).join(" · ");
    const matiere = notion.sujet.split("/")[0];
    const active = `${apiUrl}/maquettes/${encodeURIComponent(notion.id)}?lang=fr`;
    const source = `https://github.com/Kermic974/trigoLab/blob/main/catalogue/${encodeURIComponent(notion.id)}/${c ? "contenu.json" : "page.html"}`;
    lignes.push(`<tr data-notion="${echapper(notion.id)}"><td><a href="${echapper(cible)}">${echapper(notion.titre)}</a><br><code>${echapper(notion.id)}</code><br><a data-lien-actif href="${echapper(active)}" target="_blank" rel="noopener noreferrer">Vue active</a> · <a data-lien-actif href="${echapper(source)}" target="_blank" rel="noopener noreferrer">Source main</a></td><td>${echapper(fr[`matiere_${matiere}`] ?? `${matiere} (libellé absent du site)`)}</td><td>${echapper(fr[`niveau_${notion.niveau}`])}</td><td>${echapper(notion.version)}</td><td>${echapper(onglets.join(" · "))}</td><td>${echapper(c?.application?.figure?.type ?? "—")}</td><td>${echapper(progression)}</td></tr>`);
  }
  const jeux = catalogue.index.maquettes.filter((n) => n.sujet.startsWith("jeux/")).length;
  const liensDialogues = { "dialogue-pseudo": "premiere-visite", profil: "profil", "bulle-lab": "bulle", defi: "defi", progres: "badges", signalement: "support", compte: "comptes", consentement: "comptes" };
  for (const id of dialogues) if (!liensDialogues[id]) throw new Error(`Inventaire UX : dialogue non représenté ${id}`);
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'">
  <title>Atelier UX · Inventaire vérifiable · KermicLab</title>
  <style>
    * { box-sizing: border-box; } body { margin: 0; color: #222; background: #f5f5f5; font: 16px/1.6 system-ui, sans-serif; }
    header, main, footer { max-width: 1400px; margin: auto; padding: 1rem; min-width: 0; }
    a { color: inherit; } :focus-visible { outline: 3px solid #222; outline-offset: 3px; }
    nav { display: flex; flex-wrap: wrap; gap: 1rem; } nav a { padding: .6rem; min-height: 44px; }
    section { border-top: 2px solid #555; padding-top: 1rem; margin: 2rem 0; }
    code { overflow-wrap: anywhere; } .tableau { overflow-x: auto; } table { border-collapse: collapse; background: white; }
    th, td { padding: .7rem; border: 1px solid #bbb; text-align: left; vertical-align: top; min-width: 130px; }
    summary { cursor: pointer; min-height: 32px; } details { padding: 1rem; background: white; border: 1px solid #ccc; }
  </style>
</head>
<body>
  <header><h1>Inventaire des écrans · KermicLab</h1><p>Généré depuis les sources publiques, pas depuis une estimation ni une capture de production.</p>
    <nav aria-label="Atelier"><a href="index.html">Site et parcours principal</a><a href="notion.html">Page de notion</a><a href="cercle.html">Application cercle</a><a href="jeux.html">Les neuf jeux</a><a href="editorial.html">Pages annexes</a></nav>
  </header>
  <main>
    <section data-ecran="inventaire-perimetre"><h2>Périmètre et traçabilité</h2>
      <p>${catalogue.index.maquettes.length} pages publiques : ${catalogue.index.maquettes.length - jeux - 1} notions du gabarit, une notion cercle écrite à la main et ${jeux} jeux ; plus l'application /cercle/, le tableau de bord et trois pages éditoriales.</p>
      <p>${modules.size} modules dans Mes trophées, dont le mini-cercle de l'accueil. Les badges d'exploration du tableau de bord sont distincts des badges de jeux.</p>
      <p>Empreinte SHA-256 des fichiers de web/, catalogue/, gabarit/ et src/ : <code data-empreinte>${empreinte.digest("hex")}</code>.</p>
      <p>Le catalogue privé et le déploiement effectif ne sont pas vérifiés. Les contenus pédagogiques sont représentés par leur gabarit, pas recopiés intégralement. Les options masquées ne sont pas déclarées actives. Les états clair/sombre et français/anglais partagent les mêmes structures ; l'atelier est figé en français.</p>
      <p>Régénérer et versionner : <code>node scripts/ux-suivi.mjs --version=X.Y.Z</code>. Les tests détectent une dérive des sources, des squelettes, des dialogues, de la navigation et des onglets des jeux ; relire les squelettes manuels avant de valider une nouvelle version.</p>
    </section>
    <section data-ecran="inventaire-site"><h2>Coquille, dialogues et variantes</h2>
      <p>Navigation actuelle : ${navigation.map(echapper).join(" · ")}. Couverture détaillée dans le squelette principal, avec variantes vides, chargement, erreur, réussite, mémoire et notifications.</p>
      <ul>${dialogues.map((id) => `<li data-dialogue="${echapper(id)}"><a href="index.html#${liensDialogues[id]}">${echapper(id)}</a>${["compte", "consentement"].includes(id) ? " · accès masqué" : ""}</li>`).join("")}</ul>
      <p>Éditorial : <a href="editorial.html#feuille-de-route">Feuille de route</a>, <a href="editorial.html#confidentialite">Confidentialité</a>, <a href="editorial.html#mentions-legales">Mentions légales</a>. Participation : lien externe, pas d'écran interne. Worker : aucune page d'erreur HTML dédiée, 404 textuelle.</p>
    </section>
    <section data-ecran="inventaire-catalogue"><h2>Toutes les pages publiques</h2><p>Chaque ligne relie le squelette, la vue active de l'API et sa source sur main ; la version indiquée est celle du catalogue local, pas une certification du déploiement. Les liens externes ne chargent rien avant un clic. Les onglets ci-dessous sont actifs ; Auto-évaluation est inactive et Se connecter est masqué dans les pages autonomes.</p>
      <div class="tableau" role="region" aria-label="Toutes les pages du catalogue, défilement horizontal" tabindex="0"><table><caption>Catalogue public, versions et variantes réelles</caption><thead><tr><th>Titre et ID</th><th>Matière</th><th>Niveau</th><th>Version</th><th>Onglets</th><th>Figure</th><th>Mes trophées</th></tr></thead><tbody>${lignes.join("\n")}</tbody></table></div>
    </section>
    <details><summary>Limites et écarts observés dans les sources</summary><p>Français et SES ont des pages mais ne figurent pas dans la liste fixe de matières du tableau de bord ; leurs libellés de traduction sont absents. La feuille de route juxtapose un bilan éditorial plus ancien (huit jeux) et un suivi automatique (neuf jeux). Poker et Mots croisés ne remontent pas dans la collection Mes trophées. Ces écarts sont documentés, pas corrigés par les artefacts UX.</p></details>
  </main>
  <footer><a href="index.html">Retour à l'atelier</a> · fichier autonome hors ligne</footer>
</body>
</html>
`;
}
