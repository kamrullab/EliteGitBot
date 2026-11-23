import { bytesToBase64Url } from "../utils/crypto";

const encoder = new TextEncoder();

function pemToBytes(pem: string): ArrayBuffer {
  const content = pem.replace(/\\n/g, "\n").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(content);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

async function appJwt(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({ iat: now - 60, exp: now + 540, iss: env.GITHUB_APP_ID })));
  const key = await crypto.subtle.importKey("pkcs8", pemToBytes(env.GITHUB_PRIVATE_KEY), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(`${header}.${payload}`));
  return `${header}.${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function request<T>(url: string, init: RequestInit, attempts = 3): Promise<T> {
  let lastError = "GitHub request failed";
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
    if (response.ok) return response.json<T>();
    lastError = `GitHub API ${response.status}`;
    if (response.status !== 429 && response.status < 500) break;
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  throw new Error(lastError);
}

export class GitHubClient {
  private constructor(private readonly token: string) {}

  static async forInstallation(env: Env, installationId: number): Promise<GitHubClient> {
    const jwt = await appJwt(env);
    const result = await request<{ token: string }>(`https://api.github.com/app/installations/${installationId}/access_tokens`, { method: "POST", headers: headers(jwt) });
    return new GitHubClient(result.token);
  }

  get<T>(path: string): Promise<T> { return request<T>(`https://api.github.com${path}`, { headers: headers(this.token) }); }
  post<T>(path: string, body: unknown): Promise<T> { return request<T>(`https://api.github.com${path}`, { method: "POST", headers: headers(this.token), body: JSON.stringify(body) }); }
  patch<T>(path: string, body: unknown): Promise<T> { return request<T>(`https://api.github.com${path}`, { method: "PATCH", headers: headers(this.token), body: JSON.stringify(body) }); }
}

function headers(token: string): Record<string, string> {
  return { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "EliteGitBot/0.1", "X-GitHub-Api-Version": "2022-11-28" };
}
