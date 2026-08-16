import Stripe from "stripe";
import { HttpError } from "./httpError.js";

const key = process.env.STRIPE_SECRET_KEY;

// STRIPE_SECRET_KEY未設定でもサーバー自体は起動できるようにし、
// 課金関連エンドポイントを呼び出した時にだけエラーにする(決済機能を後から有効化できるように)。
export const stripe = key ? new Stripe(key) : null;

export function requireStripe(): Stripe {
  if (!stripe) {
    throw new HttpError(503, "決済機能は現在準備中です。しばらくしてから再度お試しください。");
  }
  return stripe;
}
