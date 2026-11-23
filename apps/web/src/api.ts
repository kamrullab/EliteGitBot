export class ApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }
function csrf(): string { return document.cookie.split("; ").find((item) => item.startsWith("elite_csrf="))?.split("=")[1] ?? ""; }
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...(init.method && init.method !== "GET" ? { "X-CSRF-Token": decodeURIComponent(csrf()) } : {}), ...init.headers } });
  const body = await response.json() as { data?: T; error?: { message: string } };
  if (!response.ok || body.data === undefined) throw new ApiError(body.error?.message ?? "Request failed", response.status);
  return body.data;
}
