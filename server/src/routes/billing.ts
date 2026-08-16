import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireStripe } from "../lib/stripe.js";
import { badRequest } from "../lib/httpError.js";
import { createCheckoutSession, createPortalSession, handleStripeWebhookEvent } from "../services/billingService.js";
import { prisma } from "../lib/prisma.js";

export const billingRouter = Router();

billingRouter.get(
  "/status",
  asyncHandler(async (req, res) => {
    const subscription = await prisma.subscription.findUnique({ where: { userId: req.userId! } });
    res.json(subscription ?? { status: "NONE" });
  })
);

billingRouter.post(
  "/checkout",
  asyncHandler(async (req, res) => {
    res.json(await createCheckoutSession(req.userId!));
  })
);

billingRouter.post(
  "/portal",
  asyncHandler(async (req, res) => {
    res.json(await createPortalSession(req.userId!));
  })
);

// Stripe Webhook: index.ts で express.raw() を使ってマウントするため、
// このルーターは webhook 用に別途エクスポートする。
export const stripeWebhookHandler = asyncHandler(async (req, res) => {
  const stripe = requireStripe();
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) badRequest("Webhook設定が不足しています");

  const event = stripe.webhooks.constructEvent(req.body, signature as string, webhookSecret as string);
  await handleStripeWebhookEvent(event);
  res.json({ received: true });
});
