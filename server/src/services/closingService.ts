import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/httpError.js";
import { generateDepreciationSchedule, sumDepreciationInRange } from "../lib/depreciation.js";
import type { DepreciationMethod } from "../lib/depreciation.js";
import { getBalanceSheet, getProfitAndLoss } from "./reportsService.js";
import { getOrCreateFiscalYearForDate } from "./fiscalYearService.js";
import { postDepreciationForFiscalYear } from "./fixedAssetService.js";

async function resolveFiscalYear(businessId: string, fiscalYearId?: string) {
  if (fiscalYearId) {
    const fy = await prisma.fiscalYear.findFirst({ where: { id: fiscalYearId, businessId } });
    if (!fy) notFound("会計期間が見つかりません");
    return fy!;
  }
  return getOrCreateFiscalYearForDate(businessId, new Date());
}

async function depreciationRows(businessId: string, fiscalYearId: string, from: Date, to: Date) {
  const assets = await prisma.fixedAsset.findMany({
    where: { businessId, status: "ACTIVE" },
    include: { depreciations: true },
    orderBy: { acquisitionDate: "asc" },
  });
  return assets.map((a) => {
    const schedule = generateDepreciationSchedule({
      method: a.depreciationMethod as DepreciationMethod,
      acquisitionCost: a.acquisitionCost,
      residualValue: a.residualValue,
      usefulLifeYears: a.usefulLifeYears,
      acquisitionDate: a.acquisitionDate,
    });
    const scheduledAmount = sumDepreciationInRange(schedule, from, to);
    const postedRecord = a.depreciations.find((d) => d.fiscalYearId === fiscalYearId);
    return {
      id: a.id,
      name: a.name,
      scheduledAmount,
      posted: Boolean(postedRecord),
      postedAmount: postedRecord?.amount ?? 0,
    };
  });
}

/**
 * 期末処理(決算)の状況を点検して返す。損益振替仕訳は当アプリが当期純利益を
 * 自動算出するモデルのため生成せず、代わりに決算整理のチェックリストを提供する。
 */
export async function getYearEndClosing(businessId: string, fiscalYearId?: string) {
  const fy = await resolveFiscalYear(businessId, fiscalYearId);
  const [pl, bs, deps] = await Promise.all([
    getProfitAndLoss(businessId, fy.startDate, fy.endDate),
    getBalanceSheet(businessId, fy.startDate, fy.endDate),
    depreciationRows(businessId, fy.id, fy.startDate, fy.endDate),
  ]);

  const pendingDeps = deps.filter((d) => !d.posted && d.scheduledAmount > 0);

  const checklist = [
    {
      key: "depreciation",
      label: "固定資産の減価償却費を計上する",
      status: deps.length === 0 ? "info" : pendingDeps.length === 0 ? "done" : "pending",
      detail:
        deps.length === 0
          ? "対象の固定資産がありません"
          : pendingDeps.length === 0
            ? "すべての固定資産で当期の減価償却を計上済みです"
            : `未計上 ${pendingDeps.length} 件(計 ${pendingDeps.reduce((s, d) => s + d.scheduledAmount, 0)} 円)`,
    },
    {
      key: "balance",
      label: "貸借対照表の貸借が一致している",
      status: bs.balanced ? "done" : "pending",
      detail: bs.balanced
        ? "資産 = 負債 + 純資産 で一致しています"
        : `不一致: 資産 ${bs.totalAssets} / 負債+純資産 ${bs.totalLiabilitiesAndEquity}`,
    },
    {
      key: "netIncome",
      label: "当期純利益の確認",
      status: "info" as const,
      detail: `当期純利益(見込み) ${pl.summary.netIncome} 円`,
    },
  ];

  return {
    fiscalYear: { id: fy.id, startDate: fy.startDate, endDate: fy.endDate, status: fy.status },
    summary: {
      sales: pl.summary.sales,
      netIncome: pl.summary.netIncome,
      totalAssets: bs.totalAssets,
      totalLiabilitiesAndEquity: bs.totalLiabilitiesAndEquity,
      balanced: bs.balanced,
    },
    depreciation: {
      assets: deps,
      pendingCount: pendingDeps.length,
      pendingTotal: pendingDeps.reduce((s, d) => s + d.scheduledAmount, 0),
    },
    checklist,
  };
}

/**
 * 当期に未計上の全固定資産について、減価償却費を一括で仕訳計上する(期末処理の自動化)。
 */
export async function postAllDepreciation(businessId: string, fiscalYearId?: string) {
  const fy = await resolveFiscalYear(businessId, fiscalYearId);
  const deps = await depreciationRows(businessId, fy.id, fy.startDate, fy.endDate);
  const pending = deps.filter((d) => !d.posted && d.scheduledAmount > 0);

  let posted = 0;
  let totalAmount = 0;
  const errors: { name: string; message: string }[] = [];

  for (const asset of pending) {
    try {
      await postDepreciationForFiscalYear(businessId, asset.id, fy.id);
      posted++;
      totalAmount += asset.scheduledAmount;
    } catch (e) {
      errors.push({ name: asset.name, message: e instanceof Error ? e.message : "計上に失敗しました" });
    }
  }

  return { posted, totalAmount, errors, fiscalYearId: fy.id };
}
