import Stripe from "stripe";
import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/httpError.js";
import { hashPassword } from "../lib/auth.js";
import { recordAudit } from "./auditService.js";

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
    twoFactorEnabled: u.twoFactorEnabled,
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

export async function updateUserSubscription(userId: string, status: string, actingUserId?: string) {
  if (!SUBSCRIPTION_STATUSES.has(status)) badRequest("不正なステータスです");

  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (!existing) notFound("対象ユーザーのサブスクリプションが見つかりません");

  const updated = await prisma.subscription.update({ where: { userId }, data: { status } });
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  await recordAudit({
    action: "SUBSCRIPTION_CHANGE",
    userId: actingUserId ?? null,
    userEmail: target?.email ?? null,
    detail: `${existing.status} → ${status}`,
  });
  return updated;
}

const ROLES = new Set(["USER", "ADMIN"]);

export async function updateUserRole(actingUserId: string, targetUserId: string, role: string) {
  if (!ROLES.has(role)) badRequest("不正な権限です");
  if (actingUserId === targetUserId && role !== "ADMIN") {
    badRequest("自分自身の管理者権限は削除できません");
  }

  const existing = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!existing) notFound("対象ユーザーが見つかりません");

  const updated = await prisma.user.update({ where: { id: targetUserId }, data: { role } });
  await recordAudit({
    action: "ROLE_CHANGE",
    userId: actingUserId,
    userEmail: existing!.email,
    detail: `${existing!.role} → ${role}`,
  });
  return updated;
}

/** 紛らわしい文字(0/O/1/l/I)を除いた安全なランダムパスワードを生成する。 */
function generateTempPassword(length = 12): string {
  const charset = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += charset[bytes[i] % charset.length];
  return out;
}

/**
 * 管理者がロックアウトされたユーザーのパスワードを再設定する(権限制御済みの正規運用)。
 * password 未指定時は一時パスワードを生成して返す。ユーザーには別経路で安全に伝え、
 * 次回ログイン後に本人がパスワード変更することを推奨する。
 */
export async function adminResetUserPassword(targetUserId: string, password?: string, actingUserId?: string) {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) notFound("対象ユーザーが見つかりません");

  const newPassword = password && password.length > 0 ? password : generateTempPassword();
  if (newPassword.length < 8) badRequest("パスワードは8文字以上で入力してください");

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: targetUserId }, data: { passwordHash } });

  await recordAudit({
    action: "PASSWORD_RESET",
    userId: actingUserId ?? null,
    userEmail: user!.email,
    detail: "管理者によるパスワード再設定",
  });

  return { email: user!.email, password: newPassword, generated: !(password && password.length > 0) };
}

/** 管理者がロックアウトされたユーザーの二要素認証を解除する(復旧用)。 */
export async function adminDisableTwoFactor(targetUserId: string, actingUserId?: string) {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) notFound("対象ユーザーが見つかりません");
  if (!user!.twoFactorEnabled) badRequest("このユーザーは二要素認証が有効ではありません");

  await prisma.user.update({ where: { id: targetUserId }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
  await recordAudit({
    action: "TWO_FACTOR_DISABLED",
    userId: actingUserId ?? null,
    userEmail: user!.email,
    detail: "管理者による解除",
  });
  return { email: user!.email, enabled: false };
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
