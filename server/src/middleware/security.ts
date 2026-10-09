import { createMiddleware } from "hono/factory";
import { tokenHash } from "../lib/sessionSecurity.js";
import type { AppEnv } from "../types/env.js";

/** Explicit browser-origin check, independent of CORS response visibility. */
export const browserOriginGuard = createMiddleware<AppEnv>(async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method) && c.req.path !== "/api/billing/webhook") {
    const origin = c.req.header("origin");
    const expected = new URL(c.env.APP_URL).origin;
    if ((origin && origin !== expected) || c.req.header("sec-fetch-site") === "cross-site") {
      return c.json({ error: "この送信元からの操作は許可されていません" }, 403);
    }
  }
  await next();
});

export const securityHeaders = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // Restrict framing/object/base without breaking the authored sandboxed ThreeUI srcDoc.
  c.header("Content-Security-Policy", "frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
  if (c.env.ENVIRONMENT === "production") c.header("Strict-Transport-Security", "max-age=31536000");
  if (c.req.path.startsWith("/api/") && !c.req.path.startsWith("/api/blog")) c.header("Cache-Control", "no-store");
});

/** Atomic shared counters, not isolate-local memory. Values are hashed before storage. */
export async function consumeAttempt(db: D1Database, key: string, limit: number, seconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare(`INSERT INTO SecurityRateLimit(key,attempts,resetAt) VALUES (?,1,?)
    ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN resetAt<=? THEN 1 ELSE attempts+1 END,
    resetAt=CASE WHEN resetAt<=? THEN ? ELSE resetAt END RETURNING attempts,resetAt`)
    .bind(await tokenHash(key), now + seconds, now, now, now + seconds).first<{ attempts: number; resetAt: number }>();
  return { allowed: Boolean(row && row.attempts <= limit), retryAfter: Math.max(1, (row?.resetAt ?? now + seconds) - now) };
}

export const authAttemptLimit = createMiddleware<AppEnv>(async (c, next) => {
  if (c.req.method !== "POST" || c.req.path === "/api/auth/logout") return next();
  const path = c.req.path;
  const ip = c.req.header("cf-connecting-ip") ?? "unknown"; // Never trust x-forwarded-for.
  const reset = path.endsWith("/forgot-password");
  const network = await consumeAttempt(c.env.DB, `${path}:ip:${ip}`, reset ? 10 : 30, reset ? 3600 : 900);
  if (!network.allowed) {
    c.header("Retry-After", String(network.retryAfter));
    return c.json({ error: "試行回数が上限に達しました。時間をおいて再試行してください" }, 429);
  }
  const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  const subject = typeof body.email === "string" ? body.email.trim().toLowerCase() : c.get("userId");
  if (subject) {
    const account = await consumeAttempt(c.env.DB, `${path}:account:${subject}`, reset ? 5 : 20, reset ? 3600 : 900);
    if (!account.allowed) {
      c.header("Retry-After", String(account.retryAfter));
      return c.json({ error: "試行回数が上限に達しました。時間をおいて再試行してください" }, 429);
    }
  }
  // Bound retained state without keeping arbitrary IP/email values in cleartext.
  await c.env.DB.prepare('DELETE FROM SecurityRateLimit WHERE resetAt<=?').bind(Math.floor(Date.now() / 1000)).run();
  await next();
});
