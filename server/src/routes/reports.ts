import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireBusinessId, parseDateParam } from "../lib/requestHelpers.js";
import { notFound } from "../lib/httpError.js";
import {
  getBalanceSheet,
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

export const reportsRouter = Router();

async function resolvePeriod(businessId: string, req: import("express").Request) {
  const from = parseDateParam(req.query.from);
  const to = parseDateParam(req.query.to);
  if (from && to) return { from, to };

  const fiscalYear = await getOrCreateFiscalYearForDate(businessId, to ?? new Date());
  return { from: from ?? fiscalYear.startDate, to: to ?? fiscalYear.endDate };
}

reportsRouter.get(
  "/trial-balance",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const { from, to } = await resolvePeriod(businessId, req);
    const rows = await getTrialBalance(businessId, from, to);
    res.json({ period: { from, to }, rows });
  })
);

reportsRouter.get(
  "/general-ledger/:accountId",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const { from, to } = await resolvePeriod(businessId, req);
    const ledger = await getGeneralLedger(businessId, req.params.accountId, from, to);
    if (!ledger) notFound("勘定科目が見つかりません");
    res.json(ledger);
  })
);

reportsRouter.get(
  "/profit-loss",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const { from, to } = await resolvePeriod(businessId, req);
    const pl = await getProfitAndLoss(businessId, from, to);
    res.json(pl);
  })
);

reportsRouter.get(
  "/balance-sheet",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const { from, to } = await resolvePeriod(businessId, req);
    const bs = await getBalanceSheet(businessId, from, to);
    res.json(bs);
  })
);

reportsRouter.get(
  "/cash-trend",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 24);
    const points = await getCashTrend(businessId, months);
    res.json(points);
  })
);

reportsRouter.get(
  "/blue-return",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const { from, to } = await resolvePeriod(businessId, req);
    res.json(await getBlueReturnStatement(businessId, from, to));
  })
);

reportsRouter.get(
  "/partner-balances",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    res.json(await getPartnerBalances(businessId));
  })
);

reportsRouter.get(
  "/monthly-trend",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const months = Math.min(Math.max(Number(req.query.months) || 12, 1), 24);
    res.json(await getMonthlyTrend(businessId, months));
  })
);

reportsRouter.get(
  "/journal-book",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);
    const entries = await getJournalBook(businessId, from, to);
    res.json(entries);
  })
);
