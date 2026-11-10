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
console.log(`Kanban généré : ${open.length} issues ouvertes, ${closed.length} fermées.`);
