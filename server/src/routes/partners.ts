import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireBusinessId } from "../lib/requestHelpers.js";
import { partnerInputSchema } from "../lib/zodSchemas.js";
import { notFound } from "../lib/httpError.js";

export const partnersRouter = Router();

partnersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const partners = await prisma.partner.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
    });
    res.json(partners);
  })
);

partnersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const input = partnerInputSchema.parse(req.body);
    const partner = await prisma.partner.create({
      data: { businessId, ...input, email: input.email || undefined },
    });
    res.status(201).json(partner);
  })
);

partnersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const existing = await prisma.partner.findFirst({ where: { id: req.params.id, businessId } });
    if (!existing) notFound("取引先が見つかりません");
    const input = partnerInputSchema.partial().parse(req.body);
    const partner = await prisma.partner.update({
      where: { id: req.params.id },
      data: { ...input, email: input.email || undefined },
    });
    res.json(partner);
  })
);

partnersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const existing = await prisma.partner.findFirst({ where: { id: req.params.id, businessId } });
    if (!existing) notFound("取引先が見つかりません");
    await prisma.partner.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
