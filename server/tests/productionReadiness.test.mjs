import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderEmail } from '../src/services/emailService.ts';
import { businessInputSchema,invoiceInputSchema,journalLineInputSchema } from '../src/lib/zodSchemas.ts';

test('email template escapes untrusted headings, labels, and link attributes', () => {
  const html = renderEmail({
    heading: '<img src=x onerror=alert(1)>',
    bodyHtml: '<p>trusted body</p>',
    actionLabel: '確認 <script>alert(1)</script>',
    actionUrl: 'https://example.test/?next=" onmouseover="alert(1)',
  });

  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('href="https://example.test/?next=" onmouseover='));
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /<p>trusted body<\/p>/);
});

test('invoice input cannot set accounting lifecycle status directly', () => {
  const result = invoiceInputSchema.safeParse({
    partnerId: 'partner',
    invoiceNumber: 'INV-001',
    issueDate: '2026-10-09',
    status: 'PAID',
    items: [{ description: 'service', unitPrice: 1000 }],
  });

  assert.equal(result.success, false);
});

test('an invoice can claim exactly one journal and becomes financially immutable', () => {
  const db = new DatabaseSync(':memory:');
  const migrationDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));
  for (const file of readdirSync(migrationDirectory).filter((name) => name.endsWith('.sql')).sort()) {
    db.exec(readFileSync(`${migrationDirectory}/${file}`, 'utf8'));
  }

  const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='InvoicePostingClaim'").get();
  assert.equal(table?.name, 'InvoicePostingClaim');

  db.exec(`
    INSERT INTO User(id,email,passwordHash) VALUES ('u','u@example.test','hash');
    INSERT INTO Business(id,ownerId,name,updatedAt) VALUES ('b','u','Business',CURRENT_TIMESTAMP);
    INSERT INTO FiscalYear(id,businessId,startDate,endDate) VALUES ('fy','b','2026-01-01','2026-12-31');
    INSERT INTO Partner(id,businessId,name) VALUES ('p','b','Partner');
    INSERT INTO Invoice(id,businessId,partnerId,invoiceNumber,issueDate,status,subtotal,taxAmount,total)
      VALUES ('i','b','p','INV-1','2026-10-09','DRAFT',1000,100,1100);
    INSERT INTO InvoiceItem(id,invoiceId,lineNumber,description,unitPrice,amount)
      VALUES ('ii','i',1,'Service',1000,1000);
    INSERT INTO JournalEntry(id,businessId,fiscalYearId,entryNumber,entryDate,status,source,updatedAt)
      VALUES ('j','b','fy',1,'2026-10-09','CONFIRMED','INVOICE',CURRENT_TIMESTAMP);
    INSERT INTO Account(id,businessId,code,name,category,subcategory,normalBalance)
      VALUES ('ar','b','1110','Receivable','ASSET','receivable','DEBIT'),('sale','b','4010','Sales','REVENUE','sales','CREDIT'),('tax','b','2055','Tax','LIABILITY','tax','CREDIT');
    INSERT INTO JournalEntryLine(id,journalEntryId,lineNumber,side,accountId,partnerId,amount)
      VALUES ('l1','j',1,'DEBIT','ar','p',1100),('l2','j',2,'CREDIT','sale','p',1000),('l3','j',3,'CREDIT','tax','p',100);
    INSERT INTO JournalEntry(id,businessId,fiscalYearId,entryNumber,entryDate,status,source,updatedAt)
      VALUES ('wrong','b','fy',2,'2026-10-09','CONFIRMED','MANUAL',CURRENT_TIMESTAMP);
  `);
  assert.throws(()=>db.exec("INSERT INTO InvoicePostingClaim(invoiceId,businessId,journalEntryId) VALUES ('i','b','wrong')"),/INVOICE_POSTING_MISMATCH/);
  db.exec(`
    INSERT INTO InvoicePostingClaim(invoiceId,businessId,journalEntryId) VALUES ('i','b','j');
    UPDATE Invoice SET status='SENT' WHERE id='i';
  `);

  assert.throws(
    () => db.exec("INSERT INTO InvoicePostingClaim(invoiceId,businessId,journalEntryId) VALUES ('i','b','j2')"),
    /UNIQUE|constraint|INVOICE_POSTING_UNAVAILABLE|INVOICE_POSTING_MISMATCH/i,
  );
  assert.throws(() => db.exec("UPDATE Invoice SET total=1200 WHERE id='i'"), /INVOICE_POSTED/);
  assert.throws(() => db.exec("UPDATE InvoiceItem SET amount=1200 WHERE id='ii'"), /INVOICE_POSTED/);
  assert.throws(() => db.exec("DELETE FROM JournalEntry WHERE id='j'"), /INVOICE_POSTED/);
  db.exec("UPDATE Invoice SET status='PAID' WHERE id='i'");
  db.close();
});

test('TOTP storage encrypts the seed and binds it to its owner',async()=>{
  const module=await import('../src/lib/totpSecret.ts').catch(()=>null);
  assert.equal(typeof module?.sealTotpSecret,'function');
  const seed='JBSWY3DPEHPK3PXP';
  const first=await module.sealTotpSecret(seed,'owner','test-key-with-at-least-32-characters');
  const second=await module.sealTotpSecret(seed,'owner','test-key-with-at-least-32-characters');
  assert.notEqual(first,second);
  assert.ok(!first.includes(seed));
  assert.equal(await module.openTotpSecret(first,'owner','test-key-with-at-least-32-characters'),seed);
  await assert.rejects(module.openTotpSecret(first,'other','test-key-with-at-least-32-characters'));
  await assert.rejects(module.openTotpSecret(first,'owner','wrong-key'));
  assert.equal(await module.openTotpSecret(seed,'owner','test-key-with-at-least-32-characters'),seed);
});

test('registration numbers reject malformed values and retain valid values',()=>{
  const input={name:'Business',type:'INDIVIDUAL'};
  assert.equal(businessInputSchema.safeParse({...input,invoiceRegistrationNumber:'123'}).success,false);
  assert.equal(businessInputSchema.parse({...input,invoiceRegistrationNumber:'T1234567890123'}).invoiceRegistrationNumber,'T1234567890123');
});

test('journal tax cannot exceed the gross amount of its line',()=>{
  assert.equal(journalLineInputSchema.safeParse({side:'DEBIT',accountId:'cash',amount:100,taxAmount:101}).success,false);
});
