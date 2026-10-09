import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

function database(){
 const db=new DatabaseSync(':memory:');
 db.exec(`PRAGMA foreign_keys=ON; CREATE TABLE Business(id TEXT PRIMARY KEY); CREATE TABLE Invoice(id TEXT PRIMARY KEY,businessId TEXT,status TEXT); CREATE TABLE JournalEntry(id TEXT PRIMARY KEY); CREATE TABLE BusinessControl(businessId TEXT PRIMARY KEY,closedThrough TEXT); INSERT INTO Business VALUES ('owner'),('other'); INSERT INTO Invoice VALUES ('invoice','owner','SENT');`);
 db.exec(readFileSync(new URL('../migrations/0021_invoice_payment_claim.sql',import.meta.url),'utf8'));return db;
}
test('payment claims reject foreign businesses and duplicate settlement without extra journals',()=>{
 const db=database();
 assert.throws(()=>db.prepare('INSERT INTO InvoicePaymentClaim VALUES (?,?,?,?)').run('invoice','other','2026-11-01','j'));
 db.exec("BEGIN; INSERT INTO InvoicePaymentClaim VALUES ('invoice','owner','2026-11-01','j'); INSERT INTO JournalEntry VALUES ('j'); UPDATE Invoice SET status='PAID' WHERE id='invoice'; COMMIT;");
 assert.throws(()=>db.exec("BEGIN; INSERT INTO InvoicePaymentClaim VALUES ('invoice','owner','2026-11-01','j2'); INSERT INTO JournalEntry VALUES ('j2'); COMMIT;"));db.exec('ROLLBACK');
 assert.equal(db.prepare('SELECT count(*) AS n FROM JournalEntry').get().n,1);
 assert.throws(()=>db.exec("DELETE FROM JournalEntry WHERE id='j'"));
 db.close();
});
test('closed payment dates fail before any claim is retained',()=>{
 const db=database();db.exec("INSERT INTO BusinessControl VALUES ('owner','2026-10-31')");
 assert.throws(()=>db.exec("BEGIN; INSERT INTO InvoicePaymentClaim VALUES ('invoice','owner','2026-10-09','j'); INSERT INTO JournalEntry VALUES ('j'); COMMIT;"));db.exec('ROLLBACK');
 assert.equal(db.prepare('SELECT count(*) AS n FROM InvoicePaymentClaim').get().n,0);
 assert.equal(db.prepare('SELECT count(*) AS n FROM JournalEntry').get().n,0);
 assert.equal(db.prepare('SELECT status FROM Invoice').get().status,'SENT');
 db.close();
});
test('a rejected final invoice status rolls the claim and journal back together',()=>{
 const db=database();
 db.exec("CREATE TRIGGER reject_status BEFORE UPDATE ON Invoice BEGIN SELECT RAISE(ABORT,'LOCKED'); END;");
 assert.throws(()=>db.exec("BEGIN; INSERT INTO InvoicePaymentClaim VALUES ('invoice','owner','2026-11-01','j'); INSERT INTO JournalEntry VALUES ('j'); UPDATE Invoice SET status='PAID' WHERE id='invoice'; COMMIT;"));db.exec('ROLLBACK');
 assert.equal(db.prepare('SELECT count(*) AS n FROM InvoicePaymentClaim').get().n,0);
 assert.equal(db.prepare('SELECT count(*) AS n FROM JournalEntry').get().n,0);
 assert.equal(db.prepare('SELECT status FROM Invoice').get().status,'SENT');
 db.close();
});
