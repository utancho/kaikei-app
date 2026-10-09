import { prisma, requestDatabase } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/httpError.js";
import { assertLineReferences, attachLineReferences } from "../lib/businessReferences.js";
import type { z } from "zod";
import type { templateInputSchema } from "../lib/zodSchemas.js";

export type TemplateInput = z.infer<typeof templateInputSchema>;

async function assertAccountsBelong(businessId: string, accountIds: string[]) {
  const unique = [...new Set(accountIds)];
  const found = await prisma.account.findMany({ where: { id: { in: unique }, businessId }, select: { id: true } });
  if (found.length !== unique.length) badRequest("指定された勘定科目が見つかりません");
}

export async function listTemplates(businessId: string) {
  const templates = await prisma.journalEntryTemplate.findMany({
    where: { businessId },
    include: { lines: { include: { taxCategory: true }, orderBy: { lineNumber: "asc" } } },
    orderBy: { displayOrder: "asc" },
  });
  const lines = await attachLineReferences(businessId, templates.flatMap(t => t.lines));
  const byId = new Map(lines.map(l => [l.id, l]));
  return templates.map(t => ({ ...t, lines: t.lines.map(l => byId.get(l.id)!) }));
}

export async function createTemplate(businessId: string, input: TemplateInput) {
  await assertLineReferences(businessId, input.lines);
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
  await assertLineReferences(businessId, input.lines);
  const existing = await prisma.journalEntryTemplate.findFirst({ where: { id, businessId } });
  if (!existing) notFound("テンプレートが見つかりません");
  await assertAccountsBelong(businessId, input.lines.map((l) => l.accountId));

  const db = requestDatabase();
  await db.batch([
    db.prepare('DELETE FROM JournalEntryTemplateLine WHERE templateId=?').bind(id),
    db.prepare('UPDATE JournalEntryTemplate SET name=?,description=? WHERE id=? AND businessId=?').bind(input.name, input.description ?? null, id, businessId),
    ...input.lines.map((l, i) => db.prepare('INSERT INTO JournalEntryTemplateLine(id,templateId,lineNumber,side,accountId,partnerId,taxCategoryId,amountDefault,description) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(), id, i+1, l.side, l.accountId, l.partnerId || null, l.taxCategoryId || null, l.amountDefault ?? null, l.description ?? null)),
  ]);
  return prisma.journalEntryTemplate.findUniqueOrThrow({ where: { id }, include: { lines: true } });
}

export async function deleteTemplate(businessId: string, id: string) {
  const existing = await prisma.journalEntryTemplate.findFirst({ where: { id, businessId } });
  if (!existing) notFound("テンプレートが見つかりません");
  await prisma.journalEntryTemplate.delete({ where: { id } });
}
