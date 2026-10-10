import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function fixture() {
  const db=new DatabaseSync(':memory:');
  const dir=fileURLToPath(new URL('../migrations/',import.meta.url));
  for(const file of readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()) db.exec(readFileSync(dir+'/'+file,'utf8'));
  db.exec("INSERT INTO User(id,email,passwordHash) VALUES ('qa','qa@invalid','test'); INSERT INTO Business(id,ownerId,name,updatedAt) VALUES ('b','qa','QA',CURRENT_TIMESTAMP); INSERT INTO FiscalYear(id,businessId,startDate,endDate) VALUES ('fy','b','2026-01-01','2026-12-31'); INSERT INTO Account(id,businessId,code,name,category,subcategory,normalBalance) VALUES ('a','b','1010','cash','ASSET','cash','DEBIT'); INSERT INTO JournalEntry(id,businessId,fiscalYearId,entryNumber,entryDate,updatedAt) VALUES ('e','b','fy',1,'2026-01-10',CURRENT_TIMESTAMP);");
  // Pin control contract before the migration exists; RED is missing enforcement, not syntax.
  db.exec('CREATE TABLE IF NOT EXISTS BusinessControl(businessId TEXT PRIMARY KEY,closedThrough TEXT,reason TEXT,updatedBy TEXT,updatedAt TEXT);');
  return db;
}
test('closing blocks direct old-entry changes and downstream lines but permits future drafts',()=>{
  const db=fixture();
  db.exec("INSERT INTO BusinessControl(businessId,closedThrough) VALUES ('b','2026-01-31');");
  assert.throws(()=>db.exec("UPDATE JournalEntry SET description='changed' WHERE id='e'"),/PERIOD_LOCKED/);
  assert.throws(()=>db.exec("INSERT INTO JournalEntryLine(id,journalEntryId,lineNumber,side,accountId,amount) VALUES ('l','e',1,'DEBIT','a',1)"),/PERIOD_LOCKED/);
  assert.throws(()=>db.exec("DELETE FROM JournalEntry WHERE id='e'"),/PERIOD_LOCKED/);
  db.exec("INSERT INTO JournalEntry(id,businessId,fiscalYearId,entryNumber,entryDate,status,updatedAt) VALUES ('future','b','fy',2,'2026-02-10','DRAFT',CURRENT_TIMESTAMP);");
  assert.equal(db.prepare("SELECT count(*) AS n FROM JournalEntry WHERE id='future'").get().n,1);
  db.close();
});
test('accounting edits leave immutable before/after history',()=>{
  const db=fixture();
  db.exec("UPDATE JournalEntry SET description='revised' WHERE id='e'");
  const history=db.prepare("SELECT beforeJson,afterJson FROM BusinessHistory WHERE businessId='b' AND entityId='e' AND action='UPDATE'").get();
  assert.equal(JSON.parse(history.beforeJson).description,null);
  assert.equal(JSON.parse(history.afterJson).description,'revised');
  assert.throws(()=>db.exec("DELETE FROM BusinessHistory WHERE businessId='b'"),/IMMUTABLE_HISTORY/);
  db.close();
});
test('unlocked cascading delete preserves child history',()=>{
  const db=fixture();db.exec('PRAGMA foreign_keys=ON');
  db.exec("INSERT INTO JournalEntryLine(id,journalEntryId,lineNumber,side,accountId,amount) VALUES ('child','e',1,'DEBIT','a',1)");
  db.exec("DELETE FROM JournalEntry WHERE id='e'");
  assert.equal(db.prepare("SELECT count(*) AS n FROM JournalEntryLine WHERE id='child'").get().n,0);
  assert.equal(db.prepare("SELECT count(*) AS n FROM BusinessHistory WHERE entityId='child' AND action='DELETE'").get().n,1);
  db.close();
});
test('closed historical invoice permits only status settlement without financial edits',()=>{
  const db=fixture();
  db.exec("INSERT INTO Partner(id,businessId,name) VALUES ('p','b','Partner'); INSERT INTO Invoice(id,businessId,partnerId,invoiceNumber,issueDate,status,total) VALUES ('i','b','p','INV','2026-01-10','SENT',100); INSERT INTO BusinessControl(businessId,closedThrough) VALUES ('b','2026-01-31');");
  db.exec("UPDATE Invoice SET status='PAID' WHERE id='i'");
  assert.throws(()=>db.exec("UPDATE Invoice SET total=101 WHERE id='i'"),/PERIOD_LOCKED/);
  assert.throws(()=>db.exec("UPDATE Invoice SET status='SENT' WHERE id='i'"),/PERIOD_LOCKED/);
  db.close();
});
test('history budget measures Japanese UTF8 bytes rather than characters',()=>{
  const db=fixture();const before=db.prepare("SELECT bytes FROM WorkflowBudget WHERE name='history'").get().bytes;
  db.exec("INSERT INTO BusinessHistory(businessId,entityType,entityId,action,afterJson) VALUES ('b','TEST','x','TEST','経理')");
  const after=db.prepare("SELECT bytes FROM WorkflowBudget WHERE name='history'").get().bytes;
  assert.equal(after-before,306);
  db.close();
});

test('one business cannot exhaust the audit capacity of another business',()=>{
  const db=fixture();
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='BusinessHistoryBudget'").get());
  db.exec("INSERT INTO Business(id,ownerId,name,updatedAt) VALUES ('c','qa','Other',CURRENT_TIMESTAMP)");
  db.exec("UPDATE BusinessHistoryBudget SET rows=5000 WHERE businessId='b'");
  assert.throws(()=>db.exec("INSERT INTO BusinessHistory(businessId,entityType,entityId,action) VALUES ('b','TEST','x','TEST')"),/BUSINESS_HISTORY_QUOTA/);
  db.exec("INSERT INTO BusinessHistory(businessId,entityType,entityId,action) VALUES ('c','TEST','x','TEST')");
  assert.equal(db.prepare("SELECT rows FROM BusinessHistoryBudget WHERE businessId='c'").get().rows,1);
  db.close();
});

test('membership changes retain immutable audit records without invitation secrets',()=>{
  const db=fixture();
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='BusinessMemberAudit'").get());
  db.exec("INSERT INTO User(id,email,passwordHash) VALUES ('member-user','member@example.test','test'); INSERT INTO BusinessMember(id,businessId,email,status,role,inviteTokenHash) VALUES ('member','b','member@example.test','PENDING','VIEWER','private-invite-hash')");
  db.exec("UPDATE BusinessMember SET userId='member-user',status='ACTIVE',inviteTokenHash=NULL WHERE id='member'; DELETE FROM BusinessMember WHERE id='member'");
  const records=db.prepare("SELECT action,actorId,beforeJson,afterJson FROM BusinessMemberAudit WHERE businessId='b' ORDER BY id").all();
  assert.deepEqual(records.map(record=>record.action),['MEMBER_INVITED','MEMBER_JOINED','MEMBER_REMOVED']);
  assert.deepEqual(records.map(record=>record.actorId),['qa','member-user','qa']);
  assert.ok(!JSON.stringify(records).includes('private-invite-hash'));
  assert.throws(()=>db.exec('DELETE FROM BusinessMemberAudit'),/IMMUTABLE_MEMBER_AUDIT/);
  db.close();
});
