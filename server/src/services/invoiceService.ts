import { prisma, requestDatabase } from "../lib/prisma.js";
import { notFound, badRequest } from "../lib/httpError.js";
import { assertPartnerBelongs } from "../lib/businessReferences.js";
import { d1Date } from "../lib/d1Date.js";
import type { z } from "zod";
import type { invoiceInputSchema } from "../lib/zodSchemas.js";
import { getOrCreateFiscalYearForDate } from "./fiscalYearService.js";
import { escapeHtmlText, isEmailEnabled, renderEmail, sendEmail } from "./emailService.js";
import type { Bindings } from "../types/env.js";

export type InvoiceInput = z.infer<typeof invoiceInputSchema>;
interface TaxBreakdown { rate: number; subtotal: number; taxAmount: number; isReducedRate: boolean; lineNumbers: number[]; zeroRateKinds?: {kind:string;subtotal:number}[] }
interface InvoiceIssuer { name: string; address: string | null; representativeName: string | null; invoiceRegistrationNumber: string | null }

function documentInvoice<T extends {status:string;issuerJson: string | null;recipientJson: string | null;taxBreakdownJson: string | null;partner: {name: string;address: string | null;email: string | null}}>(invoice:T) {
  const posted = invoice.status !== 'DRAFT';
  const recipient = posted && invoice.recipientJson ? JSON.parse(invoice.recipientJson) as {name:string;address:string|null;email:string|null} : undefined;
  return {...invoice,partner:{...invoice.partner,...recipient},issuer:posted && invoice.issuerJson ? JSON.parse(invoice.issuerJson) as InvoiceIssuer : null,taxBreakdown:invoice.taxBreakdownJson ? JSON.parse(invoice.taxBreakdownJson) as TaxBreakdown[] : null};
}

function issuerSnapshot(business: InvoiceIssuer): string {
  return JSON.stringify({name:business.name,address:business.address,representativeName:business.representativeName,invoiceRegistrationNumber:business.invoiceRegistrationNumber});
}

interface Computed {
  items: { lineNumber: number; description: string; quantity: number; unitPrice: number; amount: number; taxCategoryId?: string | null }[];
  subtotal: number;
  taxAmount: number;
  total: number;
  taxBreakdown: TaxBreakdown[];
}

async function computeInvoiceTotals(items: InvoiceInput["items"]): Promise<Computed> {
  const taxCategories = await prisma.taxCategory.findMany();
  const rateById = new Map(taxCategories.map((t) => [t.id, t.rate]));
  for (const item of items) {
    if (item.taxCategoryId && !taxCategories.some(category => category.id === item.taxCategoryId && category.kind !== 'TAXABLE_PURCHASE')) {
      badRequest('請求書には有効な売上の税区分を指定してください');
    }
  }

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
  const groupByRate = new Map<number, TaxBreakdown>();
  for (const it of computedItems) {
    const rate = it.taxCategoryId ? (rateById.get(it.taxCategoryId) ?? 0) : 0;
    const group = groupByRate.get(rate) ?? {rate,subtotal:0,taxAmount:0,isReducedRate:false,lineNumbers:[]};
    group.subtotal += it.amount;
    group.lineNumbers.push(it.lineNumber);
    if (rate === 0) {
      const kind = taxCategories.find(category=>category.id===it.taxCategoryId)?.kind ?? 'UNKNOWN';
      group.zeroRateKinds ??= [];
      const category = group.zeroRateKinds.find(category=>category.kind===kind);
      if (category) category.subtotal += it.amount;
      else group.zeroRateKinds.push({kind,subtotal:it.amount});
    }
    group.isReducedRate ||= Boolean(taxCategories.find(category=>category.id===it.taxCategoryId)?.isReducedRate);
    groupByRate.set(rate,group);
  }
  let taxAmount = 0;
  for (const group of groupByRate.values()) {
    group.taxAmount = Math.round(group.subtotal * group.rate);
    taxAmount += group.taxAmount;
  }

  return { items: computedItems, subtotal, taxAmount, total: subtotal + taxAmount, taxBreakdown: [...groupByRate.values()] };
}

export async function listInvoices(businessId: string) {
  const invoices = await prisma.invoice.findMany({
    where: { businessId, partner: { businessId } },
    include: { partner: true, items: true },
    orderBy: { issueDate: "desc" },
  });
  return invoices.map(documentInvoice);
}

export async function getInvoice(businessId: string, id: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId, partner: { businessId } },
    include: { partner: true, items: { include: { taxCategory: true } } },
  });
  if (!invoice) notFound("請求書が見つかりません");
  return documentInvoice(invoice);
}

export async function createInvoice(businessId: string, input: InvoiceInput) {
  const partner = await prisma.partner.findFirst({ where: { id: input.partnerId, businessId } });
  if (!partner) badRequest("取引先が見つかりません");

  const totals = await computeInvoiceTotals(input.items);
  const business = await prisma.business.findUniqueOrThrow({where:{id:businessId}});

  const db = requestDatabase();
  const id = crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO Invoice(id,businessId,partnerId,invoiceNumber,issueDate,dueDate,status,notes,subtotal,taxAmount,total,issuerJson,recipientJson,taxBreakdownJson) VALUES (?,?,?,?,?,?,'DRAFT',?,?,?,?,?,?,?)")
      .bind(id,businessId,input.partnerId,input.invoiceNumber,d1Date(input.issueDate),input.dueDate ? d1Date(input.dueDate) : null,input.notes ?? null,totals.subtotal,totals.taxAmount,totals.total,issuerSnapshot(business),JSON.stringify({name:partner.name,address:partner.address,email:partner.email}),JSON.stringify(totals.taxBreakdown)),
    ...totals.items.map(item => db.prepare('INSERT INTO InvoiceItem(id,invoiceId,lineNumber,description,quantity,unitPrice,taxCategoryId,amount) VALUES (?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),id,item.lineNumber,item.description,item.quantity,item.unitPrice,item.taxCategoryId ?? null,item.amount)),
  ]);
  return getInvoice(businessId,id);
}

export async function updateInvoice(businessId: string, id: string, input: InvoiceInput) {
  await assertPartnerBelongs(businessId, input.partnerId);
  const existing = await prisma.invoice.findFirst({ where: { id, businessId } });
  if (!existing) notFound("請求書が見つかりません");
  if (existing.status !== "DRAFT") badRequest("計上済みの請求書は変更できません。訂正は別の取引として記録してください");
  const settled=await requestDatabase().prepare('SELECT invoiceId FROM InvoicePaymentClaim WHERE businessId=? AND invoiceId=?').bind(businessId,id).first();
  if(settled) badRequest("入金消込済みの請求書は直接変更できません。訂正は別の取引として記録してください");

  const totals = await computeInvoiceTotals(input.items);

  const db = requestDatabase();
  await db.batch([
    db.prepare('DELETE FROM InvoiceItem WHERE invoiceId=?').bind(id),
    db.prepare('UPDATE Invoice SET partnerId=?,invoiceNumber=?,issueDate=?,dueDate=?,status=?,notes=?,subtotal=?,taxAmount=?,total=? WHERE id=? AND businessId=?')
      .bind(input.partnerId, input.invoiceNumber, d1Date(input.issueDate), input.dueDate ? d1Date(input.dueDate) : null, existing.status, input.notes ?? null, totals.subtotal, totals.taxAmount, totals.total, id, businessId),
    ...totals.items.map(it => db.prepare('INSERT INTO InvoiceItem(id,invoiceId,lineNumber,description,quantity,unitPrice,taxCategoryId,amount) VALUES (?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(), id, it.lineNumber, it.description, it.quantity, it.unitPrice, it.taxCategoryId ?? null, it.amount)),
    db.prepare('UPDATE Invoice SET taxBreakdownJson=?,recipientJson=NULL WHERE id=? AND businessId=?').bind(JSON.stringify(totals.taxBreakdown),id,businessId),
  ]);
  return getInvoice(businessId, id);
}

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const ymd = (d: Date) =>
  new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(d);

/** 請求書を取引先のメールアドレス宛に送信する。 */
export async function sendInvoiceEmail(env: Bindings, businessId: string, id: string) {
  if (!isEmailEnabled(env)) {
    badRequest("メール送信が未設定です。RESEND_API_KEY と MAIL_FROM を設定してください");
  }
  const storedInvoice = await prisma.invoice.findFirst({
    where: { id, businessId, partner: { businessId } },
    include: { partner: true, items: true },
  });
  if (!storedInvoice) notFound("請求書が見つかりません");
  const invoice = documentInvoice(storedInvoice);
  if (!invoice!.partner.email) badRequest("取引先にメールアドレスが登録されていません");

  const business = invoice.issuer ?? await prisma.business.findUniqueOrThrow({ where: { id: businessId } });

  const rows = invoice!.items
    .map(
      (it) =>
        `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${escapeHtmlText(it.description)}${invoice.taxBreakdown?.some(group=>group.isReducedRate && group.lineNumbers.includes(it.lineNumber)) ? ' ※' : ''}</td>` +
        `<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${it.quantity}</td>` +
        `<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${yen(it.unitPrice)}</td>` +
        `<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${yen(it.amount)}</td></tr>`
    )
    .join("");

  const bodyHtml =
    `<p>${escapeHtmlText(invoice!.partner.name)} 御中</p>` +
    `<p>いつもお世話になっております。${escapeHtmlText(business.name)} です。<br>下記のとおりご請求申し上げます。</p>` +
    (business.invoiceRegistrationNumber ? `<p>登録番号: ${escapeHtmlText(business.invoiceRegistrationNumber)}</p>` : '') +
    `<p>請求書番号: <strong>${escapeHtmlText(invoice!.invoiceNumber)}</strong><br>` +
    `発行日: ${ymd(invoice!.issueDate)}` +
    (invoice!.dueDate ? `<br>お支払期限: ${ymd(invoice!.dueDate)}` : "") +
    `</p>` +
    `<table style="border-collapse:collapse;width:100%;font-size:13px;margin:12px 0;">` +
    `<thead><tr style="background:#f3f4f6;"><th style="padding:4px 8px;text-align:left;">品目</th>` +
    `<th style="padding:4px 8px;text-align:right;">数量</th><th style="padding:4px 8px;text-align:right;">単価</th>` +
    `<th style="padding:4px 8px;text-align:right;">金額</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<p style="text-align:right;">小計: ${yen(invoice!.subtotal)}<br>消費税: ${yen(invoice!.taxAmount)}<br>` +
    `<strong style="font-size:16px;">合計: ${yen(invoice!.total)}</strong></p>` +
    (invoice.taxBreakdown ?? []).map(group=>`<p>${Math.round(group.rate*100)}%対象（税抜）: ${yen(group.subtotal)} ／ 消費税: ${yen(group.taxAmount)}</p>`).join('') +
    (invoice.taxBreakdown?.some(group=>group.isReducedRate) ? '<p>※ 軽減税率対象</p>' : '') +
    (invoice!.notes ? `<p style="color:#6b7280;">${escapeHtmlText(invoice!.notes)}</p>` : "");

  const result = await sendEmail(env, {
    quotaScope: `invoice:${businessId}`,
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
  if (existing.status !== "DRAFT") badRequest("計上済みの請求書は削除できません");
  const settled=await requestDatabase().prepare('SELECT invoiceId FROM InvoicePaymentClaim WHERE businessId=? AND invoiceId=?').bind(businessId,id).first();
  if(settled) badRequest("入金消込済みの請求書は削除できません");
  await prisma.invoice.delete({ where: { id } });
}

// 請求書を仕訳(売掛金/売上高)に計上する
export async function postInvoiceToJournal(businessId: string, id: string) {
  const db = requestDatabase();
  const previous = await db.prepare('SELECT journalEntryId FROM InvoicePostingClaim WHERE invoiceId=? AND businessId=?')
    .bind(id, businessId).first<{ journalEntryId: string }>();
  if (previous) return prisma.journalEntry.findUniqueOrThrow({ where: { id: previous.journalEntryId }, include: { lines: true } });
  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId, partner: { businessId } },
    include: { items: true, partner: true },
  });
  if (!invoice) notFound("請求書が見つかりません");
  if (invoice.status !== "DRAFT") badRequest("この請求書は計上済み、または計上できない状態です");

  const receivable = await prisma.account.findFirst({
    where: { businessId, code: "1110" }, // 売掛金
  });
  const sales = await prisma.account.findFirst({ where: { businessId, code: "4010" } }); // 売上高
  const salesTax = await prisma.account.findFirst({ where: { businessId, code: "2055" } }); // 仮受消費税等
  if (!receivable || !sales) badRequest("売掛金/売上高の勘定科目が見つかりません");
  if (invoice.taxAmount > 0 && !salesTax) badRequest("仮受消費税等の勘定科目が見つかりません");

  const fiscalYear = await getOrCreateFiscalYearForDate(businessId, invoice.issueDate);
  const business = await prisma.business.findUniqueOrThrow({where:{id:businessId}});

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

  const journalEntryId = crypto.randomUUID();
  // D1 batch rolls back every statement if the unique invoice claim fails.
  // Insert the claim after lines so its immutability guards apply only once complete.
  try {
    await db.batch([
      db.prepare('UPDATE Invoice SET issuerJson=?,recipientJson=? WHERE id=? AND businessId=? AND status=\'DRAFT\'')
        .bind(issuerSnapshot(business),JSON.stringify({name:invoice.partner.name,address:invoice.partner.address,email:invoice.partner.email}),id,businessId),
      db.prepare(`INSERT INTO JournalEntry(id,businessId,fiscalYearId,entryNumber,entryDate,description,status,source,updatedAt)
        VALUES (?,?,?,COALESCE((SELECT MAX(entryNumber) FROM JournalEntry WHERE businessId=?),0)+1,?,?,'CONFIRMED','INVOICE',?)`)
        .bind(journalEntryId,businessId,fiscalYear.id,businessId,d1Date(invoice.issueDate),`請求書 ${invoice.invoiceNumber} (${invoice.partner.name})`,d1Date(new Date())),
      ...lines.map(line => db.prepare('INSERT INTO JournalEntryLine(id,journalEntryId,lineNumber,side,accountId,partnerId,amount) VALUES (?,?,?,?,?,?,?)')
        .bind(crypto.randomUUID(),journalEntryId,line.lineNumber,line.side,line.accountId,line.partnerId,line.amount)),
      db.prepare('INSERT INTO InvoicePostingClaim(invoiceId,businessId,journalEntryId) VALUES (?,?,?)').bind(id,businessId,journalEntryId),
      db.prepare("UPDATE Invoice SET status='SENT' WHERE id=? AND businessId=? AND status='DRAFT'").bind(id,businessId),
    ]);
  } catch (error) {
    const concurrent = await db.prepare('SELECT journalEntryId FROM InvoicePostingClaim WHERE invoiceId=? AND businessId=?')
      .bind(id,businessId).first<{ journalEntryId: string }>();
    if (concurrent) return prisma.journalEntry.findUniqueOrThrow({ where: { id: concurrent.journalEntryId }, include: { lines: true } });
    throw error;
  }
  return prisma.journalEntry.findUniqueOrThrow({ where: { id: journalEntryId }, include: { lines: true } });
}

// 請求書の入金を記録し、売掛金を消し込む(借方:入金口座 / 貸方:売掛金)
export async function recordInvoicePayment(
  businessId: string,
  id: string,
  paymentAccountId: string,
  paymentDate: Date
) {
  const invoice = await prisma.invoice.findFirst({ where: { id, businessId, partner: { businessId } }, include: { partner: true } });
  if (!invoice) notFound("請求書が見つかりません");
  if (invoice!.status !== "SENT") badRequest("入金消込は「計上済み」の請求書のみ行えます");

  const paymentAccount = await prisma.account.findFirst({ where: { id: paymentAccountId, businessId } });
  if (!paymentAccount) badRequest("入金口座が見つかりません");

  const receivable = await prisma.account.findFirst({ where: { businessId, code: "1110" } }); // 売掛金
  if (!receivable) badRequest("売掛金の勘定科目が見つかりません");

  const db = requestDatabase();
  const locked = await db.prepare('SELECT 1 FROM BusinessControl WHERE businessId=? AND closedThrough IS NOT NULL AND date(?)<=closedThrough')
    .bind(businessId, d1Date(paymentDate)).first();
  if (locked) badRequest('締め済み期間には入金を記録できません');
  const fiscalYear = await getOrCreateFiscalYearForDate(businessId, paymentDate);
  const journalEntryId = crypto.randomUUID();
  // D1 batch is atomic. The unique claim serializes concurrent settlement attempts.
  // Its deferred journal FK is satisfied later in the same batch, never by a separate write.
  try {
    await db.batch([
      db.prepare('INSERT INTO InvoicePaymentClaim(invoiceId,businessId,paymentDate,journalEntryId) VALUES (?,?,?,?)')
        .bind(id, businessId, d1Date(paymentDate), journalEntryId),
      db.prepare(`INSERT INTO JournalEntry(id,businessId,fiscalYearId,entryNumber,entryDate,description,status,source,updatedAt)
        SELECT ?,?,?,COALESCE((SELECT MAX(entryNumber) FROM JournalEntry WHERE businessId=?),0)+1,?,?,'CONFIRMED','INVOICE',?
        FROM Invoice WHERE id=? AND businessId=? AND status='SENT'`)
        .bind(journalEntryId,businessId,fiscalYear.id,businessId,d1Date(paymentDate),`入金消込 請求書 ${invoice!.invoiceNumber} (${invoice!.partner.name})`,d1Date(new Date()),id,businessId),
      ...[{lineNumber:1,side:'DEBIT',accountId:paymentAccount.id},{lineNumber:2,side:'CREDIT',accountId:receivable.id}].map(line=>
        db.prepare(`INSERT INTO JournalEntryLine(id,journalEntryId,lineNumber,side,accountId,partnerId,amount)
          SELECT ?,?,?,?,?,partnerId,total FROM Invoice WHERE id=? AND businessId=? AND status='SENT'`)
          .bind(crypto.randomUUID(),journalEntryId,line.lineNumber,line.side,line.accountId,id,businessId)),
      db.prepare("UPDATE Invoice SET status='PAID' WHERE id=? AND businessId=? AND status='SENT'").bind(id,businessId),
    ]);
  } catch (error) {
    const current = await prisma.invoice.findFirst({where:{id,businessId},select:{status:true}});
    if (current?.status === 'PAID') badRequest('この請求書の入金は記録済みです');
    throw error;
  }
  return prisma.journalEntry.findUniqueOrThrow({where:{id:journalEntryId},include:{lines:true}});
}
