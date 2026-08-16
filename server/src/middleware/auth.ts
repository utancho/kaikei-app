import type { NextFunction, Request, Response } from "express";
import { AUTH_COOKIE_NAME, verifyToken } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "ログインが必要です" });
    return;
  }
  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "ログインが必要です" });
  }
}

const ACTIVE_STATUSES = new Set(["TRIALING", "ACTIVE"]);

export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  const subscription = await prisma.subscription.findUnique({ where: { userId: req.userId! } });
  if (!subscription || !ACTIVE_STATUSES.has(subscription.status)) {
    res.status(402).json({ error: "有効なプランへの登録が必要です", code: "SUBSCRIPTION_REQUIRED" });
    return;
  }
  next();
}

// businessId はクエリパラメータで渡される規約になっているため、ここで一括してアクセス権を検証する。
export async function verifyBusinessOwnership(req: Request, res: Response, next: NextFunction) {
  const businessId = (req.query.businessId as string | undefined) || (req.body?.businessId as string | undefined);
  if (!businessId) {
    next();
    return;
  }
  const business = await prisma.business.findFirst({ where: { id: businessId, ownerId: req.userId } });
  if (!business) {
    res.status(403).json({ error: "この事業者へのアクセス権がありません" });
    return;
  }
  next();
}
