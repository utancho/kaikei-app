import bcrypt from "bcryptjs";
import { sign, verify } from "hono/jwt";
import { Buffer } from "node:buffer";
import { badRequest } from "./httpError.js";

export const AUTH_COOKIE_NAME = "kaikei_session";
const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30日

export async function hashPassword(password: string): Promise<string> {
  // bcrypt ignores bytes beyond 72; never silently accept a different credential.
  if (new TextEncoder().encode(password).length > 72) badRequest("パスワードはUTF-8で72バイト以内にしてください");
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface TokenPayload {
  userId: string;
  exp: number;
  securityVersion?: number;
}

// Workersにはprocess.envに依存しないほうが安全なため、シークレットは
// 呼び出し元(Honoルート)が c.env.JWT_SECRET から明示的に渡す。
export async function signToken(payload: { userId: string; securityVersion?: number }, secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  return sign({ ...payload, securityVersion: payload.securityVersion ?? 0, jti: crypto.randomUUID(), exp }, secret, "HS256");
}

export async function verifyToken(token: string, secret: string): Promise<TokenPayload> {
  const parts = token.split(".");
  // HMAC signatures have equivalent base64 encodings; reject aliases before revocation lookup.
  if (parts.length !== 3 || !/^[A-Za-z0-9_-]{43}$/.test(parts[2]) || Buffer.from(parts[2], "base64url").toString("base64url") !== parts[2]) {
    throw new Error("Invalid session encoding");
  }
  return (await verify(token, secret, "HS256")) as unknown as TokenPayload;
}
