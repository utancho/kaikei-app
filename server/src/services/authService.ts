import { prisma } from "../lib/prisma.js";
import { badRequest } from "../lib/httpError.js";
import { hashPassword, signToken, verifyPassword } from "../lib/auth.js";
import { activatePendingInvites } from "./memberService.js";
import { recordAudit, type AuditContext } from "./auditService.js";

function sanitizeUser(user: { id: string; email: string; name: string | null; role: string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function signup(
  email: string,
  password: string,
  jwtSecret: string,
  name?: string,
  context?: AuditContext
) {
  if (password.length < 8) badRequest("パスワードは8文字以上で入力してください");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) badRequest("このメールアドレスは既に登録されています");

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      subscription: { create: { status: "NONE" } },
    },
  });

  await activatePendingInvites(user.id, user.email);
  await recordAudit({ action: "SIGNUP", userId: user.id, userEmail: user.email, context });

  const token = await signToken({ userId: user.id }, jwtSecret);
  return { user: sanitizeUser(user), token };
}

export async function login(email: string, password: string, jwtSecret: string, context?: AuditContext) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await recordAudit({ action: "LOGIN_FAILED", userEmail: email, detail: "ユーザーが存在しません", context });
    badRequest("メールアドレスまたはパスワードが正しくありません");
  }

  const ok = await verifyPassword(password, user!.passwordHash);
  if (!ok) {
    await recordAudit({ action: "LOGIN_FAILED", userId: user!.id, userEmail: email, detail: "パスワード不一致", context });
    badRequest("メールアドレスまたはパスワードが正しくありません");
  }

  await recordAudit({ action: "LOGIN_SUCCESS", userId: user!.id, userEmail: user!.email, context });

  const token = await signToken({ userId: user!.id }, jwtSecret);
  return { user: sanitizeUser(user!), token };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  return { user: sanitizeUser(user), subscription };
}
