import { prisma } from "../lib/prisma.js";

// 標準税率10%における国税(7.8%)・地方消費税(2.2%)の按分比率
const NATIONAL_RATIO_STANDARD = 7.8 / 10;
// 軽減税率8%における国税(6.24%)・地方消費税(1.76%)の按分比率
const NATIONAL_RATIO_REDUCED = 6.24 / 8;

// 簡易課税のみなし仕入率(事業区分ごと)
const DEEMED_PURCHASE_RATES: Record<number, { label: string; rate: number }> = {
  1: { label: "第一種事業(卸売業)", rate: 0.9 },
  2: { label: "第二種事業(小売業)", rate: 0.8 },
  3: { label: "第三種事業(製造業等)", rate: 0.7 },
  4: { label: "第四種事業(その他・飲食店業等)", rate: 0.6 },
  5: { label: "第五種事業(サービス業等)", rate: 0.5 },
  6: { label: "第六種事業(不動産業)", rate: 0.4 },
};

interface RateGroup {
  base: number; // 税抜金額
  tax: number; // 消費税額
}

function emptyRateGroup(): RateGroup {
  return { base: 0, tax: 0 };
}

function splitNationalLocal(tax: number, isReducedRate: boolean) {
  const ratio = isReducedRate ? NATIONAL_RATIO_REDUCED : NATIONAL_RATIO_STANDARD;
  const national = Math.floor(tax * ratio);
  return { national, local: tax - national };
}

export async function getConsumptionTaxReturn(businessId: string, from: Date, to: Date) {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });

  const lines = await prisma.journalEntryLine.findMany({
    where: {
      account: { businessId },
      journalEntry: { status: "CONFIRMED", entryDate: { gte: from, lte: to } },
      taxCategoryId: { not: null },
    },
    include: { taxCategory: true },
  });

  const sales = { standard: emptyRateGroup(), reduced: emptyRateGroup() };
  const purchases = { standard: emptyRateGroup(), reduced: emptyRateGroup() };
  let exemptSales = 0;
  let outOfScopeSales = 0;
  let exportSales = 0;

  for (const line of lines) {
    const tc = line.taxCategory;
    if (!tc) continue;
    const base = line.amount - line.taxAmount;

    if (tc.kind === "TAXABLE_SALES") {
      const group = tc.isReducedRate ? sales.reduced : sales.standard;
      group.base += base;
      group.tax += line.taxAmount;
    } else if (tc.kind === "TAXABLE_PURCHASE") {
      const group = tc.isReducedRate ? purchases.reduced : purchases.standard;
      group.base += base;
      group.tax += line.taxAmount;
    } else if (tc.kind === "EXEMPT") {
      exemptSales += line.amount;
    } else if (tc.kind === "OUT_OF_SCOPE") {
      outOfScopeSales += line.amount;
    } else if (tc.kind === "EXPORT") {
      exportSales += line.amount;
    }
  }

  const outputTaxStandard = splitNationalLocal(sales.standard.tax, false);
  const outputTaxReduced = splitNationalLocal(sales.reduced.tax, true);
  const totalOutputTax = sales.standard.tax + sales.reduced.tax;

  if (business.taxationType === "EXEMPT") {
    return {
      business: { name: business.name, taxationType: business.taxationType },
      period: { from, to },
      isExempt: true,
      taxableSales: { standard: sales.standard, reduced: sales.reduced },
      outputTax: { standard: outputTaxStandard, reduced: outputTaxReduced, total: totalOutputTax },
      exemptSales,
      outOfScopeSales,
      exportSales,
    } as const;
  }

  if (business.taxationType === "SIMPLIFIED") {
    const category = DEEMED_PURCHASE_RATES[business.simplifiedTaxCategory] ?? DEEMED_PURCHASE_RATES[5];
    const deemedInputTax = Math.floor(totalOutputTax * category.rate);
    const payableTax = Math.max(0, totalOutputTax - deemedInputTax);
    const { national: payableNational, local: payableLocal } = splitNationalLocal(
      payableTax,
      false // 概算のため標準税率の按分比で計算(参考値)
    );

    return {
      business: { name: business.name, taxationType: business.taxationType },
      period: { from, to },
      isExempt: false,
      taxableSales: { standard: sales.standard, reduced: sales.reduced },
      outputTax: { standard: outputTaxStandard, reduced: outputTaxReduced, total: totalOutputTax },
      exemptSales,
      outOfScopeSales,
      exportSales,
      simplified: {
        businessCategory: business.simplifiedTaxCategory,
        businessCategoryLabel: category.label,
        deemedPurchaseRate: category.rate,
        deemedInputTax,
      },
      payableTax: { national: payableNational, local: payableLocal, total: payableTax },
    } as const;
  }

  // GENERAL(本則課税)
  const inputTaxStandard = splitNationalLocal(purchases.standard.tax, false);
  const inputTaxReduced = splitNationalLocal(purchases.reduced.tax, true);
  const totalInputTax = purchases.standard.tax + purchases.reduced.tax;
  const payableTax = Math.max(0, totalOutputTax - totalInputTax);
  const payableNational = Math.max(0, outputTaxStandard.national + outputTaxReduced.national - inputTaxStandard.national - inputTaxReduced.national);
  const payableLocal = Math.max(0, payableTax - payableNational);

  return {
    business: { name: business.name, taxationType: business.taxationType },
    period: { from, to },
    isExempt: false,
    taxableSales: { standard: sales.standard, reduced: sales.reduced },
    outputTax: { standard: outputTaxStandard, reduced: outputTaxReduced, total: totalOutputTax },
    exemptSales,
    outOfScopeSales,
    exportSales,
    taxablePurchases: { standard: purchases.standard, reduced: purchases.reduced },
    inputTax: { standard: inputTaxStandard, reduced: inputTaxReduced, total: totalInputTax },
    payableTax: { national: payableNational, local: payableLocal, total: payableTax },
  } as const;
}

export function getSimplifiedTaxCategories() {
  return Object.entries(DEEMED_PURCHASE_RATES).map(([id, v]) => ({ id: Number(id), label: v.label, rate: v.rate }));
}
