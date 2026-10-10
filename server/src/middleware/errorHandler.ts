import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { HttpError } from "../lib/httpError.js";
import { addAccountNotification } from "../lib/identitySecurity.js";

export async function errorHandler(err: unknown, c: Context) {
  if (err instanceof ZodError) {
    return c.json({ error: "入力内容が正しくありません", details: err.flatten() }, 400);
  }
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status as ContentfulStatusCode);
  }
  const message=err instanceof Error?err.message:String(err);
  if (/PERIOD_LOCKED/.test(message)) return c.json({error:"締め済み期間は変更できません。オーナーによる再開が必要です",code:"PERIOD_LOCKED"},409);
  if (/EVIDENCE_QUOTA|WORKFLOW_QUOTA|BUSINESS_HISTORY_QUOTA/.test(message)) return c.json({error:"保存枠の上限です。業務JSONを保存して運営へご連絡ください",code:"FREE_QUOTA"},413);
  if (/INVOICE_POSTED|INVOICE_POSTING_|InvoicePostingClaim/.test(message)) return c.json({error:'この請求書は計上済みか、請求書と仕訳の内容が一致しないため変更できません',code:'INVOICE_POSTING_CONFLICT'},409);
  if (/IMMUTABLE_HISTORY/.test(message)) return c.json({error:"変更履歴は変更・削除できません"},403);
  if (/INVOICE_PAYMENT_UNAVAILABLE|PAYMENT_CLAIM_IMMUTABLE|InvoicePaymentClaim/.test(message)) return c.json({error:"この請求書の入金は処理済みか、変更できない状態です"},409);
  console.error(err);
  if(c.get('userId')&&c.env?.DB){
    try { await addAccountNotification(c.env.DB,c.get('userId'),'SERVER_ERROR','処理中に問題が発生しました。再試行しても続く場合は運営へご連絡ください。'); } catch { /* DB outage remains visible in platform logs; never mask the original error. */ }
  }
  return c.json({ error: "サーバーエラーが発生しました" }, 500);
}
