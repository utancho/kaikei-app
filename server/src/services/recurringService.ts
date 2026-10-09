import { prisma, requestDatabase } from '../lib/prisma.js';
import { assertLineReferences, assertPartnerBelongs } from '../lib/businessReferences.js';
import { getOrCreateFiscalYearForDate } from './fiscalYearService.js';
import { badRequest, notFound } from '../lib/httpError.js';
import { d1Date } from '../lib/d1Date.js';

type Rule={id:string;businessId:string;kind:string;sourceId:string;name:string;dayOfMonth:number};
export async function recurringRules(businessId:string) {
  return (await requestDatabase().prepare('SELECT * FROM BusinessRecurring WHERE businessId=? AND enabled=1 ORDER BY createdAt DESC LIMIT 50').bind(businessId).all()).results;
}
export async function addRecurring(businessId:string,userId:string,input:{kind:string;sourceId:string;name:string;dayOfMonth:number}) {
  const existing=input.kind==='JOURNAL'?await prisma.journalEntry.findFirst({where:{id:input.sourceId,businessId}}):await prisma.invoice.findFirst({where:{id:input.sourceId,businessId,partner:{businessId}}});
  if(!existing) notFound('元データが見つかりません');
  const count=await requestDatabase().prepare('SELECT count(*) AS n FROM BusinessRecurring WHERE businessId=? AND enabled=1').bind(businessId).first<{n:number}>();
  if((count?.n??0)>=20) badRequest('無料の定期登録は20件までです');
  const id=crypto.randomUUID();
  await requestDatabase().prepare('INSERT INTO BusinessRecurring(id,businessId,kind,sourceId,name,dayOfMonth,createdBy) VALUES (?,?,?,?,?,?,?)').bind(id,businessId,input.kind,input.sourceId,input.name,input.dayOfMonth,userId).run();
  return {id,...input};
}
export async function runRecurring(businessId:string,month:string) {
  const db=requestDatabase();
  const rules=(await recurringRules(businessId)).slice(0,20) as unknown as Rule[];
  let created=0,skipped=0;const errors:string[]=[];
  for(const rule of rules){
    const done=await db.prepare('SELECT targetId FROM BusinessRecurringRun WHERE recurringId=? AND month=?').bind(rule.id,month).first();
    if(done){skipped++;continue;}
    try{
      const date=new Date(`${month}-${String(rule.dayOfMonth).padStart(2,'0')}T00:00:00Z`);
      const id=crypto.randomUUID();const now=d1Date(new Date());
      const statements=[db.prepare('INSERT INTO BusinessRecurringRun(recurringId,month,targetId) VALUES (?,?,?)').bind(rule.id,month,id)];
      if(rule.kind==='JOURNAL'){
        const source=await prisma.journalEntry.findFirst({where:{id:rule.sourceId,businessId},include:{lines:true}});
        if(!source) notFound('元仕訳が削除されています');
        await assertLineReferences(businessId,source.lines);
        const debit=source.lines.filter(l=>l.side==='DEBIT').reduce((s,l)=>s+l.amount,0);
        const credit=source.lines.filter(l=>l.side==='CREDIT').reduce((s,l)=>s+l.amount,0);
        if(!debit||debit!==credit) badRequest('元仕訳の貸借が一致しません');
        const fy=await getOrCreateFiscalYearForDate(businessId,date);
        statements.push(db.prepare("INSERT INTO JournalEntry(id,businessId,fiscalYearId,entryNumber,entryDate,description,status,source,createdAt,updatedAt) VALUES (?,?,?,(SELECT coalesce(max(entryNumber),0)+1 FROM JournalEntry WHERE businessId=?),?,?,'DRAFT','MANUAL',?,?)").bind(id,businessId,fy.id,businessId,d1Date(date),`定期: ${rule.name}`,now,now));
        for(const l of source.lines) statements.push(db.prepare('INSERT INTO JournalEntryLine(id,journalEntryId,lineNumber,side,accountId,subAccountId,partnerId,taxCategoryId,amount,taxAmount,description) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,l.lineNumber,l.side,l.accountId,l.subAccountId,l.partnerId,l.taxCategoryId,l.amount,l.taxAmount,l.description));
      }else{
        const source=await prisma.invoice.findFirst({where:{id:rule.sourceId,businessId,partner:{businessId}},include:{items:true}});
        if(!source) notFound('元請求書が削除されています');
        await assertPartnerBelongs(businessId,source.partnerId);
        statements.push(db.prepare("INSERT INTO Invoice(id,businessId,partnerId,invoiceNumber,issueDate,status,notes,subtotal,taxAmount,total,createdAt) VALUES (?,?,?,?,?,'DRAFT',?,?,?,?,?)").bind(id,businessId,source.partnerId,`${source.invoiceNumber}-${month}`,d1Date(date),source.notes,source.subtotal,source.taxAmount,source.total,now));
        for(const it of source.items) statements.push(db.prepare('INSERT INTO InvoiceItem(id,invoiceId,lineNumber,description,quantity,unitPrice,taxCategoryId,amount) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,it.lineNumber,it.description,it.quantity,it.unitPrice,it.taxCategoryId,it.amount));
      }
      await db.batch(statements);created++;
    }catch(err){
      const concurrent=await db.prepare('SELECT targetId FROM BusinessRecurringRun WHERE recurringId=? AND month=?').bind(rule.id,month).first();
      if(concurrent) skipped++;
      else errors.push(`${rule.name}: ${err instanceof Error&&/PERIOD_LOCKED/.test(err.message)?'締め済み期間です':err instanceof Error?err.message.slice(0,160):'作成できませんでした'}`);
    }
  }
  return {created,skipped,errors};
}
