import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { confirmEmailVerification, deleteSession, listSessions, readNotification } from '../src/services/accountSecurityService.ts';
import { captureSession, addAccountNotification } from '../src/lib/identitySecurity.ts';
import { tokenHash } from '../src/lib/sessionSecurity.ts';
import { sendEmail } from '../src/services/emailService.ts';

function database() {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE User(id TEXT PRIMARY KEY,email TEXT,securityVersion INTEGER DEFAULT 0); CREATE TABLE RevokedSession(tokenHash TEXT PRIMARY KEY,expiresAt INTEGER);');
  sqlite.exec(readFileSync(new URL('../migrations/0019_identity_workflows.sql',import.meta.url),'utf8'));
  sqlite.exec(readFileSync(new URL('../migrations/0023_session_activity_versions.sql',import.meta.url),'utf8'));
  sqlite.prepare('INSERT INTO User(id,email) VALUES (?,?)').run('owner','owner@example.test');
  sqlite.prepare('INSERT INTO User(id,email) VALUES (?,?)').run('other','other@example.test');
  const db={prepare(sql){
    let values=[];
    const query={bind(...args){values=args;return query;},async first(){return sqlite.prepare(sql).get(...values)??null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){const result=sqlite.prepare(sql).run(...values);return {meta:{changes:Number(result.changes)}};}};
    return query;
  },async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
  return {db,sqlite};
}

test('identity migration preserves users as unverified and stores only unique session hashes', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE User(id TEXT PRIMARY KEY); INSERT INTO User VALUES (\'legacy\');');
  const file = new URL('../migrations/0019_identity_workflows.sql', import.meta.url);
  assert.equal(readFileSync(file, 'utf8').length > 0, true);
  db.exec(readFileSync(file, 'utf8'));
  assert.equal(db.prepare('SELECT emailVerifiedAt FROM User').get().emailVerifiedAt, null);
  db.prepare('INSERT INTO SessionActivity(id,userId,tokenHash,userAgent,createdAt,lastSeenAt,expiresAt) VALUES (?,?,?,?,?,?,?)').run('a','legacy','hash','browser',1,1,2);
  assert.throws(() => db.prepare('INSERT INTO SessionActivity(id,userId,tokenHash,userAgent,createdAt,lastSeenAt,expiresAt) VALUES (?,?,?,?,?,?,?)').run('b','legacy','hash','browser',1,1,2));
  db.close();
});

test('email verification rejects foreign, expired and replayed tokens and binds the original email',async()=>{
  const {db,sqlite}=database();const token='a'.repeat(64);const hash=await tokenHash(token);const now=Math.floor(Date.now()/1000);
  sqlite.prepare('INSERT INTO EmailVerification(tokenHash,userId,email,expiresAt) VALUES (?,?,?,?)').run(hash,'owner','owner@example.test',now+60);
  await assert.rejects(confirmEmailVerification(db,'other',token));
  assert.equal(sqlite.prepare('SELECT usedAt FROM EmailVerification').get().usedAt,null);
  assert.deepEqual(await confirmEmailVerification(db,'owner',token),{emailVerified:true});
  await assert.rejects(confirmEmailVerification(db,'owner',token));
  sqlite.prepare('UPDATE EmailVerification SET usedAt=NULL,expiresAt=?').run(now-1);
  await assert.rejects(confirmEmailVerification(db,'owner',token));
  sqlite.prepare('UPDATE EmailVerification SET expiresAt=?,email=?').run(now+60,'old@example.test');
  await assert.rejects(confirmEmailVerification(db,'owner',token));
  sqlite.close();
});

test('session capture hides token hashes, caps user agents and revocation enforces ownership',async()=>{
  const {db,sqlite}=database();const now=Math.floor(Date.now()/1000);
  await captureSession(db,'owner','opaque-jwt','x'.repeat(800),now+3600);
  const sessions=await listSessions(db,'owner','opaque-jwt');
  assert.equal(sessions.length,1);assert.equal(sessions[0].current,true);assert.equal(sessions[0].userAgent.length,500);assert.equal('tokenHash' in sessions[0],false);
  const before=sqlite.prepare('SELECT lastSeenAt FROM SessionActivity').get().lastSeenAt;
  await captureSession(db,'owner','opaque-jwt','changed',now+3600);
  assert.equal(sqlite.prepare('SELECT lastSeenAt FROM SessionActivity').get().lastSeenAt,before);
  await assert.rejects(deleteSession(db,'other',sessions[0].id));
  assert.equal((await listSessions(db,'owner','opaque-jwt')).length,1);
  await deleteSession(db,'owner',sessions[0].id);
  assert.equal((await listSessions(db,'owner','opaque-jwt')).length,0);
  assert.equal(sqlite.prepare('SELECT tokenHash FROM RevokedSession').get().tokenHash,await tokenHash('opaque-jwt'));
  sqlite.close();
});
test('credential version changes remove old sessions from the active-device list',async()=>{
  const {db,sqlite}=database();const now=Math.floor(Date.now()/1000);
  await captureSession(db,'owner','old-token','browser',now+3600);
  sqlite.exec("UPDATE User SET securityVersion=1 WHERE id='owner'");
  assert.equal((await listSessions(db,'owner','new-token')).length,0);
  await captureSession(db,'owner','new-token','browser',now+3600,1);
  assert.equal((await listSessions(db,'owner','new-token')).length,1);
  sqlite.close();
});

test('notification storage is bounded and a foreign user cannot mark notifications read',async()=>{
  const {db,sqlite}=database();
  for(let i=0;i<205;i++)await addAccountNotification(db,'owner','LOGIN_SUCCESS',`login ${i}`);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM AccountNotification').get().count,200);
  const id=sqlite.prepare('SELECT id FROM AccountNotification LIMIT 1').get().id;
  await assert.rejects(readNotification(db,'other',id));
  await readNotification(db,'owner',id);
  assert.equal(typeof sqlite.prepare('SELECT readAt FROM AccountNotification WHERE id=?').get(id).readAt,'number');
  sqlite.close();
});

test('session retention evicts old records at both the user and global bounds',async()=>{
  const {db,sqlite}=database();const now=Math.floor(Date.now()/1000);
  const insert=sqlite.prepare('INSERT INTO SessionActivity(id,userId,tokenHash,userAgent,createdAt,lastSeenAt,expiresAt) VALUES (?,?,?,?,?,?,?)');
  for(let i=0;i<501;i++)insert.run(`owner-${i}`,'owner',`owner-hash-${i}`,'browser',1,1,now+3600);
  await captureSession(db,'owner','new-owner-token','browser',now+3600);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM SessionActivity WHERE userId=?').get('owner').count,500);
  for(let i=0;i<5000;i++)insert.run(`global-${i}`,'other',`global-hash-${i}`,'browser',1,1,now+3600);
  await captureSession(db,'owner','next-owner-token','browser',now+3600);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM SessionActivity').get().count,5000);
  assert.equal((await listSessions(db,'owner','next-owner-token')).some(row=>row.current),true);
  sqlite.close();
});

test('disabled email and the exhausted global budget make no provider request',async()=>{
  const {db,sqlite}=database();const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;throw new Error('Provider calls are forbidden in this test');};
  try{
    assert.equal((await sendEmail({DB:db},{to:'x',subject:'x',html:'x'})).sent,false);
    sqlite.prepare('INSERT INTO EmailDailyUsage(day,attempts) VALUES (?,90)').run(new Date().toISOString().slice(0,10));
    assert.equal((await sendEmail({DB:db,RESEND_API_KEY:'test-only',MAIL_FROM:'test@example.test'},{to:'x',subject:'x',html:'x'})).sent,false);
    assert.equal(calls,0);
  }finally{globalThis.fetch=original;sqlite.close();}
});
