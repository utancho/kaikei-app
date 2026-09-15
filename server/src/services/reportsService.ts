import { prisma } from "../lib/prisma.js";
import type { AccountCategory, NormalBalance } from "../lib/enums.js";

interface Totals {
  debit: number;
  credit: number;
}

async function sumLinesByAccount(
  businessId: string,
  where: { gte?: Date; lte?: Date }
): Promise<Map<string, Totals>> {
  const grouped = await prisma.journalEntryLine.groupBy({
    by: ["accountId", "side"],
    where: {
      account: { businessId },
      journalEntry: {
        status: "CONFIRMED",
        entryDate: where,
      },
    },
    _sum: { amount: true },
  });

  const map = new Map<string, Totals>();
  for (const row of grouped) {
    const entry = map.get(row.accountId) ?? { debit: 0, credit: 0 };
    if (row.side === "DEBIT") entry.debit += row._sum.amount ?? 0;
    else entry.credit += row._sum.amount ?? 0;
    map.set(row.accountId, entry);
  }
  return map;
}

function signedBalance(normalBalance: NormalBalance, totals: Totals): number {
  return normalBalance === "DEBIT" ? totals.debit - totals.credit : totals.credit - totals.debit;
}

export async function getTrialBalance(businessId: string, from?: Date, to?: Date) {
  const accounts = await prisma.account.findMany({
    where: { businessId, isActive: true },
    orderBy: [{ category: "asc" }, { displayOrder: "asc" }],
  });
  const totalsByAccount = await sumLinesByAccount(businessId, { gte: from, lte: to });

  return accounts.map((a) => {
    const totals = totalsByAccount.get(a.id) ?? { debit: 0, credit: 0 };
    const balance = signedBalance(a.normalBalance as NormalBalance, totals);
    return {
      accountId: a.id,
      code: a.code,
      name: a.name,
      category: a.category,
      subcategory: a.subcategory,
      normalBalance: a.normalBalance,
      debitTotal: totals.debit,
      creditTotal: totals.credit,
      balance,
    };
  });
}

export async function getGeneralLedger(
  businessId: string,
  accountId: string,
  from?: Date,
  to?: Date
) {
  const account = await prisma.account.findFirst({ where: { id: accountId, businessId } });
  if (!account) return null;

  // 期首残高(fromより前の累計)
  const priorTotals = from
    ? await sumLinesByAccount(businessId, { lte: new Date(from.getTime() - 1) })
    : new Map<string, Totals>();
  const openingBalance = signedBalance(
    account.normalBalance as NormalBalance,
    priorTotals.get(accountId) ?? { debit: 0, credit: 0 }
  );

  const lines = await prisma.journalEntryLine.findMany({
    where: {
      accountId,
      journalEntry: { businessId, status: "CONFIRMED", entryDate: { gte: from, lte: to } },
    },
    include: {
      journalEntry: true,
      partner: true,
      subAccount: true,
      taxCategory: true,
    },
    orderBy: [{ journalEntry: { entryDate: "asc" } }, { journalEntry: { entryNumber: "asc" } }, { lineNumber: "asc" }],
  });

  let running = openingBalance;
  const rows = lines.map((l) => {
    const delta =
      account.normalBalance === "DEBIT"
        ? l.side === "DEBIT"
          ? l.amount
          : -l.amount
        : l.side === "CREDIT"
          ? l.amount
          : -l.amount;
    running += delta;
    return {
      journalEntryId: l.journalEntryId,
      entryDate: l.journalEntry.entryDate,
      entryNumber: l.journalEntry.entryNumber,
      description: l.description || l.journalEntry.description,
      partnerName: l.partner?.name ?? null,
      side: l.side,
      amount: l.amount,
      balance: running,
    };
  });

  return {
    account: { id: account.id, code: account.code, name: account.name, normalBalance: account.normalBalance },
    openingBalance,
    closingBalance: running,
    rows,
  };
}

const PL_CATEGORIES: AccountCategory[] = ["REVENUE", "EXPENSE"];
const BS_CATEGORIES: AccountCategory[] = ["ASSET", "LIABILITY", "EQUITY"];

function summarizeProfitAndLoss(
  accounts: { id: string; code: string; name: string; category: string; subcategory: string; normalBalance: string }[],
  totals: Map<string, Totals>
) {
  const lineItems = accounts
    .map((a) => ({
      accountId: a.id,
      code: a.code,
      name: a.name,
      category: a.category,
      subcategory: a.subcategory,
      amount: signedBalance(a.normalBalance as NormalBalance, totals.get(a.id) ?? { debit: 0, credit: 0 }),
    }))
    .filter((li) => li.amount !== 0);

  const sumOf = (subcategory: string) =>
    lineItems.filter((li) => li.subcategory === subcategory).reduce((s, li) => s + li.amount, 0);

  const sales = sumOf("売上高");
  const cogs = sumOf("売上原価");
  const grossProfit = sales - cogs;
  const sga = sumOf("販売費及び一般管理費");
  const operatingIncome = grossProfit - sga;
  const nonOperatingRevenue = sumOf("営業外収益");
  const nonOperatingExpense = sumOf("営業外費用");
  const ordinaryIncome = operatingIncome + nonOperatingRevenue - nonOperatingExpense;
  const extraordinaryGain = sumOf("特別利益");
  const extraordinaryLoss = sumOf("特別損失");
  const incomeBeforeTax = ordinaryIncome + extraordinaryGain - extraordinaryLoss;
  const taxes = sumOf("法人税等");
  const netIncome = incomeBeforeTax - taxes;

  return {
    lineItems,
    summary: {
      sales,
      cogs,
      grossProfit,
      sga,
      operatingIncome,
      nonOperatingRevenue,
      nonOperatingExpense,
      ordinaryIncome,
      extraordinaryGain,
      extraordinaryLoss,
      incomeBeforeTax,
      taxes,
      netIncome,
    },
  };
}

export async function getProfitAndLoss(businessId: string, from: Date, to: Date) {
  const accounts = await prisma.account.findMany({
    where: { businessId, isActive: true, category: { in: PL_CATEGORIES } },
    orderBy: [{ category: "asc" }, { displayOrder: "asc" }],
  });
  const totals = await sumLinesByAccount(businessId, { gte: from, lte: to });
  const { lineItems, summary } = summarizeProfitAndLoss(accounts, totals);

  return { period: { from, to }, lineItems, summary };
}

export async function getBalanceSheet(businessId: string, fiscalYearStart: Date, asOf: Date) {
  const accounts = await prisma.account.findMany({
    where: { businessId, isActive: true, category: { in: BS_CATEGORIES } },
    orderBy: [{ category: "asc" }, { displayOrder: "asc" }],
  });
  const totals = await sumLinesByAccount(businessId, { lte: asOf });

  const lineItems = accounts
    .map((a) => ({
      accountId: a.id,
      code: a.code,
      name: a.name,
      category: a.category,
      subcategory: a.subcategory,
      amount: signedBalance(a.normalBalance as NormalBalance, totals.get(a.id) ?? { debit: 0, credit: 0 }),
    }))
    .filter((li) => li.amount !== 0);

  const totalAssets = lineItems.filter((l) => l.category === "ASSET").reduce((s, l) => s + l.amount, 0);
  const totalLiabilities = lineItems
    .filter((l) => l.category === "LIABILITY")
    .reduce((s, l) => s + l.amount, 0);
  const equityFromAccounts = lineItems
    .filter((l) => l.category === "EQUITY")
    .reduce((s, l) => s + l.amount, 0);

  // 当期純利益(未振替) = 期首〜期末の収益-費用。決算振替仕訳をしていない前提で
  // 貸借を一致させるため、当期純利益を純資産の部に自動計上する。
  const pl = await getProfitAndLoss(businessId, fiscalYearStart, asOf);
  const currentNetIncome = pl.summary.netIncome;
  const totalEquity = equityFromAccounts + currentNetIncome;

  return {
    asOf,
    lineItems,
    currentNetIncome,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
    balanced: totalAssets === totalLiabilities + totalEquity,
  };
}

const CASH_ACCOUNT_CODES = ["1010", "1020", "1030", "1040", "1050"];

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// 過去分の月次推移は、月ごとにDBへ問い合わせる代わりに対象期間の明細を1回で取得し、
// JS側で月ごとに集計する(N+1回避)。
export async function getCashTrend(businessId: string, months: number) {
  const cashAccounts = await prisma.account.findMany({
    where: { businessId, code: { in: CASH_ACCOUNT_CODES } },
  });
  const cashAccountIds = cashAccounts.map((a) => a.id);
  const now = new Date();
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

  const points: { month: string; balance: number }[] = [];
  if (cashAccountIds.length === 0) {
    for (let i = months - 1; i >= 0; i--) {
      points.push({ month: monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))), balance: 0 });
    }
    return points;
  }

  const [openingTotals, lines] = await Promise.all([
    sumLinesByAccount(businessId, { lte: new Date(windowStart.getTime() - 1) }),
    prisma.journalEntryLine.findMany({
      where: {
        accountId: { in: cashAccountIds },
        journalEntry: { status: "CONFIRMED", entryDate: { gte: windowStart, lte: now } },
      },
      select: { accountId: true, side: true, amount: true, journalEntry: { select: { entryDate: true } } },
    }),
  ]);

  const linesByMonth = new Map<string, typeof lines>();
  for (const l of lines) {
    const key = monthKey(l.journalEntry.entryDate);
    const bucket = linesByMonth.get(key);
    if (bucket) bucket.push(l);
    else linesByMonth.set(key, [l]);
  }

  const running = new Map<string, Totals>(cashAccountIds.map((id) => [id, { ...(openingTotals.get(id) ?? { debit: 0, credit: 0 }) }]));

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = monthKey(monthDate);
    for (const l of linesByMonth.get(key) ?? []) {
      const t = running.get(l.accountId)!;
      if (l.side === "DEBIT") t.debit += l.amount;
      else t.credit += l.amount;
    }
    const balance = cashAccounts.reduce((sum, a) => sum + signedBalance(a.normalBalance as NormalBalance, running.get(a.id)!), 0);
    points.push({ month: key, balance });
  }

  return points;
}

export async function getPartnerBalances(businessId: string) {
  const [receivableAccount, payableAccount] = await Promise.all([
    prisma.account.findFirst({ where: { businessId, code: "1110" } }), // 売掛金
    prisma.account.findFirst({ where: { businessId, code: "2010" } }), // 買掛金
  ]);

  async function balancesFor(accountId: string | undefined, normalBalance: NormalBalance) {
    if (!accountId) return [];
    const grouped = await prisma.journalEntryLine.groupBy({
      by: ["partnerId", "side"],
      where: { accountId, partnerId: { not: null }, journalEntry: { status: "CONFIRMED" } },
      _sum: { amount: true },
    });

    const totalsByPartner = new Map<string, Totals>();
    for (const row of grouped) {
      if (!row.partnerId) continue;
      const entry = totalsByPartner.get(row.partnerId) ?? { debit: 0, credit: 0 };
      if (row.side === "DEBIT") entry.debit += row._sum.amount ?? 0;
      else entry.credit += row._sum.amount ?? 0;
      totalsByPartner.set(row.partnerId, entry);
    }

    const partners = await prisma.partner.findMany({ where: { id: { in: [...totalsByPartner.keys()] } } });
    const nameById = new Map(partners.map((p) => [p.id, p.name]));

    return [...totalsByPartner.entries()]
      .map(([partnerId, totals]) => ({
        partnerId,
        partnerName: nameById.get(partnerId) ?? "(不明な取引先)",
        balance: signedBalance(normalBalance, totals),
      }))
      .filter((r) => r.balance !== 0)
      .sort((a, b) => b.balance - a.balance);
  }

  const [receivables, payables] = await Promise.all([
    balancesFor(receivableAccount?.id, "DEBIT"),
    balancesFor(payableAccount?.id, "CREDIT"),
  ]);

  return {
    receivables,
    payables,
    totalReceivables: receivables.reduce((s, r) => s + r.balance, 0),
    totalPayables: payables.reduce((s, r) => s + r.balance, 0),
  };
}

export async function getMonthlyTrend(businessId: string, months: number) {
  const accounts = await prisma.account.findMany({
    where: { businessId, isActive: true, category: { in: PL_CATEGORIES } },
    orderBy: [{ category: "asc" }, { displayOrder: "asc" }],
  });
  const accountIds = accounts.map((a) => a.id);

  const now = new Date();
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

  const lines = accountIds.length
    ? await prisma.journalEntryLine.findMany({
        where: {
          accountId: { in: accountIds },
          journalEntry: { status: "CONFIRMED", entryDate: { gte: windowStart, lte: now } },
        },
        select: { accountId: true, side: true, amount: true, journalEntry: { select: { entryDate: true } } },
      })
    : [];

  const totalsByMonth = new Map<string, Map<string, Totals>>();
  for (const l of lines) {
    const key = monthKey(l.journalEntry.entryDate);
    let monthTotals = totalsByMonth.get(key);
    if (!monthTotals) {
      monthTotals = new Map();
      totalsByMonth.set(key, monthTotals);
    }
    const entry = monthTotals.get(l.accountId) ?? { debit: 0, credit: 0 };
    if (l.side === "DEBIT") entry.debit += l.amount;
    else entry.credit += l.amount;
    monthTotals.set(l.accountId, entry);
  }

  const points: { month: string; sales: number; expenses: number; netIncome: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = monthKey(monthDate);
    const { summary } = summarizeProfitAndLoss(accounts, totalsByMonth.get(key) ?? new Map());
    points.push({
      month: key,
      sales: summary.sales,
      expenses: summary.cogs + summary.sga + summary.nonOperatingExpense + summary.extraordinaryLoss,
      netIncome: summary.netIncome,
    });
  }

  return points;
}

export async function getJournalBook(businessId: string, from?: Date, to?: Date) {
  return prisma.journalEntry.findMany({
    where: { businessId, status: "CONFIRMED", entryDate: { gte: from, lte: to } },
    include: {
      lines: { include: { account: true, partner: true }, orderBy: { lineNumber: "asc" } },
    },
    orderBy: [{ entryDate: "asc" }, { entryNumber: "asc" }],
  });
}
