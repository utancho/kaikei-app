import { prisma } from "../src/lib/prisma.js";
import { createBusinessWithDefaults } from "../src/services/businessService.js";

async function main() {
  const existing = await prisma.business.findFirst();
  if (existing) {
    console.log("Business already exists, skipping seed:", existing.name);
    return;
  }

  const { business, fiscalYear } = await createBusinessWithDefaults({
    name: "サンプル商店",
    type: "INDIVIDUAL",
    representativeName: "山田 太郎",
    taxationType: "EXEMPT",
  });

  const partner = await prisma.partner.create({
    data: {
      businessId: business.id,
      name: "株式会社サンプル取引先",
      kana: "サンプルトリヒキサキ",
      type: "CUSTOMER",
    },
  });

  const cash = await prisma.account.findFirstOrThrow({
    where: { businessId: business.id, code: "1030" }, // 普通預金
  });
  const sales = await prisma.account.findFirstOrThrow({
    where: { businessId: business.id, code: "4010" }, // 売上高
  });
  const supplies = await prisma.account.findFirstOrThrow({
    where: { businessId: business.id, code: "6150" }, // 消耗品費
  });
  const capital = await prisma.account.findFirstOrThrow({
    where: { businessId: business.id, code: "3010" }, // 元入金
  });

  await prisma.journalEntry.create({
    data: {
      businessId: business.id,
      fiscalYearId: fiscalYear.id,
      entryNumber: 1,
      entryDate: fiscalYear.startDate,
      description: "開業時元入れ",
      status: "CONFIRMED",
      source: "MANUAL",
      lines: {
        create: [
          { lineNumber: 1, side: "DEBIT", accountId: cash.id, amount: 500000 },
          { lineNumber: 2, side: "CREDIT", accountId: capital.id, amount: 500000 },
        ],
      },
    },
  });

  await prisma.journalEntry.create({
    data: {
      businessId: business.id,
      fiscalYearId: fiscalYear.id,
      entryNumber: 2,
      entryDate: new Date(),
      description: "売上代金の入金",
      status: "CONFIRMED",
      source: "MANUAL",
      lines: {
        create: [
          {
            lineNumber: 1,
            side: "DEBIT",
            accountId: cash.id,
            amount: 33000,
            partnerId: partner.id,
          },
          {
            lineNumber: 2,
            side: "CREDIT",
            accountId: sales.id,
            amount: 33000,
            partnerId: partner.id,
          },
        ],
      },
    },
  });

  await prisma.journalEntry.create({
    data: {
      businessId: business.id,
      fiscalYearId: fiscalYear.id,
      entryNumber: 3,
      entryDate: new Date(),
      description: "文房具購入",
      status: "CONFIRMED",
      source: "MANUAL",
      lines: {
        create: [
          { lineNumber: 1, side: "DEBIT", accountId: supplies.id, amount: 2200 },
          { lineNumber: 2, side: "CREDIT", accountId: cash.id, amount: 2200 },
        ],
      },
    },
  });

  console.log("Seed complete:", business.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
