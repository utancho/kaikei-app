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

// businessが解決済み(verifyBusinessAccess通過後)ならその事業者オーナーの契約状況を、
// そうでなければ(事業者作成前など)リクエストユーザー自身の契約状況を見る。
// メンバーとして招待されたユーザーは自分自身が契約していなくても、
// オーナーが契約中であればその事業者を利用できる。
export const requireActiveSubscription = createMiddleware<AppEnv>(async (c, next) => {
  const business = c.get("business");
  const targetUserId = business ? business.ownerId : c.get("userId");
  const subscription = await prisma.subscription.findUnique({ where: { userId: targetUserId } });
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
// オーナー本人、またはステータスACTIVEなメンバーのみアクセス可。
export const verifyBusinessAccess = createMiddleware<AppEnv>(async (c, next) => {
  const businessId = c.req.query("businessId");
  if (!businessId) {
    await next();
    return;
  }
  const userId = c.get("userId");
  const business = await prisma.business.findFirst({
    where: {
      id: businessId,
      OR: [{ ownerId: userId }, { members: { some: { userId, status: "ACTIVE" } } }],
    },
  });
  if (!business) {
    return c.json({ error: "この事業者へのアクセス権がありません" }, 403);
  }
  c.set("business", { id: business.id, ownerId: business.ownerId });
  await next();
});

// 事業者の設定変更・メンバー管理・削除など、オーナーのみ許可する操作向け。
// verifyBusinessAccess の後段で使う想定(businessが未解決の場合は403)。
export const requireBusinessOwner = createMiddleware<AppEnv>(async (c, next) => {
  const business = c.get("business");
  if (!business || business.ownerId !== c.get("userId")) {
    return c.json({ error: "この操作にはオーナー権限が必要です" }, 403);
  }
  await next();
});
