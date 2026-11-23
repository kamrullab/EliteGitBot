# EliteGitBot implementation plan

1. Scaffold the strict TypeScript monorepo, Worker, Vite dashboard, configuration, and observability.
2. Add the D1 relational schema, constraints, indexes, and typed query helpers.
3. Secure GitHub App JWT/token exchange and constant-time webhook verification.
4. Synchronize installations/repositories and persist repository-specific controls.
5. Queue idempotent PR analysis, publish reviews, and persist structured findings.
6. Classify issues, create configurable replies, and apply labels conservatively.
7. Provide Gemini, Ollama, and always-available rule-based providers with fallback.
8. Persist workflow runs and security findings; add external scanner workflow.
9. Build the authenticated, responsive React administration dashboard using live APIs.
10. Add session/CSRF/rate-limit middleware, settings, activity logs, and controls.
11. Cover cryptography, deduplication, auth, analysis, and UI with automated tests.
12. Document GitHub App configuration, local setup, deployment, and limitations.

Each phase is verified by type checking and automated tests. Deployment requires real Cloudflare and GitHub credentials; tests use fixtures only.
