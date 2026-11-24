export type EventJob = { deliveryId: string; event: string; payload: GitHubPayload };

export type GitHubPayload = {
  action?: string;
  installation?: { id: number; account?: { login: string; type: string }; suspended_at?: string | null };
  repository?: { id: number; name: string; full_name: string; private: boolean; visibility?: string; default_branch: string; archived: boolean; owner: { login: string } };
  pull_request?: { id: number; number?: number; title: string; state: string; html_url: string; head: { sha: string }; base: { ref: string }; user: { login: string } };
  issue?: { id: number; number: number; title: string; body?: string | null; state: string; html_url: string; user: { login: string } };
  workflow_run?: { id: number; name: string; status: string; conclusion?: string | null; head_branch?: string | null; head_sha: string; html_url: string; run_started_at?: string; updated_at?: string };
  sender?: { login: string };
};

export type Finding = { category: string; severity: "critical" | "high" | "medium" | "low"; title: string; description: string; path?: string; line?: number; confirmed: boolean };
export type Analysis = { summary: string; findings: Finding[]; recommendation: "approve-candidate" | "request-changes-candidate" | "needs-human-review"; provider: string };
export type PullFile = { filename: string; status: string; additions: number; deletions: number; patch?: string };
