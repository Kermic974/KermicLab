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
Browser ──▶ Cloudflare Worker « trigolab » (wrangler.toml)
                                                        ├─ static chat files (dist/, built from web/)
                                                        ├─ keyword router (deterministic, catalogue index)
                                                        ├─ Claude Haiku 5.5 router (structured JSON) if no match
                                                        ├─ GET /maquettes/:id  → catalogue HTML served as-is
                                                        ├─ GitHub Issues (maquette-manquante, traduction-manquante, support)
                                                        └─ Cloudflare D1 (anonymous KPIs)
```

The standalone trigonometry-circle learning app is available at the repository root in `index.html`.
GitHub Pages deploys only this offline-capable app after the existing CI checks pass; the chat and API
remain on the Cloudflare Worker.

Real pages live in a separate **private** repository (`maquettes-catalogue`), fetched by CI with a
read-only token. This repository only ships a minimal example page (`catalogue/trigo-cercle`).

## Quick start

Requirements: Node.js 22+, a Cloudflare account, an Anthropic API key (optional for local dev).

```bash
npm ci
npm run ci                          # lint, build, page security checks, unit + browser tests
cp .env.example .dev.vars           # fill in ANTHROPIC_API_KEY / GITHUB_TOKEN (optional)
npx wrangler d1 execute kermiclab-kpi --local --file=worker/schema.sql
npx wrangler dev                    # builds, then serves chat + API on http://localhost:8787
```

Without `ANTHROPIC_API_KEY` the catalogue still works; other questions get a fallback answer.
This is the current **zero-budget mode** (free Cloudflare and GitHub plans only), see [ADR 0006](docs/decisions/0006-mode-zero-budget.md).
Without `GITHUB_TOKEN` no issue is created.

## Deploy

The Cloudflare Worker `trigolab` is connected to this GitHub repository (**Workers Builds**): every push to `main`
is built and deployed by Cloudflare (`npx wrangler deploy`, which first runs `npm run build`). No deploy token is
stored in GitHub; GitHub Actions only checks the Worker build.

The same GitHub Actions workflow deploys the standalone `index.html` to GitHub Pages after checks pass on `main`.
Enable **Settings → Pages → Build and deployment → GitHub Actions** once. The Pages artifact contains only this app;
it has no network calls or external assets and can be saved and opened offline.

| Where | Name | Purpose |
|---|---|---|
| Cloudflare → Workers → trigolab → Settings → Variables and Secrets | `ANTHROPIC_API_KEY` (secret) | Chat/router model (optional: zero-budget mode without it) |
| same | `GITHUB_TOKEN` (secret) | Fine-grained token, Issues read/write on this repo only |
| GitHub → Settings → Secrets → Actions | `ANTHROPIC_API_KEY` | AI security review on pull requests (optional) |
| same | `CATALOGUE_TOKEN` | Read-only token on the private catalogue repo (optional) |

The D1 database `kermiclab-kpi` is declared in `wrangler.toml`; its schema is `worker/schema.sql`.
See [docs/actions-manuelles.md](docs/actions-manuelles.md) for the full checklist.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) for the generic engine (HTML template, tab registry, storage, routing).
Page catalogue and generator parameters are private.
