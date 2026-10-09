import { prisma } from '../lib/prisma.js';
import { badRequest, notFound } from '../lib/httpError.js';
import { tokenHash } from '../lib/sessionSecurity.js';
import { verifyPassword } from '../lib/auth.js';
import { verifyTOTP } from '../lib/totp.js';
import { consumeBackupCode } from './twoFactorService.js';
import { isEmailEnabled, sendEmail, renderEmail } from './emailService.js';
import type { Bindings } from '../types/env.js';

export async function accountSecurityStatus(env:Bindings,userId:string) {
  const row=await env.DB.prepare('SELECT emailVerifiedAt FROM User WHERE id=?').bind(userId).first<{emailVerifiedAt:string|null}>();
  return {emailVerified:Boolean(row?.emailVerifiedAt),emailEnabled:isEmailEnabled(env),mailLimit:90};
}

export async function requestEmailVerification(env:Bindings,userId:string) {
  if (!isEmailEnabled(env)) return {sent:false,reason:'メール送信が未設定です(RESEND_API_KEY / MAIL_FROM)'};
  const user=await prisma.user.findUnique({where:{id:userId}});
  if(!user) notFound('ユーザーが見つかりません');
  const status=await accountSecurityStatus(env,userId);
  if(status.emailVerified) return {sent:false,reason:'メールアドレスは確認済みです'};
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const token=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
  const now=Math.floor(Date.now()/1000);
  const hash=await tokenHash(token);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM EmailVerification WHERE expiresAt<=? OR userId=?').bind(now,userId),
    env.DB.prepare('INSERT INTO EmailVerification(tokenHash,userId,email,expiresAt) VALUES (?,?,?,?)').bind(hash,userId,user!.email,now+86400),
  ]);
  const url=new URL('/account',env.APP_URL); url.searchParams.set('verifyEmailToken',token);
  const result=await sendEmail(env,{to:user!.email,subject:'keirio メールアドレスの確認',html:renderEmail({heading:'メールアドレスを確認',bodyHtml:'24時間以内にログインした状態で確認してください。',actionLabel:'確認する',actionUrl:url.toString()}),text:`メールアドレスを確認: ${url}`});
  if(!result.sent) await env.DB.prepare('DELETE FROM EmailVerification WHERE tokenHash=?').bind(hash).run();
  return result;
}

export async function confirmEmailVerification(db:D1Database,userId:string,token:string) {
  if(!/^[a-f0-9]{64}$/.test(token)) badRequest('確認トークンが無効です');
  const hash=await tokenHash(token); const now=Math.floor(Date.now()/1000);
  // Both statements execute atomically; the first is authoritative for replay/expiry/ownership.
  const results=await db.batch([
    db.prepare(`UPDATE User SET emailVerifiedAt=? WHERE id=? AND EXISTS(SELECT 1 FROM EmailVerification v WHERE v.tokenHash=? AND v.userId=User.id AND v.email=User.email AND v.usedAt IS NULL AND v.expiresAt>?)`).bind(new Date().toISOString(),userId,hash,now),
    db.prepare('UPDATE EmailVerification SET usedAt=? WHERE tokenHash=? AND userId=? AND usedAt IS NULL AND expiresAt>?').bind(now,hash,userId,now),
  ]);
  if(!results[0].meta.changes) badRequest('確認トークンは無効、期限切れ、または使用済みです');
  return {emailVerified:true};
}

export async function listSessions(db:D1Database,userId:string,currentToken:string) {
  const hash=await tokenHash(currentToken); const now=Math.floor(Date.now()/1000);
  const result=await db.prepare('SELECT id,tokenHash,userAgent,createdAt,lastSeenAt,expiresAt FROM SessionActivity WHERE userId=? AND securityVersion=(SELECT securityVersion FROM User WHERE id=?) AND expiresAt>? AND tokenHash NOT IN (SELECT tokenHash FROM RevokedSession WHERE expiresAt>?) ORDER BY lastSeenAt DESC LIMIT 500').bind(userId,userId,now,now).all<{id:string;tokenHash:string;userAgent:string;createdAt:number;lastSeenAt:number;expiresAt:number}>();
  return result.results.map(({tokenHash:stored,...row})=>({...row,current:stored===hash}));
}

export async function deleteSession(db:D1Database,userId:string,id:string) {
  const result=await db.batch([
    db.prepare('INSERT OR IGNORE INTO RevokedSession(tokenHash,expiresAt) SELECT tokenHash,expiresAt FROM SessionActivity WHERE id=? AND userId=? AND expiresAt>?').bind(id,userId,Math.floor(Date.now()/1000)),
    db.prepare('DELETE FROM SessionActivity WHERE id=? AND userId=?').bind(id,userId),
  ]);
  if(!result[1].meta.changes) notFound('セッションが見つかりません');
  return {ok:true};
}

export async function logoutAll(db:D1Database,userId:string,password:string,code?:string) {
  const user=await prisma.user.findUnique({where:{id:userId}});
  if(!user || !await verifyPassword(password,user.passwordHash)) badRequest('パスワードが正しくありません');
  if(user!.twoFactorEnabled) {
    const valid=code && ((user!.twoFactorSecret && await verifyTOTP(user!.twoFactorSecret,code)) || await consumeBackupCode(userId,code));
    if(!valid) badRequest('認証コードが正しくありません');
  }
  await db.batch([
    db.prepare('UPDATE User SET securityVersion=securityVersion+1 WHERE id=?').bind(userId),
    db.prepare('DELETE FROM SessionActivity WHERE userId=?').bind(userId),
  ]);
  return {loggedOut:true};
}

export async function listNotifications(db:D1Database,userId:string) {
  return (await db.prepare('SELECT id,kind,message,createdAt,readAt FROM AccountNotification WHERE userId=? ORDER BY createdAt DESC,rowid DESC LIMIT 200').bind(userId).all()).results;
}
export async function readNotification(db:D1Database,userId:string,id:string) {
  const row=await db.prepare('UPDATE AccountNotification SET readAt=COALESCE(readAt,?) WHERE id=? AND userId=? RETURNING id').bind(Math.floor(Date.now()/1000),id,userId).first();
  if(!row) notFound('通知が見つかりません');
  return {ok:true};
}
