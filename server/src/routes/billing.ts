import { Hono } from "hono";
import { getStripe } from "../lib/stripe.js";
import { badRequest } from "../lib/httpError.js";
import { createCheckoutSession, createPortalSession, handleStripeWebhookEvent } from "../services/billingService.js";
import { prisma } from "../lib/prisma.js";
import type { AppEnv } from "../types/env.js";

export const billingRouter = new Hono<AppEnv>();

billingRouter.get("/status", async (c) => {
  const subscription = await prisma.subscription.findUnique({ where: { userId: c.get("userId") } });
  return c.json(subscription ?? { status: "NONE" });
});

billingRouter.post("/checkout", async (c) => {
  const stripe = getStripe(c.env.STRIPE_SECRET_KEY);
  return c.json(await createCheckoutSession(stripe, c.get("userId"), c.env.STRIPE_PRICE_ID, c.env.APP_URL));
});

billingRouter.post("/portal", async (c) => {
  const stripe = getStripe(c.env.STRIPE_SECRET_KEY);
  return c.json(await createPortalSession(stripe, c.get("userId"), c.env.APP_URL));
});

// Stripe Webhook: 署名検証には生のリクエストボディが必要。
// Workersの同期crypto APIは使えないため、非同期版の constructEventAsync を使う。
export const webhookRouter = new Hono<AppEnv>();

webhookRouter.post("/", async (c) => {
  const stripe = getStripe(c.env.STRIPE_SECRET_KEY);
  const signature = c.req.header("stripe-signature");
  const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) badRequest("Webhook設定が不足しています");

  const rawBody = await c.req.text();
  const event = await stripe.webhooks.constructEventAsync(rawBody, signature as string, webhookSecret as string);
  await handleStripeWebhookEvent(stripe, event);
  return c.json({ received: true });
});
