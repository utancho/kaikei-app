import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesSecurityVersion } from "../src/lib/sessionSecurity.ts";
import { escapeCsvCell, parseCsv } from "../../client/src/lib/csvExport.ts";
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { authAttemptLimit } from '../src/middleware/security.ts';

test("legacy version-zero cookies survive only until security version changes", () => {
  const payload = { userId: "qa-user", exp: Math.floor(Date.now()/1000)+60 };
  assert.equal(matchesSecurityVersion(payload, 0), true);
  assert.equal(matchesSecurityVersion(payload, 1), false);
  assert.equal(matchesSecurityVersion({ ...payload, securityVersion: 1 }, 1), true);
  for (const bad of [-1, 1.5, "0", NaN]) assert.equal(matchesSecurityVersion({ ...payload, securityVersion: bad }, 0), false);
  assert.equal(matchesSecurityVersion({ ...payload, exp: 0 }, 0), false);
});

test("spreadsheet formula text is neutralized without changing numeric cells", () => {
  for (const text of ["=1+1", "+SUM(A1)", "-1+2", "@SUM(A1)", "\t=1+1", "\r\n=1+1", "  =1+1", "\u0000=1+1"]) {
    const cell = parseCsv(escapeCsvCell(text)+"\n")[0][0];
    assert.equal(cell, "'"+text);
  }
  assert.equal(escapeCsvCell(-100), "-100");
  assert.equal(escapeCsvCell(100), "100");
  assert.equal(escapeCsvCell("通常の摘要"), "通常の摘要");
  assert.equal(parseCsv(escapeCsvCell('a,"b"\nc')+"\n")[0][0], 'a,"b"\nc');
});

test('pre-authentication requests from one IP cannot lock out the same email at another IP',async()=>{
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE SecurityRateLimit(key TEXT PRIMARY KEY,attempts INTEGER,resetAt INTEGER)');
  const db={prepare(sql){let args=[];const statement={bind(...values){args=values;return statement;},async first(){return sqlite.prepare(sql).get(...args)??null;},async run(){return sqlite.prepare(sql).run(...args);}};return statement;}};
  const app=new Hono();app.use('*',authAttemptLimit);app.post('/api/auth/login',c=>c.json({ok:true}));
  const request=(ip)=>app.request('/api/auth/login',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':ip},body:JSON.stringify({email:'victim@example.test'})},{DB:db});
  try{
    for(let i=0;i<20;i++) assert.equal((await request('192.0.2.1')).status,200);
    assert.equal((await request('192.0.2.1')).status,429);
    assert.equal((await request('192.0.2.2')).status,200);
  }finally{sqlite.close();}
});
