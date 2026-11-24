import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { hashPassword, login, logout, requireAuth, verifyAdministrator } from "./services/auth";
import { processEvent } from "./services/events";
import type { EventJob, GitHubPayload } from "./types";
import { verifyWebhook } from "./utils/crypto";
import { GitHubClient } from "./github/client";
import { createProvider, getAISettings, safeExternalUrl } from "./ai/providers";
import { deleteManagedSecret, setManagedSecret } from "./services/managed-secrets";

type AppEnv = { Bindings: Env; Variables: { userId: number } };
const app = new Hono<AppEnv>();

app.use("*", secureHeaders({ contentSecurityPolicy: { defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", "data:"], connectSrc: ["'self'"] } }));
app.use("/api/*", cors({ origin: (origin) => origin, credentials: true, allowHeaders: ["Content-Type", "X-CSRF-Token"] }));

app.onError((error, c) => {
  console.error(JSON.stringify({ message: "request_failed", error: error.message, path: c.req.path }));
  return c.json({ error: { code: "INTERNAL_ERROR", message: "The request could not be completed" } }, 500);
});

app.get("/api/health", (c) => c.json({ status: "ok" }));

const loginSchema = z.object({ username: z.string().min(1).max(100), password: z.string().min(8).max(200) });
app.post("/api/auth/login", zValidator("json", loginSchema), async (c) => {
  const recent = await c.env.DB.prepare("SELECT COUNT(*) count FROM activity_logs WHERE event_type='login_failed' AND created_at > datetime('now','-15 minutes')").first<{ count: number }>();
  if ((recent?.count ?? 0) >= 10) return c.json({ error: { code: "RATE_LIMITED", message: "Too many login attempts" } }, 429);
  const input = c.req.valid("json");
  if (!(await login(c, input.username, input.password))) {
    await c.env.DB.prepare("INSERT INTO activity_logs(event_type,description) VALUES ('login_failed','Rejected administrator login')").run();
    return c.json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } }, 401);
  }
  return c.json({ data: { username: input.username } });
});

app.post("/api/webhooks/github", async (c) => {
  const deliveryId = c.req.header("X-GitHub-Delivery");
  const event = c.req.header("X-GitHub-Event");
  if (!deliveryId || !event) return c.json({ error: { code: "MISSING_HEADERS", message: "GitHub delivery headers are required" } }, 400);
  const body = await c.req.text();
  if (!(await verifyWebhook(body, c.req.header("X-Hub-Signature-256"), c.env.GITHUB_WEBHOOK_SECRET))) return c.json({ error: { code: "INVALID_SIGNATURE", message: "Webhook signature is invalid" } }, 401);
  let payload: GitHubPayload;
  try { payload = JSON.parse(body) as GitHubPayload; } catch { return c.json({ error: { code: "INVALID_JSON", message: "Webhook body is invalid" } }, 400); }
  const inserted = await c.env.DB.prepare("INSERT OR IGNORE INTO webhook_deliveries(delivery_id,event_name,action) VALUES (?,?,?)").bind(deliveryId, event, payload.action ?? null).run();
  if (!inserted.meta.changes) return c.json({ data: { status: "duplicate" } }, 200);
  await c.env.EVENT_QUEUE.send({ deliveryId, event, payload } satisfies EventJob);
  return c.json({ data: { status: "accepted" } }, 202);
});

app.use("/api/*", requireAuth);
app.get("/api/auth/me", (c) => c.json({ data: { authenticated: true } }));
app.post("/api/auth/logout", async (c) => { await logout(c); return c.json({ data: { success: true } }); });

app.get("/api/dashboard/stats", async (c) => {
  const row = await c.env.DB.prepare(`SELECT
    (SELECT COUNT(*) FROM repositories) totalRepositories,
    (SELECT COUNT(*) FROM repositories WHERE monitored=1) monitoredRepositories,
    (SELECT COUNT(*) FROM pull_requests WHERE state='open') openPullRequests,
    (SELECT COUNT(*) FROM pull_request_reviews) reviewedPullRequests,
    (SELECT COUNT(*) FROM issues WHERE state='open') openIssues,
    (SELECT COUNT(*) FROM issue_replies WHERE status='published') answeredIssues,
    (SELECT COUNT(*) FROM security_findings WHERE status='open') securityFindings,
    (SELECT COUNT(*) FROM workflow_runs WHERE conclusion='failure') failedWorkflows,
    (SELECT COUNT(*) FROM activity_logs) totalActions`).first();
  return c.json({ data: row });
});

function page(c: Context<AppEnv>): { limit: number; offset: number } {
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 25)));
  const offset = Math.max(0, Number(c.req.query("offset") ?? 0));
  return { limit, offset };
}

app.get("/api/repositories", async (c) => { const p = page(c); const data = await c.env.DB.prepare("SELECT r.*,s.pr_review_enabled,s.issue_automation_enabled,s.security_scan_enabled,s.auto_labeling_enabled FROM repositories r LEFT JOIN repository_settings s ON s.repository_id=r.id ORDER BY r.updated_at DESC LIMIT ? OFFSET ?").bind(p.limit, p.offset).all(); return c.json({ data: data.results }); });
app.get("/api/repositories/:id", async (c) => { const data = await c.env.DB.prepare("SELECT r.*,s.* FROM repositories r LEFT JOIN repository_settings s ON s.repository_id=r.id WHERE r.id=?").bind(c.req.param("id")).first(); return data ? c.json({ data }) : c.json({ error: { code: "NOT_FOUND", message: "Repository not found" } }, 404); });
const repoSettings = z.object({ monitored: z.boolean().optional(), prReviewEnabled: z.boolean().optional(), issueAutomationEnabled: z.boolean().optional(), securityScanEnabled: z.boolean().optional(), autoLabelingEnabled: z.boolean().optional(), requirePublishApproval: z.boolean().optional(), maxFileSize: z.number().int().min(1000).max(500000).optional(), excludedPaths: z.array(z.string().max(200)).max(100).optional() });
app.patch("/api/repositories/:id/settings", zValidator("json", repoSettings), async (c) => {
  const id = c.req.param("id"); const v = c.req.valid("json");
  if (v.monitored !== undefined) await c.env.DB.prepare("UPDATE repositories SET monitored=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(v.monitored ? 1 : 0, id).run();
  await c.env.DB.prepare(`UPDATE repository_settings SET pr_review_enabled=COALESCE(?,pr_review_enabled),issue_automation_enabled=COALESCE(?,issue_automation_enabled),security_scan_enabled=COALESCE(?,security_scan_enabled),auto_labeling_enabled=COALESCE(?,auto_labeling_enabled),require_publish_approval=COALESCE(?,require_publish_approval),max_file_size=COALESCE(?,max_file_size),excluded_paths=COALESCE(?,excluded_paths),updated_at=CURRENT_TIMESTAMP WHERE repository_id=?`).bind(v.prReviewEnabled === undefined ? null : v.prReviewEnabled ? 1 : 0, v.issueAutomationEnabled === undefined ? null : v.issueAutomationEnabled ? 1 : 0, v.securityScanEnabled === undefined ? null : v.securityScanEnabled ? 1 : 0, v.autoLabelingEnabled === undefined ? null : v.autoLabelingEnabled ? 1 : 0, v.requirePublishApproval === undefined ? null : v.requirePublishApproval ? 1 : 0, v.maxFileSize ?? null, v.excludedPaths ? JSON.stringify(v.excludedPaths) : null, id).run();
  return c.json({ data: { success: true } });
});

app.get("/api/pull-requests", async (c) => { const p=page(c); const data=await c.env.DB.prepare("SELECT p.*,r.full_name repository_name,rv.status review_status,rv.risk_level,rv.created_at review_date FROM pull_requests p JOIN repositories r ON r.id=p.repository_id LEFT JOIN pull_request_reviews rv ON rv.id=(SELECT id FROM pull_request_reviews WHERE pull_request_id=p.id ORDER BY created_at DESC LIMIT 1) ORDER BY p.updated_at DESC LIMIT ? OFFSET ?").bind(p.limit,p.offset).all(); return c.json({data:data.results}); });
app.get("/api/pull-requests/:id", async (c) => { const data=await c.env.DB.prepare("SELECT p.*,r.full_name repository_name FROM pull_requests p JOIN repositories r ON r.id=p.repository_id WHERE p.id=?").bind(c.req.param("id")).first(); return data?c.json({data}):c.json({error:{code:"NOT_FOUND",message:"Pull request not found"}},404); });
app.get("/api/pull-requests/:id/findings", async (c) => { const data=await c.env.DB.prepare("SELECT f.* FROM review_findings f JOIN pull_request_reviews rv ON rv.id=f.review_id WHERE rv.pull_request_id=? ORDER BY CASE f.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END").bind(c.req.param("id")).all(); return c.json({data:data.results}); });
app.get("/api/issues", async (c) => { const p=page(c); const data=await c.env.DB.prepare("SELECT i.*,r.full_name repository_name,(SELECT status FROM issue_replies WHERE issue_id=i.id ORDER BY created_at DESC LIMIT 1) reply_status FROM issues i JOIN repositories r ON r.id=i.repository_id ORDER BY i.updated_at DESC LIMIT ? OFFSET ?").bind(p.limit,p.offset).all(); return c.json({data:data.results}); });
app.get("/api/security/findings", async (c) => { const p=page(c); const data=await c.env.DB.prepare("SELECT s.*,r.full_name repository_name FROM security_findings s JOIN repositories r ON r.id=s.repository_id ORDER BY s.created_at DESC LIMIT ? OFFSET ?").bind(p.limit,p.offset).all(); return c.json({data:data.results}); });
app.get("/api/workflows", async (c) => { const p=page(c); const data=await c.env.DB.prepare("SELECT w.*,r.full_name repository_name FROM workflow_runs w JOIN repositories r ON r.id=w.repository_id ORDER BY w.updated_at DESC LIMIT ? OFFSET ?").bind(p.limit,p.offset).all(); return c.json({data:data.results}); });
app.get("/api/workflows/:id", async (c) => { const data=await c.env.DB.prepare("SELECT w.*,r.full_name repository_name FROM workflow_runs w JOIN repositories r ON r.id=w.repository_id WHERE w.id=?").bind(c.req.param("id")).first(); return data?c.json({data}):c.json({error:{code:"NOT_FOUND",message:"Workflow not found"}},404); });
app.get("/api/activity", async (c) => { const p=page(c); const data=await c.env.DB.prepare("SELECT a.*,r.full_name repository_name FROM activity_logs a LEFT JOIN repositories r ON r.id=a.repository_id ORDER BY a.created_at DESC LIMIT ? OFFSET ?").bind(p.limit,p.offset).all(); return c.json({data:data.results}); });
app.get("/api/github/installations", async (c) => { const data=await c.env.DB.prepare("SELECT id,github_installation_id,account_login,account_type,suspended_at,updated_at FROM github_installations ORDER BY updated_at DESC").all(); return c.json({data:data.results}); });
app.post("/api/github/sync", async (c) => {
  const installations=await c.env.DB.prepare("SELECT github_installation_id FROM github_installations WHERE suspended_at IS NULL").all<{github_installation_id:number}>();
  let count=0;
  for(const installation of installations.results){ const client=await GitHubClient.forInstallation(c.env,installation.github_installation_id); const result=await client.get<{repositories:Array<{id:number;name:string;full_name:string;private:boolean;visibility?:string;default_branch:string;archived:boolean;owner:{login:string}}> }>("/installation/repositories?per_page=100"); for(const repo of result.repositories){ const pk=await c.env.DB.prepare("SELECT id FROM github_installations WHERE github_installation_id=?").bind(installation.github_installation_id).first<{id:number}>(); if(pk){ await c.env.DB.prepare("INSERT INTO repositories(github_repository_id,installation_id,owner,name,full_name,visibility,default_branch,archived,last_activity_at) VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(github_repository_id) DO UPDATE SET owner=excluded.owner,name=excluded.name,full_name=excluded.full_name,visibility=excluded.visibility,default_branch=excluded.default_branch,archived=excluded.archived,updated_at=CURRENT_TIMESTAMP").bind(repo.id,pk.id,repo.owner.login,repo.name,repo.full_name,repo.visibility??(repo.private?"private":"public"),repo.default_branch,repo.archived?1:0).run(); const saved=await c.env.DB.prepare("SELECT id FROM repositories WHERE github_repository_id=?").bind(repo.id).first<{id:number}>(); if(saved) await c.env.DB.prepare("INSERT OR IGNORE INTO repository_settings(repository_id) VALUES(?)").bind(saved.id).run(); count++; } } }
  return c.json({data:{repositoriesSynced:count}});
});
app.get("/api/settings", async (c) => {
  const [system, account, ai] = await Promise.all([
    c.env.DB.prepare("SELECT key,value FROM system_settings").all<{key:string;value:string}>(),
    c.env.DB.prepare("SELECT username,updated_at FROM users WHERE id=?").bind(c.get("userId")).first<{ username: string; updated_at: string }>(),
    getAISettings(c.env)
  ]);
  return c.json({data:{
    system:Object.fromEntries(system.results.map(x=>[x.key,JSON.parse(x.value)])),
    account,
    ai:{ enabled:Boolean(ai.enabled),provider:ai.provider,model:ai.model,baseUrl:ai.base_url,allowedHosts:ai.allowed_hosts,maxInputSize:ai.max_input_size,privateCodeExternalEnabled:Boolean(ai.private_code_external_enabled),apiKeyConfigured:ai.apiKeyConfigured }
  }});
});

const accountSettingsSchema = z.object({
  currentPassword: z.string().min(8).max(200),
  username: z.string().trim().min(3).max(100).regex(/^[A-Za-z0-9_.-]+$/),
  newPassword: z.string().min(12).max(200).optional()
});
app.patch("/api/settings/account", zValidator("json", accountSettingsSchema), async (c) => {
  const value = c.req.valid("json");
  const userId = c.get("userId");
  if (!(await verifyAdministrator(c.env.DB, userId, value.currentPassword))) return c.json({error:{code:"INVALID_PASSWORD",message:"Current password is incorrect"}},403);
  const passwordHash = value.newPassword ? await hashPassword(value.newPassword) : null;
  try {
    await c.env.DB.prepare("UPDATE users SET username=?,password_hash=COALESCE(?,password_hash),updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(value.username,passwordHash,userId).run();
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) return c.json({error:{code:"USERNAME_EXISTS",message:"That username is already in use"}},409);
    throw error;
  }
  await c.env.DB.prepare("INSERT INTO activity_logs(event_type,actor,description) VALUES('admin_account_updated',?,'Administrator credentials updated')").bind(value.username).run();
  await c.env.DB.prepare("DELETE FROM admin_sessions").run();
  return c.json({data:{success:true,reauthenticate:true}});
});

const aiSettingsSchema = z.object({
  currentPassword: z.string().min(8).max(200),
  enabled: z.boolean(),
  provider: z.enum(["rule-based","gemini","openai-compatible"]),
  model: z.string().trim().max(200).nullable(),
  baseUrl: z.string().trim().max(500).nullable(),
  allowedHosts: z.string().trim().max(500).nullable(),
  maxInputSize: z.number().int().min(1000).max(200000),
  privateCodeExternalEnabled: z.boolean(),
  apiKey: z.string().trim().min(8).max(1000).optional(),
  removeApiKey: z.boolean().optional()
});
app.patch("/api/settings/ai", zValidator("json", aiSettingsSchema), async (c) => {
  const value = c.req.valid("json");
  if (!(await verifyAdministrator(c.env.DB,c.get("userId"),value.currentPassword))) return c.json({error:{code:"INVALID_PASSWORD",message:"Current password is incorrect"}},403);
  const enabled = value.provider !== "rule-based" && value.enabled;
  if (enabled && !value.model) return c.json({error:{code:"MODEL_REQUIRED",message:"A model is required for external AI"}},400);
  if (value.provider === "openai-compatible") {
    if (!value.baseUrl || !value.allowedHosts) return c.json({error:{code:"ENDPOINT_REQUIRED",message:"Base URL and allowed hosts are required"}},400);
    try { safeExternalUrl(value.baseUrl,value.allowedHosts); } catch (error) { return c.json({error:{code:"INVALID_ENDPOINT",message:error instanceof Error?error.message:"Invalid AI endpoint"}},400); }
  }
  const previous = await c.env.DB.prepare("SELECT provider FROM ai_provider_settings WHERE id=1").first<{provider:string}>();
  const existingKey = Boolean(await c.env.DB.prepare("SELECT 1 configured FROM managed_secrets WHERE name='ai_api_key'").first());
  const providerChanged = Boolean(previous && previous.provider !== value.provider && value.provider !== "rule-based");
  const configured = value.apiKey ? true : value.removeApiKey || providerChanged ? false : existingKey;
  if (enabled && providerChanged && !value.apiKey) return c.json({error:{code:"NEW_API_KEY_REQUIRED",message:"Add the correct API key when changing external providers"}},400);
  if (enabled && !configured) return c.json({error:{code:"API_KEY_REQUIRED",message:"Add an API key before enabling external AI"}},400);
  if (value.apiKey) await setManagedSecret(c.env,"ai_api_key",value.apiKey);
  if ((value.removeApiKey || providerChanged) && !value.apiKey) await deleteManagedSecret(c.env,"ai_api_key");
  await c.env.DB.prepare("UPDATE ai_provider_settings SET enabled=?,provider=?,model=?,base_url=?,allowed_hosts=?,max_input_size=?,private_code_external_enabled=?,updated_at=CURRENT_TIMESTAMP WHERE id=1")
    .bind(enabled?1:0,value.provider,value.model||null,value.provider==="openai-compatible"?value.baseUrl:null,value.provider==="openai-compatible"?value.allowedHosts:null,value.maxInputSize,value.privateCodeExternalEnabled?1:0).run();
  await c.env.DB.prepare("INSERT INTO activity_logs(event_type,actor,description,metadata) SELECT 'ai_settings_updated',username,'AI provider settings updated',? FROM users WHERE id=?")
    .bind(JSON.stringify({provider:value.provider,enabled,apiKeyChanged:Boolean(value.apiKey||value.removeApiKey)}),c.get("userId")).run();
  return c.json({data:{success:true,apiKeyConfigured:configured}});
});

app.get("/api/ai/providers", async (c) => {
  const ai=await getAISettings(c.env);
  return c.json({data:[
    {id:"rule-based",configured:true,active:!ai.enabled||ai.provider==="rule-based"},
    {id:"gemini",configured:ai.apiKeyConfigured&&Boolean(ai.model),active:Boolean(ai.enabled)&&ai.provider==="gemini"},
    {id:"openai-compatible",configured:ai.apiKeyConfigured&&Boolean(ai.model&&ai.base_url&&ai.allowed_hosts),active:Boolean(ai.enabled)&&ai.provider==="openai-compatible"}
  ]});
});
app.post("/api/ai/test", async (c) => {
  const provider=await createProvider(c.env,true);
  await provider.analyzeIssue("EliteGitBot connection test","Return a safe automated test acknowledgement.");
  return c.json({data:{provider:provider.name,ok:true,message:`${provider.name} completed a test request`}});
});

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<EventJob>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try { await processEvent(env, message.body); message.ack(); }
      catch (error) { console.error(JSON.stringify({ message: "event_processing_failed", deliveryId: message.body.deliveryId, error: error instanceof Error ? error.message : String(error) })); message.retry(); }
    }
  }
} satisfies ExportedHandler<Env, EventJob>;
