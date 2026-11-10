import { writeFile } from "node:fs/promises";

const repo = process.env.GITHUB_REPOSITORY || "Kermic974/KermicLab";
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) throw new Error("GH_TOKEN ou GITHUB_TOKEN requis");

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}: ${path}`);
  return response.json();
}

async function allIssues() {
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await github(`/repos/${repo}/issues?state=all&per_page=100&page=${page}`);
    all.push(...batch.filter(item => !item.pull_request));
    if (batch.length < 100) break;
  }
  return all;
}

const horizons = [
  { key: "maintenant", title: "À faire maintenant", description: "Priorité immédiate" },
  { key: "ensuite", title: "À faire ensuite", description: "Après les prérequis" },
  { key: "sous-condition", title: "Sous condition", description: "Budget, validation ou prérequis à lever" },
  { key: "plus-tard", title: "Plus tard", description: "Évolutions différées" }
];

const issues = await allIssues();
const open = issues.filter(issue => issue.state === "open");
const closed = issues.filter(issue => issue.state === "closed");
const labelNames = issue => (issue.labels || []).map(label => typeof label === "string" ? label : label.name);
const horizonOf = issue => labelNames(issue).find(label => label.startsWith("horizon:"))?.slice("horizon:".length) || "a-classer";
const statusOf = issue => {
  const labels = labelNames(issue);
  const workflow = labels.find(label => /^statut:/.test(label) || /^status:/.test(label));
  if (workflow) return workflow.split(":")[1].replaceAll("-", " ");
  return "à qualifier (pas de statut explicite)";
};
const escape = value => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ").trim();
const card = issue => {
  const labels = labelNames(issue);
  const assignees = (issue.assignees || []).map(user => user.login).join(", ") || "non assignée";
  const project = labels.find(label => label.startsWith("projet:"))?.slice(7) || "non classé";
  const url = issue.html_url || `https://github.com/${repo}/issues/${issue.number}`;
  const milestone = issue.milestone?.title ? ` · jalon : ${escape(issue.milestone.title)}` : "";
  const dependencies = issue.issue_dependencies_summary?.total_blocked_by;
  const blocked = dependencies > 0 ? ` · bloquée par ${dependencies} dépendance(s)` : "";
  return `- [#${issue.number} — ${escape(issue.title)}](${url}) · ${statusOf(issue)} · ${project} · responsable : ${escape(assignees)}${milestone}${blocked}`;
};

const counts = Object.fromEntries(horizons.map(h => [h.key, open.filter(i => horizonOf(i) === h.key).length]));
const unclassified = open.filter(i => horizonOf(i) === "a-classer");
const generatedAt = new Date().toISOString();
let markdown = `<!-- AUTO-GENERATED: do not edit by hand; run node scripts/synchroniser-kanban.mjs -->
# Kanban de pilotage KermicLab

> **Source de vérité :** issues et labels GitHub de [Kermic974/KermicLab](https://github.com/${repo}/issues).
> **Généré le :** ${generatedAt} (UTC) · **Ouvertes :** ${open.length} · **Fermées :** ${closed.length}.
> Les horizons sont des priorités, pas des statuts d'avancement. Le statut reste « à qualifier » tant qu'aucun label `statut:*` ou `status:*` n'est défini sur l'issue.

## Synthèse

| Colonne | Issues ouvertes |
|---|---:|
${horizons.map(h => `| ${h.title} | ${counts[h.key]} |`).join("\n")}
| À classer | ${unclassified.length} |
| **Total** | **${open.length}** |

## Tableau Kanban

`;
for (const horizon of horizons) {
  const items = open.filter(issue => horizonOf(issue) === horizon.key).sort((a,b) => a.number-b.number);
  markdown += `### ${horizon.title} — ${items.length}

_${horizon.description}._

${items.length ? items.map(card).join("\n") : "_Aucune issue._"}

\n`;
}
markdown += `### À classer — ${unclassified.length}

${unclassified.length ? unclassified.map(card).join("\n") : "_Aucune issue._"}

## Issues terminées

${closed.length ? closed.sort((a,b) => b.number-a.number).slice(0,30).map(card).join("\n") : "_Aucune issue fermée._"}
${closed.length > 30 ? `\n\n_${closed.length-30} autres issues fermées non affichées._\n` : ""}

## Règles de synchronisation

1. Les labels `horizon:maintenant`, `horizon:ensuite`, `horizon:sous-condition` et `horizon:plus-tard` déterminent la colonne.
2. Une issue sans label d'horizon apparaît dans **À classer**.
3. Les issues ouvertes et fermées sont récupérées depuis l'API GitHub ; les pull requests sont exclues.
4. Le statut d'avancement n'est jamais déduit de l'horizon. Pour afficher un statut, utiliser un label `statut:backlog`, `statut:pret`, `statut:en-cours`, `statut:en-revue` ou `statut:termine`.
5. Les responsables, jalons et dépendances affichés sont ceux présents dans les métadonnées GitHub au moment de la génération.
6. La synchronisation est en lecture seule : elle ne modifie ni les issues, ni leurs labels, ni le tableau GitHub Projects global.

## Mise à jour manuelle

```bash
GH_TOKEN=... node scripts/synchroniser-kanban.mjs
```

Le workflow **Synchronisation du Kanban** régénère ce document chaque semaine et à chaque changement d'issue. Il ouvre ou actualise une PR de synchronisation ; aucune fusion automatique n'est effectuée.
`;
await writeFile("docs/pilotage-kanban.md", markdown);

// Génère également une version HTML autonome : aucun CDN, framework ou fichier externe.
const htmlEscape = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const htmlIssues = open.map(issue => ({
  number: issue.number,
  title: issue.title,
  url: issue.html_url || `https://github.com/${repo}/issues/${issue.number}`,
  horizon: horizonOf(issue),
  status: statusOf(issue),
  project: labelNames(issue).find(label => label.startsWith("projet:"))?.slice(7) || "non classé",
  assignees: (issue.assignees || []).map(user => user.login),
  milestone: issue.milestone?.title || "",
  labels: labelNames(issue)
}));
const htmlClosed = closed.map(issue => ({
  number: issue.number, title: issue.title,
  url: issue.html_url || `https://github.com/${repo}/issues/${issue.number}`
}));
const htmlData = JSON.stringify({ issues: htmlIssues, closed: htmlClosed, generatedAt, repo })
  .replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
const html = `<!-- AUTO-GENERATED: do not edit by hand; run node scripts/synchroniser-kanban.mjs -->\n<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Kanban de pilotage · KermicLab</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:light dark;--bg:#f4f6fb;--panel:#fff;--ink:#182230;--muted:#64748b;--line:#dce2eb;--accent:#5b5bd6;--chip:#eef0ff;--shadow:0 5px 18px #1822300b}
@media(prefers-color-scheme:dark){:root{--bg:#10141d;--panel:#191f2b;--ink:#e8edf5;--muted:#a1adbd;--line:#303a4a;--accent:#aaa8ff;--chip:#292b48;--shadow:0 5px 18px #0003}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink)}header{padding:28px clamp(16px,4vw,48px);background:var(--panel);border-bottom:1px solid var(--line)}.wrap{max-width:1600px;margin:auto}h1{margin:0 0 8px;font-size:clamp(1.6rem,3vw,2.35rem)}p{color:var(--muted);line-height:1.5}.meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.pill{background:var(--chip);padding:7px 11px;border-radius:99px;font-size:.85rem}.toolbar{display:flex;gap:10px;flex-wrap:wrap;padding:20px clamp(16px,4vw,48px)}input,select,button{font:inherit;border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--panel);color:var(--ink)}input{min-width:min(320px,100%);flex:1}button{cursor:pointer}.board{display:grid;grid-template-columns:repeat(5,minmax(245px,1fr));gap:14px;padding:0 clamp(16px,4vw,48px) 32px;overflow-x:auto;align-items:start}.column{background:color-mix(in srgb,var(--panel) 72%,var(--bg));border:1px solid var(--line);border-radius:14px;padding:12px;min-height:220px}.column h2{font-size:1rem;margin:4px 2px 2px}.hint{font-size:.78rem;margin:0 2px 12px}.count{color:var(--muted);font-weight:500}.card{background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:12px;margin:9px 0;box-shadow:var(--shadow)}.card a{color:var(--ink);font-weight:650;text-decoration:none}.card a:hover{color:var(--accent);text-decoration:underline}.sub{font-size:.8rem;color:var(--muted);margin-top:8px;line-height:1.5}.tag{display:inline-block;background:var(--chip);border-radius:6px;padding:3px 6px;margin:4px 4px 0 0;font-size:.72rem}.empty{color:var(--muted);font-size:.85rem;padding:12px 4px}.closed{margin:0 clamp(16px,4vw,48px) 40px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}.closed summary{cursor:pointer;font-weight:650}.closed li{margin:8px 0}.foot{padding:0 clamp(16px,4vw,48px) 30px;color:var(--muted);font-size:.82rem}@media(max-width:900px){.board{grid-template-columns:repeat(5,minmax(260px,82vw))}}@media print{.toolbar,button{display:none}.board{grid-template-columns:repeat(2,1fr);overflow:visible}.column{break-inside:avoid}}
</style>
</head>
<body>
<header><div class="wrap"><h1>Kanban de pilotage KermicLab</h1><p>Vue des issues GitHub, classées par horizon de priorité. Un horizon n'est pas un statut d'avancement.</p><div class="meta" id="summary"></div></div></header>
<div class="toolbar wrap"><input id="search" type="search" placeholder="Rechercher un ticket, un label, un responsable…"><select id="project"><option value="">Tous les projets</option></select><select id="status"><option value="">Tous les statuts</option></select><button id="reset" type="button">Réinitialiser</button><button id="print" type="button">Imprimer / PDF</button></div>
<main class="board wrap" id="board" aria-live="polite"></main>
<section class="closed wrap"><details><summary id="closed-title">Issues fermées</summary><ul id="closed-list"></ul></details></section>
<footer class="foot wrap" id="footer"></footer>
<script>
"use strict";
const DATA = ${htmlData};
const HORIZONS = [
 {key:"maintenant",title:"À faire maintenant",hint:"Priorité immédiate"},
 {key:"ensuite",title:"À faire ensuite",hint:"Après les prérequis"},
 {key:"sous-condition",title:"Sous condition",hint:"Budget, validation ou prérequis à lever"},
 {key:"plus-tard",title:"Plus tard",hint:"Évolutions différées"},
 {key:"a-classer",title:"À classer",hint:"Horizon non défini"}
];
const $ = id => document.getElementById(id);
const unique = values => [...new Set(values)].sort((a,b)=>a.localeCompare(b,"fr"));
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node}
function init(){
 $("summary").replaceChildren(...[
  el("span","pill",DATA.issues.length+" issues ouvertes"),
  el("span","pill",DATA.closed.length+" issues fermées"),
  el("span","pill","Généré le "+new Date(DATA.generatedAt).toLocaleString("fr-FR",{timeZone:"Indian/Reunion"})+" (La Réunion)")
 ]);
 unique(DATA.issues.map(i=>i.project)).forEach(v=>{const o=el("option","",v);o.value=v;$("project").append(o)});
 unique(DATA.issues.map(i=>i.status)).forEach(v=>{const o=el("option","",v);o.value=v;$("status").append(o)});
 $("closed-title").textContent="Issues fermées ("+DATA.closed.length+")";
 $("footer").textContent="Source : github.com/"+DATA.repo+" · Les données sont intégrées au fichier : cette page fonctionne hors ligne. Pour actualiser la vue, ouvrir la version générée par le workflow de synchronisation.";
 render();
 ["search","project","status"].forEach(id=>$(id).addEventListener(id==="search"?"input":"change",render));
 $("reset").addEventListener("click",()=>{$("search").value="";$("project").value="";$("status").value="";render()});
 $("print").addEventListener("click",()=>window.print());
 const list=$("closed-list");DATA.closed.forEach(i=>{const li=el("li");const a=el("a","", "#"+i.number+" — "+i.title);a.href=i.url;a.target="_blank";a.rel="noopener noreferrer";li.append(a);list.append(li)});
}
function render(){
 const q=$("search").value.trim().toLocaleLowerCase("fr");
 const filtered=DATA.issues.filter(i=>(!q||[i.title,i.number,i.status,i.project,...i.assignees,...i.labels].join(" ").toLocaleLowerCase("fr").includes(q))&&(!$("project").value||i.project===$("project").value)&&(!$("status").value||i.status===$("status").value));
 const board=$("board");board.replaceChildren();
 HORIZONS.forEach(h=>{
  const items=filtered.filter(i=>i.horizon===h.key).sort((a,b)=>a.number-b.number);
  const col=el("section","column");const heading=el("h2","",h.title+" ");heading.append(el("span","count","("+items.length+")"));col.append(heading,el("p","hint",h.hint));
  if(!items.length)col.append(el("div","empty","Aucune issue dans cette colonne."));
  items.forEach(i=>{
   const card=el("article","card");const a=el("a","", "#"+i.number+" — "+i.title);a.href=i.url;a.target="_blank";a.rel="noopener noreferrer";card.append(a);
   card.append(el("div","sub","Statut : "+i.status+" · Projet : "+i.project));
   const details=[i.assignees.length?"Responsable : "+i.assignees.join(", "):"Non assignée",i.milestone?"Jalon : "+i.milestone:"",i.labels.join(" · ")].filter(Boolean);
   if(details.length)card.append(el("div","sub",details.join(" | ")));
   col.append(card);
  });
  board.append(col);
 });
}
init();
</script>
</body>
</html>
`;
await writeFile("docs/pilotage-kanban.html", html);
console.log("Vue HTML autonome générée : docs/pilotage-kanban.html");

console.log(`Kanban généré : ${open.length} issues ouvertes, ${closed.length} fermées.`);
