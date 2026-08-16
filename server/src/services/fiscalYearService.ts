import { prisma } from "../lib/prisma.js";
import { computeCurrentFiscalYearRange } from "./businessService.js";
import type { BusinessType } from "../lib/enums.js";

export async function getOrCreateFiscalYearForDate(businessId: string, date: Date) {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  const { startDate, endDate } = computeCurrentFiscalYearRange(
    business.type as BusinessType,
    business.fiscalYearStartMonth,
    date
  );

  const existing = await prisma.fiscalYear.findFirst({
    where: { businessId, startDate },
  });
  if (existing) return existing;

  return prisma.fiscalYear.create({
    data: { businessId, startDate, endDate, status: "OPEN" },
  });
}
