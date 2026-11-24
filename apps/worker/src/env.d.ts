interface Env {
  GITHUB_APP_ID: string;
  GITHUB_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD_HASH: string;
  SESSION_SECRET: string;
  CONFIG_ENCRYPTION_KEY: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
  AI_ENABLED?: string;
  AI_PROVIDER?: "gemini" | "openai-compatible" | "rule-based";
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
  AI_ALLOWED_HOSTS?: string;
  AI_MAX_INPUT_CHARS?: string;
  AI_PRIVATE_REPOSITORIES_ENABLED?: string;
}
