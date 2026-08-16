import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/httpError.js";
import { businessInputSchema } from "../lib/zodSchemas.js";
import { createBusinessWithDefaults } from "../services/businessService.js";
import { inviteMember, listMembers, removeMember } from "../services/memberService.js";
import { requireActiveSubscription } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

export const businessRouter = new Hono<AppEnv>();

async function findAccessibleBusiness(id: string, userId: string) {
  return prisma.business.findFirst({
    where: { id, OR: [{ ownerId: userId }, { members: { some: { userId, status: "ACTIVE" } } }] },
  });
}

businessRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const businesses = await prisma.business.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId, status: "ACTIVE" } } }] },
    orderBy: { createdAt: "asc" },
  });
  return c.json(businesses.map((b) => ({ ...b, isOwner: b.ownerId === userId })));
});

businessRouter.get("/:id", async (c) => {
  const business = await findAccessibleBusiness(c.req.param("id"), c.get("userId"));
  if (!business) notFound("事業者が見つかりません");
  return c.json({ ...business, isOwner: business!.ownerId === c.get("userId") });
});

businessRouter.post("/", requireActiveSubscription, async (c) => {
  const input = businessInputSchema.parse(await c.req.json());
  const { business } = await createBusinessWithDefaults(c.get("userId"), input);
  return c.json(business, 201);
});

businessRouter.patch("/:id", async (c) => {
  const existing = await prisma.business.findFirst({ where: { id: c.req.param("id"), ownerId: c.get("userId") } });
  if (!existing) notFound("事業者が見つかりません(オーナーのみ設定を変更できます)");
  const input = businessInputSchema.partial().parse(await c.req.json());
  const business = await prisma.business.update({
    where: { id: c.req.param("id") },
    data: input,
  });
  return c.json(business);
});

businessRouter.get("/:id/fiscal-years", async (c) => {
  const existing = await findAccessibleBusiness(c.req.param("id"), c.get("userId"));
  if (!existing) notFound("事業者が見つかりません");
  const fiscalYears = await prisma.fiscalYear.findMany({
    where: { businessId: c.req.param("id") },
    orderBy: { startDate: "desc" },
  });
  return c.json(fiscalYears);
});

businessRouter.get("/:id/members", async (c) => {
  const existing = await findAccessibleBusiness(c.req.param("id"), c.get("userId"));
  if (!existing) notFound("事業者が見つかりません");
  return c.json(await listMembers(c.req.param("id")));
});

const inviteInputSchema = z.object({ email: z.string().email("有効なメールアドレスを入力してください") });

businessRouter.post("/:id/members", async (c) => {
  const existing = await prisma.business.findFirst({ where: { id: c.req.param("id"), ownerId: c.get("userId") } });
  if (!existing) notFound("事業者が見つかりません(オーナーのみメンバーを招待できます)");
  const { email } = inviteInputSchema.parse(await c.req.json());
  const member = await inviteMember(c.req.param("id"), email);
  return c.json(member, 201);
});

businessRouter.delete("/:id/members/:memberId", async (c) => {
  const existing = await prisma.business.findFirst({ where: { id: c.req.param("id"), ownerId: c.get("userId") } });
  if (!existing) notFound("事業者が見つかりません(オーナーのみメンバーを削除できます)");
  await removeMember(c.req.param("id"), c.req.param("memberId"));
  return c.body(null, 204);
});
