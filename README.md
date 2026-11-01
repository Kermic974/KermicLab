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
read-only token. This repository ships the unit-circle page and public template-based mathematics,
physics-chemistry and geography examples.

The geography catalogue covers **metropolisation, urbanisation, rural spaces, natural hazards,
climate change, resources, mobility, migration and French territories**. Each French-language page
progresses from intuition through middle-school to high-school concepts, with case studies, mental
maps, corrected multiple-choice questions about concepts, actors and scales, and an everyday challenge.
Pages are generated from `catalogue/<id>/contenu.json`; see [the template guide](docs/gabarit.md).
Human review of geographical accuracy is required before merging.

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

## License

[MIT](LICENSE) for the generic engine (HTML template, tab registry, storage, routing).
Page catalogue and generator parameters are private.
