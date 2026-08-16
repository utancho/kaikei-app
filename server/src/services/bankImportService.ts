import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/httpError.js";
import { parseCsv } from "../lib/csv.js";
import { getOrCreateFiscalYearForDate } from "./fiscalYearService.js";

interface ParsedRow {
  date: Date;
  description: string;
  amount: number; // 正=入金, 負=出金
  balance: number | null;
}

function findColumn(header: string[], keywords: string[]): number {
  return header.findIndex((h) => keywords.some((k) => h.includes(k)));
}

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[,¥\s]/g, "");
  if (cleaned === "" || cleaned === "-") return 0;
  const n = Number(cleaned);
  return Number.isNaN(n) ? 0 : Math.round(n);
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const normalized = raw.trim().replace(/\//g, "-");
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseBankCsv(content: string): ParsedRow[] {
  const rows = parseCsv(content);
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.trim());
  const dateIdx = findColumn(header, ["日付", "取引日", "年月日"]);
  const descIdx = findColumn(header, ["摘要", "内容", "取引内容", "適用"]);
  const depositIdx = findColumn(header, ["入金"]);
  const withdrawalIdx = findColumn(header, ["出金"]);
  // "金額"は「出金金額」「入金金額」にも部分一致してしまうため、
  // 入金/出金の専用列ではない列だけを対象に汎用の金額列を探す
  const amountIdx = header.findIndex((h) => h.includes("金額") && !h.includes("入金") && !h.includes("出金"));
  const balanceIdx = findColumn(header, ["残高"]);

  if (dateIdx === -1) badRequest("CSVに日付列が見つかりません");

  const parsed: ParsedRow[] = [];
  for (const raw of rows.slice(1)) {
    const date = parseDate(raw[dateIdx]);
    if (!date) continue;

    let amount = 0;
    if (amountIdx !== -1) {
      amount = parseAmount(raw[amountIdx]);
    } else if (depositIdx !== -1 || withdrawalIdx !== -1) {
      const deposit = parseAmount(raw[depositIdx]);
      const withdrawal = parseAmount(raw[withdrawalIdx]);
      amount = deposit - withdrawal;
    }
    if (amount === 0) continue;

    parsed.push({
      date,
      description: descIdx !== -1 ? (raw[descIdx] ?? "").trim() : "",
      amount,
      balance: balanceIdx !== -1 ? parseAmount(raw[balanceIdx]) : null,
    });
  }
  return parsed;
}

const SUGGESTION_RULES: { keywords: string[]; code: string }[] = [
  { keywords: ["家賃", "賃料"], code: "6180" }, // 地代家賃
  { keywords: ["電気"], code: "6130" }, // 水道光熱費
  { keywords: ["水道"], code: "6130" },
  { keywords: ["ガス"], code: "6130" },
  { keywords: ["携帯", "電話", "通信", "インターネット"], code: "6120" }, // 通信費
  { keywords: ["保険"], code: "6190" }, // 保険料
  { keywords: ["給与", "給料"], code: "6020" }, // 給料賃金
  { keywords: ["手数料"], code: "6220" }, // 支払手数料
  { keywords: ["租税", "税務署", "都道府県税", "市税"], code: "6200" }, // 租税公課
  { keywords: ["リース"], code: "6250" }, // リース料
  { keywords: ["交通", "タクシー", "鉄道"], code: "6110" }, // 旅費交通費
];

async function suggestAccountId(
  businessId: string,
  description: string,
  amount: number
): Promise<string | null> {
  let code: string | null = null;
  for (const rule of SUGGESTION_RULES) {
    if (rule.keywords.some((k) => description.includes(k))) {
      code = rule.code;
      break;
    }
  }
  if (!code) {
    if (amount < 0 && description.includes("利息")) code = "7010"; // 支払利息
    else if (amount > 0 && description.includes("利息")) code = "4110"; // 受取利息
  }
  if (!code) return null;

  const account = await prisma.account.findFirst({ where: { businessId, code } });
  return account?.id ?? null;
}

export async function createImportBatch(
  businessId: string,
  bankAccountId: string,
  fileName: string,
  content: string
) {
  const bankAccount = await prisma.account.findFirst({
    where: { id: bankAccountId, businessId },
  });
  if (!bankAccount) badRequest("取込先の勘定科目が見つかりません");

  const parsedRows = parseBankCsv(content);
  if (parsedRows.length === 0) badRequest("CSVから取引データを読み取れませんでした");

  const batch = await prisma.bankImportBatch.create({
    data: { businessId, fileName, accountId: bankAccountId },
  });

  const rowsWithSuggestion = await Promise.all(
    parsedRows.map(async (r) => ({
      batchId: batch.id,
      date: r.date,
      description: r.description,
      amount: r.amount,
      balance: r.balance ?? undefined,
      suggestedAccountId: await suggestAccountId(businessId, r.description, r.amount),
      status: "UNMATCHED",
    }))
  );

  await prisma.bankTransactionRow.createMany({ data: rowsWithSuggestion });

  return prisma.bankImportBatch.findUniqueOrThrow({
    where: { id: batch.id },
    include: { rows: true },
  });
}

export async function listImportBatches(businessId: string) {
  return prisma.bankImportBatch.findMany({
    where: { businessId },
    include: { _count: { select: { rows: true } } },
    orderBy: { importedAt: "desc" },
  });
}

export async function getBatchRows(businessId: string, batchId: string) {
  const batch = await prisma.bankImportBatch.findFirst({ where: { id: batchId, businessId } });
  if (!batch) notFound("取込データが見つかりません");
  const rows = await prisma.bankTransactionRow.findMany({
    where: { batchId },
    orderBy: { date: "asc" },
  });
  return { batch, rows };
}

export async function confirmRow(
  businessId: string,
  rowId: string,
  counterpartAccountId: string,
  description?: string
) {
  const row = await prisma.bankTransactionRow.findUnique({
    where: { id: rowId },
    include: { batch: true },
  });
  if (!row || row.batch.businessId !== businessId) notFound("明細が見つかりません");
  if (row.status === "MATCHED") badRequest("この明細は既に仕訳済みです");

  const counterpart = await prisma.account.findFirst({
    where: { id: counterpartAccountId, businessId },
  });
  if (!counterpart) badRequest("相手勘定科目が見つかりません");

  const isDeposit = row.amount > 0;
  const amount = Math.abs(row.amount);

  const fiscalYear = await getOrCreateFiscalYearForDate(businessId, row.date);
  const last = await prisma.journalEntry.findFirst({
    where: { businessId },
    orderBy: { entryNumber: "desc" },
    select: { entryNumber: true },
  });
  const entryNumber = (last?.entryNumber ?? 0) + 1;

  const entry = await prisma.journalEntry.create({
    data: {
      businessId,
      fiscalYearId: fiscalYear.id,
      entryNumber,
      entryDate: row.date,
      description: description || row.description,
      status: "CONFIRMED",
      source: "BANK_IMPORT",
      lines: {
        create: [
          {
            lineNumber: 1,
            side: isDeposit ? "DEBIT" : "CREDIT",
            accountId: row.batch.accountId,
            amount,
          },
          {
            lineNumber: 2,
            side: isDeposit ? "CREDIT" : "DEBIT",
            accountId: counterpart.id,
            amount,
          },
        ],
      },
    },
    include: { lines: true },
  });

  await prisma.bankTransactionRow.update({
    where: { id: rowId },
    data: { status: "MATCHED", matchedJournalEntryId: entry.id },
  });

  return entry;
}

export async function ignoreRow(businessId: string, rowId: string) {
  const row = await prisma.bankTransactionRow.findUnique({
    where: { id: rowId },
    include: { batch: true },
  });
  if (!row || row.batch.businessId !== businessId) notFound("明細が見つかりません");
  await prisma.bankTransactionRow.update({ where: { id: rowId }, data: { status: "IGNORED" } });
}
