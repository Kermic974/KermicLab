# Kermiclab (trigoLab)

*[Version française](README.fr.md)*

Kermiclab is a conversational learning agent for ages 7 to 77. Ask a question ("what is the sine?") and
it serves a **self-contained, versioned HTML page** with tabs: explanation (from intuition to formal),
playful application, and an engaging challenge.

## Functional documentation

The functional documentation is being consolidated into a maintained project reference. See the [v1.3.0 functional documentation roadmap](docs/roadmap-pack-fonctionnel-v1.3.0.md).

The roadmap treats the repository as the source of truth for implemented behaviour and explicitly separates current behaviour from planned evolution.

- **Deterministic**: questions covered by the catalogue always return the same page file (zero generation tokens).
- **Backlog learning**: uncovered questions open (or comment on) a `maquette-manquante` GitHub issue; once a human validates a new page, the same question returns it.
- **Agent-agnostic**: all project instructions live in [AGENTS.md](AGENTS.md).
- **Three solving methods** in the unit-circle app: geometric, algebraic and tabular (remarkable angles), with a cross-method agreement check. A Compare mode is planned.
- **Child-safe by design**: no personal data collected, input/output moderation, anonymous KPIs only.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md), [SPEC.md](SPEC.md), [PLAN.md](PLAN.md), [AGENTS.md](AGENTS.md), [SECURITY.md](SECURITY.md) and [CONTRIBUTING.md](CONTRIBUTING.md) for the maintained project references.

The existing architecture, deployment, contribution, UX workshop and licence sections remain governed by their dedicated repository documents. This README entry makes the v1.3.0 functional-documentation roadmap discoverable from the project root.

## Quick start

Requirements: Node.js 22+ and a Cloudflare account with Workers AI available. An Anthropic API key is optional and is only used as a fallback if Workers AI fails.

```bash
npm ci
npm run ci
cp .env.example worker/.dev.vars
cd worker && npx wrangler d1 execute kermiclab-kpi --local --file=schema.sql && npx wrangler dev
```

In another terminal:

```bash
KERMICLAB_API_URL=http://<scrubbed-url-domain> npm run build && npx wrangler pages dev dist
```

## Documentation maintenance

Functional changes should keep implementation, tests and applicable documentation aligned. Architectural decisions remain in ADRs, while operational and security requirements remain in their dedicated documents.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) for the generic engine (HTML template, tab registry, storage, routing).
Page catalogue and generator parameters are private.
