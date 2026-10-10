import { prisma } from "../lib/prisma.js";
import { DEFAULT_TAX_CATEGORIES, getDefaultAccounts } from "../lib/defaultAccounts.js";
import type { BusinessType, TaxationType } from "../lib/enums.js";

export async function ensureTaxCategoriesSeeded() {
  for (const tc of DEFAULT_TAX_CATEGORIES) {
    await prisma.taxCategory.upsert({
      where: { code: tc.code },
      update: { name: tc.name, rate: tc.rate, kind: tc.kind, isReducedRate: tc.isReducedRate },
      create: tc,
    });
  }
}

export function computeCurrentFiscalYearRange(
  type: BusinessType,
  fiscalYearStartMonth: number,
  reference: Date = new Date()
) {
  const startMonth = type === "INDIVIDUAL" ? 1 : fiscalYearStartMonth;
  const refY = reference.getUTCFullYear();
  const refM = reference.getUTCMonth() + 1; // 1-12

  // 直近の「開始月1日」で、参照日以前のものを期首とする
  let startYear = refM >= startMonth ? refY : refY - 1;
  const startDate = new Date(Date.UTC(startYear, startMonth - 1, 1));
  const endDate = new Date(Date.UTC(startYear + 1, startMonth - 1, 1) - 1); // 翌年の開始月1日の前日

  return { startDate, endDate };
}

export interface CreateBusinessInput {
  name: string;
  type: BusinessType;
  representativeName?: string;
  invoiceRegistrationNumber?: string | null;
  postalCode?: string;
  address?: string;
  fiscalYearStartMonth?: number;
  taxationType?: TaxationType;
}

export async function createBusinessWithDefaults(ownerId: string, input: CreateBusinessInput) {
  await ensureTaxCategoriesSeeded();

  const business = await prisma.business.create({
    data: {
      ownerId,
      name: input.name,
      type: input.type,
      representativeName: input.representativeName,
      invoiceRegistrationNumber: input.invoiceRegistrationNumber,
      postalCode: input.postalCode,
      address: input.address,
      fiscalYearStartMonth: input.type === "INDIVIDUAL" ? 1 : input.fiscalYearStartMonth ?? 4,
      taxationType: input.taxationType ?? "EXEMPT",
    },
  });

  const taxCategories = await prisma.taxCategory.findMany();
  const taxCategoryIdByCode = new Map(taxCategories.map((t) => [t.code, t.id]));

  const defs = getDefaultAccounts(input.type as BusinessType);
  await prisma.account.createMany({
    data: defs.map((d, i) => ({
      businessId: business.id,
      code: d.code,
      name: d.name,
      category: d.category,
      subcategory: d.subcategory,
      normalBalance: d.normalBalance,
      isDefault: true,
      displayOrder: i,
      defaultTaxCategoryId: d.defaultTaxCategoryCode
        ? taxCategoryIdByCode.get(d.defaultTaxCategoryCode)
        : undefined,
    })),
  });

  const { startDate, endDate } = computeCurrentFiscalYearRange(
    input.type as BusinessType,
    business.fiscalYearStartMonth
  );
  const fiscalYear = await prisma.fiscalYear.create({
    data: {
      businessId: business.id,
      startDate,
      endDate,
      status: "OPEN",
    },
  });

  return { business, fiscalYear };
}
