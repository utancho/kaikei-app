import { prisma } from "../lib/prisma.js";
import { badRequest } from "../lib/httpError.js";
import { verifyPassword } from "../lib/auth.js";
import { buildOtpauthUrl, generateBase32Secret, verifyTOTP } from "../lib/totp.js";
import { recordAudit, type AuditContext } from "./auditService.js";

const BACKUP_CODE_COUNT = 10;
const BACKUP_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // 紛らわしい文字を除外

function generateBackupCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < 8; i++) s += BACKUP_ALPHABET[bytes[i] % BACKUP_ALPHABET.length];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

function normalizeBackupCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createBackupCodes(userId: string): Promise<string[]> {
  await prisma.twoFactorBackupCode.deleteMany({ where: { userId } });
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, generateBackupCode);
  for (const code of codes) {
    await prisma.twoFactorBackupCode.create({
      data: { userId, codeHash: await sha256Hex(normalizeBackupCode(code)) },
    });
  }
  return codes;
}

export async function countRemainingBackupCodes(userId: string): Promise<number> {
  return prisma.twoFactorBackupCode.count({ where: { userId, usedAt: null } });
}

/** ログイン時にバックアップコードを1回だけ消費して検証する。 */
export async function consumeBackupCode(userId: string, code: string): Promise<boolean> {
  const hash = await sha256Hex(normalizeBackupCode(code));
  const record = await prisma.twoFactorBackupCode.findFirst({ where: { userId, codeHash: hash, usedAt: null } });
  if (!record) return false;
  await prisma.twoFactorBackupCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return true;
}

export async function regenerateBackupCodes(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) badRequest("ユーザーが見つかりません");
  if (!user!.twoFactorEnabled) badRequest("二要素認証が有効ではありません");
  const codes = await createBackupCodes(userId);
  return { backupCodes: codes };
}

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
  const backupCodes = await createBackupCodes(userId);
  await recordAudit({ action: "TWO_FACTOR_ENABLED", userId, userEmail: user!.email, context });
  return { enabled: true, backupCodes };
}

/** 本人がパスワード確認のうえ二要素認証を無効化する。 */
export async function disableTwoFactor(userId: string, password: string, context?: AuditContext) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) badRequest("ユーザーが見つかりません");
  if (!user!.twoFactorEnabled) badRequest("二要素認証は有効になっていません");

  const ok = await verifyPassword(password, user!.passwordHash);
  if (!ok) badRequest("パスワードが正しくありません");

  await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
  await prisma.twoFactorBackupCode.deleteMany({ where: { userId } });
  await recordAudit({ action: "TWO_FACTOR_DISABLED", userId, userEmail: user!.email, detail: "本人による無効化", context });
  return { enabled: false };
}
