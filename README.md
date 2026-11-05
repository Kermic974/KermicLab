# Kermiclab (trigoLab)

*[Version française](README.fr.md)*

Kermiclab is a conversational learning agent for ages 7 to 77. Ask a question ("what is the sine?") and
it serves a **self-contained, versioned HTML page** with tabs: explanation (from intuition to formal),
playful application, and an engaging challenge.

- **Deterministic**: questions covered by the catalogue always return the same page file (zero generation tokens).
- **Backlog learning**: uncovered questions open (or comment on) a `maquette-manquante` GitHub issue; once a human validates a new page, the same question returns it.
- **Agent-agnostic**: all project instructions live in [AGENTS.md](AGENTS.md).
- **Three solving methods** in the unit-circle app: geometric, algebraic and tabular (remarkable angles), with a cross-method agreement check. A Compare mode is planned.
- **Child-safe by design**: no personal data collected, input/output moderation, anonymous KPIs only.

## Architecture

```
Browser ──▶ www.kermiclab.online (Cloudflare Pages « kermiclab », built from dist/)
            ├─ /         chat (web/)
            └─ /cercle/  standalone unit-circle app (index.html, offline-capable)
        ──POST /api/chat──▶ Cloudflare Worker « kermiclab-api » (worker/wrangler.toml)
                            ├─ keyword router (deterministic, catalogue index)
                            ├─ Claude Haiku 5.5 router (structured JSON) if no match
                            ├─ GET /maquettes/:id → catalogue HTML served as-is
                            ├─ GitHub Issues (maquette-manquante, traduction-manquante, support)
                            ├─ Cloudflare D1 (anonymous KPIs) + daily R2 backup
```

The standalone trigonometry-circle learning app (`index.html`, generated from `src/`) is published at
`/cercle/`, next to the chat (ADR 0008).

Additional pages can live in a separate **private** repository (`maquettes-catalogue`), fetched by CI with a
read-only token. This repository ships the unit-circle page and public template-based examples in mathematics,
physics-chemistry, geography and philosophy.

The geography catalogue covers **metropolisation, urbanisation, rural spaces, natural hazards,
climate change, resources, mobility, migration and French territories**, plus eight globalisation topics
(`mondialisation`, `mers-oceans`, `union-europeenne`, `dynamiques-territoriales`, `france-regions`,
`espaces-productifs`, `tourisme` and `afrique-australe`). Each French-language page progresses from
intuition or middle school through high school, with case studies, corrected exercises and an everyday
challenge. The globalisation topics use five self-marking practice exercises and a four-step challenge;
numerical scenario data are fictional and review references are in each `fiche.md`. Pages are generated
from `catalogue/<id>/contenu.json`; see [the template guide](docs/gabarit.md). Human review of geographical
accuracy is required before merging.

The nine philosophy pages cover duty, the state, justice, freedom, language, reason, science, technology
and truth. They use the common template, with progressive explanations, authors, self-correcting quizzes
and everyday challenges.

## Quick start

Requirements: Node.js 22+, a Cloudflare account, an Anthropic API key (optional for local dev).

```bash
npm ci
npm run ci                          # lint, build, page security checks, unit + browser tests
cp .env.example worker/.dev.vars    # fill in ANTHROPIC_API_KEY / GITHUB_TOKEN (optional)
cd worker && npx wrangler d1 execute kermiclab-kpi --local --file=schema.sql && npx wrangler dev   # API on :8787
# in another terminal
KERMICLAB_API_URL=http://localhost:8787 npm run build && npx wrangler pages dev dist           # chat on :8788
```

Without `ANTHROPIC_API_KEY` the catalogue still works; other questions get a fallback answer.
This is the current **zero-budget mode** (free Cloudflare and GitHub plans only), see [ADR 0006](docs/decisions/0006-mode-zero-budget.md).
Without `GITHUB_TOKEN` no issue is created.

## Deploy

Pushing to `main` runs `.github/workflows/ci.yml`: the `verifier` job (lint, build, page security, unit and browser
tests) must pass before the **Déploiement Cloudflare** job applies the D1 schema, deploys the Worker `kermiclab-api`,
sets its secrets when defined, and publishes `dist/` to the Cloudflare Pages project `kermiclab`
(`www.kermiclab.online`, `kermiclab.online`). Pull requests get a Cloudflare Pages preview.

| Kind | Name | Purpose |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Deploy Worker, Pages, D1 |
| Secret | `KERMICLAB_GITHUB_TOKEN` | Fine-grained token (Issues read/write on this repo), pushed to the Worker as `GITHUB_TOKEN` |
| Secret | `ANTHROPIC_API_KEY` | Chat/router model, optional (zero-budget mode without it); also the AI security review |
| Secret | `CATALOGUE_TOKEN` | Read-only token on the private catalogue repo (optional) |
| Variable | `KERMICLAB_API_URL` | API URL baked into the chat (default `https://kermiclab-api.kermic.workers.dev`) |

See [docs/actions-manuelles.md](docs/actions-manuelles.md) for the full checklist.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [SECURITY.md](SECURITY.md).

## HTML base for UX workshops

Open [docs/ux/index.html](docs/ux/index.html) in a browser or copy its contents into Canvas.
Six self-contained HTML files cover the current dashboard (v3 welcome journey, Labs/Games navigation,
chat, catalogue, challenge, trophies, profile and dialogs), the [learning-page variants](docs/ux/notion.html),
the [unit-circle app](docs/ux/cercle.html), [all nine games and their Academies](docs/ux/jeux.html),
the [editorial pages](docs/ux/editorial.html) and a [source-derived inventory](docs/ux/inventaire.html).
Download all six into the same directory to retain navigation; each works offline with embedded styles.

These are French structural wireframes, not a redesign or a pixel-perfect export.
The inventory lists every public catalogue page (181 at this snapshot), actual tabs, versions, figures
and trophy compatibility. Shared layouts are represented once, with game-specific screens and state variants.
Private catalogue contents and the live deployment are not verified. Hidden account screens remain labeled inactive.
Screens and dialogs are expanded, identified by `data-ecran` and traced with `data-source`, with fictional examples.
Only links and native disclosure panels work: no submissions, calculations, storage or external services.
Copy is frozen for this workshop, separate from the translated `web/i18n/` interface.
The build does not publish these files and the current site is unchanged.
Return the edited HTML or screen-by-screen instructions after the Canvas workshop to prepare the redesign.
Each file includes a version panel linking to its active views, current sources and immutable reference commit.
Every inventory row also links to the live page and its source. External links open only on click; no resources
are loaded automatically. Dialogs without direct URLs link to their entry page with opening instructions.
The deployment version is not inferred from the source snapshot.

After source or wireframe changes, review the manual wireframes, then run
`node scripts/ux-suivi.mjs --version=X.Y.Z` with a strictly increasing SemVer version.
This regenerates the inventory and the six version panels, versions only affected files and appends the changed
views, source commits and SHA-256 fingerprints to `docs/ux/suivi.json`. Use a major version for restructuring,
minor for new screens, patch for corrections. Commit the wireframes and registry together; Git preserves previous snapshots.
`node scripts/ux-suivi.mjs --check` detects source or wireframe drift without rewriting files.
`node --test tests/e2e/ux.test.mjs` additionally checks catalogue/dialog/navigation/game-tab coverage,
local and active-view links and offline layouts at 360, 768 and 1440 pixels.
Pull request CI checks sources merged with `main`: when a new view lands there in the meantime, integrate `main`,
update the affected wireframes and publish a new version; do not regenerate fingerprints in CI.
Commit sources before versioning: modified or untracked sources are rejected before any file is written.
Checks also verify that the reference commit contains the fingerprinted sources.
Only the factual `roadmap:auto` block is normalized to avoid blocking automated roadmap PRs:
the rest of the page and its generator remain tracked, so structural changes require a new UX version.

## License

[MIT](LICENSE) for the generic engine (HTML template, tab registry, storage, routing).
Page catalogue and generator parameters are private.
