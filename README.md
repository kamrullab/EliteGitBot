# EliteGitBot

EliteGitBot is a self-hosted GitHub App for secure webhook processing, repository monitoring, deterministic pull-request review, issue triage, workflow tracking, and an authenticated administration dashboard. Its core mode uses no paid AI service.

## What is implemented

- GitHub App JWT authentication and short-lived installation tokens (never persisted).
- HMAC-SHA256 webhook verification, fixed-size timing-safe comparison, D1 delivery deduplication, and Queue processing with retries/DLQ.
- Installation/repository synchronization, per-repository automation controls, PR SHA deduplication, issue classification/replies, workflow-run persistence, activity logs, and real dashboard statistics.
- Local rule-based security review with secret redaction; no PR code is executed in Workers. Semgrep and Trivy run in a least-privilege GitHub Actions workflow.
- Single-admin PBKDF2 password verification, HttpOnly sessions, strict same-site cookies, CSRF double-submit validation, expiry, logout, protected routes, and login throttling.
- Responsive light/dark React dashboard using Vite, Tailwind, TanStack Query, React Router, Lucide, and accessible loading/error/empty states.
- D1 migrations, strict TypeScript, Worker and UI tests, observability, example secrets, and deployment configuration.

## Architecture

```text
GitHub App -> signed webhook -> Worker -> D1 delivery ledger -> Queue
                                                    |          |
React dashboard <- authenticated REST API <- D1 <---+----------+
                                                               |
                                      GitHub API <- event processors
```

Queues provide at-least-once delivery; database uniqueness makes processing idempotent. Failed messages retry three times and then enter `elite-gitbot-events-dlq` for recovery.

## Prerequisites and local setup

- Node.js 20+
- A Cloudflare account with Workers, D1, and Queues enabled
- A GitHub App

```bash
npm install
cp .dev.vars.example apps/worker/.dev.vars
npm run cf-typegen
npx wrangler d1 migrations apply elite-gitbot --local --config apps/worker/wrangler.jsonc
npm run dev
npm run dev:web
```

Create an admin password hash without sending the password anywhere:

```bash
node scripts/hash-password.mjs "your-password"
```

Store the output as `ADMIN_PASSWORD_HASH`. Do not put production secrets in `.dev.vars` or source control.

## GitHub App configuration

Set the webhook URL to `https://YOUR_WORKER/api/webhooks/github`, choose a random webhook secret, and subscribe to `pull_request`, `pull_request_review`, `pull_request_review_comment`, `issues`, `issue_comment`, `push`, `release`, `workflow_run`, `check_suite`, `installation`, `installation_repositories`, and `repository`. GitHub may not offer `security_advisory` for every personal App configuration.

Minimum repository permissions:

- Metadata: Read
- Contents: Read
- Pull requests: Read and write
- Issues: Read and write
- Actions: Read
- Checks and commit statuses: Read
- Security events: Read only when the account supports it

Install the App only on repositories that should be monitored. EliteGitBot cannot access uninstalled repositories.

## Environment variables and secrets

| Name | Required | Purpose |
|---|---:|---|
| `GITHUB_APP_ID` | yes | GitHub App identifier |
| `GITHUB_PRIVATE_KEY` | yes | PKCS#8 App private key, with escaped newlines allowed |
| `GITHUB_WEBHOOK_SECRET` | yes | webhook HMAC secret |
| `ADMIN_USERNAME` | yes | single administrator name |
| `ADMIN_PASSWORD_HASH` | yes | `pbkdf2$iterations$salt$hash` value |
| `SESSION_SECRET` | yes | at least 32 random bytes |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | no | reserved external provider configuration |
| `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | no | reserved trusted Ollama endpoint configuration |

Production secrets are uploaded interactively:

```bash
npx wrangler secret put GITHUB_APP_ID --config apps/worker/wrangler.jsonc
npx wrangler secret put GITHUB_PRIVATE_KEY --config apps/worker/wrangler.jsonc
npx wrangler secret put GITHUB_WEBHOOK_SECRET --config apps/worker/wrangler.jsonc
npx wrangler secret put ADMIN_USERNAME --config apps/worker/wrangler.jsonc
npx wrangler secret put ADMIN_PASSWORD_HASH --config apps/worker/wrangler.jsonc
npx wrangler secret put SESSION_SECRET --config apps/worker/wrangler.jsonc
```

## Provision and deploy

Replace the D1 database ID in `apps/worker/wrangler.jsonc`, then:

```bash
npx wrangler d1 create elite-gitbot
npx wrangler queues create elite-gitbot-events
npx wrangler queues create elite-gitbot-events-dlq
npx wrangler d1 migrations apply elite-gitbot --remote --config apps/worker/wrangler.jsonc
npm test
npm run build
npm run deploy
```

## Tests

`npm test` runs cryptographic signature, rule analysis/redaction, issue classification, and login UI tests without real GitHub credentials. `npm run typecheck` verifies both applications. `npm run build` performs a dashboard production build and Worker dry-run bundle.

## Safety and limitations

- EliteGitBot never automatically approves, merges, closes, deletes branches, or executes PR code.
- Inline comments are intentionally not emitted by the current deterministic analyzer because patch positions are not yet mapped to GitHub diff coordinates. Findings are published as general review comments, avoiding invented line numbers.
- Rule matching is heuristic and cannot prove code secure. Semgrep/Trivy results currently remain in GitHub SARIF; ingestion into D1 is a future enhancement.
- The implementation analyzes the first 100 changed files. Very large PR pagination is a follow-up.
- Gemini/Ollama configuration status exists, but the initial production processor deliberately uses the rule provider until explicit private-code consent, encrypted provider settings, SSRF allowlisting, and provider quota handling are completed.
- Queue availability and quotas vary by current Cloudflare plan. If unavailable, replace the producer with a separately deployed Worker/service binding; do not run long AI work synchronously in the webhook.
- GitHub Discussions do not provide equivalent webhook support for every GitHub App/account combination.
