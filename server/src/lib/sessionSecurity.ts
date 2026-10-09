import type { TokenPayload } from "./auth.js";

export async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function matchesSecurityVersion(payload: TokenPayload, version: number) {
  const supplied = payload.securityVersion ?? 0;
  return typeof payload.userId === "string" && payload.userId.length > 0 &&
    Number.isSafeInteger(payload.exp) && payload.exp > Math.floor(Date.now() / 1000) &&
    Number.isSafeInteger(supplied) && supplied >= 0 && supplied === version;
}

export async function isSessionRevoked(db: D1Database, token: string) {
  return Boolean(await db.prepare('SELECT tokenHash FROM RevokedSession WHERE tokenHash=? AND expiresAt>?')
    .bind(await tokenHash(token), Math.floor(Date.now() / 1000)).first());
}

export async function revokeSession(db: D1Database, token: string, exp: number) {
  await db.batch([
    db.prepare('DELETE FROM RevokedSession WHERE expiresAt<=?').bind(Math.floor(Date.now() / 1000)),
    db.prepare('INSERT OR IGNORE INTO RevokedSession(tokenHash,expiresAt) VALUES (?,?)').bind(await tokenHash(token), exp),
  ]);
}
