import { prisma, requestDatabase } from "../lib/prisma.js";
import { badRequest } from "../lib/httpError.js";
import { hashPassword, signToken, verifyPassword } from "../lib/auth.js";
import { verifyTOTP } from "../lib/totp.js";
import { recordAudit, type AuditContext } from "./auditService.js";
import { consumeBackupCode, countRemainingBackupCodes } from "./twoFactorService.js";
import { openTotpSecret, sealTotpSecret } from '../lib/totpSecret.js';

function sanitizeUser(user: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  twoFactorEnabled?: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
  };
}

export async function signup(
  email: string,
  password: string,
  jwtSecret: string,
  name?: string,
  context?: AuditContext
) {
  if (password.length < 8) badRequest("パスワードは8文字以上で入力してください");
  email = email.trim().toLowerCase();

  const existing = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM User WHERE lower(email)=lower(${email}) LIMIT 1`;
  if (existing.length) badRequest("このメールアドレスは既に登録されています");

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      subscription: { create: { status: "NONE" } },
    },
  });

  // Membership is activated only when the recipient accepts its secret link.
  await recordAudit({ action: "SIGNUP", userId: user.id, userEmail: user.email, context });

  const token = await signToken({ userId: user.id, securityVersion: user.securityVersion }, jwtSecret);
  return { user: sanitizeUser(user), token };
}

export async function login(
  email: string,
  password: string,
  jwtSecret: string,
  code?: string,
  context?: AuditContext,
  encryptionKey: string = jwtSecret
) {
  email = email.trim();
  let user = await prisma.user.findUnique({ where: { email } });
  // Preserve exact legacy accounts; allow case-insensitive login only when unambiguous.
  if (!user) {
    const matches = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM User WHERE lower(email)=lower(${email}) LIMIT 2`;
    if (matches.length === 1) user = await prisma.user.findUnique({ where: { id: matches[0].id } });
  }
  if (!user) {
    await recordAudit({ action: "LOGIN_FAILED", userEmail: email, detail: "ユーザーが存在しません", context });
    badRequest("メールアドレスまたはパスワードが正しくありません");
  }

  const ok = await verifyPassword(password, user!.passwordHash);
  if (!ok) {
    await recordAudit({ action: "LOGIN_FAILED", userId: user!.id, userEmail: email, detail: "パスワード不一致", context });
    badRequest("メールアドレスまたはパスワードが正しくありません");
  }

  // 二要素認証が有効な場合は、認証コードの入力・検証を必須にする。
  if (user!.twoFactorEnabled) {
    if (!code) {
      return { twoFactorRequired: true as const };
    }
    const totpOk = user!.twoFactorSecret ? await verifyTOTP(await openTotpSecret(user!.twoFactorSecret,user!.id,encryptionKey), code) : false;
    // 認証アプリのコードが一致しない場合はバックアップコードを試す(1回限り消費)。
    const codeOk = totpOk || (await consumeBackupCode(user!.id, code));
    if (!codeOk) {
      await recordAudit({ action: "LOGIN_FAILED", userId: user!.id, userEmail: email, detail: "2FAコード不一致", context });
      badRequest("認証コードが正しくありません");
    }
    if (user!.twoFactorSecret && !user!.twoFactorSecret.startsWith('enc:')) {
      await prisma.user.updateMany({where:{id:user!.id,twoFactorSecret:user!.twoFactorSecret,securityVersion:user!.securityVersion},data:{twoFactorSecret:await sealTotpSecret(user!.twoFactorSecret,user!.id,encryptionKey)}});
    }
  }

  await recordAudit({ action: "LOGIN_SUCCESS", userId: user!.id, userEmail: user!.email, context });

  const token = await signToken({ userId: user!.id, securityVersion: user!.securityVersion }, jwtSecret);
  return { user: sanitizeUser(user!), token };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  const backupRemaining = user.twoFactorEnabled ? await countRemainingBackupCodes(userId) : 0;
  const verified = await requestDatabase().prepare('SELECT emailVerifiedAt FROM User WHERE id=?').bind(userId).first<{emailVerifiedAt:string|null}>();
  return {
    user: { ...sanitizeUser(user), emailVerified: Boolean(verified?.emailVerifiedAt), twoFactorBackupCodesRemaining: backupRemaining },
    subscription,
  };
}
