import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { AUTH_COOKIE_NAME, verifyToken } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import type { AppEnv } from "../types/env.js";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, AUTH_COOKIE_NAME);
  if (!token) {
    return c.json({ error: "ログインが必要です" }, 401);
  }
  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    c.set("userId", payload.userId);
    await next();
  } catch {
    return c.json({ error: "ログインが必要です" }, 401);
  }
});

const ACTIVE_STATUSES = new Set(["TRIALING", "ACTIVE"]);

export const requireActiveSubscription = createMiddleware<AppEnv>(async (c, next) => {
  const subscription = await prisma.subscription.findUnique({ where: { userId: c.get("userId") } });
  if (!subscription || !ACTIVE_STATUSES.has(subscription.status)) {
    return c.json({ error: "有効なプランへの登録が必要です", code: "SUBSCRIPTION_REQUIRED" }, 402);
  }
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = await prisma.user.findUnique({ where: { id: c.get("userId") } });
  if (!user || user.role !== "ADMIN") {
    return c.json({ error: "管理者権限が必要です" }, 403);
  }
  await next();
});

// businessId はクエリパラメータで渡される規約になっているため、ここで一括してアクセス権を検証する。
export const verifyBusinessOwnership = createMiddleware<AppEnv>(async (c, next) => {
  const businessId = c.req.query("businessId");
  if (!businessId) {
    await next();
    return;
  }
  const business = await prisma.business.findFirst({ where: { id: businessId, ownerId: c.get("userId") } });
  if (!business) {
    return c.json({ error: "この事業者へのアクセス権がありません" }, 403);
  }
  await next();
});
