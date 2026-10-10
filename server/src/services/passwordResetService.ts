import { prisma } from "../lib/prisma.js";
import { badRequest } from "../lib/httpError.js";
import { hashPassword } from "../lib/auth.js";
import { isEmailEnabled, renderEmail, sendEmail } from "./emailService.js";
import { recordAudit, type AuditContext } from "./auditService.js";
import type { Bindings } from "../types/env.js";

const TTL_MS = 60 * 60 * 1000; // 1時間

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// トークンは生のままDBに保存せず、SHA-256ハッシュで保管する(漏洩時の悪用を防ぐ)。
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function requestPasswordReset(env: Bindings, email: string, context?: AuditContext) {
  const user = await prisma.user.findUnique({ where: { email } });

  // ユーザーの存在有無を外部に漏らさないため、存在時のみ送信し、レスポンスは常に同じ。
  if (user) {
    const token = randomToken();
    const tokenHash = await sha256Hex(token);
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + TTL_MS) },
    });
    const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;
    await sendEmail(env, {
      quotaScope: `security:password-reset:${user.id}`,
      to: user.email,
      subject: "【Kaikei】パスワード再設定のご案内",
      html: renderEmail({
        heading: "パスワード再設定のお手続き",
        bodyHtml:
          "下のボタンから<strong>1時間以内</strong>にパスワードを再設定してください。<br>心当たりがない場合は、このメールを破棄してください。",
        actionLabel: "パスワードを再設定する",
        actionUrl: resetUrl,
      }),
    });
    await recordAudit({
      action: "PASSWORD_RESET",
      userId: user.id,
      userEmail: user.email,
      detail: "本人によるリセット要求",
      context,
    });
  }

  return { emailEnabled: isEmailEnabled(env) };
}

export async function resetPasswordWithToken(db: D1Database, token: string, newPassword: string, context?: AuditContext) {
  if (newPassword.length < 8) badRequest("パスワードは8文字以上で入力してください");

  const tokenHash = await sha256Hex(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    badRequest("リンクが無効か、有効期限が切れています。お手数ですが再度お手続きください");
  }

  const passwordHash = await hashPassword(newPassword);
  const now = new Date().toISOString();
  // D1 batch is atomic. Competing requests cannot both consume the same capability.
  const results = await db.batch([
    db.prepare('UPDATE User SET passwordHash=?, securityVersion=securityVersion+1 WHERE id=? AND EXISTS (SELECT 1 FROM PasswordResetToken WHERE tokenHash=? AND userId=User.id AND usedAt IS NULL AND julianday(expiresAt)>julianday(?))').bind(passwordHash, record!.userId, tokenHash, now),
    db.prepare('UPDATE PasswordResetToken SET usedAt=? WHERE userId=? AND EXISTS (SELECT 1 FROM PasswordResetToken AS valid WHERE valid.tokenHash=? AND valid.usedAt IS NULL AND julianday(valid.expiresAt)>julianday(?))').bind(now, record!.userId, tokenHash, now),
  ]);
  if (results[0].meta.changes !== 1) badRequest("リンクは使用済みか、有効期限が切れています");

  const user = await prisma.user.findUnique({ where: { id: record!.userId }, select: { email: true } });
  await recordAudit({
    action: "PASSWORD_RESET",
    userId: record!.userId,
    userEmail: user?.email ?? null,
    detail: "本人によるリセット完了",
    context,
  });

  return { ok: true };
}
