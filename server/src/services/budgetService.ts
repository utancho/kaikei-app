import { prisma } from "../lib/prisma.js";
import { badRequest } from "../lib/httpError.js";
import type { NormalBalance } from "../lib/enums.js";
import { getCashTrend } from "./reportsService.js";

export async function listBudgets(businessId: string, year: number) {
  return prisma.budget.findMany({
    where: { businessId, year },
    include: { account: { select: { id: true, code: true, name: true, category: true } } },
  });
}

interface BudgetEntryInput {
  accountId: string;
  year: number;
  month: number;
  amount: number;
}

export async function upsertBudgets(businessId: string, entries: BudgetEntryInput[]) {
  const accountIds = [...new Set(entries.map((e) => e.accountId))];
  const accounts = await prisma.account.findMany({ where: { id: { in: accountIds }, businessId } });
  if (accounts.length !== accountIds.length) badRequest("この事業者に属さない勘定科目が含まれています");

  return prisma.$transaction(
    entries.map((e) =>
      prisma.budget.upsert({
        where: { accountId_year_month: { accountId: e.accountId, year: e.year, month: e.month } },
        create: { businessId, accountId: e.accountId, year: e.year, month: e.month, amount: e.amount },
        update: { amount: e.amount },
      })
    )
  );
}

export async function getBudgetActual(businessId: string, year: number) {
  const accounts = await prisma.account.findMany({
    where: { businessId, category: { in: ["REVENUE", "EXPENSE"] }, isActive: true },
    orderBy: [{ category: "asc" }, { displayOrder: "asc" }],
  });

  const budgets = await prisma.budget.findMany({ where: { businessId, year } });
  const budgetMap = new Map<string, number>(); // `${accountId}-${month}` -> amount
  for (const b of budgets) budgetMap.set(`${b.accountId}-${b.month}`, b.amount);

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  const lines = await prisma.journalEntryLine.findMany({
    where: {
      account: { businessId, category: { in: ["REVENUE", "EXPENSE"] } },
      journalEntry: { status: "CONFIRMED", entryDate: { gte: yearStart, lte: yearEnd } },
    },
    include: { journalEntry: { select: { entryDate: true } }, account: { select: { id: true, normalBalance: true } } },
  });

  const actualMap = new Map<string, number>(); // `${accountId}-${month}` -> signed amount
  for (const line of lines) {
    const month = line.journalEntry.entryDate.getUTCMonth() + 1;
    const key = `${line.accountId}-${month}`;
    const normalBalance = line.account.normalBalance as NormalBalance;
    const delta =
      normalBalance === "DEBIT" ? (line.side === "DEBIT" ? line.amount : -line.amount) : line.side === "CREDIT" ? line.amount : -line.amount;
    actualMap.set(key, (actualMap.get(key) ?? 0) + delta);
  }

  const rows = accounts.map((a) => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const key = `${a.id}-${month}`;
      const budget = budgetMap.get(key) ?? 0;
      const actual = actualMap.get(key) ?? 0;
      return { month, budget, actual, variance: actual - budget };
    });
    return {
      accountId: a.id,
      code: a.code,
      name: a.name,
      category: a.category,
      budgetTotal: months.reduce((s, m) => s + m.budget, 0),
      actualTotal: months.reduce((s, m) => s + m.actual, 0),
      months,
    };
  });

  return { year, rows };
}

export async function getCashFlowForecast(businessId: string, forecastMonths: number) {
  const trend = await getCashTrend(businessId, 6);
  const currentBalance = trend[trend.length - 1]?.balance ?? 0;

  const recentDeltas: number[] = [];
  for (let i = 1; i < trend.length; i++) recentDeltas.push(trend[i].balance - trend[i - 1].balance);
  const trailingAverage = recentDeltas.length > 0 ? Math.round(recentDeltas.reduce((s, d) => s + d, 0) / recentDeltas.length) : 0;

  const now = new Date();
  const currentYear = now.getUTCFullYear();

  const budgets = await prisma.budget.findMany({
    where: { businessId, year: { in: [currentYear, currentYear + 1] } },
    include: { account: { select: { category: true } } },
  });
  const budgetNetByYearMonth = new Map<string, number>();
  for (const b of budgets) {
    const sign = b.account.category === "REVENUE" ? 1 : b.account.category === "EXPENSE" ? -1 : 0;
    const key = `${b.year}-${b.month}`;
    budgetNetByYearMonth.set(key, (budgetNetByYearMonth.get(key) ?? 0) + sign * b.amount);
  }

  const forecast: { month: string; balance: number; source: "budget" | "trend" }[] = [];
  let runningBalance = currentBalance;
  for (let i = 1; i <= forecastMonths; i++) {
    const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const key = `${monthDate.getUTCFullYear()}-${monthDate.getUTCMonth() + 1}`;
    const budgetNet = budgetNetByYearMonth.get(key);
    const delta = budgetNet ?? trailingAverage;
    runningBalance += delta;
    forecast.push({
      month: `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}`,
      balance: runningBalance,
      source: budgetNet != null ? "budget" : "trend",
    });
  }

  return { currentBalance, history: trend, forecast, trailingAverageMonthlyChange: trailingAverage };
}
