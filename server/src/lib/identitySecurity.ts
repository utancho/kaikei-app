import { tokenHash } from './sessionSecurity.js';

export async function captureSession(db: D1Database, userId: string, token: string, userAgent: string, expiresAt: number, securityVersion=0) {
  const now = Math.floor(Date.now()/1000);
  const hash = await tokenHash(token);
  const existing = await db.prepare('SELECT lastSeenAt,securityVersion FROM SessionActivity WHERE tokenHash=?').bind(hash).first<{lastSeenAt:number;securityVersion:number}>();
  if (existing && existing.lastSeenAt > now-3600 && existing.securityVersion===securityVersion) return;
  await db.batch([
    db.prepare('DELETE FROM SessionActivity WHERE expiresAt<=?').bind(now),
    db.prepare(`INSERT INTO SessionActivity(id,userId,tokenHash,userAgent,createdAt,lastSeenAt,expiresAt,securityVersion) VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(tokenHash) DO UPDATE SET lastSeenAt=excluded.lastSeenAt,securityVersion=excluded.securityVersion`).bind(crypto.randomUUID(),userId,hash,userAgent.slice(0,500),now,now,expiresAt,securityVersion),
    db.prepare('DELETE FROM SessionActivity WHERE userId=? AND id NOT IN (SELECT id FROM SessionActivity WHERE userId=? ORDER BY lastSeenAt DESC,rowid DESC LIMIT 500)').bind(userId,userId),
    db.prepare('DELETE FROM SessionActivity WHERE id NOT IN (SELECT id FROM SessionActivity ORDER BY lastSeenAt DESC,rowid DESC LIMIT 5000)'),
  ]);
}

export async function addAccountNotification(db:D1Database,userId:string,kind:string,message:string) {
  await db.batch([
    db.prepare('INSERT INTO AccountNotification(id,userId,kind,message,createdAt) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),userId,kind,message.slice(0,500),Math.floor(Date.now()/1000)),
    db.prepare('DELETE FROM AccountNotification WHERE userId=? AND id NOT IN (SELECT id FROM AccountNotification WHERE userId=? ORDER BY createdAt DESC,rowid DESC LIMIT 200)').bind(userId,userId),
  ]);
}
