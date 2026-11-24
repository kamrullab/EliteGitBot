import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyWebhook } from "../src/utils/crypto";
import { GeminiProvider, OpenAICompatibleProvider, RuleBasedProvider } from "../src/ai/providers";
import { verifyPassword } from "../src/services/auth";

afterEach(() => vi.unstubAllGlobals());

describe("GitHub webhook verification", () => {
  it("accepts a valid SHA-256 signature and rejects tampering", async () => {
    const body = JSON.stringify({ action: "opened" });
    const secret = "test-webhook-secret";
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const digest = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))), (byte) => byte.toString(16).padStart(2, "0")).join("");
    expect(await verifyWebhook(body, `sha256=${digest}`, secret)).toBe(true);
    expect(await verifyWebhook(`${body}x`, `sha256=${digest}`, secret)).toBe(false);
    expect(await verifyWebhook(body, undefined, secret)).toBe(false);
  });
});

describe("administrator password verification", () => {
  it("accepts a Worker-compatible 100,000-iteration PBKDF2 hash", async () => {
    const password = "correct-horse-battery-staple";
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256));
    const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
    const encoded = `pbkdf2$100000$${base64(salt)}$${base64(derived)}`;

    expect(await verifyPassword(password, encoded)).toBe(true);
    expect(await verifyPassword("wrong-password", encoded)).toBe(false);
    expect(await verifyPassword(password, encoded.replace("pbkdf2$100000$", "pbkdf2$210000$"))).toBe(false);
  });
});

describe("rule-based PR analysis", () => {
  it("redacts the value and flags a hardcoded credential", async () => {
    const result = await new RuleBasedProvider().analyzePullRequest("config", [{ filename: "src/config.ts", status: "modified", additions: 1, deletions: 0, patch: "+const apiKey = 'super-secret-value';" }]);
    expect(result.findings[0]?.severity).toBe("critical");
    expect(JSON.stringify(result)).not.toContain("super-secret-value");
    expect(result.recommendation).toBe("request-changes-candidate");
  });
  it("classifies issues conservatively", async () => {
    const result = await new RuleBasedProvider().analyzeIssue("App crashes on login", "Reproduction included");
    expect(result.category).toBe("Bug Report");
    expect(result.reply).toContain("automated acknowledgement");
  });
});

describe("external AI providers", () => {
  const analysis = JSON.stringify({ summary: "Review complete", findings: [], recommendation: "needs-human-review" });

  it("parses OpenAI-compatible JSON without exposing the API key in the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: analysis } }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatibleProvider({ apiKey: "test-secret-key", baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/free", maxInputChars: 50000 });
    const result = await provider.analyzePullRequest("Safe change", []);
    expect(result.provider).toBe("openai-compatible");
    const request = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request[0]).toBe("https://openrouter.ai/api/v1/chat/completions");
    const body = request[1].body;
    expect(typeof body).toBe("string");
    if (typeof body !== "string") throw new Error("Expected serialized request body");
    expect(body).not.toContain("test-secret-key");
  });

  it("uses Gemini structured JSON mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: analysis }] } }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new GeminiProvider({ apiKey: "gemini-test-key", baseUrl: "https://generativelanguage.googleapis.com", model: "gemini-test", maxInputChars: 50000 });
    const result = await provider.analyzePullRequest("Safe change", []);
    expect(result.provider).toBe("gemini");
    const request = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request[0]).toContain("generativelanguage.googleapis.com");
    const body = request[1].body;
    expect(typeof body).toBe("string");
    if (typeof body !== "string") throw new Error("Expected serialized request body");
    expect(body).not.toContain("gemini-test-key");
  });
});
