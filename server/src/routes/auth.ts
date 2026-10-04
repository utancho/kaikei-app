import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { AUTH_COOKIE_NAME } from "../lib/auth.js";
import {
  forgotPasswordSchema,
  loginInputSchema,
  resetPasswordSchema,
  signupInputSchema,
  twoFactorDisableSchema,
  twoFactorEnableSchema,
} from "../lib/zodSchemas.js";
import { getMe, login, signup } from "../services/authService.js";
import { requestPasswordReset, resetPasswordWithToken } from "../services/passwordResetService.js";
import { disableTwoFactor, enableTwoFactor, regenerateBackupCodes, setupTwoFactor } from "../services/twoFactorService.js";
import { requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";
import type { Context } from "hono";

export const authRouter = new Hono<AppEnv>();

const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30日

function setSessionCookie(c: Context<AppEnv>, token: string) {
  // フロントエンドとAPIは同一Worker・同一オリジンから配信されるため、
  // cross-site用の SameSite=None は不要 (Lax で十分)。
  setCookie(c, AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT === "production",
    sameSite: "Lax",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
}

function auditContext(c: { req: { header: (name: string) => string | undefined } }) {
  return {
    ipAddress: c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? null,
    userAgent: c.req.header("user-agent") ?? null,
  };
}

authRouter.post("/signup", async (c) => {
  const input = signupInputSchema.parse(await c.req.json());
  const { user, token } = await signup(input.email, input.password, c.env.JWT_SECRET, input.name, auditContext(c));
  setSessionCookie(c, token);
  return c.json({ user }, 201);
});

authRouter.post("/login", async (c) => {
  const input = loginInputSchema.parse(await c.req.json());
  const result = await login(input.email, input.password, c.env.JWT_SECRET, input.code, auditContext(c));
  if ("twoFactorRequired" in result) {
    return c.json({ twoFactorRequired: true });
  }
  setSessionCookie(c, result.token);
  return c.json({ user: result.user });
});

authRouter.post("/forgot-password", async (c) => {
  const { email } = forgotPasswordSchema.parse(await c.req.json());
  const result = await requestPasswordReset(c.env, email, auditContext(c));
  // ユーザー存在有無は返さない(列挙攻撃対策)。emailEnabled のみ返す。
  return c.json({ ok: true, emailEnabled: result.emailEnabled });
});

authRouter.post("/reset-password", async (c) => {
  const { token, password } = resetPasswordSchema.parse(await c.req.json());
  await resetPasswordWithToken(token, password, auditContext(c));
  return c.json({ ok: true });
});

authRouter.post("/2fa/setup", requireAuth, async (c) => {
  return c.json(await setupTwoFactor(c.get("userId")));
});

authRouter.post("/2fa/enable", requireAuth, async (c) => {
  const { code } = twoFactorEnableSchema.parse(await c.req.json());
  return c.json(await enableTwoFactor(c.get("userId"), code, auditContext(c)));
});

authRouter.post("/2fa/backup-codes", requireAuth, async (c) => {
  return c.json(await regenerateBackupCodes(c.get("userId")));
});

authRouter.post("/2fa/disable", requireAuth, async (c) => {
  const { password } = twoFactorDisableSchema.parse(await c.req.json());
  return c.json(await disableTwoFactor(c.get("userId"), password, auditContext(c)));
});

authRouter.post("/logout", (c) => {
  deleteCookie(c, AUTH_COOKIE_NAME, { path: "/" });
  return c.body(null, 204);
});

authRouter.get("/me", requireAuth, async (c) => {
  const me = await getMe(c.get("userId"));
  if (!me) {
    deleteCookie(c, AUTH_COOKIE_NAME, { path: "/" });
    return c.json({ error: "ログインが必要です" }, 401);
  }
  return c.json(me);
});
