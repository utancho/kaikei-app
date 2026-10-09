import { prisma } from "./prisma.js";
import { badRequest } from "./httpError.js";

type LineReference = { accountId: string; partnerId?: string | null; subAccountId?: string | null };
const unique = (ids: (string | null | undefined)[]) => [...new Set(ids.filter((id): id is string => Boolean(id)))];

export async function assertPartnerBelongs(businessId: string, partnerId: string) {
  if (!await prisma.partner.findFirst({ where: { id: partnerId, businessId }, select: { id: true } })) {
    badRequest("指定された取引先が見つかりません");
  }
}

/** Validate every tenant-owned foreign reference before any write. TaxCategory is global. */
export async function assertLineReferences(businessId: string, lines: LineReference[]) {
  const accountIds = unique(lines.map(l => l.accountId));
  const partnerIds = unique(lines.map(l => l.partnerId));
  const subIds = unique(lines.map(l => l.subAccountId));
  const [accounts, partners, subs] = await Promise.all([
    prisma.account.findMany({ where: { businessId, id: { in: accountIds } }, select: { id: true } }),
    prisma.partner.findMany({ where: { businessId, id: { in: partnerIds } }, select: { id: true } }),
    prisma.subAccount.findMany({ where: { id: { in: subIds }, account: { businessId } }, select: { id: true, accountId: true } }),
  ]);
  const bySub = new Map(subs.map(s => [s.id, s.accountId]));
  if (accounts.length !== accountIds.length || partners.length !== partnerIds.length ||
      lines.some(l => l.subAccountId && bySub.get(l.subAccountId) !== l.accountId)) {
    badRequest("この事業者・勘定科目に属さない参照が含まれています");
  }
}

/** Resolve only scoped objects, including historical rows created before write validation. */
export async function attachLineReferences<T extends LineReference>(businessId: string, lines: T[]) {
  const [accounts, partners, subs] = await Promise.all([
    prisma.account.findMany({ where: { businessId, id: { in: unique(lines.map(l => l.accountId)) } } }),
    prisma.partner.findMany({ where: { businessId, id: { in: unique(lines.map(l => l.partnerId)) } } }),
    prisma.subAccount.findMany({ where: { id: { in: unique(lines.map(l => l.subAccountId)) }, account: { businessId } } }),
  ]);
  const a = new Map(accounts.map(x => [x.id, x]));
  const p = new Map(partners.map(x => [x.id, x]));
  const s = new Map(subs.map(x => [x.id, x]));
  return lines.map(l => {
    const sub = l.subAccountId ? s.get(l.subAccountId) : undefined;
    return { ...l, account: a.get(l.accountId) ?? null,
      partnerId: l.partnerId && p.has(l.partnerId) ? l.partnerId : null,
      partner: l.partnerId ? p.get(l.partnerId) ?? null : null,
      subAccountId: sub?.accountId === l.accountId ? l.subAccountId : null,
      subAccount: sub?.accountId === l.accountId ? sub : null };
  });
}
