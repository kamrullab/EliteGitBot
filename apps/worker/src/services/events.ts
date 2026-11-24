import { createProvider } from "../ai/providers";
import { GitHubClient } from "../github/client";
import type { Analysis, EventJob, GitHubPayload, PullFile } from "../types";
import { sha256 } from "../utils/crypto";

async function log(db: D1Database, type: string, description: string, repositoryId?: number, metadata: unknown = {}): Promise<void> {
  await db.prepare("INSERT INTO activity_logs (repository_id,event_type,description,metadata) VALUES (?,?,?,?)").bind(repositoryId ?? null, type, description, JSON.stringify(metadata)).run();
}

async function canSendToExternalAI(env: Env, isPrivate: boolean): Promise<boolean> {
  if (!isPrivate) return true;
  const settings = await env.DB.prepare("SELECT private_code_external_enabled FROM ai_provider_settings WHERE id=1").first<{ private_code_external_enabled: number }>();
  return settings ? Boolean(settings.private_code_external_enabled) : env.AI_PRIVATE_REPOSITORIES_ENABLED === "true";
}

async function installationPk(db: D1Database, githubId: number): Promise<number> {
  const row = await db.prepare("SELECT id FROM github_installations WHERE github_installation_id=?").bind(githubId).first<{ id: number }>();
  if (!row) throw new Error("Installation is not synchronized");
  return row.id;
}

async function syncInstallation(env: Env, payload: GitHubPayload): Promise<void> {
  const installation = payload.installation;
  if (!installation) return;
  await env.DB.prepare("INSERT INTO github_installations (github_installation_id,account_login,account_type,suspended_at) VALUES (?,?,?,?) ON CONFLICT(github_installation_id) DO UPDATE SET account_login=excluded.account_login,account_type=excluded.account_type,suspended_at=excluded.suspended_at,updated_at=CURRENT_TIMESTAMP").bind(installation.id, installation.account.login, installation.account.type, installation.suspended_at ?? null).run();
  await log(env.DB, "installation", `GitHub App installation ${payload.action ?? "updated"}`, undefined, { installationId: installation.id });
}

async function syncRepository(env: Env, payload: GitHubPayload): Promise<number | undefined> {
  const repo = payload.repository;
  const installation = payload.installation;
  if (!repo || !installation) return undefined;
  await syncInstallation(env, payload);
  const parentId = await installationPk(env.DB, installation.id);
  await env.DB.prepare("INSERT INTO repositories (github_repository_id,installation_id,owner,name,full_name,visibility,default_branch,archived,last_activity_at) VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(github_repository_id) DO UPDATE SET installation_id=excluded.installation_id,owner=excluded.owner,name=excluded.name,full_name=excluded.full_name,visibility=excluded.visibility,default_branch=excluded.default_branch,archived=excluded.archived,last_activity_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP").bind(repo.id, parentId, repo.owner.login, repo.name, repo.full_name, repo.visibility ?? (repo.private ? "private" : "public"), repo.default_branch, repo.archived ? 1 : 0).run();
  const row = await env.DB.prepare("SELECT id FROM repositories WHERE github_repository_id=?").bind(repo.id).first<{ id: number }>();
  if (!row) throw new Error("Repository synchronization failed");
  await env.DB.prepare("INSERT OR IGNORE INTO repository_settings (repository_id) VALUES (?)").bind(row.id).run();
  return row.id;
}

function renderReview(analysis: Analysis): string {
  const groups = ["critical", "high", "medium", "low"] as const;
  const sections = groups.map((severity) => {
    const findings = analysis.findings.filter((item) => item.severity === severity);
    if (!findings.length) return "";
    return `### ${severity[0]?.toUpperCase()}${severity.slice(1)} Priority Issues\n${findings.map((item) => `- **${item.title}**${item.path ? ` (\`${item.path}\`)` : ""}: ${item.description}`).join("\n")}`;
  }).filter(Boolean).join("\n\n");
  return `## EliteGitBot Code Review\n\nOverall Status: ${analysis.findings.length ? "Needs Attention" : "Looks Good"}\n\n### Summary\n${analysis.summary}\n\n${sections || "### Findings\nNo deterministic findings were detected. This does not establish that the code is secure or correct."}\n\n### Final Recommendation\n${analysis.recommendation.replaceAll("-", " ")}\n\n> Automated analysis (${analysis.provider}). Human review is required; EliteGitBot never auto-approves or merges.`;
}

async function processPullRequest(env: Env, payload: GitHubPayload, repositoryId: number): Promise<void> {
  const repo = payload.repository;
  const pr = payload.pull_request;
  const installation = payload.installation;
  if (!repo || !pr || !installation) return;
  const settings = await env.DB.prepare("SELECT r.monitored,s.pr_review_enabled,s.max_file_size,s.excluded_paths,s.require_publish_approval FROM repositories r JOIN repository_settings s ON s.repository_id=r.id WHERE r.id=?").bind(repositoryId).first<{ monitored: number; pr_review_enabled: number; max_file_size: number; excluded_paths: string; require_publish_approval: number }>();
  if (!settings?.monitored || !settings.pr_review_enabled) return;
  const number = pr.number ?? 0;
  await env.DB.prepare("INSERT INTO pull_requests (repository_id,github_pr_id,number,title,author,state,head_sha,base_branch,html_url) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(repository_id,number) DO UPDATE SET title=excluded.title,author=excluded.author,state=excluded.state,head_sha=excluded.head_sha,base_branch=excluded.base_branch,html_url=excluded.html_url,updated_at=CURRENT_TIMESTAMP").bind(repositoryId, pr.id, number, pr.title, pr.user.login, pr.state, pr.head.sha, pr.base.ref, pr.html_url).run();
  const exists = await env.DB.prepare("SELECT id FROM pull_request_reviews WHERE repository_id=? AND pr_number=? AND commit_sha=?").bind(repositoryId, number, pr.head.sha).first();
  if (exists) return;
  const client = await GitHubClient.forInstallation(env, installation.id);
  const allFiles = await client.get<PullFile[]>(`/repos/${repo.full_name}/pulls/${number}/files?per_page=100`);
  const excluded = JSON.parse(settings.excluded_paths) as string[];
  const files = allFiles.filter((file) => file.patch && file.patch.length <= settings.max_file_size && !excluded.some((pattern) => pattern.endsWith("/**") ? file.filename.startsWith(pattern.slice(0, -3)) : pattern.startsWith("*.") ? file.filename.endsWith(pattern.slice(1)) : file.filename === pattern));
  const analysis = await (await createProvider(env, await canSendToExternalAI(env, repo.private))).analyzePullRequest(pr.title, files);
  const risk = analysis.findings.some((finding) => finding.severity === "critical") ? "critical" : analysis.findings.some((finding) => finding.severity === "high") ? "high" : analysis.findings.length ? "medium" : "low";
  const prRow = await env.DB.prepare("SELECT id FROM pull_requests WHERE repository_id=? AND number=?").bind(repositoryId, number).first<{ id: number }>();
  if (!prRow) throw new Error("Pull request persistence failed");
  const result = await env.DB.prepare("INSERT INTO pull_request_reviews (pull_request_id,repository_id,pr_number,commit_sha,status,risk_level,provider,summary,recommendation) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id").bind(prRow.id, repositoryId, number, pr.head.sha, settings.require_publish_approval ? "pending_approval" : "completed", risk, analysis.provider, analysis.summary, analysis.recommendation).first<{ id: number }>();
  if (!result) throw new Error("Review persistence failed");
  for (const finding of analysis.findings) {
    const fingerprint = await sha256(`${finding.category}:${finding.title}:${finding.path ?? ""}:${finding.line ?? ""}`);
    await env.DB.prepare("INSERT OR IGNORE INTO review_findings (review_id,category,severity,title,description,file_path,line,confirmed,fingerprint) VALUES (?,?,?,?,?,?,?,?,?)").bind(result.id, finding.category, finding.severity, finding.title, finding.description, finding.path ?? null, finding.line ?? null, finding.confirmed ? 1 : 0, fingerprint).run();
  }
  if (!settings.require_publish_approval) {
    const comment = await client.post<{ id: number }>(`/repos/${repo.full_name}/issues/${number}/comments`, { body: renderReview(analysis) });
    await env.DB.prepare("UPDATE pull_request_reviews SET github_comment_id=?,published_at=CURRENT_TIMESTAMP WHERE id=?").bind(comment.id, result.id).run();
  }
  await log(env.DB, "pr_reviewed", `Reviewed PR #${number}`, repositoryId, { sha: pr.head.sha, findings: analysis.findings.length });
}

async function processIssue(env: Env, payload: GitHubPayload, repositoryId: number): Promise<void> {
  const issue = payload.issue; const repo = payload.repository; const installation = payload.installation;
  if (!issue || !repo || !installation || payload.action !== "opened") return;
  const settings = await env.DB.prepare("SELECT issue_automation_enabled,auto_labeling_enabled,require_publish_approval FROM repository_settings WHERE repository_id=?").bind(repositoryId).first<{ issue_automation_enabled: number; auto_labeling_enabled: number; require_publish_approval: number }>();
  if (!settings?.issue_automation_enabled) return;
  const analysis = await (await createProvider(env, await canSendToExternalAI(env, repo.private))).analyzeIssue(issue.title, issue.body ?? "");
  await env.DB.prepare("INSERT INTO issues (repository_id,github_issue_id,number,title,author,body,state,category,html_url) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(repository_id,number) DO UPDATE SET title=excluded.title,body=excluded.body,state=excluded.state,category=excluded.category,updated_at=CURRENT_TIMESTAMP").bind(repositoryId, issue.id, issue.number, issue.title, issue.user.login, issue.body ?? null, issue.state, analysis.category, issue.html_url).run();
  const issueRow = await env.DB.prepare("SELECT id FROM issues WHERE repository_id=? AND number=?").bind(repositoryId, issue.number).first<{ id: number }>();
  if (!issueRow) return;
  if (settings.require_publish_approval) await env.DB.prepare("INSERT INTO issue_replies (issue_id,body,status) VALUES (?,?,'pending_approval')").bind(issueRow.id, analysis.reply).run();
  else {
    const client = await GitHubClient.forInstallation(env, installation.id);
    const comment = await client.post<{ id: number }>(`/repos/${repo.full_name}/issues/${issue.number}/comments`, { body: analysis.reply });
    await env.DB.prepare("INSERT INTO issue_replies (issue_id,body,status,github_comment_id) VALUES (?,?,'published',?)").bind(issueRow.id, analysis.reply, comment.id).run();
  }
  await log(env.DB, "issue_classified", `Classified issue #${issue.number} as ${analysis.category}`, repositoryId);
}

async function processWorkflow(env: Env, payload: GitHubPayload, repositoryId: number): Promise<void> {
  const run = payload.workflow_run;
  if (!run) return;
  const duration = run.run_started_at && run.updated_at ? Math.max(0, new Date(run.updated_at).getTime() - new Date(run.run_started_at).getTime()) : null;
  await env.DB.prepare("INSERT INTO workflow_runs (repository_id,github_run_id,name,status,conclusion,branch,commit_sha,html_url,started_at,completed_at,duration_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(github_run_id) DO UPDATE SET status=excluded.status,conclusion=excluded.conclusion,completed_at=excluded.completed_at,duration_ms=excluded.duration_ms,updated_at=CURRENT_TIMESTAMP").bind(repositoryId, run.id, run.name, run.status, run.conclusion ?? null, run.head_branch ?? null, run.head_sha, run.html_url, run.run_started_at ?? null, run.status === "completed" ? run.updated_at ?? null : null, duration).run();
  if (run.conclusion === "failure") await log(env.DB, "workflow_failed", `${run.name} failed`, repositoryId, { url: run.html_url });
}

export async function processEvent(env: Env, job: EventJob): Promise<void> {
  try {
    const repositoryId = await syncRepository(env, job.payload);
    if (job.event === "installation") await syncInstallation(env, job.payload);
    if (repositoryId && job.event === "pull_request" && ["opened", "reopened", "synchronize", "ready_for_review"].includes(job.payload.action ?? "")) await processPullRequest(env, job.payload, repositoryId);
    if (repositoryId && job.event === "issues") await processIssue(env, job.payload, repositoryId);
    if (repositoryId && job.event === "workflow_run") await processWorkflow(env, job.payload, repositoryId);
    await env.DB.prepare("UPDATE webhook_deliveries SET status='processed',processed_at=CURRENT_TIMESTAMP WHERE delivery_id=?").bind(job.deliveryId).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown event error";
    await env.DB.prepare("UPDATE webhook_deliveries SET status='failed',error_message=? WHERE delivery_id=?").bind(message.slice(0, 500), job.deliveryId).run();
    throw error;
  }
}
