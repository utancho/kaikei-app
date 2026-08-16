export interface Bindings {
  DB: D1Database;
  JWT_SECRET: string;
  APP_URL: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_ID?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  ENVIRONMENT?: string;
}

export interface Variables {
  userId: string;
  business?: { id: string; ownerId: string };
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: Variables;
}
