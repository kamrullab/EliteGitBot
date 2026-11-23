<div align="center">

# 🔐 Security Policy

[![Security](https://img.shields.io/badge/Security-Private_Reports-DC2626?style=for-the-badge&logo=hackthebox&logoColor=white)](https://github.com/kamrullab/EliteGitBot/security/advisories/new)
[![Secrets](https://img.shields.io/badge/Secrets-Never_Commit-F97316?style=for-the-badge&logo=1password&logoColor=white)](#security-boundaries)
[![Safe Defaults](https://img.shields.io/badge/Defaults-Non--Destructive-16A34A?style=for-the-badge&logo=shieldsdotio&logoColor=white)](#security-boundaries)

**Report vulnerabilities privately so they can be fixed before public disclosure.**

</div>

---

## Supported versions

EliteGitBot is currently pre-1.0. Security fixes are applied to the latest `main` branch and most recent release only.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting feature under **Security → Advisories → Report a vulnerability** in this repository. Do not include secrets, live access tokens, private source code, or exploit traffic against systems you do not own.

Include:

- A concise description and affected component
- Reproduction steps using sanitized data
- Impact and realistic attack prerequisites
- A suggested mitigation, when available

You should receive an acknowledgement within seven days. Valid reports will be coordinated privately until a fix and disclosure plan are ready.

## Security boundaries

- Installation tokens are short-lived and are not persisted.
- Pull-request code is not executed inside Workers.
- External AI transmission is disabled by default.
- Webhooks require a valid GitHub HMAC signature.
- Destructive repository actions are outside the default product policy.
