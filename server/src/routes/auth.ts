import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { AUTH_COOKIE_NAME } from "../lib/auth.js";
import { loginInputSchema, signupInputSchema } from "../lib/zodSchemas.js";
import { getMe, login, signup } from "../services/authService.js";
import { requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";
import type { Context } from "hono";

export const authRouter = new Hono<AppEnv>();

const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30日

function setSessionCookie(c: Context<AppEnv>, token: string) {
  setCookie(c, AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT === "production",
    sameSite: c.env.ENVIRONMENT === "production" ? "None" : "Lax",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
}

authRouter.post("/signup", async (c) => {
  const input = signupInputSchema.parse(await c.req.json());
  const { user, token } = await signup(input.email, input.password, c.env.JWT_SECRET, input.name);
  setSessionCookie(c, token);
  return c.json({ user }, 201);
});

authRouter.post("/login", async (c) => {
  const input = loginInputSchema.parse(await c.req.json());
  const { user, token } = await login(input.email, input.password, c.env.JWT_SECRET);
  setSessionCookie(c, token);
  return c.json({ user });
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
