import type { Analysis, Finding, PullFile } from "../types";

export interface AIProvider {
  readonly name: string;
  analyzePullRequest(title: string, files: PullFile[]): Promise<Analysis>;
  analyzeIssue(title: string, body: string): Promise<{ category: string; reply: string }>;
}

const secretPatterns = [
  { title: "Potential private key", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i },
  { title: "Potential hardcoded credential", regex: /(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"'\s]{8,}["']/i },
  { title: "Potential command injection", regex: /(?:exec|spawn|system)\s*\([^)]*(?:req\.|request\.|input|body)/i },
  { title: "Potential SQL injection", regex: /(?:SELECT|INSERT|UPDATE|DELETE)[^;]*(?:\$\{|\+\s*(?:req|input|body))/i },
  { title: "Potential XSS", regex: /(?:innerHTML|dangerouslySetInnerHTML)\s*[:=]/i }
] as const;

export class RuleBasedProvider implements AIProvider {
  readonly name = "rule-based";
  analyzePullRequest(title: string, files: PullFile[]): Promise<Analysis> {
    const findings: Finding[] = [];
    for (const file of files) {
      const patch = file.patch ?? "";
      for (const pattern of secretPatterns) {
        if (pattern.regex.test(patch)) findings.push({ category: "security", severity: pattern.title.includes("private") || pattern.title.includes("credential") ? "critical" : "high", title: pattern.title, description: "A heuristic pattern was found in added code. Validate manually; sensitive values are intentionally redacted.", path: file.filename, confirmed: false });
      }
      if (/^\+.*console\.(log|debug)\(/m.test(patch)) findings.push({ category: "code-quality", severity: "low", title: "Debug logging added", description: "Confirm that logs are structured and contain no sensitive data.", path: file.filename, confirmed: false });
    }
    const severe = findings.some((finding) => finding.severity === "critical" || finding.severity === "high");
    return Promise.resolve({ summary: `Reviewed ${files.length} changed file(s) in “${title}” using local deterministic rules.`, findings, recommendation: severe ? "request-changes-candidate" : "needs-human-review", provider: this.name });
  }
  analyzeIssue(title: string, body: string): Promise<{ category: string; reply: string }> {
    const text = `${title} ${body}`.toLowerCase();
    const category = /security|vulnerab|cve/.test(text) ? "Security Report" : /bug|error|crash|broken/.test(text) ? "Bug Report" : /feature|request|would like/.test(text) ? "Feature Request" : /install|setup/.test(text) ? "Installation Problem" : /docs|documentation/.test(text) ? "Documentation" : /\?|how (?:do|can)/.test(text) ? "Question" : "Other";
    return Promise.resolve({ category, reply: `Thanks for reporting this issue.\n\nEliteGitBot categorized it as **${category}**. This is an automated acknowledgement, not confirmation that a developer has reviewed it. Please add reproduction steps and sanitized logs when relevant.` });
  }
}

export function createProvider(): AIProvider {
  return new RuleBasedProvider();
}
