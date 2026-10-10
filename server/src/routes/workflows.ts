import { Hono } from 'hono';
import { z } from 'zod';
import { Buffer } from 'node:buffer';
import { createMiddleware } from 'hono/factory';
import { requireAuth, requireActiveSubscription } from '../middleware/auth.js';
import { requireBusinessId } from '../lib/requestHelpers.js';
import { prisma, requestDatabase } from '../lib/prisma.js';
import { notFound, badRequest } from '../lib/httpError.js';
import { consumeAttempt } from '../middleware/security.js';
import { overview,history,setLock,reviews,createReview,saveEvidence,listEvidence,backup,duplicates,suggestions,createSample } from '../services/workflowService.js';
import { recurringRules,addRecurring,runRecurring } from '../services/recurringService.js';
import { createJournalEntry } from '../services/journalEntryService.js';
import type { AppEnv } from '../types/env.js';

export const workflowRouter=new Hono<AppEnv>();
workflowRouter.use('*',requireAuth);
workflowRouter.use('*',async(c,next)=>{
  const businessId=requireBusinessId(c);const userId=c.get('userId');
  const business=await prisma.business.findFirst({where:{id:businessId,OR:[{ownerId:userId},{members:{some:{userId,status:'ACTIVE'}}}]}});
  if(!business) return c.json({error:'アクセス権がありません'},403);
  c.set('business',{id:business.id,ownerId:business.ownerId});
  if(!['GET','HEAD','OPTIONS'].includes(c.req.method)){
    const member=business.ownerId===userId?null:await prisma.businessMember.findFirst({where:{businessId,userId,status:'ACTIVE'}});
    const review=/\/reviews(?:\/[^/]+)?$/.test(c.req.path);
    if(business.ownerId!==userId&&member?.role!=='MEMBER'&&!review) return c.json({error:'閲覧専用の共有権限では変更できません'},403);
    const rate=await consumeAttempt(c.env.DB,`workflows:${userId}`,60,3600);
    if(!rate.allowed){c.header('Retry-After',String(rate.retryAfter));return c.json({error:'無料枠保護の操作回数上限です。時間をおいてください'},429);}
  }
  await next();
});
workflowRouter.use('*',requireActiveSubscription);

export const recordBusinessOperation=createMiddleware<AppEnv>(async(c,next)=>{
  const isWrite=!['GET','HEAD','OPTIONS'].includes(c.req.method);let input:unknown=null;
  if(isWrite&&c.req.header('content-type')?.includes('application/json')) input=await c.req.json().catch(()=>null);
  if(!isWrite||!c.get('business')) return next();
  const json=JSON.stringify(input);
  if(new TextEncoder().encode(json).length>32768) return c.json({error:'無料枠では一度の業務JSON操作を32KiB以内に分割してください'},413);
  const db=requestDatabase(),businessId=c.get('business')!.id,claim=crypto.randomUUID();
  let reservedRows=1000,reservedBytes=2097152;
  const child=c.req.path.startsWith('/api/journal-entries/')?'JournalEntryLine':c.req.path.startsWith('/api/invoices/')?'InvoiceItem':null;
  if(child&&c.req.param('id')){
    const fk=child==='JournalEntryLine'?'journalEntryId':'invoiceId';
    const parent=child==='JournalEntryLine'?'JournalEntry':'Invoice';
    const old=await db.prepare(`SELECT count(*) AS n,coalesce(sum(length(CAST(child.description AS BLOB))),0) AS bytes FROM ${child} child JOIN ${parent} parent ON child.${fk}=parent.id WHERE parent.id=? AND parent.businessId=?`).bind(c.req.param('id'),businessId).first<{n:number;bytes:number}>();
    reservedRows=Math.max(reservedRows,(old?.n??0)*3+100);reservedBytes=Math.max(reservedBytes,(old?.bytes??0)*3+reservedRows*1500);
  }
  const now=Math.floor(Date.now()/1000);
  await db.prepare('DELETE FROM BusinessWriteReservation WHERE expiresAt<=?').bind(now).run();
  const held=await db.prepare('SELECT id FROM BusinessWriteReservation WHERE businessId=?').bind(businessId).first();
  if(held) return c.json({error:'この事業者は別の変更を処理中です。少し待って再試行してください'},409);
  const acquired=await db.prepare(`INSERT OR IGNORE INTO BusinessWriteReservation(businessId,id,expiresAt,reservedBytes,reservedRows)
    SELECT ?,?,?,?,? WHERE
      coalesce((SELECT bytes FROM BusinessHistoryBudget WHERE businessId=?),0)+?<=5242880 AND
      coalesce((SELECT rows FROM BusinessHistoryBudget WHERE businessId=?),0)+?<=5000 AND
      EXISTS(SELECT 1 FROM WorkflowBudget WHERE name='history' AND bytes+coalesce((SELECT sum(reservedBytes) FROM BusinessWriteReservation),0)+?<=52428800 AND rows+coalesce((SELECT sum(reservedRows) FROM BusinessWriteReservation),0)+?<=50000)
    RETURNING id`).bind(businessId,claim,now+600,reservedBytes,reservedRows,businessId,reservedBytes,businessId,reservedRows,reservedBytes,reservedRows).first();
  if(!acquired) return c.json({error:'無料履歴枠の残量が不足しています。業務JSONを保存して運営へご連絡ください'},413);
  try{
    // Immutable actor attribution is reserved BEFORE mutation. Trigger records show actual committed before/after states.
    await db.prepare('INSERT INTO BusinessHistory(businessId,entityType,entityId,action,userId,afterJson) VALUES (?,?,?,?,?,?)').bind(businessId,'API_REQUEST',c.req.param('id')??c.req.path,`${c.req.method} ${c.req.path}`,c.get('userId'),JSON.stringify({requestId:claim,input})).run();
    await next();
  }finally{try{await db.prepare('DELETE FROM BusinessWriteReservation WHERE businessId=? AND id=?').bind(businessId,claim).run();}catch{console.warn('Business write reservation release deferred to expiry');}}
});
workflowRouter.use('*',recordBusinessOperation);
const id=(c:{get:(k:'business')=>{id:string;ownerId:string}|undefined})=>c.get('business')!.id;
workflowRouter.get('/overview',async c=>{
  const result=await overview(id(c));
  if(result.counts.overdueInvoices>0&&c.get('business')!.ownerId===c.get('userId')){
    const day=new Date().toISOString().slice(0,10);const userId=c.get('userId');
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT OR IGNORE INTO AccountNotification(id,userId,kind,message,createdAt) VALUES (?,?,'PAYMENT_DUE',?,?)").bind(`due:${id(c)}:${day}`,userId,`支払期限を過ぎた請求書が${result.counts.overdueInvoices}件あります。実務管理から確認してください。`,Math.floor(Date.now()/1000)),
      c.env.DB.prepare('DELETE FROM AccountNotification WHERE userId=? AND id NOT IN (SELECT id FROM AccountNotification WHERE userId=? ORDER BY createdAt DESC,rowid DESC LIMIT 200)').bind(userId,userId),
    ]);
  }
  return c.json(result);
});
workflowRouter.get('/entities',async c=>{
  const businessId=id(c);
  const [entries,invoices]=await Promise.all([
    prisma.journalEntry.findMany({where:{businessId},select:{id:true,entryNumber:true,description:true,entryDate:true},orderBy:{entryDate:'desc'},take:100}),
    prisma.invoice.findMany({where:{businessId,partner:{businessId}},select:{id:true,invoiceNumber:true,issueDate:true,partner:{select:{name:true}}},orderBy:{issueDate:'desc'},take:100}),
  ]);
  return c.json({entries,invoices:invoices.map(({partner,...row})=>({...row,partnerName:partner.name}))});
});
workflowRouter.get('/history',async c=>c.json(await history(id(c))));
workflowRouter.get('/reviews',async c=>c.json(await reviews(id(c))));
workflowRouter.post('/reviews',async c=>{
  const input=z.object({entityType:z.enum(['JOURNAL','INVOICE']),entityId:z.string().min(1).max(100),message:z.string().trim().min(1).max(2000),status:z.enum(['COMMENT','CHANGES_REQUESTED','APPROVED']).default('COMMENT')}).parse(await c.req.json());
  return c.json(await createReview(id(c),c.get('userId'),input),201);
});
workflowRouter.patch('/reviews/:id',async c=>{
  const {status}=z.object({status:z.enum(['COMMENT','CHANGES_REQUESTED','APPROVED','RESOLVED'])}).parse(await c.req.json());
  const row=await c.env.DB.prepare('SELECT userId FROM BusinessReview WHERE id=? AND businessId=?').bind(c.req.param('id'),id(c)).first<{userId:string}>();
  if(!row) notFound('レビューが見つかりません');
  const member=await prisma.businessMember.findFirst({where:{businessId:id(c),userId:c.get('userId'),status:'ACTIVE'}});
  if(c.get('business')!.ownerId!==c.get('userId')&&member?.role!=='MEMBER'&&row!.userId!==c.get('userId')) return c.json({error:'他の人のレビューは変更できません'},403);
  await c.env.DB.prepare('UPDATE BusinessReview SET status=?,updatedAt=? WHERE id=? AND businessId=?').bind(status,new Date().toISOString(),c.req.param('id'),id(c)).run();return c.json({ok:true});
});
workflowRouter.post('/lock',async c=>{
  if(c.get('business')!.ownerId!==c.get('userId')) return c.json({error:'オーナーのみ締め・再開できます'},403);
  const input=z.object({closedThrough:z.string().regex(/^20\d\d-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/).nullable(),reason:z.string().trim().min(3).max(500)}).parse(await c.req.json());
  if(input.closedThrough&&new Date(input.closedThrough).toISOString().slice(0,10)!==input.closedThrough) badRequest('有効な締日を指定してください');
  return c.json(await setLock(id(c),c.get('userId'),input.closedThrough,input.reason));
});
workflowRouter.get('/evidence',async c=>c.json(await listEvidence(id(c))));
workflowRouter.post('/evidence',async c=>{
  const form=await c.req.parseBody();const file=form.file;
  if(!(file instanceof File)) badRequest('ファイルを選択してください');
  const entryId=typeof form.entryId==='string'?form.entryId:undefined;const invoiceId=typeof form.invoiceId==='string'?form.invoiceId:undefined;
  return c.json(await saveEvidence(id(c),c.get('userId'),file,entryId,invoiceId),201);
});
workflowRouter.get('/evidence/:id',async c=>{
  const row=await c.env.DB.prepare('SELECT fileName,mimeType,bytesBase64 FROM BusinessEvidence WHERE id=? AND businessId=? AND deletedAt IS NULL').bind(c.req.param('id'),id(c)).first<{fileName:string;mimeType:string;bytesBase64:string}>();
  if(!row) notFound('証憑が見つかりません');
  c.header('Content-Type',row!.mimeType);c.header('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(row!.fileName)}`);c.header('Cache-Control','no-store');
  return c.body(new Uint8Array(Buffer.from(row!.bytesBase64,'base64')));
});
workflowRouter.delete('/evidence/:id',async c=>{
  const result=await c.env.DB.prepare('UPDATE BusinessEvidence SET deletedAt=? WHERE id=? AND businessId=? AND deletedAt IS NULL').bind(new Date().toISOString(),c.req.param('id'),id(c)).run();
  if(!result.meta.changes) notFound('証憑が見つかりません');return c.body(null,204);
});
workflowRouter.get('/backup',async c=>{
  if(c.get('business')!.ownerId!==c.get('userId')) return c.json({error:'オーナーのみ一括出力できます'},403);
  return c.json(await backup(id(c)));
});
workflowRouter.get('/duplicates',async c=>c.json(await duplicates(id(c))));
workflowRouter.get('/suggestions',async c=>c.json(await suggestions(id(c),z.string().max(100).parse(c.req.query('query')??''))));
workflowRouter.post('/suggestions/:id/apply',async c=>{
  const input=z.object({entryDate:z.coerce.date(),confirm:z.literal(true)}).parse(await c.req.json());
  const source=await prisma.journalEntry.findFirst({where:{id:c.req.param('id'),businessId:id(c),status:'CONFIRMED'},include:{lines:true}});
  if(!source) notFound('候補の仕訳が見つかりません');
  const lines=source.lines.map(l=>({side:z.enum(['DEBIT','CREDIT']).parse(l.side),accountId:l.accountId,amount:l.amount,description:l.description??undefined,partnerId:l.partnerId,subAccountId:l.subAccountId,taxCategoryId:l.taxCategoryId,taxAmount:l.taxAmount}));
  return c.json(await createJournalEntry(id(c),{entryDate:input.entryDate,description:source.description??undefined,status:'DRAFT',lines}),201);
});
workflowRouter.get('/recurring',async c=>c.json(await recurringRules(id(c))));
workflowRouter.post('/recurring',async c=>{
  const input=z.object({kind:z.enum(['JOURNAL','INVOICE']),sourceId:z.string().min(1).max(100),name:z.string().trim().min(1).max(100),dayOfMonth:z.number().int().min(1).max(28)}).parse(await c.req.json());
  return c.json(await addRecurring(id(c),c.get('userId'),input),201);
});
workflowRouter.post('/recurring/run',async c=>{
  const {month}=z.object({month:z.string().regex(/^20\d\d-(0[1-9]|1[0-2])$/)}).parse(await c.req.json());
  return c.json(await runRecurring(id(c),month));
});
workflowRouter.delete('/recurring/:id',async c=>{
  const result=await c.env.DB.prepare('UPDATE BusinessRecurring SET enabled=0 WHERE id=? AND businessId=?').bind(c.req.param('id'),id(c)).run();
  if(!result.meta.changes) notFound('定期登録が見つかりません');return c.body(null,204);
});
workflowRouter.post('/sample',async c=>{
  if(c.get('business')!.ownerId!==c.get('userId')) return c.json({error:'オーナーのみ追加できます'},403);
  z.object({confirm:z.literal(true)}).parse(await c.req.json());return c.json(await createSample(id(c),c.get('userId')),201);
});
