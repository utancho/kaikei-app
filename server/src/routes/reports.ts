import { Hono } from "hono";
import type { Context } from "hono";
import { requireBusinessId, parseDateParam } from "../lib/requestHelpers.js";
import { notFound } from "../lib/httpError.js";
import {
  getBalanceSheet,
  getBusinessAnalysis,
  getCashTrend,
  getGeneralLedger,
  getJournalBook,
  getMonthlyTrend,
  getPartnerBalances,
  getProfitAndLoss,
  getTrialBalance,
} from "../services/reportsService.js";
import { getOrCreateFiscalYearForDate } from "../services/fiscalYearService.js";
import { getBlueReturnStatement } from "../services/blueReturnService.js";
import { getConsumptionTaxReturn, getSimplifiedTaxCategories } from "../services/consumptionTaxService.js";
import { getCashFlowForecast } from "../services/budgetService.js";
import { getYearEndClosing } from "../services/closingService.js";
import type { AppEnv } from "../types/env.js";

export const reportsRouter = new Hono<AppEnv>();

async function resolvePeriod(businessId: string, c: Context<AppEnv>) {
  const from = parseDateParam(c.req.query("from"));
  const to = parseDateParam(c.req.query("to"));
  if (from && to) return { from, to };

  const fiscalYear = await getOrCreateFiscalYearForDate(businessId, to ?? new Date());
  return { from: from ?? fiscalYear.startDate, to: to ?? fiscalYear.endDate };
}

reportsRouter.get("/trial-balance", async (c) => {
  const businessId = requireBusinessId(c);
  const { from, to } = await resolvePeriod(businessId, c);
  const rows = await getTrialBalance(businessId, from, to);
  return c.json({ period: { from, to }, rows });
});

reportsRouter.get("/general-ledger/:accountId", async (c) => {
  const businessId = requireBusinessId(c);
  const { from, to } = await resolvePeriod(businessId, c);
  const ledger = await getGeneralLedger(businessId, c.req.param("accountId"), from, to);
  if (!ledger) notFound("勘定科目が見つかりません");
  return c.json(ledger);
});

reportsRouter.get("/profit-loss", async (c) => {
  const businessId = requireBusinessId(c);
  const { from, to } = await resolvePeriod(businessId, c);
  const pl = await getProfitAndLoss(businessId, from, to);
  return c.json(pl);
});

reportsRouter.get("/balance-sheet", async (c) => {
  const businessId = requireBusinessId(c);
  const { from, to } = await resolvePeriod(businessId, c);
  const bs = await getBalanceSheet(businessId, from, to);
  return c.json(bs);
});

reportsRouter.get("/year-end-closing", async (c) => {
  const businessId = requireBusinessId(c);
  return c.json(await getYearEndClosing(businessId, c.req.query("fiscalYearId")));
});

reportsRouter.get("/business-analysis", async (c) => {
  const businessId = requireBusinessId(c);
  const { from, to } = await resolvePeriod(businessId, c);
  return c.json(await getBusinessAnalysis(businessId, from, to));
});

reportsRouter.get("/cash-trend", async (c) => {
  const businessId = requireBusinessId(c);
  const months = Math.min(Math.max(Number(c.req.query("months")) || 6, 1), 24);
  const points = await getCashTrend(businessId, months);
  return c.json(points);
});

reportsRouter.get("/blue-return", async (c) => {
  const businessId = requireBusinessId(c);
  const { from, to } = await resolvePeriod(businessId, c);
  return c.json(await getBlueReturnStatement(businessId, from, to));
});

reportsRouter.get("/consumption-tax", async (c) => {
  const businessId = requireBusinessId(c);
  const { from, to } = await resolvePeriod(businessId, c);
  return c.json(await getConsumptionTaxReturn(businessId, from, to));
});

reportsRouter.get("/consumption-tax/categories", (c) => {
  return c.json(getSimplifiedTaxCategories());
});

reportsRouter.get("/cash-flow-forecast", async (c) => {
  const businessId = requireBusinessId(c);
  const months = Math.min(Math.max(Number(c.req.query("months")) || 6, 1), 12);
  return c.json(await getCashFlowForecast(businessId, months));
});

reportsRouter.get("/partner-balances", async (c) => {
  const businessId = requireBusinessId(c);
  return c.json(await getPartnerBalances(businessId));
});

reportsRouter.get("/monthly-trend", async (c) => {
  const businessId = requireBusinessId(c);
  const months = Math.min(Math.max(Number(c.req.query("months")) || 12, 1), 24);
  return c.json(await getMonthlyTrend(businessId, months));
});

reportsRouter.get("/journal-book", async (c) => {
  const businessId = requireBusinessId(c);
  const from = parseDateParam(c.req.query("from"));
  const to = parseDateParam(c.req.query("to"));
  const entries = await getJournalBook(businessId, from, to);
  return c.json(entries);
});
