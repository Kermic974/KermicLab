# Contributing

*[Version française](CONTRIBUTING.fr.md)*

Thanks for helping! Kermiclab serves learners from age 7, so every contribution must be safe for all ages.

1. Read [AGENTS.md](AGENTS.md) (conventions, page contract, security rules) — it applies to humans too.
2. Open or pick an issue (`good first issue`, `help wanted`, `maquette-manquante`).
3. Branch from `main`, make focused changes, run `npm run ci`.
4. Open a pull request using the template. CI, CodeQL, dependency review, secret scan and an AI security
   review run automatically; the CODEOWNER's approval is required before merge.

Rules:

- No secrets, no personal data, no external scripts or network calls in HTML pages.
- No hard-coded UI text: add keys to every `web/i18n/*.json` file.
- New dependencies need a short decision record in `docs/decisions/`.
- Commits on `main` must be signed.

Security issues: see [SECURITY.md](SECURITY.md) — never in a public issue.
