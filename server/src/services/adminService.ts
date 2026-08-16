import Stripe from "stripe";
import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/httpError.js";

const SUBSCRIPTION_STATUSES = new Set(["NONE", "TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"]);

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscription: true,
      businesses: { select: { id: true, name: true, type: true }, orderBy: { createdAt: "asc" } },
    },
  });
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt,
    businesses: u.businesses,
    subscription: u.subscription
      ? {
          status: u.subscription.status,
          currentPeriodEnd: u.subscription.currentPeriodEnd,
        }
      : { status: "NONE", currentPeriodEnd: null },
  }));
}

export async function getStats(stripe: Stripe | null, priceId: string | undefined) {
  const [totalUsers, activeCount, trialingCount, pastDueCount, canceledCount, individualCount, corporateCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.count({ where: { status: "TRIALING" } }),
      prisma.subscription.count({ where: { status: "PAST_DUE" } }),
      prisma.subscription.count({ where: { status: "CANCELED" } }),
      prisma.business.count({ where: { type: "INDIVIDUAL" } }),
      prisma.business.count({ where: { type: "CORPORATE" } }),
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

  return {
    totalUsers,
    activeCount,
    trialingCount,
    pastDueCount,
    canceledCount,
    individualBusinessCount: individualCount,
    corporateBusinessCount: corporateCount,
    mrrJpy,
  };
}

export async function updateUserSubscription(userId: string, status: string) {
  if (!SUBSCRIPTION_STATUSES.has(status)) badRequest("不正なステータスです");

  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (!existing) notFound("対象ユーザーのサブスクリプションが見つかりません");

  return prisma.subscription.update({ where: { userId }, data: { status } });
}

const ROLES = new Set(["USER", "ADMIN"]);

export async function updateUserRole(actingUserId: string, targetUserId: string, role: string) {
  if (!ROLES.has(role)) badRequest("不正な権限です");
  if (actingUserId === targetUserId && role !== "ADMIN") {
    badRequest("自分自身の管理者権限は削除できません");
  }

  const existing = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!existing) notFound("対象ユーザーが見つかりません");

  return prisma.user.update({ where: { id: targetUserId }, data: { role } });
}

export async function listAllBusinesses() {
  const businesses = await prisma.business.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { email: true, name: true } },
      _count: { select: { members: true, journalEntries: true } },
    },
  });
  return businesses.map((b) => ({
    id: b.id,
    name: b.name,
    type: b.type,
    taxationType: b.taxationType,
    ownerEmail: b.owner.email,
    ownerName: b.owner.name,
    memberCount: b._count.members,
    journalEntryCount: b._count.journalEntries,
    createdAt: b.createdAt,
  }));
}
