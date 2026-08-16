import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/httpError.js";

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

export async function inviteMember(businessId: string, email: string) {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  const owner = await prisma.user.findUnique({ where: { id: business.ownerId } });
  if (owner && owner.email.toLowerCase() === email.toLowerCase()) {
    badRequest("オーナー自身は招待できません");
  }

  const existing = await prisma.businessMember.findUnique({ where: { businessId_email: { businessId, email } } });
  if (existing) badRequest("このメールアドレスは既に招待済みです");

  const matchingUser = await prisma.user.findUnique({ where: { email } });

  return prisma.businessMember.create({
    data: {
      businessId,
      email,
      userId: matchingUser?.id,
      status: matchingUser ? "ACTIVE" : "PENDING",
      joinedAt: matchingUser ? new Date() : null,
    },
  });
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
