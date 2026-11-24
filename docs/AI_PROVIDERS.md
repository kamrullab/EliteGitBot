# AI provider configuration

EliteGitBot supports three runtime modes through one provider interface:

- `rule-based`: local deterministic analysis with no external request
- `gemini`: Google's native Gemini Developer API
- `openai-compatible`: OpenRouter, OpenAI, Groq, Together, an AI gateway, or an externally reachable Ollama endpoint implementing `/chat/completions`

If an external request fails, times out, or returns invalid structured output, EliteGitBot records a structured error log without credentials and falls back to deterministic rules.

## Which mode should I choose?

| Goal | Recommended mode | Cost notes |
|---|---|---|
| No account, no external code sharing | `rule-based` | Always free and enabled by default |
| Free AI with a direct provider | `gemini` | Google offers a limited free tier; current quotas apply |
| Try multiple free models with one key | `openai-compatible` + OpenRouter | `openrouter/free` is rate-limited and model availability can change |
| Predictable production behavior | A pinned paid/free model | Check the provider's current price and retention policy |

For a public repository and a fully free setup, start with `rule-based`. Add Gemini or OpenRouter only after the GitHub App and dashboard work correctly.

## Production quick start

For production, sign in and open **AI Settings**. The dashboard can enable/disable providers, set the model and endpoint, add/replace/remove the API key, control private-repository sharing, and test the connection. Saved keys are AES-GCM encrypted in D1 and never returned to the browser.

CLI configuration remains available for local development and migration. It has two parts:

1. Non-secret values go in `apps/worker/wrangler.jsonc` under `vars`.
2. API keys go to Cloudflare encrypted secrets with `wrangler secret put`.

Never put an API key in `wrangler.jsonc`, `.dev.vars.example`, a screenshot, an issue, or a Git commit.

## Gemini

1. Open [Google AI Studio API keys](https://aistudio.google.com/app/apikey) and create/copy a key.
2. In `apps/worker/wrangler.jsonc`, set:

```jsonc
"AI_ENABLED": "true",
"AI_PROVIDER": "gemini",
"GEMINI_MODEL": "YOUR_CURRENT_GEMINI_MODEL",
"AI_MAX_INPUT_CHARS": "50000",
"AI_PRIVATE_REPOSITORIES_ENABLED": "false"
```

3. Upload the key interactively and deploy the changed variables:

```bash
npx wrangler secret put GEMINI_API_KEY --config apps/worker/wrangler.jsonc
npm run build
npm run deploy
```

Use a model identifier currently listed in the official Gemini documentation or AI Studio. Model names and free-tier quotas change, so the repository intentionally does not hardcode a temporary free model.

Equivalent local-development values are:

```dotenv
AI_ENABLED=true
AI_PROVIDER=gemini
GEMINI_API_KEY=replace-me
GEMINI_MODEL=gemini-model-id
AI_MAX_INPUT_CHARS=50000
AI_PRIVATE_REPOSITORIES_ENABLED=false
```

Store `GEMINI_API_KEY` with `wrangler secret put`, not in committed files.

## OpenRouter

1. Create a key from the [OpenRouter keys page](https://openrouter.ai/settings/keys).
2. In `apps/worker/wrangler.jsonc`, set:

```jsonc
"AI_ENABLED": "true",
"AI_PROVIDER": "openai-compatible",
"AI_BASE_URL": "https://openrouter.ai/api/v1",
"AI_MODEL": "openrouter/free",
"AI_ALLOWED_HOSTS": "openrouter.ai",
"AI_MAX_INPUT_CHARS": "50000",
"AI_PRIVATE_REPOSITORIES_ENABLED": "false"
```

3. Upload the key and deploy:

```bash
npx wrangler secret put AI_API_KEY --config apps/worker/wrangler.jsonc
npm run build
npm run deploy
```

Equivalent local-development values are:

```dotenv
AI_ENABLED=true
AI_PROVIDER=openai-compatible
AI_API_KEY=replace-me
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=openrouter/free
AI_ALLOWED_HOSTS=openrouter.ai
AI_PRIVATE_REPOSITORIES_ENABLED=false
```

Change `AI_MODEL` to a specific model when predictable behavior matters. Free routers and model availability may change.

## Verify the active provider

1. Sign in at `https://YOUR_WORKER/login`.
2. Open the dashboard AI/settings area, or request `GET /api/ai/providers` in the authenticated browser session.
3. Confirm the chosen provider reports `configured: true` and `active: true`.
4. Call `POST /api/ai/test` from the authenticated dashboard/session. A successful response identifies the provider used.
5. Check Cloudflare logs if the test falls back to rules:

```bash
npx wrangler tail gitbot --config apps/worker/wrangler.jsonc
```

The test endpoint is authenticated and never returns the stored API key.

To disable external AI immediately, restore these committed defaults and deploy:

```jsonc
"AI_ENABLED": "false",
"AI_PROVIDER": "rule-based"
```

## Other OpenAI-compatible services

Set `AI_BASE_URL`, `AI_MODEL`, and `AI_ALLOWED_HOSTS` for the provider. The base URL may be the API root or the complete `/chat/completions` URL. Only HTTPS endpoints whose exact hostname appears in `AI_ALLOWED_HOSTS` are accepted.

Examples of configuration shapes:

```dotenv
# Groq-style
AI_BASE_URL=https://api.groq.com/openai/v1
AI_ALLOWED_HOSTS=api.groq.com

# Together-style
AI_BASE_URL=https://api.together.xyz/v1
AI_ALLOWED_HOSTS=api.together.xyz

# Multiple trusted hosts
AI_ALLOWED_HOSTS=openrouter.ai,api.groq.com,api.together.xyz
```

## Ollama

A deployed Cloudflare Worker cannot reach Ollama at `localhost`. Use an administrator-controlled HTTPS endpoint with authentication and OpenAI compatibility, then add its hostname to `AI_ALLOWED_HOSTS`. Never expose an unauthenticated Ollama server to the public internet.

## Privacy and prompt safety

- Private-repository content remains local unless `AI_PRIVATE_REPOSITORIES_ENABLED=true`.
- Common credential patterns and private keys are redacted before external transmission.
- Repository content is marked untrusted and cannot supply system instructions or tools.
- AI findings cannot invent inline line numbers; paths are accepted only when they match changed files.
- API responses are validated against strict JSON schemas.
- `AI_MAX_INPUT_CHARS` limits transmitted diff size.

External provider privacy and data-retention terms still apply. Review them before enabling private-repository analysis.
