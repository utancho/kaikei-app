import bcrypt from "bcryptjs";
import { sign, verify } from "hono/jwt";

export const AUTH_COOKIE_NAME = "kaikei_session";
const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30日

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface TokenPayload {
  userId: string;
  exp: number;
}

// Workersにはprocess.envに依存しないほうが安全なため、シークレットは
// 呼び出し元(Honoルート)が c.env.JWT_SECRET から明示的に渡す。
export async function signToken(payload: { userId: string }, secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  return sign({ ...payload, exp }, secret, "HS256");
}

export async function verifyToken(token: string, secret: string): Promise<TokenPayload> {
  return (await verify(token, secret, "HS256")) as unknown as TokenPayload;
}
