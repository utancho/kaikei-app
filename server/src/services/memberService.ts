import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/httpError.js";
import { createInviteToken, hashInviteToken } from "../lib/inviteToken.js";

export async function listMembers(businessId: string) {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  const [ownerUser, members] = await Promise.all([
    prisma.user.findUnique({ where: { id: business.ownerId }, select: { id: true, email: true, name: true } }),
    prisma.businessMember.findMany({ where: { businessId }, orderBy: { invitedAt: "asc" } }),
  ]);

  return {
    owner: ownerUser,
    members: members.map((m) => ({
      id: m.id,
      email: m.email,
      status: m.status,
      role: m.role,
      invitedAt: m.invitedAt,
      joinedAt: m.joinedAt,
    })),
  };
}

export async function inviteMember(businessId: string, email: string, role: "MEMBER" | "VIEWER" = "MEMBER") {
  email = email.trim().toLowerCase();
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  const owner = await prisma.user.findUnique({ where: { id: business.ownerId } });
  if (owner && owner.email.toLowerCase() === email.toLowerCase()) {
    badRequest("オーナー自身は招待できません");
  }

  const matches = await prisma.$queryRaw<{ id: string; status: string }[]>`SELECT id,status FROM BusinessMember WHERE businessId=${businessId} AND lower(email)=lower(${email}) LIMIT 1`;
  const existing = matches[0];
  if (existing?.status === "ACTIVE") badRequest("このメールアドレスは既に参加しています");
  const token = createInviteToken();
  const invitation = { email, role, status: "PENDING", userId: null, joinedAt: null, inviteTokenHash: await hashInviteToken(token), inviteExpiresAt: new Date(Date.now() + 7 * 86400000) };
  const member = existing ? await prisma.businessMember.update({ where: { id: existing.id }, data: invitation }) : await prisma.businessMember.create({
    data: {
      businessId,
      ...invitation,
    },
  });
  return { id: member.id, email: member.email, role: member.role, status: member.status, inviteToken: token, expiresAt: member.inviteExpiresAt };
}

export async function acceptMemberInvite(userId: string, token: string) {
  const hash = await hashInviteToken(token);
  const member = await prisma.businessMember.findUnique({ where: { inviteTokenHash: hash } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!member || member.status !== "PENDING" || !member.inviteExpiresAt || member.inviteExpiresAt <= new Date()) badRequest("招待リンクは無効または期限切れです。オーナーに再招待を依頼してください。");
  if (member!.email.toLowerCase() !== user.email.toLowerCase()) badRequest("招待先と同じメールアドレスでログインしてください。");
  const updated = await prisma.businessMember.updateMany({ where: { id: member!.id, status: "PENDING", inviteTokenHash: hash, inviteExpiresAt: { gt: new Date() } }, data: { status: "ACTIVE", userId, joinedAt: new Date(), inviteTokenHash: null, inviteExpiresAt: null } });
  if (!updated.count) badRequest("この招待リンクは使用済みです。");
  return { businessId: member!.businessId };
}

export async function removeMember(businessId: string, memberId: string) {
  const member = await prisma.businessMember.findFirst({ where: { id: memberId, businessId } });
  if (!member) notFound("メンバーが見つかりません");
  await prisma.businessMember.delete({ where: { id: memberId } });
}

// サインアップ時に、そのメールアドレス宛の招待が保留中であれば自動的に参加させる。
export async function activatePendingInvites(userId: string, email: string) {
  await prisma.businessMember.updateMany({
    where: { email, status: "PENDING" },
    data: { userId, status: "ACTIVE", joinedAt: new Date() },
  });
}
