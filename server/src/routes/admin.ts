import { Hono } from "hono";
import Stripe from "stripe";
import { z } from "zod";
import {
  adminDisableTwoFactor,
  adminResetUserPassword,
  getStats,
  listAllBusinesses,
  listUsers,
  updateUserRole,
  updateUserSubscription,
} from "../services/adminService.js";
import { listAuditLogs } from "../services/auditService.js";
import { createBlogPost, deleteBlogPost, listAllBlogPosts, updateBlogPost } from "../services/blogService.js";
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
  const subscription = await updateUserSubscription(c.req.param("id"), status, c.get("userId"));
  return c.json(subscription);
});

adminRouter.get("/audit-logs", async (c) => {
  const limit = Number(c.req.query("limit")) || 100;
  return c.json(await listAuditLogs({ limit, action: c.req.query("action") }));
});

const updateRoleSchema = z.object({
  role: z.enum(["USER", "ADMIN"]),
});

adminRouter.patch("/users/:id/role", async (c) => {
  const { role } = updateRoleSchema.parse(await c.req.json());
  const user = await updateUserRole(c.get("userId"), c.req.param("id"), role);
  return c.json(user);
});

const resetPasswordSchema = z.object({
  password: z.string().min(8, "パスワードは8文字以上で入力してください").optional(),
});

adminRouter.post("/users/:id/reset-password", async (c) => {
  const { password } = resetPasswordSchema.parse(await c.req.json().catch(() => ({})));
  const result = await adminResetUserPassword(c.env.DB, c.req.param("id"), password, c.get("userId"));
  return c.json(result);
});

adminRouter.post("/users/:id/disable-2fa", async (c) => {
  const result = await adminDisableTwoFactor(c.req.param("id"), c.get("userId"));
  return c.json(result);
});

const blogPostInputSchema = z.object({
  title: z.string().trim().min(1, "タイトルを入力してください").max(120),
  slug: z
    .string()
    .trim()
    .min(1, "URLスラッグを入力してください")
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "URLスラッグは半角英小文字・数字・ハイフンで入力してください"),
  excerpt: z.string().max(240).nullable().optional(),
  content: z.string().trim().min(1, "本文を入力してください").max(100000),
  coverImageUrl: z.string().url("画像URLの形式が正しくありません").max(2048).nullable().optional(),
  category: z.string().max(50).nullable().optional(),
  published: z.boolean(),
});

adminRouter.get("/blog", async (c) => {
  return c.json(await listAllBlogPosts());
});

adminRouter.post("/blog", async (c) => {
  const input = blogPostInputSchema.parse(await c.req.json());
  return c.json(await createBlogPost(input), 201);
});

adminRouter.put("/blog/:id", async (c) => {
  const input = blogPostInputSchema.parse(await c.req.json());
  return c.json(await updateBlogPost(c.req.param("id"), input));
});

adminRouter.delete("/blog/:id", async (c) => {
  await deleteBlogPost(c.req.param("id"));
  return c.body(null, 204);
});
