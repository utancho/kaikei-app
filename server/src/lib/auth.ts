import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const AUTH_COOKIE_NAME = "kaikei_session";
const TOKEN_TTL = "30d";

// process.env.JWT_SECRET はモジュール読み込み時ではなく呼び出し時に読む。
// ESMではimportが他の文より先に評価される(hoistingされる)ため、
// dotenvによる.env読み込みより前にこのモジュールが評価されるケースがあり、
// トップレベルで固定値を読むと未設定エラーになってしまうため。
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface TokenPayload {
  userId: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, getJwtSecret()) as TokenPayload;
}
