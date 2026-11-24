import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context, MiddlewareHandler } from "hono";
import { randomToken, secureEqual, sha256 } from "../utils/crypto";

const SESSION_COOKIE = "elite_session";

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, iterationsText, saltB64, expectedB64] = encoded.split("$");
  if (algorithm !== "pbkdf2" || !iterationsText || !saltB64 || !expectedB64) return false;
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations !== 100000) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = Uint8Array.from(atob(saltB64), (char) => char.charCodeAt(0));
  const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
  const actual = btoa(String.fromCharCode(...derived));
  return secureEqual(actual, expectedB64);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256));
  const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
  return `pbkdf2$100000$${base64(salt)}$${base64(derived)}`;
}

export async function verifyAdministrator(db: D1Database, userId: number, password: string): Promise<boolean> {
  const row = await db.prepare("SELECT password_hash FROM users WHERE id=?").bind(userId).first<{ password_hash: string }>();
  return Boolean(row && await verifyPassword(password, row.password_hash));
}

type AuthEnv = { Bindings: Env; Variables: { userId: number } };

export async function login(c: Context<AuthEnv>, username: string, password: string): Promise<boolean> {
  let user = await c.env.DB.prepare("SELECT id,password_hash FROM users WHERE username=?").bind(username).first<{ id: number; password_hash: string }>();
  const userCount = await c.env.DB.prepare("SELECT COUNT(*) count FROM users").first<{ count: number }>();
  if (!user && (userCount?.count ?? 0) === 0 && await secureEqual(username, c.env.ADMIN_USERNAME) && await verifyPassword(password, c.env.ADMIN_PASSWORD_HASH)) {
    await c.env.DB.prepare("INSERT INTO users (username,password_hash) VALUES (?,?)").bind(username, c.env.ADMIN_PASSWORD_HASH).run();
    user = await c.env.DB.prepare("SELECT id,password_hash FROM users WHERE username=?").bind(username).first<{ id: number; password_hash: string }>();
  }
  if (!user || !(await verifyPassword(password, user.password_hash))) return false;
  const session = randomToken();
  const csrf = randomToken();
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  await c.env.DB.prepare("INSERT INTO admin_sessions (id,user_id,csrf_token_hash,expires_at) VALUES (?,?,?,?)").bind(await sha256(`${session}:${c.env.SESSION_SECRET}`), user.id, await sha256(csrf), expires).run();
  setCookie(c, SESSION_COOKIE, session, { httpOnly: true, secure: new URL(c.req.url).protocol === "https:", sameSite: "Strict", path: "/", maxAge: 28800 });
  setCookie(c, "elite_csrf", csrf, { httpOnly: false, secure: new URL(c.req.url).protocol === "https:", sameSite: "Strict", path: "/", maxAge: 28800 });
  c.header("X-CSRF-Token", csrf);
  return true;
}

export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: { userId: number } }> = async (c, next) => {
  const raw = getCookie(c, SESSION_COOKIE);
  if (!raw) return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
  const session = await c.env.DB.prepare("SELECT user_id FROM admin_sessions WHERE id=? AND expires_at>CURRENT_TIMESTAMP").bind(await sha256(`${raw}:${c.env.SESSION_SECRET}`)).first<{ user_id: number }>();
  if (!session) return c.json({ error: { code: "UNAUTHORIZED", message: "Session expired" } }, 401);
  c.set("userId", session.user_id);
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const csrf = c.req.header("X-CSRF-Token");
    const csrfCookie = getCookie(c, "elite_csrf");
    const row = await c.env.DB.prepare("SELECT csrf_token_hash FROM admin_sessions WHERE id=?").bind(await sha256(`${raw}:${c.env.SESSION_SECRET}`)).first<{ csrf_token_hash: string }>();
    if (!csrf || !csrfCookie || !(await secureEqual(csrf, csrfCookie)) || !row || !(await secureEqual(await sha256(csrf), row.csrf_token_hash))) return c.json({ error: { code: "CSRF", message: "Invalid CSRF token" } }, 403);
  }
  await next();
};

export async function logout(c: Context<AuthEnv>): Promise<void> {
  const raw = getCookie(c, SESSION_COOKIE);
  if (raw) await c.env.DB.prepare("DELETE FROM admin_sessions WHERE id=?").bind(await sha256(`${raw}:${c.env.SESSION_SECRET}`)).run();
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  deleteCookie(c, "elite_csrf", { path: "/" });
}
