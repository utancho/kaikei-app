import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/httpError.js";
import { generateDepreciationSchedule, sumDepreciationInRange } from "../lib/depreciation.js";
import type { DepreciationMethod } from "../lib/depreciation.js";

export interface FixedAssetInput {
  name: string;
  assetAccountId: string;
  expenseAccountId: string;
  acquisitionDate: Date;
  acquisitionCost: number;
  residualValue?: number;
  usefulLifeYears: number;
  depreciationMethod: DepreciationMethod;
  memo?: string;
}

async function assertAccountsBelong(businessId: string, accountIds: string[]) {
  const found = await prisma.account.findMany({ where: { id: { in: accountIds }, businessId }, select: { id: true } });
  if (found.length !== new Set(accountIds).size) badRequest("指定された勘定科目が見つかりません");
}

// FixedAsset の assetAccountId / expenseAccountId は Prisma の @relation を張らず
// 単純な文字列FKとして保持しているため、口座名の解決はここで手動で行う。
async function attachAccountNames<T extends { assetAccountId: string; expenseAccountId: string }>(
  businessId: string,
  assets: T[]
) {
  const accountIds = [...new Set(assets.flatMap((a) => [a.assetAccountId, a.expenseAccountId]))];
  const accounts = await prisma.account.findMany({ where: { id: { in: accountIds }, businessId } });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return assets.map((a) => ({
    ...a,
    assetAccount: byId.get(a.assetAccountId) ?? null,
    expenseAccount: byId.get(a.expenseAccountId) ?? null,
  }));
}

export async function listFixedAssets(businessId: string) {
  const assets = await prisma.fixedAsset.findMany({
    where: { businessId },
    include: { depreciations: true },
    orderBy: { acquisitionDate: "desc" },
  });
  const withNames = await attachAccountNames(businessId, assets);
  // 帳簿価額は「実際に仕訳計上済みの減価償却費」に基づいて算出する(未計上の期間分は含めない)。
  return withNames.map((a) => {
    const postedTotal = a.depreciations.reduce((s, d) => s + d.amount, 0);
    return { ...a, currentBookValue: a.acquisitionCost - postedTotal };
  });
}

export async function getFixedAsset(businessId: string, id: string) {
  const asset = await prisma.fixedAsset.findFirst({
    where: { id, businessId },
    include: { depreciations: { orderBy: { postedAt: "asc" } } },
  });
  if (!asset) notFound("固定資産が見つかりません");

  const schedule = generateDepreciationSchedule({
    method: asset!.depreciationMethod as DepreciationMethod,
    acquisitionCost: asset!.acquisitionCost,
    residualValue: asset!.residualValue,
    usefulLifeYears: asset!.usefulLifeYears,
    acquisitionDate: asset!.acquisitionDate,
  });

  const [withNames] = await attachAccountNames(businessId, [asset!]);
  const postedTotal = asset!.depreciations.reduce((s, d) => s + d.amount, 0);
  const currentBookValue = asset!.acquisitionCost - postedTotal;
  return { ...withNames, schedule, currentBookValue };
}

export async function createFixedAsset(businessId: string, input: FixedAssetInput) {
  await assertAccountsBelong(businessId, [input.assetAccountId, input.expenseAccountId]);
  if (input.acquisitionCost <= 0) badRequest("取得価額は1円以上で入力してください");
  if (input.usefulLifeYears <= 0) badRequest("耐用年数は1年以上で入力してください");

  return prisma.fixedAsset.create({
    data: {
      businessId,
      name: input.name,
      assetAccountId: input.assetAccountId,
      expenseAccountId: input.expenseAccountId,
      acquisitionDate: input.acquisitionDate,
      acquisitionCost: input.acquisitionCost,
      residualValue: input.residualValue ?? 1,
      usefulLifeYears: input.usefulLifeYears,
      depreciationMethod: input.depreciationMethod,
      memo: input.memo,
    },
  });
}

export async function deleteFixedAsset(businessId: string, id: string) {
  const asset = await prisma.fixedAsset.findFirst({ where: { id, businessId } });
  if (!asset) notFound("固定資産が見つかりません");
  await prisma.fixedAsset.delete({ where: { id } });
}

export async function postDepreciationForFiscalYear(businessId: string, assetId: string, fiscalYearId: string) {
  const asset = await prisma.fixedAsset.findFirst({ where: { id: assetId, businessId } });
  if (!asset) notFound("固定資産が見つかりません");

  const fiscalYear = await prisma.fiscalYear.findFirst({ where: { id: fiscalYearId, businessId } });
  if (!fiscalYear) notFound("会計期間が見つかりません");

  const existing = await prisma.fixedAssetDepreciation.findUnique({
    where: { fixedAssetId_fiscalYearId: { fixedAssetId: assetId, fiscalYearId } },
  });
  if (existing) badRequest("この会計期間の減価償却費は既に計上済みです");

  const schedule = generateDepreciationSchedule({
    method: asset!.depreciationMethod as DepreciationMethod,
    acquisitionCost: asset!.acquisitionCost,
    residualValue: asset!.residualValue,
    usefulLifeYears: asset!.usefulLifeYears,
    acquisitionDate: asset!.acquisitionDate,
  });
  const amount = sumDepreciationInRange(schedule, fiscalYear.startDate, fiscalYear.endDate);
  if (amount <= 0) badRequest("この会計期間に計上すべき減価償却費はありません");

  const last = await prisma.journalEntry.findFirst({ where: { businessId }, orderBy: { entryNumber: "desc" }, select: { entryNumber: true } });
  const entryNumber = (last?.entryNumber ?? 0) + 1;

  const entry = await prisma.journalEntry.create({
    data: {
      businessId,
      fiscalYearId,
      entryNumber,
      entryDate: fiscalYear.endDate < new Date() ? fiscalYear.endDate : new Date(),
      description: `減価償却費計上(${asset!.name})`,
      status: "CONFIRMED",
      source: "MANUAL",
      lines: {
        create: [
          { lineNumber: 1, side: "DEBIT", accountId: asset!.expenseAccountId, amount },
          { lineNumber: 2, side: "CREDIT", accountId: asset!.assetAccountId, amount },
        ],
      },
    },
  });

  await prisma.fixedAssetDepreciation.create({
    data: { fixedAssetId: assetId, fiscalYearId, amount, journalEntryId: entry.id },
  });

  return entry;
}
