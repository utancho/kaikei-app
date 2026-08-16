import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { HttpError } from "../lib/httpError.js";

export function errorHandler(err: unknown, c: Context) {
  if (err instanceof ZodError) {
    return c.json({ error: "入力内容が正しくありません", details: err.flatten() }, 400);
  }
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status as ContentfulStatusCode);
  }
  console.error(err);
  return c.json({ error: "サーバーエラーが発生しました" }, 500);
}
