PRAGMA foreign_keys = ON;

ALTER TABLE ai_provider_settings ADD COLUMN base_url TEXT;
ALTER TABLE ai_provider_settings ADD COLUMN allowed_hosts TEXT;

CREATE TABLE managed_secrets (
  name TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO ai_provider_settings (
  id, enabled, provider, model, max_input_size,
  private_code_external_enabled
) VALUES (1, 0, 'rule-based', NULL, 50000, 0);
