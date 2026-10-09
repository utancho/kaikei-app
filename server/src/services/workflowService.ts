import { prisma, requestDatabase } from '../lib/prisma.js';
import { badRequest, notFound, HttpError } from '../lib/httpError.js';
import { createJournalEntry } from './journalEntryService.js';
import { d1Date } from '../lib/d1Date.js';
import { Buffer } from 'node:buffer';

export const EVIDENCE_FILE_LIMIT=262144;
export const EVIDENCE_BUSINESS_LIMIT=5242880;
export const EVIDENCE_GLOBAL_LIMIT=52428800;
export async function overview(businessId:string) {
  const db=requestDatabase();
  const [draftEntries,unpaidInvoices,overdueInvoices,unmatchedRows,missingEvidence,pendingReviews,lock,quota]=await Promise.all([
    prisma.journalEntry.count({where:{businessId,status:'DRAFT'}}),
    prisma.invoice.count({where:{businessId,status:'SENT'}}),
    prisma.invoice.count({where:{businessId,status:'SENT',dueDate:{lt:new Date()}}}),
    prisma.bankTransactionRow.count({where:{batch:{businessId},status:'UNMATCHED'}}),
    db.prepare('SELECT count(*) AS n FROM JournalEntry j WHERE j.businessId=? AND NOT EXISTS(SELECT 1 FROM BusinessEvidence e WHERE e.businessId=j.businessId AND e.entryId=j.id AND e.deletedAt IS NULL)').bind(businessId).first<{n:number}>(),
    db.prepare("SELECT count(*) AS n FROM BusinessReview WHERE businessId=? AND status='CHANGES_REQUESTED'").bind(businessId).first<{n:number}>(),
    db.prepare('SELECT closedThrough,reason FROM BusinessControl WHERE businessId=?').bind(businessId).first(),
    db.prepare('SELECT coalesce(sum(size),0) AS usedBytes FROM BusinessEvidence WHERE businessId=?').bind(businessId).first<{usedBytes:number}>(),
  ]);
  return {counts:{draftEntries,unpaidInvoices,overdueInvoices,unmatchedRows,missingEvidence:missingEvidence?.n??0,pendingReviews:pendingReviews?.n??0},lock,
    evidenceQuota:{usedBytes:quota?.usedBytes??0,maxBytes:EVIDENCE_BUSINESS_LIMIT,maxFileBytes:EVIDENCE_FILE_LIMIT},freeLimits:{evidenceGlobalBytes:EVIDENCE_GLOBAL_LIMIT,recurringPerRun:20,externalAI:false}};
}

export async function scopedEntity(businessId:string,type:string,id:string) {
  const record=type==='JOURNAL'?await prisma.journalEntry.findFirst({where:{id,businessId}}):type==='INVOICE'?await prisma.invoice.findFirst({where:{id,businessId}}):null;
  if(!record) notFound('対象データが見つかりません');
  return record;
}

export async function history(businessId:string) {
  return (await requestDatabase().prepare('SELECT * FROM BusinessHistory WHERE businessId=? ORDER BY id DESC LIMIT 100').bind(businessId).all()).results;
}
export async function setLock(businessId:string,userId:string,date:string|null,reason:string) {
  await requestDatabase().batch([
    requestDatabase().prepare('INSERT INTO BusinessControl(businessId,closedThrough,reason,updatedBy,updatedAt) VALUES (?,?,?,?,?) ON CONFLICT(businessId) DO UPDATE SET closedThrough=excluded.closedThrough,reason=excluded.reason,updatedBy=excluded.updatedBy,updatedAt=excluded.updatedAt').bind(businessId,date,reason,userId,d1Date(new Date())),
    requestDatabase().prepare('INSERT INTO BusinessHistory(businessId,entityType,entityId,action,userId,afterJson) VALUES (?,?,?,?,?,?)').bind(businessId,'CONTROL',businessId,date?'CLOSE':'REOPEN',userId,JSON.stringify({closedThrough:date,reason})),
  ]);
  return {closedThrough:date,reason};
}
export async function reviews(businessId:string) {
  return (await requestDatabase().prepare('SELECT * FROM BusinessReview WHERE businessId=? ORDER BY createdAt DESC LIMIT 100').bind(businessId).all()).results;
}
export async function createReview(businessId:string,userId:string,input:{entityType:string;entityId:string;message:string;status:string}) {
  await scopedEntity(businessId,input.entityType,input.entityId);
  const id=crypto.randomUUID();
  await requestDatabase().batch([
    requestDatabase().prepare('INSERT INTO BusinessReview(id,businessId,entityType,entityId,message,status,userId) VALUES (?,?,?,?,?,?,?)').bind(id,businessId,input.entityType,input.entityId,input.message,input.status,userId),
    requestDatabase().prepare("INSERT INTO AccountNotification(id,userId,kind,message,createdAt) SELECT ?,ownerId,'REVIEW',?,? FROM Business WHERE id=? AND ownerId<>?").bind(crypto.randomUUID(),`レビュー: ${input.status}`,Math.floor(Date.now()/1000),businessId,userId),
    requestDatabase().prepare('DELETE FROM AccountNotification WHERE userId=(SELECT ownerId FROM Business WHERE id=?) AND id NOT IN(SELECT id FROM AccountNotification WHERE userId=(SELECT ownerId FROM Business WHERE id=?) ORDER BY createdAt DESC,rowid DESC LIMIT 200)').bind(businessId,businessId),
  ]);
  return {id,...input,userId};
}

function validMagic(mime:string,bytes:Uint8Array) {
  const prefix=Buffer.from(bytes.subarray(0,12));
  if(mime==='application/pdf') return prefix.toString().startsWith('%PDF-');
  if(mime==='image/jpeg') return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(mime==='image/png') return prefix.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  return mime==='image/webp'&&prefix.toString('ascii',0,4)==='RIFF'&&prefix.toString('ascii',8,12)==='WEBP';
}
export async function saveEvidence(businessId:string,userId:string,file:File,entryId?:string,invoiceId?:string) {
  if(entryId) await scopedEntity(businessId,'JOURNAL',entryId);
  if(invoiceId) await scopedEntity(businessId,'INVOICE',invoiceId);
  if(file.size<1||file.size>EVIDENCE_FILE_LIMIT) throw new HttpError(413,'無料保存は1件256KiB以下です。原本は自動圧縮しません');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(!validMagic(file.type,bytes)) badRequest('PDF・JPEG・PNG・WebPの実ファイルのみ保存できます');
  const digest=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');
  const duplicate=await requestDatabase().prepare('SELECT id FROM BusinessEvidence WHERE businessId=? AND digest=? AND deletedAt IS NULL').bind(businessId,digest).first();
  if(duplicate) throw new HttpError(409,'同じ原本を保存済みです');
  const id=crypto.randomUUID();
  const fileName=file.name.replace(/[\u0000-\u001f\u007f/\\]/g,'_').slice(0,180)||'evidence';
  await requestDatabase().prepare('INSERT INTO BusinessEvidence(id,businessId,entryId,invoiceId,fileName,mimeType,size,digest,bytesBase64,createdBy) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,businessId,entryId||null,invoiceId||null,fileName,file.type,file.size,digest,Buffer.from(bytes).toString('base64'),userId).run();
  return {id,fileName,mimeType:file.type,size:file.size,digest,entryId:entryId||null,invoiceId:invoiceId||null};
}
export async function listEvidence(businessId:string) {
  return (await requestDatabase().prepare('SELECT id,entryId,invoiceId,fileName,mimeType,size,digest,createdAt FROM BusinessEvidence WHERE businessId=? AND deletedAt IS NULL ORDER BY createdAt DESC LIMIT 100').bind(businessId).all()).results;
}

export async function duplicates(businessId:string) {
  return (await requestDatabase().prepare("SELECT date(entryDate) AS entryDate,coalesce(description,'') AS description,count(*) AS count,group_concat(id) AS entryIds FROM JournalEntry WHERE businessId=? GROUP BY date(entryDate),coalesce(description,''),(SELECT sum(amount) FROM JournalEntryLine WHERE journalEntryId=JournalEntry.id AND side='DEBIT') HAVING count(*)>1 LIMIT 50").bind(businessId).all()).results;
}
export async function suggestions(businessId:string,query:string) {
  if(!query.trim()) return [];
  const entries=await prisma.journalEntry.findMany({where:{businessId,status:'CONFIRMED',description:{contains:query.trim()}},select:{id:true,description:true,lines:{select:{side:true,accountId:true,amount:true,taxCategoryId:true},orderBy:{lineNumber:'asc'}}},orderBy:{entryDate:'desc'},take:5});
  return entries.map(e=>({...e,source:'過去の確定仕訳',evaluatedByAI:false}));
}

export async function backup(businessId:string) {
  const db=requestDatabase();
  const business=await prisma.business.findUniqueOrThrow({where:{id:businessId}});
  const direct:Record<string,string>={accounts:'Account',partners:'Partner',fiscalYears:'FiscalYear',entries:'JournalEntry',invoices:'Invoice',templates:'JournalEntryTemplate',fixedAssets:'FixedAsset',budgets:'Budget',bankBatches:'BankImportBatch',evidence:'BusinessEvidence',reviews:'BusinessReview',history:'BusinessHistory',recurring:'BusinessRecurring'};
  const result:Record<string,unknown>={schemaVersion:1,generatedAt:new Date().toISOString(),business};
  for(const [key,table] of Object.entries(direct)) result[key]=(await db.prepare(`SELECT * FROM ${table} WHERE businessId=? LIMIT 10001`).bind(businessId).all()).results;
  const child:Record<string,[string,string,string]>={subAccounts:['SubAccount','accountId','Account'],entryLines:['JournalEntryLine','journalEntryId','JournalEntry'],invoiceItems:['InvoiceItem','invoiceId','Invoice'],templateLines:['JournalEntryTemplateLine','templateId','JournalEntryTemplate'],assetDepreciations:['FixedAssetDepreciation','fixedAssetId','FixedAsset'],bankRows:['BankTransactionRow','batchId','BankImportBatch']};
  for(const [key,[table,fk,parent]] of Object.entries(child)) result[key]=(await db.prepare(`SELECT child.* FROM ${table} child JOIN ${parent} parent ON child.${fk}=parent.id WHERE parent.businessId=? LIMIT 10001`).bind(businessId).all()).results;
  result.control=await db.prepare('SELECT * FROM BusinessControl WHERE businessId=?').bind(businessId).first();
  result.recurringRuns=(await db.prepare('SELECT run.* FROM BusinessRecurringRun run JOIN BusinessRecurring rule ON rule.id=run.recurringId WHERE rule.businessId=?').bind(businessId).all()).results;
  result.paymentClaims=(await db.prepare('SELECT * FROM InvoicePaymentClaim WHERE businessId=?').bind(businessId).all()).results;
  if(Object.values(result).some(v=>Array.isArray(v)&&v.length>10000)) throw new HttpError(413,'一括出力の上限を超えています。運営へ分割出力を依頼してください');
  return result;
}

export async function createSample(businessId:string,userId:string) {
  const existing=await prisma.journalEntry.count({where:{businessId}});
  if(existing) throw new HttpError(409,'仕訳がある事業者にはサンプルを追加しません');
  const cash=await prisma.account.findFirst({where:{businessId,code:'1010'}});
  const sales=await prisma.account.findFirst({where:{businessId,code:'4010'}});
  if(!cash||!sales) badRequest('標準科目が必要です');
  return createJournalEntry(businessId,{entryDate:new Date(),description:'【サンプル】現金売上（実取引ではありません）',status:'DRAFT',lines:[{side:'DEBIT',accountId:cash.id,amount:1000},{side:'CREDIT',accountId:sales.id,amount:1000}]});
}
