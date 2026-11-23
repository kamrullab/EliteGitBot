import { describe, expect, it } from "vitest";
import { verifyWebhook } from "../src/utils/crypto";
import { RuleBasedProvider } from "../src/ai/providers";

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
