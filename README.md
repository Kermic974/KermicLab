# Kermiclab (trigoLab)

*[Version française](README.fr.md)*

Kermiclab is a conversational learning agent for ages 7 to 77. Ask a question ("what is the sine?") and
it serves a **self-contained, versioned HTML page** with tabs: explanation (from intuition to formal),
playful application, and an engaging challenge.

- **Deterministic**: questions covered by the catalogue always return the same page file (zero generation tokens).
- **Backlog learning**: uncovered questions open (or comment on) a `maquette-manquante` GitHub issue; once a human validates a new page, the same question returns it.
- **Agent-agnostic**: all project instructions live in [AGENTS.md](AGENTS.md).
- **Child-safe by design**: no personal data collected, input/output moderation, anonymous KPIs only.

## Architecture

```
Browser (Cloudflare Pages: web/)  ──POST /api/chat──▶  Cloudflare Worker (worker/)
                                                        ├─ keyword router (deterministic, catalogue index)
                                                        ├─ Claude Haiku 5.5 router (structured JSON) if no match
                                                        ├─ GET /maquettes/:id  → catalogue HTML served as-is
                                                        ├─ GitHub Issues (maquette-manquante, traduction-manquante, support)
                                                        └─ Cloudflare D1 (anonymous KPIs)
```

Real pages live in a separate **private** repository (`maquettes-catalogue`), fetched by CI with a
read-only token. This repository only ships a minimal example page (`catalogue/trigo-cercle`).

## Quick start

Requirements: Node.js 22+, a Cloudflare account, an Anthropic API key (optional for local dev).

```bash
npm ci
npm run ci                          # lint, build, page security checks, unit + browser tests
cp .env.example worker/.dev.vars    # fill in ANTHROPIC_API_KEY / GITHUB_TOKEN (optional)
cd worker && npx wrangler d1 execute kermiclab-kpi --local --file=schema.sql && npx wrangler dev
# in another terminal
npm run build && npx wrangler pages dev dist
```

Without `ANTHROPIC_API_KEY` the catalogue still works; other questions get a fallback answer.
This is the current **zero-budget mode** (free Cloudflare and GitHub plans only), see [ADR 0006](docs/decisions/0006-mode-zero-budget.md).
Without `GITHUB_TOKEN` no issue is created.

## Deploy

Pushing to `main` runs the CI/CD pipeline (`.github/workflows/ci.yml`): tests, D1 schema, Worker, Pages.

| Kind | Name | Purpose |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Deploy Worker, Pages, D1 |
| Secret | `ANTHROPIC_API_KEY` | Chat/router model (also used by AI security review) |
| Secret | `KERMICLAB_GITHUB_TOKEN` | Fine-grained token, Issues read/write on this repo only |
| Secret | `CATALOGUE_TOKEN` | Read-only token on the private catalogue repo (optional) |
| Variable | `KERMICLAB_API_URL` | Public Worker URL used by the chat |
| Variable | `CATALOGUE_REPO`, `CLOUDFLARE_PAGES_PROJECT` | Optional overrides |

Then set the D1 `database_id` and `ORIGINES_AUTORISEES` in `worker/wrangler.toml`.
See [docs/actions-manuelles.md](docs/actions-manuelles.md) for the full checklist.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) for the generic engine (HTML template, tab registry, storage, routing).
Page catalogue and generator parameters are private.
