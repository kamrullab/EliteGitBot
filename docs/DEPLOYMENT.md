# Deploy EliteGitBot to Cloudflare

This guide deploys the Worker API and React dashboard together using Workers Static Assets, D1, and Queues. The core rule-based configuration requires no paid AI API.

> [!NOTE]
> Cloudflare product quotas can change. Queues joined the Workers Free plan in February 2026 with a daily operation allowance and shorter free-tier retention. Confirm the current [Queues limits](https://developers.cloudflare.com/queues/platform/limits/) before production use.

## 1. Prerequisites

- Node.js 20+
- A free Cloudflare account
- A GitHub account that can create a GitHub App
- This repository cloned locally

```bash
git clone https://github.com/kamrullab/EliteGitBot.git
cd EliteGitBot
npm install
```

Run the local checks before provisioning anything:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## 2. Authenticate Wrangler

```bash
npx wrangler login
npx wrangler whoami
```

Confirm that `whoami` shows the intended Cloudflare account. Do not continue if it points to another account.

## 3. Create the D1 database

```bash
npx wrangler d1 create elite-gitbot
```

Wrangler prints the new database UUID. Open `apps/worker/wrangler.jsonc` and replace:

```jsonc
"database_id": "replace-with-d1-database-id"
```

with the returned UUID. Keep the binding name `DB` and database name `elite-gitbot` unchanged.

## 4. Create the Queues

```bash
npx wrangler queues create elite-gitbot-events
npx wrangler queues create elite-gitbot-events-dlq
```

The first Queue processes events. The second is the dead-letter queue for events that still fail after three retries.

## 5. Apply D1 migrations

First inspect pending migrations:

```bash
npx wrangler d1 migrations list elite-gitbot \
  --remote \
  --config apps/worker/wrangler.jsonc
```

Then apply them:

```bash
npx wrangler d1 migrations apply elite-gitbot \
  --remote \
  --config apps/worker/wrangler.jsonc
```

Cloudflare applies D1 migrations transactionally; a failed migration is rolled back while previously successful migrations remain applied. See the official [D1 migration commands](https://developers.cloudflare.com/d1/wrangler-commands/).

## 6. Prepare administrator credentials

Generate the password representation locally:

```bash
node scripts/hash-password.mjs "use-a-long-unique-password"
```

Copy the resulting `pbkdf2$...` value. Do not store the plaintext password in any file.

The generator uses 100,000 PBKDF2-SHA-256 iterations, matching the Cloudflare Workers Web Crypto runtime limit. Do not substitute a higher iteration count without changing the password-verification strategy.

Generate independent random values for `SESSION_SECRET` and `GITHUB_WEBHOOK_SECRET`. Each should contain at least 32 random bytes.

## 7. Upload required Worker secrets

Each command opens an interactive prompt. Paste the value only into Wrangler—not into source files, shell history, GitHub issues, or chat.

```bash
npx wrangler secret put GITHUB_APP_ID --config apps/worker/wrangler.jsonc
npx wrangler secret put GITHUB_PRIVATE_KEY --config apps/worker/wrangler.jsonc
npx wrangler secret put GITHUB_WEBHOOK_SECRET --config apps/worker/wrangler.jsonc
npx wrangler secret put ADMIN_USERNAME --config apps/worker/wrangler.jsonc
npx wrangler secret put ADMIN_PASSWORD_HASH --config apps/worker/wrangler.jsonc
npx wrangler secret put SESSION_SECRET --config apps/worker/wrangler.jsonc
```

For `GITHUB_PRIVATE_KEY`, paste the complete PEM including the BEGIN/END lines. Wrangler secrets are not committed and normal deployments do not delete existing secrets.

GitHub may download the key as PKCS#1 (`BEGIN RSA PRIVATE KEY`), while EliteGitBot imports PKCS#8 (`BEGIN PRIVATE KEY`). Convert it locally before upload:

```bash
openssl pkcs8 -topk8 -nocrypt -in github-app.private-key.pem -out github-app.pkcs8.pem
npx wrangler secret put GITHUB_PRIVATE_KEY --config apps/worker/wrangler.jsonc
```

Paste the converted PKCS#8 file into Wrangler's prompt. Never commit either key file. Delete the converted copy after upload and retain the original only in secure private storage.

## 8. Configure optional AI

The committed production default is free local rule analysis:

```jsonc
"AI_ENABLED": "false",
"AI_PROVIDER": "rule-based"
```

To enable Gemini, change the non-secret `vars` in `apps/worker/wrangler.jsonc`:

```jsonc
"AI_ENABLED": "true",
"AI_PROVIDER": "gemini",
"GEMINI_MODEL": "YOUR_CURRENT_GEMINI_MODEL"
```

Then upload its key:

```bash
npx wrangler secret put GEMINI_API_KEY --config apps/worker/wrangler.jsonc
```

For OpenRouter or another OpenAI-compatible API, add:

```jsonc
"AI_ENABLED": "true",
"AI_PROVIDER": "openai-compatible",
"AI_BASE_URL": "https://openrouter.ai/api/v1",
"AI_MODEL": "openrouter/free",
"AI_ALLOWED_HOSTS": "openrouter.ai"
```

and upload the key:

```bash
npx wrangler secret put AI_API_KEY --config apps/worker/wrangler.jsonc
```

Keep `AI_PRIVATE_REPOSITORIES_ENABLED` set to `false` unless you explicitly accept the selected provider's source-code privacy and retention terms. See [AI provider configuration](AI_PROVIDERS.md).

> [!TIP]
> For a completely free first deployment, leave AI disabled. Rule-based analysis works without Gemini, OpenRouter, billing, or an API key.

## 9. Build and deploy

The frontend must be built before the Worker so Wrangler can include `apps/web/dist` as static assets.

```bash
npm run build
npm run deploy
```

Wrangler returns a URL similar to:

```text
https://elite-gitbot.YOUR-SUBDOMAIN.workers.dev
```

`wrangler deploy` creates a new Worker version and routes 100% of traffic to it. Static assets and API routes are served by the same deployment. See [Workers deployment behavior](https://developers.cloudflare.com/workers/versions-and-deployments/).

## 10. Create and configure the GitHub App

In GitHub, go to **Settings → Developer settings → GitHub Apps → New GitHub App**.

Use:

| Setting | Value |
|---|---|
| GitHub App name | A unique name, such as `EliteGitBot-yourname` |
| Homepage URL | Your deployed Worker URL |
| Webhook URL | `https://YOUR_WORKER/api/webhooks/github` |
| Webhook secret | The same value uploaded as `GITHUB_WEBHOOK_SECRET` |
| Active | Enabled |

Repository permissions:

| Permission | Access |
|---|---|
| Metadata | Read |
| Contents | Read |
| Pull requests | Read and write |
| Issues | Read and write |
| Actions | Read |
| Checks | Read |
| Commit statuses | Read |

Leave every permission not listed above at **No access**.

Subscribe to `security_advisory`, `check_suite`, `issue_comment`, `issues`, `pull_request`, `pull_request_review`, `pull_request_review_comment`, `push`, `release`, `repository`, and `workflow_run`. GitHub delivers installation lifecycle events needed by the App automatically; they may not appear as selectable checkboxes.

After creating the App:

1. Copy the App ID and upload it as `GITHUB_APP_ID` if not already set.
2. Generate a private key, download it once, and upload it as `GITHUB_PRIVATE_KEY`.
3. Install the App only on repositories you want EliteGitBot to access.
4. Redeploy only if code/config changed; updating a Wrangler secret deploys a new version automatically.

Generate the key from **Credentials → Key pairs → New key**:

Upload the project logo under **Display information**. Leave the IP allow list empty for a Workers deployment because Workers do not provide a single fixed outbound IP for this purpose.

## 11. Verify the deployment

### Health check

```bash
curl https://YOUR_WORKER/api/health
```

Expected response:

```json
{"status":"ok"}
```

Then verify:

1. Open the Worker URL and sign in with the configured administrator credentials.
2. Confirm the dashboard loads real empty-state or D1 values—not mock statistics.
3. Deliver GitHub's ping/test webhook and confirm it receives a successful response.
4. Open a test pull request in an installed repository.
5. Confirm a single review is created for the current commit SHA.
6. Open a test issue and confirm classification/reply behavior follows repository settings.
7. Run a failing test workflow and confirm the workflow appears in the dashboard.

## 12. Logs and troubleshooting

Stream Worker logs:

```bash
npx wrangler tail elite-gitbot
```

Common problems:

| Problem | Check |
|---|---|
| Webhook returns 401 | GitHub and Worker webhook secrets must match exactly |
| GitHub API returns 401/403 | App ID, private key, installation, and permissions |
| D1 errors | Database UUID, `DB` binding, and remote migrations |
| Queue events do not run | Both Queue names and consumer configuration |
| AI always uses rules | `AI_ENABLED`, provider variables, API secret, and allowed hostname |
| Dashboard route returns 404 | Build `apps/web/dist` before deploying |

## Updating production

```bash
git pull
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run deploy
```

Apply new D1 migrations before deploying code that depends on them.

## Rollback and backups

Worker code can be rolled back from **Cloudflare Dashboard → Workers & Pages → EliteGitBot → Deployments**. A Worker rollback does not roll back D1 or Queue data. Export or back up D1 before high-risk schema changes and prefer forward-compatible migrations.
