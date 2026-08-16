import { prisma } from "../lib/prisma.js";
import { badRequest } from "../lib/httpError.js";
import type Stripe from "stripe";

const TRIAL_DAYS = 14;

async function ensureStripeCustomer(stripe: Stripe, userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const subscription = await prisma.subscription.findUnique({ where: { userId } });

  if (subscription?.stripeCustomerId) return subscription.stripeCustomerId;

  const customer = await stripe.customers.create({ email: user.email, metadata: { userId } });
  await prisma.subscription.upsert({
    where: { userId },
    update: { stripeCustomerId: customer.id },
    create: { userId, stripeCustomerId: customer.id, status: "NONE" },
  });
  return customer.id;
}

export async function createCheckoutSession(stripe: Stripe, userId: string, priceId: string | undefined, appUrl: string) {
  if (!priceId) badRequest("STRIPE_PRICE_ID が設定されていません");

  const customerId = await ensureStripeCustomer(stripe, userId);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { trial_period_days: TRIAL_DAYS },
    success_url: `${appUrl}/billing/success`,
    cancel_url: `${appUrl}/billing`,
  });

  return { url: session.url };
}

export async function createPortalSession(stripe: Stripe, userId: string, appUrl: string) {
  const customerId = await ensureStripeCustomer(stripe, userId);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/billing`,
  });
  return { url: session.url };
}

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
    case "paused":
    default:
      return "CANCELED";
  }
}

async function syncSubscriptionFromStripe(stripeSubscription: Stripe.Subscription) {
  const customerId =
    typeof stripeSubscription.customer === "string" ? stripeSubscription.customer : stripeSubscription.customer.id;
  const existing = await prisma.subscription.findUnique({ where: { stripeCustomerId: customerId } });
  if (!existing) return;

  const item = stripeSubscription.items.data[0];
  await prisma.subscription.update({
    where: { userId: existing.userId },
    data: {
      stripeSubscriptionId: stripeSubscription.id,
      status: mapStripeStatus(stripeSubscription.status),
      priceId: item?.price.id,
      currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
    },
  });
}

export async function handleStripeWebhookEvent(stripe: Stripe, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscriptionId =
        event.type === "checkout.session.completed"
          ? (event.data.object as Stripe.Checkout.Session).subscription
          : (event.data.object as Stripe.Subscription).id;
      if (!subscriptionId) break;
      const id = typeof subscriptionId === "string" ? subscriptionId : subscriptionId.id;
      const subscription = await stripe.subscriptions.retrieve(id);
      await syncSubscriptionFromStripe(subscription);
      break;
    }
    default:
      break;
  }
}
