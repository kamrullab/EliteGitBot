# REST API overview

All endpoints except health, login, and the GitHub webhook require an authenticated administrator session. State-changing dashboard requests also require the CSRF header and matching cookie.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Worker health probe |
| `POST` | `/api/auth/login` | Start administrator session |
| `POST` | `/api/auth/logout` | Revoke current session |
| `GET` | `/api/auth/me` | Check session state |
| `POST` | `/api/webhooks/github` | Receive signed GitHub events |
| `GET` | `/api/dashboard/stats` | Retrieve live dashboard totals |
| `GET` | `/api/repositories` | List synchronized repositories |
| `GET` | `/api/repositories/:id` | Retrieve repository settings |
| `PATCH` | `/api/repositories/:id/settings` | Update repository automation |
| `GET` | `/api/pull-requests` | List tracked pull requests |
| `GET` | `/api/pull-requests/:id/findings` | List review findings |
| `GET` | `/api/issues` | List classified issues |
| `GET` | `/api/security/findings` | List persisted security findings |
| `GET` | `/api/workflows` | List workflow runs |
| `GET` | `/api/activity` | List automation activity |
| `POST` | `/api/github/sync` | Synchronize installed repositories |
| `GET` | `/api/settings` | Retrieve non-secret settings |
| `GET` | `/api/ai/providers` | Retrieve configured-status only |

Errors use `{ "error": { "code": string, "message": string } }`. Internal stack traces and secret values are never included.
