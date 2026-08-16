import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { AUTH_COOKIE_NAME } from "../lib/auth.js";
import { loginInputSchema, signupInputSchema } from "../lib/zodSchemas.js";
import { getMe, login, signup } from "../services/authService.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30日
const isProduction = process.env.NODE_ENV === "production";

function setSessionCookie(res: import("express").Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const input = signupInputSchema.parse(req.body);
    const { user, token } = await signup(input.email, input.password, input.name);
    setSessionCookie(res, token);
    res.status(201).json({ user });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginInputSchema.parse(req.body);
    const { user, token } = await login(input.email, input.password);
    setSessionCookie(res, token);
    res.json({ user });
  })
);

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
  res.status(204).send();
});

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = await getMe(req.userId!);
    if (!me) {
      res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
      res.status(401).json({ error: "ログインが必要です" });
      return;
    }
    res.json(me);
  })
);
