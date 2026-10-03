import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/httpError.js";
import { getOrCreateFiscalYearForDate } from "./fiscalYearService.js";
import type { z } from "zod";
import type { journalEntryInputSchema } from "../lib/zodSchemas.js";

export type JournalEntryInput = z.infer<typeof journalEntryInputSchema>;

function assertBalanced(lines: JournalEntryInput["lines"]) {
  const debit = lines
    .filter((l) => l.side === "DEBIT")
    .reduce((sum, l) => sum + l.amount, 0);
  const credit = lines
    .filter((l) => l.side === "CREDIT")
    .reduce((sum, l) => sum + l.amount, 0);

  if (debit === 0 || credit === 0) {
    badRequest("借方・貸方の両方に金額を入力してください");
  }
  if (debit !== credit) {
    badRequest(`貸借が一致しません(借方合計: ${debit}円 / 貸方合計: ${credit}円)`);
  }
}

async function assertAccountsBelongToBusiness(businessId: string, accountIds: string[]) {
  const unique = [...new Set(accountIds)];
  const found = await prisma.account.findMany({
    where: { id: { in: unique }, businessId },
    select: { id: true },
  });
  if (found.length !== unique.length) {
    badRequest("指定された勘定科目が見つかりません");
  }
}

export async function listJournalEntries(
  businessId: string,
  filters: { from?: Date; to?: Date; accountId?: string; keyword?: string }
) {
  return prisma.journalEntry.findMany({
    where: {
      businessId,
      entryDate: {
        gte: filters.from,
        lte: filters.to,
      },
      ...(filters.accountId ? { lines: { some: { accountId: filters.accountId } } } : {}),
      ...(filters.keyword
        ? { description: { contains: filters.keyword } }
        : {}),
    },
    include: {
      lines: {
        include: { account: true, subAccount: true, partner: true, taxCategory: true },
        orderBy: { lineNumber: "asc" },
      },
    },
    orderBy: [{ entryDate: "desc" }, { entryNumber: "desc" }],
  });
}

export async function getJournalEntry(businessId: string, id: string) {
  const entry = await prisma.journalEntry.findFirst({
    where: { id, businessId },
    include: {
      lines: {
        include: { account: true, subAccount: true, partner: true, taxCategory: true },
        orderBy: { lineNumber: "asc" },
      },
    },
  });
  if (!entry) notFound("仕訳が見つかりません");
  return entry;
}

export async function createJournalEntry(businessId: string, input: JournalEntryInput) {
  assertBalanced(input.lines);
  await assertAccountsBelongToBusiness(
    businessId,
    input.lines.map((l) => l.accountId)
  );

  const fiscalYear = await getOrCreateFiscalYearForDate(businessId, input.entryDate);

  const last = await prisma.journalEntry.findFirst({
    where: { businessId },
    orderBy: { entryNumber: "desc" },
    select: { entryNumber: true },
  });
  const entryNumber = (last?.entryNumber ?? 0) + 1;

  return prisma.journalEntry.create({
    data: {
      businessId,
      fiscalYearId: fiscalYear.id,
      entryNumber,
      entryDate: input.entryDate,
      description: input.description,
      status: input.status ?? "CONFIRMED",
      source: "MANUAL",
      lines: {
        create: input.lines.map((l, i) => ({
          lineNumber: i + 1,
          side: l.side,
          accountId: l.accountId,
          subAccountId: l.subAccountId || undefined,
          partnerId: l.partnerId || undefined,
          taxCategoryId: l.taxCategoryId || undefined,
          amount: l.amount,
          taxAmount: l.taxAmount ?? 0,
          description: l.description,
        })),
      },
    },
    include: { lines: true },
  });
}

export async function updateJournalEntry(
  businessId: string,
  id: string,
  input: JournalEntryInput
) {
  const existing = await prisma.journalEntry.findFirst({ where: { id, businessId } });
  if (!existing) notFound("仕訳が見つかりません");

  assertBalanced(input.lines);
  await assertAccountsBelongToBusiness(
    businessId,
    input.lines.map((l) => l.accountId)
  );

  const fiscalYear = await getOrCreateFiscalYearForDate(businessId, input.entryDate);

  return prisma.$transaction(async (tx) => {
    await tx.journalEntryLine.deleteMany({ where: { journalEntryId: id } });
    return tx.journalEntry.update({
      where: { id },
      data: {
        fiscalYearId: fiscalYear.id,
        entryDate: input.entryDate,
        description: input.description,
        status: input.status ?? "CONFIRMED",
        lines: {
          create: input.lines.map((l, i) => ({
            lineNumber: i + 1,
            side: l.side,
            accountId: l.accountId,
            subAccountId: l.subAccountId || undefined,
            partnerId: l.partnerId || undefined,
            taxCategoryId: l.taxCategoryId || undefined,
            amount: l.amount,
            taxAmount: l.taxAmount ?? 0,
            description: l.description,
          })),
        },
      },
      include: { lines: true },
    });
  });
}

export async function deleteJournalEntry(businessId: string, id: string) {
  const existing = await prisma.journalEntry.findFirst({ where: { id, businessId } });
  if (!existing) notFound("仕訳が見つかりません");
  await prisma.journalEntry.delete({ where: { id } });
}

interface ImportEntry {
  entryDate: string;
  description?: string | null;
  lines: { side: "DEBIT" | "CREDIT"; accountName: string; amount: number }[];
}

/**
 * CSV由来の日付文字列をUTC基準の日付に正規化する。
 * "2026/02/20" / "2026-02-20" / "2026年2月5日" などに対応。
 * スラッシュ区切りはローカルTZで解釈されて日付がズレるため、必ず明示的にUTCへ変換する。
 */
function parseUtcDate(raw: string): Date {
  const s = raw.trim();
  const m = s.match(/^(\d{4})[/\-.年](\d{1,2})[/\-.月](\d{1,2})/);
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    if (!isNaN(d.getTime())) return d;
  }
  const parsed = new Date(s);
  if (isNaN(parsed.getTime())) throw new Error(`日付「${raw}」を認識できません`);
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

/**
 * CSVから取り込んだ仕訳を一括登録する。勘定科目は名称で照合する。
 * 1件ずつ検証し、エラーになった行はスキップして理由を返す(部分取込)。
 */
export async function importJournalEntries(businessId: string, entries: ImportEntry[]) {
  const accounts = await prisma.account.findMany({
    where: { businessId, isActive: true },
    select: { id: true, name: true },
  });
  const idByName = new Map<string, string>();
  for (const a of accounts) if (!idByName.has(a.name)) idByName.set(a.name, a.id);

  let created = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    try {
      const entryDate = parseUtcDate(e.entryDate);
      const lines = e.lines.map((l) => {
        const accountId = idByName.get(l.accountName.trim());
        if (!accountId) throw new Error(`勘定科目「${l.accountName}」が見つかりません`);
        return { side: l.side, accountId, amount: Math.round(l.amount) };
      });
      await createJournalEntry(businessId, {
        entryDate,
        description: e.description ?? undefined,
        lines,
      } as JournalEntryInput);
      created++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "仕訳の作成に失敗しました";
      errors.push({ row: i + 1, message });
    }
  }

  return { total: entries.length, created, errors };
}
