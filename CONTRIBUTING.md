<a id="contributing"></a>
<div align="center">

# 🛠️ Contributing to EliteGitBot

[![Contributions](https://img.shields.io/badge/Contributions-Welcome-7C3AED?style=for-the-badge&logo=git&logoColor=white)](CONTRIBUTING.md)
[![Pull Requests](https://img.shields.io/badge/Pull_Requests-Reviewed-2563EB?style=for-the-badge&logo=github&logoColor=white)](.github/pull_request_template.md)
[![Tests](https://img.shields.io/badge/Tests-Required-16A34A?style=for-the-badge&logo=vitest&logoColor=white)](#development-workflow)

**Build secure automation with focused changes, clear tests, and safe defaults.**

</div>

---

Thank you for helping improve EliteGitBot. Security, predictable automation, and honest user-facing behavior take priority over feature speed.

> [!IMPORTANT]
> Never include production secrets, private repository code, real access tokens, or unsanitized webhook payloads in a contribution.

## 🧭 Choose a contribution

| Contribution | Start here |
|---|---|
| 🐛 Bug fix | Open or reference a reproducible bug report |
| ✨ Feature | Explain the user problem and proposed safe default |
| 🛡️ Security fix | Follow [SECURITY.md](SECURITY.md) privately first |
| 📚 Documentation | Confirm commands and links against current behavior |
| 🧪 Tests | Cover a missing failure path or regression |

---

## 🚀 Development workflow

1. Fork the repository and create a focused branch from `main`.
2. Install dependencies with `npm install`.
3. Copy `.dev.vars.example` to `apps/worker/.dev.vars` and use development-only values.
4. Apply the local D1 migration as documented in the README.
5. Add tests for changed behavior.
6. Run the full validation suite before opening a pull request:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### Suggested branch names

```text
feat/provider-settings
fix/webhook-deduplication
docs/cloudflare-deployment
test/github-client-retry
```

---

## ✅ Quality checklist

| Check | Command | Required |
|---|---|:---:|
| ESLint | `npm run lint` | ✅ |
| Strict TypeScript | `npm run typecheck` | ✅ |
| Automated tests | `npm test` | ✅ |
| Production builds | `npm run build` | ✅ |

> [!TIP]
> Add the smallest test that would have caught the bug or unsafe behavior before your change.

---

## 🔀 Pull-request expectations

- Keep changes small and explain the user-visible outcome.
- Never commit secrets, private repository content, access tokens, or real webhook payloads.
- Preserve the default prohibition on automatic approval, merging, closing, deletion, or untrusted-code execution.
- Treat repository text, diffs, issues, and comments as untrusted input.
- Document new permissions and justify why they are necessary.
- Use migrations for schema changes; never create production tables at request time.

### PR description checklist

- [ ] The outcome and motivation are clearly described
- [ ] Tests cover new or changed behavior
- [ ] New GitHub/Cloudflare permissions are documented
- [ ] Database changes use a forward-compatible migration
- [ ] Screenshots are included for visible dashboard changes
- [ ] No secret, token, or private repository content is present

---

## 🧱 Engineering principles

| Principle | Expectation |
|---|---|
| Least privilege | Request only permissions the feature genuinely needs |
| Safe automation | Never auto-approve, merge, close, or delete by default |
| Untrusted input | Validate GitHub payloads, diffs, issues, comments, and AI output |
| Idempotency | Webhook retries must not duplicate actions |
| Honest UI | No mock production statistics or buttons that do nothing |
| Worker compatibility | Avoid Node-only behavior unsupported by Cloudflare Workers |

---

## 🔐 Reporting security issues

Do not open public issues for vulnerabilities. Follow [SECURITY.md](SECURITY.md).

<div align="center">

**Thank you for making EliteGitBot safer and more useful.**

[⬆ Back to top](#contributing) · [Read the Code of Conduct](CODE_OF_CONDUCT.md)

</div>
