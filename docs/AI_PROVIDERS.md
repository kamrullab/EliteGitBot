# AI provider configuration

EliteGitBot supports three runtime modes through one provider interface:

- `rule-based`: local deterministic analysis with no external request
- `gemini`: Google's native Gemini Developer API
- `openai-compatible`: OpenRouter, OpenAI, Groq, Together, an AI gateway, or an externally reachable Ollama endpoint implementing `/chat/completions`

If an external request fails, times out, or returns invalid structured output, EliteGitBot records a structured error log without credentials and falls back to deterministic rules.

## Gemini

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
