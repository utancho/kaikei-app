import { Hono } from "hono";
import { requireBusinessId } from "../lib/requestHelpers.js";
import { badRequest } from "../lib/httpError.js";
import { analyzeReceiptImage, suggestAccountId } from "../services/receiptService.js";
import type { AppEnv } from "../types/env.js";

export const receiptsRouter = new Hono<AppEnv>();

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

receiptsRouter.post("/analyze", async (c) => {
  if(c.env.FREE_TIER_MODE==='true') return c.json({error:"追加課金を避けるため、外部AI読取は停止しています。実務管理で原本を保存し、過去の仕訳候補または手入力をご利用ください",code:"FREE_TIER_AI_DISABLED"},503);
  const businessId = requireBusinessId(c);
  const body = await c.req.parseBody();
  const file = body.file;

  if (!(file instanceof File)) badRequest("画像ファイルが指定されていません");
  if (!ALLOWED_TYPES.has(file.type)) badRequest("JPEG・PNG・WebP形式の画像のみアップロードできます");
  if (file.size > MAX_FILE_SIZE) badRequest("ファイルサイズは8MB以下にしてください");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const extraction = await analyzeReceiptImage(c.env.AI, bytes);

  const searchText = [extraction.vendorName, extraction.description].filter(Boolean).join(" ");
  const suggestedAccountId = searchText ? await suggestAccountId(businessId, searchText) : null;

  return c.json({ ...extraction, suggestedAccountId });
});
