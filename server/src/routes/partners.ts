import { Hono } from "hono";
import { prisma } from "../lib/prisma.js";
import { requireBusinessId } from "../lib/requestHelpers.js";
import { partnerInputSchema } from "../lib/zodSchemas.js";
import { notFound } from "../lib/httpError.js";
import type { AppEnv } from "../types/env.js";

export const partnersRouter = new Hono<AppEnv>();

partnersRouter.get("/", async (c) => {
  const businessId = requireBusinessId(c);
  const partners = await prisma.partner.findMany({
    where: { businessId },
    orderBy: { name: "asc" },
  });
  return c.json(partners);
});

partnersRouter.post("/", async (c) => {
  const businessId = requireBusinessId(c);
  const input = partnerInputSchema.parse(await c.req.json());
  const partner = await prisma.partner.create({
    data: { businessId, ...input, email: input.email || undefined },
  });
  return c.json(partner, 201);
});

partnersRouter.patch("/:id", async (c) => {
  const businessId = requireBusinessId(c);
  const existing = await prisma.partner.findFirst({ where: { id: c.req.param("id"), businessId } });
  if (!existing) notFound("取引先が見つかりません");
  const input = partnerInputSchema.partial().parse(await c.req.json());
  const partner = await prisma.partner.update({
    where: { id: c.req.param("id") },
    data: { ...input, email: input.email || undefined },
  });
  return c.json(partner);
});

partnersRouter.delete("/:id", async (c) => {
  const businessId = requireBusinessId(c);
  const existing = await prisma.partner.findFirst({ where: { id: c.req.param("id"), businessId } });
  if (!existing) notFound("取引先が見つかりません");
  await prisma.partner.delete({ where: { id: c.req.param("id") } });
  return c.body(null, 204);
});
