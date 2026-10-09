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

async function createBackupCodes(db: D1Database, userId: string, securityVersion: number): Promise<string[]> {
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, generateBackupCode);
  const inserts = await Promise.all(codes.map(async code => db.prepare('INSERT INTO TwoFactorBackupCode(id,userId,codeHash,createdAt) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM User WHERE id=? AND securityVersion=? AND twoFactorEnabled=1)')
    .bind(crypto.randomUUID(), userId, await sha256Hex(normalizeBackupCode(code)), new Date().toISOString(), userId, securityVersion)));
  const result = await db.batch([db.prepare('DELETE FROM TwoFactorBackupCode WHERE userId=? AND EXISTS (SELECT 1 FROM User WHERE id=? AND securityVersion=? AND twoFactorEnabled=1)').bind(userId, userId, securityVersion), ...inserts]);
  if (result.slice(1).some(r => r.meta.changes !== 1)) badRequest("認証状態が変更されました。再度ログインしてください");
  return codes;
}

export async function countRemainingBackupCodes(userId: string): Promise<number> {
  return prisma.twoFactorBackupCode.count({ where: { userId, usedAt: null } });
}

/** ログイン時にバックアップコードを1回だけ消費して検証する。 */
export async function consumeBackupCode(userId: string, code: string): Promise<boolean> {
  const hash = await sha256Hex(normalizeBackupCode(code));
  const result = await prisma.twoFactorBackupCode.updateMany({ where: { userId, codeHash: hash, usedAt: null }, data: { usedAt: new Date() } });
  return result.count === 1;
}

async function verifyFactor(userId: string, secret: string | null, code: string) {
  if (!(secret && await verifyTOTP(secret, code)) && !await consumeBackupCode(userId, code)) badRequest("認証コードが正しくありません");
}

export async function regenerateBackupCodes(db: D1Database, userId: string, password: string, code: string, context?: AuditContext) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) badRequest("ユーザーが見つかりません");
  if (!user!.twoFactorEnabled) badRequest("二要素認証が有効ではありません");
  if (!await verifyPassword(password, user!.passwordHash)) badRequest("パスワードが正しくありません");
  await verifyFactor(userId, user!.twoFactorSecret, code);
  const codes = await createBackupCodes(db, userId, user!.securityVersion);
  await recordAudit({ action: "TWO_FACTOR_BACKUP_REGENERATED", userId, userEmail: user!.email, context });
  return { backupCodes: codes };
}

/**
 * 認証アプリ登録用のシークレットを生成して保存する(この時点では未有効)。
 * ユーザーがアプリで生成したコードを検証して初めて有効化する。
 */
export async function setupTwoFactor(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) badRequest("ユーザーが見つかりません");
  if (user!.twoFactorEnabled) badRequest("二要素認証はすでに有効です");
  if (!await verifyPassword(password, user!.passwordHash)) badRequest("パスワードが正しくありません");

  const secret = generateBase32Secret();
  const changed = await prisma.user.updateMany({ where: { id: userId, securityVersion: user!.securityVersion, twoFactorEnabled: false }, data: { twoFactorSecret: secret } });
  if (changed.count !== 1) badRequest("認証状態が変更されました。再度ログインしてください");
  return { secret, otpauthUrl: buildOtpauthUrl(secret, user!.email) };
}

export async function enableTwoFactor(db: D1Database, userId: string, code: string, password: string, context?: AuditContext) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) badRequest("ユーザーが見つかりません");
  if (user!.twoFactorEnabled) badRequest("二要素認証はすでに有効です");
  if (!user!.twoFactorSecret) badRequest("先に設定を開始してください");
  if (!await verifyPassword(password, user!.passwordHash)) badRequest("パスワードが正しくありません");

  const ok = await verifyTOTP(user!.twoFactorSecret, code);
  if (!ok) badRequest("認証コードが正しくありません。アプリの時刻同期をご確認ください");

  const changed = await prisma.user.updateMany({ where: { id: userId, securityVersion: user!.securityVersion, twoFactorEnabled: false, twoFactorSecret: user!.twoFactorSecret }, data: { twoFactorEnabled: true, securityVersion: { increment: 1 } } });
  if (changed.count !== 1) badRequest("認証状態が変更されました。再度ログインしてください");
  const backupCodes = await createBackupCodes(db, userId, user!.securityVersion + 1);
  await recordAudit({ action: "TWO_FACTOR_ENABLED", userId, userEmail: user!.email, context });
  return { enabled: true, backupCodes, securityVersion: user!.securityVersion + 1 };
}

/** 本人がパスワード確認のうえ二要素認証を無効化する。 */
export async function disableTwoFactor(userId: string, password: string, code: string, context?: AuditContext) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) badRequest("ユーザーが見つかりません");
  if (!user!.twoFactorEnabled) badRequest("二要素認証は有効になっていません");

  const ok = await verifyPassword(password, user!.passwordHash);
  if (!ok) badRequest("パスワードが正しくありません");
  await verifyFactor(userId, user!.twoFactorSecret, code);

  const changed = await prisma.user.updateMany({ where: { id: userId, securityVersion: user!.securityVersion, twoFactorEnabled: true }, data: { twoFactorEnabled: false, twoFactorSecret: null, securityVersion: { increment: 1 } } });
  if (changed.count !== 1) badRequest("認証状態が変更されました。再度ログインしてください");
  await prisma.twoFactorBackupCode.deleteMany({ where: { userId } });
  await recordAudit({ action: "TWO_FACTOR_DISABLED", userId, userEmail: user!.email, detail: "本人による無効化", context });
  return { enabled: false, securityVersion: user!.securityVersion + 1 };
}
