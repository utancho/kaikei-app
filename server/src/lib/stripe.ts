import Stripe from "stripe";
import { HttpError } from "./httpError.js";

// Cloudflare WorkersにはNodeのhttp/httpsモジュールがないため、
// fetchベースのHTTPクライアントを明示的に指定する。
export function getStripe(secretKey: string | undefined): Stripe {
  if (!secretKey) {
    throw new HttpError(503, "決済機能は現在準備中です。しばらくしてから再度お試しください。");
  }
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}
