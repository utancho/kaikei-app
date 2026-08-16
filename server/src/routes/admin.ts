import { Hono } from "hono";
import Stripe from "stripe";
import { z } from "zod";
import { getStats, listUsers, updateUserSubscription } from "../services/adminService.js";
import type { AppEnv } from "../types/env.js";

export const adminRouter = new Hono<AppEnv>();

adminRouter.get("/users", async (c) => {
  return c.json(await listUsers());
});

adminRouter.get("/stats", async (c) => {
  const stripe = c.env.STRIPE_SECRET_KEY
    ? new Stripe(c.env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() })
    : null;
  return c.json(await getStats(stripe, c.env.STRIPE_PRICE_ID));
});

const updateSubscriptionSchema = z.object({
  status: z.enum(["NONE", "TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"]),
});

adminRouter.patch("/users/:id/subscription", async (c) => {
  const { status } = updateSubscriptionSchema.parse(await c.req.json());
  const subscription = await updateUserSubscription(c.req.param("id"), status);
  return c.json(subscription);
});
