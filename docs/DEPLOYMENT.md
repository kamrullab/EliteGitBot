# Deployment guide

## Cloudflare resources

Create one D1 database, a primary Queue, and a dead-letter Queue. Update the D1 ID in `apps/worker/wrangler.jsonc`; resource names must match the configuration.

Apply migrations remotely only after checking the selected Cloudflare account:

```bash
npx wrangler whoami
npx wrangler d1 migrations apply elite-gitbot --remote --config apps/worker/wrangler.jsonc
```

Upload secrets interactively with `wrangler secret put`. Never place production values in `wrangler.jsonc`, command arguments, logs, or CI output.

## GitHub App

After deployment, configure the App webhook URL as `https://YOUR_HOST/api/webhooks/github`, set the same webhook secret in GitHub and Cloudflare, select the permissions documented in the README, and install the App only on intended repositories.

## Verification

1. Request `/api/health` and expect `{ "status": "ok" }`.
2. Sign in and confirm dashboard totals load from D1.
3. Send GitHub's `ping` webhook and confirm a delivery record appears.
4. Open a test PR in an authorized repository and verify a single SHA-specific review.
5. Confirm failed Queue messages reach the DLQ after retries.

## Rollback

Worker code can be rolled back through Cloudflare deployments, but connected D1/Queue data is not rolled back with code. Use forward-compatible migrations and take an export before high-risk schema changes.
