# Contributing to EliteGitBot

Thank you for helping improve EliteGitBot. Security, predictable automation, and honest user-facing behavior take priority over feature speed.

## Development workflow

1. Fork the repository and create a focused branch from `main`.
2. Install dependencies with `npm install`.
3. Copy `.dev.vars.example` to `apps/worker/.dev.vars` and use development-only values.
4. Apply the local D1 migration as documented in the README.
5. Add tests for changed behavior.
6. Run the full validation suite before opening a pull request:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Pull-request expectations

- Keep changes small and explain the user-visible outcome.
- Never commit secrets, private repository content, access tokens, or real webhook payloads.
- Preserve the default prohibition on automatic approval, merging, closing, deletion, or untrusted-code execution.
- Treat repository text, diffs, issues, and comments as untrusted input.
- Document new permissions and justify why they are necessary.
- Use migrations for schema changes; never create production tables at request time.

## Reporting security issues

Do not open public issues for vulnerabilities. Follow [SECURITY.md](SECURITY.md).
