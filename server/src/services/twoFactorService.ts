import { prisma } from "../lib/prisma.js";
import { badRequest } from "../lib/httpError.js";
import { verifyPassword } from "../lib/auth.js";
import { buildOtpauthUrl, generateBase32Secret, verifyTOTP } from "../lib/totp.js";
import { recordAudit, type AuditContext } from "./auditService.js";

/**
 * 認証アプリ登録用のシークレットを生成して保存する(この時点では未有効)。
 * ユーザーがアプリで生成したコードを検証して初めて有効化する。
 */
export async function setupTwoFactor(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) badRequest("ユーザーが見つかりません");
  if (user!.twoFactorEnabled) badRequest("二要素認証はすでに有効です");

  const secret = generateBase32Secret();
  await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });
  return { secret, otpauthUrl: buildOtpauthUrl(secret, user!.email) };
}

export async function enableTwoFactor(userId: string, code: string, context?: AuditContext) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) badRequest("ユーザーが見つかりません");
  if (user!.twoFactorEnabled) badRequest("二要素認証はすでに有効です");
  if (!user!.twoFactorSecret) badRequest("先に設定を開始してください");

  const ok = await verifyTOTP(user!.twoFactorSecret, code);
  if (!ok) badRequest("認証コードが正しくありません。アプリの時刻同期をご確認ください");

  await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
  await recordAudit({ action: "TWO_FACTOR_ENABLED", userId, userEmail: user!.email, context });
  return { enabled: true };
}

/** 本人がパスワード確認のうえ二要素認証を無効化する。 */
export async function disableTwoFactor(userId: string, password: string, context?: AuditContext) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) badRequest("ユーザーが見つかりません");
  if (!user!.twoFactorEnabled) badRequest("二要素認証は有効になっていません");

  const ok = await verifyPassword(password, user!.passwordHash);
  if (!ok) badRequest("パスワードが正しくありません");

  await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
  await recordAudit({ action: "TWO_FACTOR_DISABLED", userId, userEmail: user!.email, detail: "本人による無効化", context });
  return { enabled: false };
}
