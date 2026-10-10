import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runWithPrisma } from '../src/lib/prisma.ts';
import { Hono } from 'hono';
import { recordBusinessOperation } from '../src/routes/workflows.ts';
import { getConsumptionTaxReturn } from '../src/services/consumptionTaxService.ts';
import { createInvoice,getInvoice,postInvoiceToJournal,updateInvoice,deleteInvoice,sendInvoiceEmail } from '../src/services/invoiceService.ts';

function fixture(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
  const directory=fileURLToPath(new URL('../migrations/',import.meta.url));
  for(const file of readdirSync(directory).filter(name=>name.endsWith('.sql')).sort())sqlite.exec(readFileSync(`${directory}/${file}`,'utf8'));
  sqlite.exec(`
    INSERT INTO User(id,email,passwordHash) VALUES ('u','user@example.test','hash');
    INSERT INTO Business(id,ownerId,name,updatedAt) VALUES ('b','u','Business',CURRENT_TIMESTAMP);
    INSERT INTO FiscalYear(id,businessId,startDate,endDate) VALUES ('fy','b','2026-01-01T00:00:00.000+00:00','2026-12-31T23:59:59.999+00:00');
    INSERT INTO Partner(id,businessId,name,email) VALUES ('p','b','Partner','partner@example.test');
    INSERT INTO Account(id,businessId,code,name,category,subcategory,normalBalance)
      VALUES ('ar','b','1110','Receivable','ASSET','receivable','DEBIT'),('sale','b','4010','Sales','REVENUE','sales','CREDIT'),('tax','b','2055','Tax','LIABILITY','tax','CREDIT');
    INSERT INTO Invoice(id,businessId,partnerId,invoiceNumber,issueDate,subtotal,taxAmount,total)
      VALUES ('i','b','p','INV-1','2026-10-09T00:00:00.000+00:00',1000,100,1100);
    INSERT INTO InvoiceItem(id,invoiceId,lineNumber,description,unitPrice,amount) VALUES ('ii','i',1,'Service',1000,1000);
  `);
  const db={prepare(sql){
    let args=[];
    const statement={bind(...values){args=values;return statement;},
      async first(){return sqlite.prepare(sql).get(...args)??null;},
      async raw(){const query=sqlite.prepare(sql);const names=query.columns().map(column=>column.name);query.setReturnArrays(true);return [names,...query.all(...args)];},
      async all(){return {success:true,results:sqlite.prepare(sql).all(...args)};},
      async run(){const result=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes)}};}};
    return statement;
  },async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
  return {sqlite,db};
}

test('posting service replay returns the same balanced journal without a second sale',async()=>{
  const {sqlite,db}=fixture();
  try{
    await runWithPrisma(db,async()=>{
      const first=await postInvoiceToJournal('b','i');
      const second=await postInvoiceToJournal('b','i');
      assert.equal(first.id,second.id);
      assert.equal(first.lines.filter(line=>line.side==='DEBIT').reduce((sum,line)=>sum+line.amount,0),1100);
      assert.equal(first.lines.filter(line=>line.side==='CREDIT').reduce((sum,line)=>sum+line.amount,0),1100);
      assert.equal(sqlite.prepare('SELECT count(*) AS n FROM JournalEntry').get().n,1);
      await assert.rejects(deleteInvoice('b','i'),/削除できません/);
      await assert.rejects(updateInvoice('b','i',{partnerId:'p',invoiceNumber:'INV-2',issueDate:new Date('2026-10-09'),items:[{description:'edited',unitPrice:2000}]}),/変更できません/);
    });
  }finally{sqlite.close();}
});

test('failed final posting status rolls back the entire journal and claim',async()=>{
  const {sqlite,db}=fixture();
  sqlite.exec("CREATE TRIGGER reject_post BEFORE UPDATE ON Invoice BEGIN SELECT RAISE(ABORT,'TEST_REJECT_POST'); END;");
  try{
    await runWithPrisma(db,async()=>assert.rejects(postInvoiceToJournal('b','i'),/TEST_REJECT_POST/));
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM JournalEntry').get().n,0);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM JournalEntryLine').get().n,0);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM InvoicePostingClaim').get().n,0);
    assert.equal(sqlite.prepare('SELECT status FROM Invoice').get().status,'DRAFT');
  }finally{sqlite.close();}
});

test('invoice delivery escapes partner, business, line and note text',async()=>{
  const {sqlite,db}=fixture();const original=globalThis.fetch;
  const malicious='<img src=x onerror=alert(1)>';
  sqlite.prepare('UPDATE Business SET name=?').run(malicious);
  sqlite.prepare('UPDATE Partner SET name=?').run(malicious);
  sqlite.prepare('UPDATE Invoice SET notes=?,invoiceNumber=?').run(malicious,malicious);
  sqlite.prepare('UPDATE InvoiceItem SET description=?').run(malicious);
  let delivered;
  globalThis.fetch=async(_url,options)=>{delivered=JSON.parse(options.body);return new Response('{}',{status:200});};
  try{
    await runWithPrisma(db,async()=>sendInvoiceEmail({DB:db,RESEND_API_KEY:'test',MAIL_FROM:'test@example.test'},'b','i'));
    assert.ok(delivered);
    assert.ok(!delivered.html.includes(malicious));
    assert.equal((delivered.html.match(/&lt;img src=x onerror=alert\(1\)&gt;/g)||[]).length,6);
  }finally{globalThis.fetch=original;sqlite.close();}
});

test('unknown invoice tax categories cannot silently become tax-free sales',async()=>{
  const {sqlite,db}=fixture();
  try{
    await runWithPrisma(db,async()=>assert.rejects(createInvoice('b',{partnerId:'p',invoiceNumber:'INVALID',issueDate:new Date('2026-10-09'),items:[{description:'Service',unitPrice:1000,taxCategoryId:'does-not-exist'}]}),/税区分/));
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM Invoice WHERE invoiceNumber='INVALID'").get().n,0);
  }finally{sqlite.close();}
});

test('a failed invoice item cannot leave a header without its items',async()=>{
  const {sqlite,db}=fixture();
  sqlite.exec("CREATE TRIGGER reject_new_item BEFORE INSERT ON InvoiceItem BEGIN SELECT RAISE(ABORT,'TEST_ITEM_REJECT'); END;");
  try{
    await runWithPrisma(db,async()=>assert.rejects(createInvoice('b',{partnerId:'p',invoiceNumber:'FAILED',issueDate:new Date('2026-10-09'),items:[{description:'Service',unitPrice:1000}]})));
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM Invoice WHERE invoiceNumber='FAILED'").get().n,0);
  }finally{sqlite.close();}
});

test('posted invoice keeps original issuer and recipient when their master records change',async()=>{
  const {sqlite,db}=fixture();
  try{
    await runWithPrisma(db,async()=>{
      await postInvoiceToJournal('b','i');
      sqlite.exec("UPDATE Business SET name='Renamed' WHERE id='b'; UPDATE Partner SET name='Renamed partner' WHERE id='p'");
      const invoice=await getInvoice('b','i');
      assert.equal(invoice.issuer?.name,'Business');
      assert.equal(invoice.partner.name,'Partner');
    });
  }finally{sqlite.close();}
});

test('invoice rounds tax once per rate and retains its rate breakdown',async()=>{
  const {sqlite,db}=fixture();
  sqlite.exec("INSERT INTO TaxCategory(id,code,name,rate,kind,isReducedRate) VALUES ('t10','TAX10','10%',0.1,'TAXABLE_SALES',0),('t8','TAX8','8%',0.08,'TAXABLE_SALES',1)");
  try{
    await runWithPrisma(db,async()=>{
      const invoice=await createInvoice('b',{partnerId:'p',invoiceNumber:'MIXED',issueDate:new Date('2026-10-09'),items:[{description:'a',unitPrice:5,taxCategoryId:'t10'},{description:'b',unitPrice:5,taxCategoryId:'t10'},{description:'c',unitPrice:100,taxCategoryId:'t8'}]});
      assert.equal(invoice.taxAmount,9);
      assert.equal(invoice.total,119);
      assert.deepEqual(invoice.taxBreakdown,[{rate:0.1,subtotal:10,taxAmount:1,isReducedRate:false,lineNumbers:[1,2]},{rate:0.08,subtotal:100,taxAmount:8,isReducedRate:true,lineNumbers:[3]}]);
    });
  }finally{sqlite.close();}
});

test('business audit capacity is reserved before a multi-step mutation starts',async()=>{
  const {sqlite,db}=fixture();let mutationStarted=false;
  sqlite.exec("UPDATE BusinessHistoryBudget SET rows=4999 WHERE businessId='b'");
  const app=new Hono();
  app.use('*',async(c,next)=>runWithPrisma(db,async()=>{c.set('business',{id:'b',ownerId:'u'});c.set('userId','u');await next();}));
  app.use('*',recordBusinessOperation);
  app.post('/api/invoices/i',c=>{mutationStarted=true;return c.json({ok:true});});
  try{
    const response=await app.request('/api/invoices/i',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    assert.equal(response.status,413);
    assert.equal(mutationStarted,false);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM BusinessWriteReservation').get().n,0);
  }finally{sqlite.close();}
});

test('posted invoice sales are included exactly once in the consumption tax summary',async()=>{
  const {sqlite,db}=fixture();
  sqlite.exec("INSERT INTO TaxCategory(id,code,name,rate,kind,isReducedRate) VALUES ('t10','TAX10','10%',0.1,'TAXABLE_SALES',0),('t8','TAX8','8%',0.08,'TAXABLE_SALES',1)");
  try{
    await runWithPrisma(db,async()=>{
      const invoice=await createInvoice('b',{partnerId:'p',invoiceNumber:'TAX',issueDate:new Date('2026-10-09'),items:[{description:'standard',unitPrice:1000,taxCategoryId:'t10'},{description:'reduced',unitPrice:100,taxCategoryId:'t8'}]});
      await postInvoiceToJournal('b',invoice.id);
      await postInvoiceToJournal('b',invoice.id);
      const result=await getConsumptionTaxReturn('b',new Date('2026-01-01'),new Date('2026-12-31T23:59:59Z'));
      assert.deepEqual(result.taxableSales,{standard:{base:1000,tax:100},reduced:{base:100,tax:8}});
      assert.equal(result.outputTax.total,108);
    });
  }finally{sqlite.close();}
});
