# Architecture

EliteGitBot separates event ingestion, asynchronous processing, persistence, and presentation so webhook response time is not coupled to GitHub API or analysis latency.

## Request flow

1. GitHub sends a webhook with a delivery ID and HMAC signature.
2. The Worker verifies the signature before parsing or persisting the payload.
3. D1's unique delivery constraint rejects duplicates.
4. The Worker enqueues a typed event and returns HTTP 202.
5. The Queue consumer synchronizes installation/repository state and dispatches to a focused processor.
6. The processor obtains a short-lived GitHub installation token, performs allowed API operations, and records the result in D1.
7. The dashboard reads persisted state through authenticated REST endpoints.

## Trust boundaries

Repository content, diffs, issue bodies, comments, webhook fields, and external provider output are untrusted. Secrets remain Worker bindings. Installation tokens are memory-only. Static scanners execute in isolated GitHub Actions jobs without write credentials to pull-request code.

## Reliability model

- Queue delivery is at least once.
- Webhook delivery IDs and review commit SHAs have database uniqueness constraints.
- Queue jobs retry three times before entering a dead-letter queue.
- Failed delivery state is retained instead of silently discarded.
- GitHub requests use bounded timeouts and exponential retry for transient failures.

## Storage

D1 stores installations, repositories, settings, webhook ledgers, reviews, findings, issues, replies, workflows, activity, and administrator sessions. Schema changes are versioned under `migrations/`.

## Future scale

The installation and repository foreign-key model already permits multiple GitHub installations. Multi-tenant SaaS requires tenant-scoped authorization, encryption for tenant provider settings, billing/quotas, and stronger isolation before public registration is enabled.
