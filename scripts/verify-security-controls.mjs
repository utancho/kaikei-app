// Local-only regression harness. Never target the production URL or database.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
const BASE = "http://127.0.0.1:4000";
const PASSWORD = "qa-security-only-password";
function sql(statement) {
  const r = spawnSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "kaikei-db", "--local", "--persist-to", ".qa-app-db", "--command", statement], { encoding: "utf8", cwd: process.cwd() });
  assert.equal(r.status, 0, "local fixture SQL failed");
}
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
sql('DELETE FROM SecurityRateLimit;');
async function request(path, method="GET", data, cookie, extra={}) {
  const r = await fetch(BASE+path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(data ? { "Content-Type": "application/json" } : {}), ...extra }, body: data ? JSON.stringify(data) : undefined });
  return { status: r.status, data: r.status===204 ? null : await r.json(), cookie: r.headers.get("set-cookie")?.split(";")[0], headers:r.headers };
}
async function login(email, password=PASSWORD, code) { return request('/api/auth/login','POST',{email,password,...(code ? {code}: {})}); }
async function account(tag) {
  const email=`security-${tag}-${Date.now()}@example.invalid`;
  const r=await request('/api/auth/signup','POST',{email,password:PASSWORD,name:"Security QA"});
  assert.equal(r.status,201);
  sql(`UPDATE Subscription SET status='ACTIVE' WHERE userId=${quote(r.data.user.id)};`);
  return {email,id:r.data.user.id,cookie:r.cookie,call:(p,m,d)=>request(p,m,d,r.cookie)};
}
const a=await account('a'), b=await account('b');
assert.equal((await request('/api/auth/signup','POST',{email:a.email.toUpperCase(),password:PASSWORD})).status,400,'case variant cannot claim duplicate recipient identity');
assert.equal((await login(a.email.toUpperCase())).status,200,'unambiguous legacy email login');
assert.equal((await request('/api/auth/signup','POST',{email:'long-password-qa@example.invalid',password:'a'.repeat(73)})).status,400,'bcrypt truncation rejected explicitly');
const ba=await a.call('/api/businesses','POST',{name:'Security A',type:'INDIVIDUAL'});
const bb=await b.call('/api/businesses','POST',{name:'Security B',type:'INDIVIDUAL'});
assert.equal(ba.status,201); assert.equal(bb.status,201);
const q=`?businessId=${ba.data.id}`, qb=`?businessId=${bb.data.id}`;
const pa=await a.call('/api/partners'+q,'POST',{name:'Own partner',type:'VENDOR'});
const pb=await b.call('/api/partners'+qb,'POST',{name:'Foreign private partner',type:'VENDOR',email:'private@example.invalid'});
assert.equal(pa.status,201); assert.equal(pb.status,201);
const accounts=(await a.call('/api/accounts'+q)).data;
const foreignAccounts=(await b.call('/api/accounts'+qb)).data;
const subA='qa-sub-'+randomBytes(8).toString('hex'), subB='qa-sub-'+randomBytes(8).toString('hex');
sql(`INSERT INTO SubAccount(id,accountId,name,isActive) VALUES (${quote(subA)},${quote(accounts[0].id)},'Own subaccount',1),(${quote(subB)},${quote(foreignAccounts[0].id)},'Foreign private subaccount',1);`);
const lines=[{side:'DEBIT',accountId:accounts[0].id,amount:100},{side:'CREDIT',accountId:accounts[1].id,amount:100}];
const journal={entryDate:'2026-10-08',description:'Security QA',lines};
for(const bad of [{partnerId:pb.data.id},{partnerId:'missing-partner'},{subAccountId:subB}]) {
  const r=await a.call('/api/journal-entries'+q,'POST',{...journal,lines:[{...lines[0],...bad},lines[1]]});
  assert.equal(r.status,400,'foreign/missing journal relation rejected');
}
assert.equal((await a.call('/api/journal-entries'+q,'POST',{...journal,lines:[lines[0],{...lines[1],subAccountId:subA}]})).status,400,'same tenant wrong account sub rejected');
const valid=await a.call('/api/journal-entries'+q,'POST',{...journal,lines:[{...lines[0],partnerId:pa.data.id,subAccountId:subA}, {...lines[1],partnerId:null,subAccountId:''}]});
assert.equal(valid.status,201,JSON.stringify(valid.data));
assert.equal((await a.call('/api/journal-entries/'+valid.data.id+q,'PUT',journal)).status,200);
assert.ok((await a.call('/api/journal-entries'+q+'&to=2026-10-08')).data.some(e=>e.id===valid.data.id),'edited date remains in inclusive upper boundary');
assert.equal((await a.call('/api/journal-entries/'+valid.data.id+q,'PUT',{...journal,lines:[{...lines[0],partnerId:pb.data.id},lines[1]]})).status,400);
const template={name:'Security template',lines};
assert.equal((await a.call('/api/templates'+q,'POST',{...template,lines:[{...lines[0],partnerId:pb.data.id},lines[1]]})).status,400);
const tv=await a.call('/api/templates'+q,'POST',template); assert.equal(tv.status,201);
assert.equal((await a.call('/api/templates/'+tv.data.id+q,'PUT',template)).status,200);
assert.equal((await a.call('/api/templates/'+tv.data.id+q,'PUT',{...template,lines:[{...lines[0],partnerId:pb.data.id},lines[1]]})).status,400);
const inv={partnerId:pa.data.id,invoiceNumber:'QA-SEC',issueDate:'2026-10-08',items:[{description:'QA',unitPrice:100}]};
const iv=await a.call('/api/invoices'+q,'POST',inv);assert.equal(iv.status,201);
assert.equal((await a.call('/api/invoices/'+iv.data.id+q,'PUT',{...inv,partnerId:pb.data.id})).status,400);
assert.equal((await a.call('/api/invoices/'+iv.data.id+q,'PUT',inv)).status,200,'legitimate invoice update');
sql(`UPDATE JournalEntryLine SET partnerId=${quote(pb.data.id)},subAccountId=${quote(subB)} WHERE journalEntryId=${quote(valid.data.id)} AND lineNumber=1; UPDATE JournalEntryTemplateLine SET partnerId=${quote(pb.data.id)} WHERE templateId=${quote(tv.data.id)}; UPDATE Invoice SET partnerId=${quote(pb.data.id)} WHERE id=${quote(iv.data.id)};`);
for(const path of ['/api/journal-entries'+q,'/api/journal-entries/'+valid.data.id+q,'/api/templates'+q,'/api/reports/journal-book'+q,'/api/reports/general-ledger/'+accounts[0].id+q,'/api/reports/partner-balances'+q]) {
  const r=await a.call(path); assert.equal(r.status,200,path);
  assert.ok(!JSON.stringify(r.data).includes('Foreign private'), 'old foreign reference never expanded: '+path);
  assert.ok(!JSON.stringify(r.data).includes('private@example.invalid'));
}
assert.equal((await a.call('/api/invoices/'+iv.data.id+q)).status,404);
assert.equal((await a.call('/api/invoices/'+iv.data.id+'/post-journal'+q,'POST',{})).status,404,'poisoned invoice cannot propagate');

const otherSession=await login(a.email); assert.equal(otherSession.status,200);
assert.equal((await a.call('/api/auth/logout','POST')).status,204);
assert.equal((await a.call('/api/auth/me')).status,401,'copied logged-out token rejected');
assert.equal((await request('/api/auth/me','GET',undefined,a.cookie+'=')).status,401,'signature padding alias rejected');
const altered=a.cookie.slice(0,-1)+'B';
assert.equal((await request('/api/auth/me','GET',undefined,altered)).status,401,'signature pad-bit alias rejected');
assert.equal((await request('/api/auth/me','GET',undefined,otherSession.cookie)).status,200,'other device preserved');
const jwt=payload=>{const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');const p=Buffer.from(JSON.stringify(payload)).toString('base64url');return `${h}.${p}.${createHmac('sha256','qa-only-not-production-secret').update(`${h}.${p}`).digest('base64url')}`;};
const legacy='kaikei_session='+jwt({userId:a.id,exp:Math.floor(Date.now()/1000)+3600});
assert.equal((await request('/api/auth/me','GET',undefined,legacy)).status,200,'legacy version0 preserved');
const resetToken=randomBytes(32).toString('hex'), resetHash=createHash('sha256').update(resetToken).digest('hex');
const anotherReset=randomBytes(32).toString('hex'), anotherHash=createHash('sha256').update(anotherReset).digest('hex');
sql(`INSERT INTO PasswordResetToken(id,userId,tokenHash,expiresAt) VALUES ('qa-reset-${Date.now()}',${quote(a.id)},${quote(resetHash)},${quote(new Date(Date.now()+3600000).toISOString())});`);
sql(`INSERT INTO PasswordResetToken(id,userId,tokenHash,expiresAt) VALUES ('qa-reset-other-${Date.now()}',${quote(a.id)},${quote(anotherHash)},${quote(new Date(Date.now()+3600000).toISOString())});`);
const resets=await Promise.all([1,2].map(()=>request('/api/auth/reset-password','POST',{token:resetToken,password:'qa-reset-new-password'})));
assert.deepEqual(resets.map(r=>r.status).sort(),[200,400],'reset link consumed once atomically');
assert.equal((await request('/api/auth/reset-password','POST',{token:anotherReset,password:'qa-reset-new-password'})).status,400,'other pending reset links invalidated');
assert.equal((await request('/api/auth/me','GET',undefined,legacy)).status,401,'legacy cookie revoked after recovery');
assert.equal((await request('/api/auth/me','GET',undefined,otherSession.cookie)).status,401,'versioned cookie revoked after recovery');
assert.equal((await login(a.email,'qa-reset-new-password')).status,200);

// TOTP fixture generation uses standard RFC6238, never contacts an authenticator/provider.
function totp(secret) {
  let bits=0,value=0;const out=[];for(const c of secret){value=(value<<5)|'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c);bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}}
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const h=createHmac('sha1',Buffer.from(out)).update(counter).digest();const offset=h.at(-1)&15;return String((h.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
assert.equal((await b.call('/api/auth/2fa/setup','POST',{})).status,400,'session alone cannot enroll');
const setup=await b.call('/api/auth/2fa/setup','POST',{password:PASSWORD});assert.equal(setup.status,200);
const enabled=await b.call('/api/auth/2fa/enable','POST',{password:PASSWORD,code:totp(setup.data.secret)});assert.equal(enabled.status,200);
assert.equal((await b.call('/api/auth/me')).status,401,'pre-MFA session invalidated');
let cookie=enabled.cookie;
assert.equal((await request('/api/auth/me','GET',undefined,cookie)).status,200,'enrolling user keeps refreshed session');
assert.equal((await request('/api/auth/2fa/backup-codes','POST',{},cookie)).status,400,'direct step-up bypass denied');
assert.equal((await request('/api/auth/2fa/backup-codes','POST',{password:PASSWORD,code:'000000-wrong'},cookie)).status,400);
const regen=await request('/api/auth/2fa/backup-codes','POST',{password:PASSWORD,code:totp(setup.data.secret)},cookie);assert.equal(regen.status,200);
const concurrent=await Promise.all([1,2].map(()=>login(b.email,PASSWORD,regen.data.backupCodes[0])));
assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,400],'backup code cannot be reused concurrently');
assert.equal((await login(b.email)).data.twoFactorRequired,true,'two-step MFA flow preserved');
assert.equal((await request('/api/auth/2fa/disable','POST',{password:PASSWORD},cookie)).status,400);
const disabled=await request('/api/auth/2fa/disable','POST',{password:PASSWORD,code:totp(setup.data.secret)},cookie);assert.equal(disabled.status,200);
assert.equal((await request('/api/auth/me','GET',undefined,cookie)).status,401);
assert.equal((await request('/api/auth/me','GET',undefined,disabled.cookie)).status,200);
sql(`UPDATE User SET role='ADMIN' WHERE id=${quote(b.id)};`);
const beforeAdmin=await login(a.email,'qa-reset-new-password');assert.equal(beforeAdmin.status,200);
const adminReset=await request('/api/admin/users/'+a.id+'/reset-password','POST',{password:'qa-admin-reset-password'},disabled.cookie);
assert.equal(adminReset.status,200);
assert.equal((await request('/api/auth/me','GET',undefined,beforeAdmin.cookie)).status,401,'admin recovery revokes sessions');
assert.equal((await login(a.email,'qa-admin-reset-password')).status,200);

assert.equal((await request('/api/auth/login','POST',{email:a.email,password:PASSWORD},undefined,{Origin:'https://attacker.example'})).status,403);
assert.equal((await request('/api/auth/login','POST',{email:a.email,password:PASSWORD},undefined,{'Sec-Fetch-Site':'cross-site'})).status,403);
const health=await request('/api/health'); assert.equal(health.headers.get('x-frame-options'),'DENY'); assert.equal(health.headers.get('cache-control'),'no-store');
sql('DELETE FROM SecurityRateLimit;');
let limited;
for(let i=0;i<21;i++) limited=await login('missing-security@example.invalid','wrong-password');
assert.equal(limited.status,429,'persistent account throttle');assert.ok(Number(limited.headers.get('retry-after'))>0);
assert.equal((await login('missing-security@example.invalid','wrong-password')).status,429,'separate subsequent request remains limited');
console.log('PASS: tenant writes/persisted reads, legacy/versioned sessions, current-only logout, atomic reset, MFA step-up/concurrent backup, origin guard, headers, persistent throttle');
