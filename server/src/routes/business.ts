import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { notFound } from "../lib/httpError.js";
import { businessInputSchema } from "../lib/zodSchemas.js";
import { createBusinessWithDefaults } from "../services/businessService.js";

export const businessRouter = Router();

businessRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const businesses = await prisma.business.findMany({
      where: { ownerId: req.userId },
      orderBy: { createdAt: "asc" },
    });
    res.json(businesses);
  })
);

businessRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const business = await prisma.business.findFirst({ where: { id: req.params.id, ownerId: req.userId } });
    if (!business) notFound("事業者が見つかりません");
    res.json(business);
  })
);

businessRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = businessInputSchema.parse(req.body);
    const { business } = await createBusinessWithDefaults(req.userId!, input);
    res.status(201).json(business);
  })
);

businessRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.business.findFirst({ where: { id: req.params.id, ownerId: req.userId } });
    if (!existing) notFound("事業者が見つかりません");
    const input = businessInputSchema.partial().parse(req.body);
    const business = await prisma.business.update({
      where: { id: req.params.id },
      data: input,
    });
    res.json(business);
  })
);

businessRouter.get(
  "/:id/fiscal-years",
  asyncHandler(async (req, res) => {
    const existing = await prisma.business.findFirst({ where: { id: req.params.id, ownerId: req.userId } });
    if (!existing) notFound("事業者が見つかりません");
    const fiscalYears = await prisma.fiscalYear.findMany({
      where: { businessId: req.params.id },
      orderBy: { startDate: "desc" },
    });
    res.json(fiscalYears);
  })
);
