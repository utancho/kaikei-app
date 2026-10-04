import { prisma } from "../lib/prisma.js";
import { notFound, badRequest } from "../lib/httpError.js";
import type { z } from "zod";
import type { invoiceInputSchema } from "../lib/zodSchemas.js";
import { getOrCreateFiscalYearForDate } from "./fiscalYearService.js";
import { isEmailEnabled, renderEmail, sendEmail } from "./emailService.js";
import type { Bindings } from "../types/env.js";

export type InvoiceInput = z.infer<typeof invoiceInputSchema>;

interface Computed {
  items: { lineNumber: number; description: string; quantity: number; unitPrice: number; amount: number; taxCategoryId?: string | null }[];
  subtotal: number;
  taxAmount: number;
  total: number;
}

async function computeInvoiceTotals(items: InvoiceInput["items"]): Promise<Computed> {
  const taxCategories = await prisma.taxCategory.findMany();
  const rateById = new Map(taxCategories.map((t) => [t.id, t.rate]));

  const computedItems = items.map((it, i) => ({
    lineNumber: i + 1,
    description: it.description,
    quantity: it.quantity ?? 1,
    unitPrice: it.unitPrice,
    amount: Math.round((it.quantity ?? 1) * it.unitPrice),
    taxCategoryId: it.taxCategoryId ?? null,
  }));

  const subtotal = computedItems.reduce((s, it) => s + it.amount, 0);

  // インボイス制度対応: 税率ごとに区分して端数処理
  const groupByRate = new Map<number, number>();
  for (const it of computedItems) {
    const rate = it.taxCategoryId ? (rateById.get(it.taxCategoryId) ?? 0) : 0;
    groupByRate.set(rate, (groupByRate.get(rate) ?? 0) + it.amount);
  }
  let taxAmount = 0;
  for (const [rate, groupSubtotal] of groupByRate) {
    taxAmount += Math.round(groupSubtotal * rate);
  }

  return { items: computedItems, subtotal, taxAmount, total: subtotal + taxAmount };
}

export async function listInvoices(businessId: string) {
  return prisma.invoice.findMany({
    where: { businessId },
    include: { partner: true, items: true },
    orderBy: { issueDate: "desc" },
  });
}

export async function getInvoice(businessId: string, id: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId },
    include: { partner: true, items: { include: { taxCategory: true } } },
  });
  if (!invoice) notFound("請求書が見つかりません");
  return invoice;
}

export async function createInvoice(businessId: string, input: InvoiceInput) {
  const partner = await prisma.partner.findFirst({ where: { id: input.partnerId, businessId } });
  if (!partner) badRequest("取引先が見つかりません");

  const totals = await computeInvoiceTotals(input.items);

  return prisma.invoice.create({
    data: {
      businessId,
      partnerId: input.partnerId,
      invoiceNumber: input.invoiceNumber,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      status: input.status ?? "DRAFT",
      notes: input.notes,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      total: totals.total,
      items: { create: totals.items },
    },
    include: { items: true, partner: true },
  });
}

export async function updateInvoice(businessId: string, id: string, input: InvoiceInput) {
  const existing = await prisma.invoice.findFirst({ where: { id, businessId } });
  if (!existing) notFound("請求書が見つかりません");

  const totals = await computeInvoiceTotals(input.items);

  return prisma.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
    return tx.invoice.update({
      where: { id },
      data: {
        partnerId: input.partnerId,
        invoiceNumber: input.invoiceNumber,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        status: input.status ?? existing.status,
        notes: input.notes,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
        items: { create: totals.items },
      },
      include: { items: true, partner: true },
    });
  });
}

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const ymd = (d: Date) =>
  new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(d);

/** 請求書を取引先のメールアドレス宛に送信する。 */
export async function sendInvoiceEmail(env: Bindings, businessId: string, id: string) {
  if (!isEmailEnabled(env)) {
    badRequest("メール送信が未設定です。RESEND_API_KEY と MAIL_FROM を設定してください");
  }
  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId },
    include: { partner: true, items: true },
  });
  if (!invoice) notFound("請求書が見つかりません");
  if (!invoice!.partner.email) badRequest("取引先にメールアドレスが登録されていません");

  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });

  const rows = invoice!.items
    .map(
      (it) =>
        `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${it.description}</td>` +
        `<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${it.quantity}</td>` +
        `<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${yen(it.unitPrice)}</td>` +
        `<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${yen(it.amount)}</td></tr>`
    )
    .join("");

  const bodyHtml =
    `<p>${invoice!.partner.name} 御中</p>` +
    `<p>いつもお世話になっております。${business.name} です。<br>下記のとおりご請求申し上げます。</p>` +
    `<p>請求書番号: <strong>${invoice!.invoiceNumber}</strong><br>` +
    `発行日: ${ymd(invoice!.issueDate)}` +
    (invoice!.dueDate ? `<br>お支払期限: ${ymd(invoice!.dueDate)}` : "") +
    `</p>` +
    `<table style="border-collapse:collapse;width:100%;font-size:13px;margin:12px 0;">` +
    `<thead><tr style="background:#f3f4f6;"><th style="padding:4px 8px;text-align:left;">品目</th>` +
    `<th style="padding:4px 8px;text-align:right;">数量</th><th style="padding:4px 8px;text-align:right;">単価</th>` +
    `<th style="padding:4px 8px;text-align:right;">金額</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<p style="text-align:right;">小計: ${yen(invoice!.subtotal)}<br>消費税: ${yen(invoice!.taxAmount)}<br>` +
    `<strong style="font-size:16px;">合計: ${yen(invoice!.total)}</strong></p>` +
    (invoice!.notes ? `<p style="color:#6b7280;">${invoice!.notes}</p>` : "");

  const result = await sendEmail(env, {
    to: invoice!.partner.email!,
    subject: `【${business.name}】請求書 ${invoice!.invoiceNumber} のご送付`,
    html: renderEmail({ heading: `請求書 ${invoice!.invoiceNumber}`, bodyHtml }),
  });
  if (!result.sent) badRequest(result.reason ?? "メール送信に失敗しました");

  return { sent: true, to: invoice!.partner.email };
}

export async function deleteInvoice(businessId: string, id: string) {
  const existing = await prisma.invoice.findFirst({ where: { id, businessId } });
  if (!existing) notFound("請求書が見つかりません");
  await prisma.invoice.delete({ where: { id } });
}

// 請求書を仕訳(売掛金/売上高)に計上する
export async function postInvoiceToJournal(businessId: string, id: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId },
    include: { items: true, partner: true },
  });
  if (!invoice) notFound("請求書が見つかりません");

  const receivable = await prisma.account.findFirst({
    where: { businessId, code: "1110" }, // 売掛金
  });
  const sales = await prisma.account.findFirst({ where: { businessId, code: "4010" } }); // 売上高
  const salesTax = await prisma.account.findFirst({ where: { businessId, code: "2055" } }); // 仮受消費税等
  if (!receivable || !sales) badRequest("売掛金/売上高の勘定科目が見つかりません");

  const fiscalYear = await getOrCreateFiscalYearForDate(businessId, invoice.issueDate);
  const last = await prisma.journalEntry.findFirst({
    where: { businessId },
    orderBy: { entryNumber: "desc" },
    select: { entryNumber: true },
  });
  const entryNumber = (last?.entryNumber ?? 0) + 1;

  const lines = [
    {
      lineNumber: 1,
      side: "DEBIT",
      accountId: receivable!.id,
      partnerId: invoice.partnerId,
      amount: invoice.total,
    },
    {
      lineNumber: 2,
      side: "CREDIT",
      accountId: sales!.id,
      partnerId: invoice.partnerId,
      amount: invoice.subtotal,
    },
  ];
  if (invoice.taxAmount > 0 && salesTax) {
    lines.push({
      lineNumber: 3,
      side: "CREDIT",
      accountId: salesTax.id,
      partnerId: invoice.partnerId,
      amount: invoice.taxAmount,
    });
  }

  const entry = await prisma.journalEntry.create({
    data: {
      businessId,
      fiscalYearId: fiscalYear.id,
      entryNumber,
      entryDate: invoice.issueDate,
      description: `請求書 ${invoice.invoiceNumber} (${invoice.partner.name})`,
      status: "CONFIRMED",
      source: "INVOICE",
      lines: { create: lines },
    },
    include: { lines: true },
  });

  await prisma.invoice.update({ where: { id }, data: { status: "SENT" } });

  return entry;
}

// 請求書の入金を記録し、売掛金を消し込む(借方:入金口座 / 貸方:売掛金)
export async function recordInvoicePayment(
  businessId: string,
  id: string,
  paymentAccountId: string,
  paymentDate: Date
) {
  const invoice = await prisma.invoice.findFirst({ where: { id, businessId }, include: { partner: true } });
  if (!invoice) notFound("請求書が見つかりません");
  if (invoice!.status !== "SENT") badRequest("入金消込は「計上済み」の請求書のみ行えます");

  const paymentAccount = await prisma.account.findFirst({ where: { id: paymentAccountId, businessId } });
  if (!paymentAccount) badRequest("入金口座が見つかりません");

  const receivable = await prisma.account.findFirst({ where: { businessId, code: "1110" } }); // 売掛金
  if (!receivable) badRequest("売掛金の勘定科目が見つかりません");

  const fiscalYear = await getOrCreateFiscalYearForDate(businessId, paymentDate);
  const last = await prisma.journalEntry.findFirst({
    where: { businessId },
    orderBy: { entryNumber: "desc" },
    select: { entryNumber: true },
  });
  const entryNumber = (last?.entryNumber ?? 0) + 1;

  const entry = await prisma.journalEntry.create({
    data: {
      businessId,
      fiscalYearId: fiscalYear.id,
      entryNumber,
      entryDate: paymentDate,
      description: `入金消込 請求書 ${invoice!.invoiceNumber} (${invoice!.partner.name})`,
      status: "CONFIRMED",
      source: "INVOICE",
      lines: {
        create: [
          { lineNumber: 1, side: "DEBIT", accountId: paymentAccount.id, partnerId: invoice!.partnerId, amount: invoice!.total },
          { lineNumber: 2, side: "CREDIT", accountId: receivable.id, partnerId: invoice!.partnerId, amount: invoice!.total },
        ],
      },
    },
    include: { lines: true },
  });

  await prisma.invoice.update({ where: { id }, data: { status: "PAID" } });

  return entry;
}
