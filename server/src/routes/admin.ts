import { Hono } from "hono";
import Stripe from "stripe";
import { z } from "zod";
import { getStats, listAllBusinesses, listUsers, updateUserRole, updateUserSubscription } from "../services/adminService.js";
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

adminRouter.get("/businesses", async (c) => {
  return c.json(await listAllBusinesses());
});

const updateSubscriptionSchema = z.object({
  status: z.enum(["NONE", "TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"]),
});

adminRouter.patch("/users/:id/subscription", async (c) => {
  const { status } = updateSubscriptionSchema.parse(await c.req.json());
  const subscription = await updateUserSubscription(c.req.param("id"), status);
  return c.json(subscription);
});

const updateRoleSchema = z.object({
  role: z.enum(["USER", "ADMIN"]),
});

adminRouter.patch("/users/:id/role", async (c) => {
  const { role } = updateRoleSchema.parse(await c.req.json());
  const user = await updateUserRole(c.get("userId"), c.req.param("id"), role);
  return c.json(user);
});
