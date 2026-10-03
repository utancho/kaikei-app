import { prisma } from "../lib/prisma.js";

export type AuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "SIGNUP"
  | "PASSWORD_RESET"
  | "ROLE_CHANGE"
  | "SUBSCRIPTION_CHANGE";

export interface AuditContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * 監査ログを記録する。セキュリティ・運用の追跡用途。
 * 記録失敗が本処理(ログイン等)を妨げないよう、失敗は握りつぶす。
 */
export async function recordAudit(params: {
  action: AuditAction;
  userId?: string | null;
  userEmail?: string | null;
  detail?: string | null;
  context?: AuditContext;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        userId: params.userId ?? null,
        userEmail: params.userEmail ?? null,
        detail: params.detail ?? null,
        ipAddress: params.context?.ipAddress ?? null,
        userAgent: params.context?.userAgent ?? null,
      },
    });
  } catch {
    // 監査ログの失敗は本処理に影響させない
  }
}

export async function listAuditLogs(options: { limit?: number; action?: string } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  return prisma.auditLog.findMany({
    where: options.action ? { action: options.action } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
