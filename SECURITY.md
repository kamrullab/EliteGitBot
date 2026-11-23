<a id="security-policy"></a>
<div align="center">

# 🔐 Security Policy

[![Security](https://img.shields.io/badge/Security-Private_Reports-DC2626?style=for-the-badge&logo=hackthebox&logoColor=white)](https://github.com/kamrullab/EliteGitBot/security/advisories/new)
[![Secrets](https://img.shields.io/badge/Secrets-Never_Commit-F97316?style=for-the-badge&logo=1password&logoColor=white)](#security-boundaries)
[![Safe Defaults](https://img.shields.io/badge/Defaults-Non--Destructive-16A34A?style=for-the-badge&logo=shieldsdotio&logoColor=white)](#security-boundaries)

**Report vulnerabilities privately so they can be fixed before public disclosure.**

</div>

---

> [!CAUTION]
> Never report a vulnerability in a public issue or discussion. Use [GitHub Private Vulnerability Reporting](https://github.com/kamrullab/EliteGitBot/security/advisories/new).

## 📦 Supported versions

| Version | Supported | Notes |
|---|:---:|---|
| Latest `main` | ✅ | Receives active fixes |
| Latest release | ✅ | Receives coordinated security fixes |
| Older releases | ❌ | Upgrade before requesting support |

EliteGitBot is currently pre-1.0. Security fixes are applied to the latest `main` branch and most recent release only.

---

## 🚨 Reporting a vulnerability

Please use GitHub's private vulnerability reporting feature under **Security → Advisories → Report a vulnerability** in this repository. Do not include secrets, live access tokens, private source code, or exploit traffic against systems you do not own.

Include:

- A concise description and affected component
- Reproduction steps using sanitized data
- Impact and realistic attack prerequisites
- A suggested mitigation, when available

### Response process

| Stage | Target |
|---|---|
| 📬 Acknowledgement | Within 7 days |
| 🔎 Initial assessment | After reproducibility and impact review |
| 🛠️ Remediation | Based on severity and complexity |
| 📣 Disclosure | Coordinated after a fix is available |

Valid reports remain private until a fix and disclosure plan are ready. Please allow reasonable time for investigation before public disclosure.

---

## 🎯 Scope

### In scope

- Webhook authentication or delivery deduplication bypass
- Administrator authentication, session, or CSRF vulnerabilities
- GitHub installation-token or Worker-secret exposure
- Unauthorized repository actions or permission escalation
- SSRF through configurable AI endpoints
- Prompt injection that crosses the documented trust boundary
- D1 data isolation or SQL injection failures

### Out of scope

- Automated scanning without a demonstrated security impact
- Findings that require an already-compromised administrator account
- Social engineering, denial-of-service traffic, or testing against systems you do not own
- Provider availability, free-tier exhaustion, or third-party service policies
- Reports containing live secrets or private source code

---

## 🧱 Security boundaries

| Boundary | Protection |
|---|---|
| GitHub tokens | Short-lived installation tokens are never persisted |
| Pull-request code | Never executed inside Cloudflare Workers |
| External AI | Disabled by default; private code requires explicit opt-in |
| Webhooks | HMAC-SHA256 signature and unique delivery ID required |
| AI endpoints | HTTPS, hostname allowlist, timeout, and schema validation |
| Destructive actions | Merge, approval, closing, and deletion remain disabled by default |
| Browser sessions | HttpOnly cookie, expiry, CSRF validation, and logout |

> [!NOTE]
> Security controls reduce risk but do not prove that the platform or reviewed repositories are vulnerability-free.

---

## 🏆 Recognition

With the reporter's permission, resolved security contributions may be acknowledged in release notes. Anonymous reporting is respected.

<div align="center">

**Responsible disclosure protects every EliteGitBot installation.**

[Report privately](https://github.com/kamrullab/EliteGitBot/security/advisories/new) · [⬆ Back to top](#security-policy)

</div>
