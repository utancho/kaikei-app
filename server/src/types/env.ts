export interface Bindings {
  ASSETS: Fetcher;
  DB: D1Database;
  AI: Ai;
  JWT_SECRET: string;
  TOTP_ENCRYPTION_KEY?: string;
  APP_URL: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_ID?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  // メール送信(Resend)。未設定ならメール機能は無効(準備中)として扱う。
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  ENVIRONMENT?: string;
  FREE_TIER_MODE?: string;
}

export interface Variables {
  userId: string;
  business?: { id: string; ownerId: string };
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: Variables;
}
