import Stripe from "stripe";
import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/httpError.js";

const SUBSCRIPTION_STATUSES = new Set(["NONE", "TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"]);

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { subscription: true, businesses: { select: { id: true } } },
  });
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt,
    businessCount: u.businesses.length,
    subscription: u.subscription
      ? {
          status: u.subscription.status,
          currentPeriodEnd: u.subscription.currentPeriodEnd,
        }
      : { status: "NONE", currentPeriodEnd: null },
  }));
}

export async function getStats(stripe: Stripe | null, priceId: string | undefined) {
  const [totalUsers, activeCount, trialingCount] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: "TRIALING" } }),
  ]);

  let mrrJpy: number | null = null;
  if (stripe && priceId) {
    try {
      const price = await stripe.prices.retrieve(priceId);
      if (price.unit_amount != null && price.currency === "jpy") {
        mrrJpy = price.unit_amount * activeCount;
      }
    } catch {
      mrrJpy = null;
    }
  }

  return { totalUsers, activeCount, trialingCount, mrrJpy };
}

export async function updateUserSubscription(userId: string, status: string) {
  if (!SUBSCRIPTION_STATUSES.has(status)) badRequest("不正なステータスです");

  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (!existing) notFound("対象ユーザーのサブスクリプションが見つかりません");

  return prisma.subscription.update({ where: { userId }, data: { status } });
}
