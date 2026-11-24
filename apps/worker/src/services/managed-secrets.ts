const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function encryptionKey(value: string): Promise<CryptoKey> {
  const bytes = base64ToBytes(value.trim());
  if (bytes.byteLength !== 32) throw new Error("CONFIG_ENCRYPTION_KEY must contain exactly 32 base64-encoded bytes");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function setManagedSecret(env: Env, name: string, plaintext: string): Promise<void> {
  const encrypted = await encryptValue(env.CONFIG_ENCRYPTION_KEY, name, plaintext);
  await env.DB.prepare("INSERT INTO managed_secrets(name,ciphertext,iv) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET ciphertext=excluded.ciphertext,iv=excluded.iv,updated_at=CURRENT_TIMESTAMP")
    .bind(name, encrypted.ciphertext, encrypted.iv).run();
}

export async function encryptValue(rootKey: string, name: string, plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(name) }, await encryptionKey(rootKey), encoder.encode(plaintext)));
  return { ciphertext: bytesToBase64(ciphertext), iv: bytesToBase64(iv) };
}

export async function getManagedSecret(env: Env, name: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT ciphertext,iv FROM managed_secrets WHERE name=?").bind(name).first<{ ciphertext: string; iv: string }>();
  if (!row) return null;
  return decryptValue(env.CONFIG_ENCRYPTION_KEY, name, row);
}

export async function decryptValue(rootKey: string, name: string, encrypted: { ciphertext: string; iv: string }): Promise<string> {
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(encrypted.iv), additionalData: encoder.encode(name) }, await encryptionKey(rootKey), base64ToBytes(encrypted.ciphertext));
  return decoder.decode(plaintext);
}

export async function deleteManagedSecret(env: Env, name: string): Promise<void> {
  await env.DB.prepare("DELETE FROM managed_secrets WHERE name=?").bind(name).run();
}
