import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/httpError.js";
import type { z } from "zod";
import type { templateInputSchema } from "../lib/zodSchemas.js";

export type TemplateInput = z.infer<typeof templateInputSchema>;

async function assertAccountsBelong(businessId: string, accountIds: string[]) {
  const unique = [...new Set(accountIds)];
  const found = await prisma.account.findMany({ where: { id: { in: unique }, businessId }, select: { id: true } });
  if (found.length !== unique.length) badRequest("指定された勘定科目が見つかりません");
}

export async function listTemplates(businessId: string) {
  return prisma.journalEntryTemplate.findMany({
    where: { businessId },
    include: { lines: { include: { account: true, partner: true, taxCategory: true }, orderBy: { lineNumber: "asc" } } },
    orderBy: { displayOrder: "asc" },
  });
}

export async function createTemplate(businessId: string, input: TemplateInput) {
  await assertAccountsBelong(businessId, input.lines.map((l) => l.accountId));
  const maxOrder = await prisma.journalEntryTemplate.aggregate({ where: { businessId }, _max: { displayOrder: true } });

  return prisma.journalEntryTemplate.create({
    data: {
      businessId,
      name: input.name,
      description: input.description,
      displayOrder: (maxOrder._max.displayOrder ?? 0) + 1,
      lines: {
        create: input.lines.map((l, i) => ({
          lineNumber: i + 1,
          side: l.side,
          accountId: l.accountId,
          partnerId: l.partnerId || undefined,
          taxCategoryId: l.taxCategoryId || undefined,
          amountDefault: l.amountDefault || undefined,
          description: l.description,
        })),
      },
    },
    include: { lines: true },
  });
}

export async function updateTemplate(businessId: string, id: string, input: TemplateInput) {
  const existing = await prisma.journalEntryTemplate.findFirst({ where: { id, businessId } });
  if (!existing) notFound("テンプレートが見つかりません");
  await assertAccountsBelong(businessId, input.lines.map((l) => l.accountId));

  return prisma.$transaction(async (tx) => {
    await tx.journalEntryTemplateLine.deleteMany({ where: { templateId: id } });
    return tx.journalEntryTemplate.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        lines: {
          create: input.lines.map((l, i) => ({
            lineNumber: i + 1,
            side: l.side,
            accountId: l.accountId,
            partnerId: l.partnerId || undefined,
            taxCategoryId: l.taxCategoryId || undefined,
            amountDefault: l.amountDefault || undefined,
            description: l.description,
          })),
        },
      },
      include: { lines: true },
    });
  });
}

export async function deleteTemplate(businessId: string, id: string) {
  const existing = await prisma.journalEntryTemplate.findFirst({ where: { id, businessId } });
  if (!existing) notFound("テンプレートが見つかりません");
  await prisma.journalEntryTemplate.delete({ where: { id } });
}
