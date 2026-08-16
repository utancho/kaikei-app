import type { Context } from "hono";
import { badRequest } from "./httpError.js";

// クライアントは常にクエリパラメータ ?businessId=... を付与する規約になっている
// (POST/PUT/DELETEでも同様。verifyBusinessAccessミドルウェアもこれを前提にしている)。
export function requireBusinessId(c: Context): string {
  const businessId = c.req.query("businessId");
  if (!businessId) badRequest("businessId is required");
  return businessId;
}

export function parseDateParam(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}
