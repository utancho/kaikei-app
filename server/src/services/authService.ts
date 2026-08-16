import { prisma } from "../lib/prisma.js";
import { badRequest } from "../lib/httpError.js";
import { hashPassword, signToken, verifyPassword } from "../lib/auth.js";

function sanitizeUser(user: { id: string; email: string; name: string | null }) {
  return { id: user.id, email: user.email, name: user.name };
}

export async function signup(email: string, password: string, name?: string) {
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

  const token = signToken({ userId: user.id });
  return { user: sanitizeUser(user), token };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) badRequest("メールアドレスまたはパスワードが正しくありません");

  const ok = await verifyPassword(password, user!.passwordHash);
  if (!ok) badRequest("メールアドレスまたはパスワードが正しくありません");

  const token = signToken({ userId: user!.id });
  return { user: sanitizeUser(user!), token };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  return { user: sanitizeUser(user), subscription };
}
