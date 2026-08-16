import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireBusinessId } from "../lib/requestHelpers.js";
import { accountInputSchema } from "../lib/zodSchemas.js";
import { normalBalanceForCategory } from "../lib/enums.js";
import type { AccountCategory } from "../lib/enums.js";
import { notFound } from "../lib/httpError.js";

export const accountsRouter = Router();

accountsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const includeInactive = req.query.includeInactive === "true";
    const accounts = await prisma.account.findMany({
      where: { businessId, ...(includeInactive ? {} : { isActive: true }) },
      include: { subAccounts: true, defaultTaxCategory: true },
      orderBy: [{ category: "asc" }, { displayOrder: "asc" }],
    });
    res.json(accounts);
  })
);

accountsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const input = accountInputSchema.parse(req.body);
    const maxOrder = await prisma.account.aggregate({
      where: { businessId },
      _max: { displayOrder: true },
    });
    const account = await prisma.account.create({
      data: {
        businessId,
        code: input.code,
        name: input.name,
        category: input.category,
        subcategory: input.subcategory,
        normalBalance: normalBalanceForCategory(input.category as AccountCategory),
        isDefault: false,
        displayOrder: (maxOrder._max.displayOrder ?? 0) + 1,
        defaultTaxCategoryId: input.defaultTaxCategoryId || undefined,
      },
    });
    res.status(201).json(account);
  })
);

accountsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const existing = await prisma.account.findFirst({ where: { id: req.params.id, businessId } });
    if (!existing) notFound("勘定科目が見つかりません");
    const input = accountInputSchema
      .pick({ name: true, subcategory: true, defaultTaxCategoryId: true })
      .partial()
      .parse(req.body);
    const account = await prisma.account.update({
      where: { id: req.params.id },
      data: {
        name: input.name,
        subcategory: input.subcategory,
        defaultTaxCategoryId: input.defaultTaxCategoryId || undefined,
        isActive: typeof req.body.isActive === "boolean" ? req.body.isActive : undefined,
      },
    });
    res.json(account);
  })
);

export const taxCategoriesRouter = Router();

taxCategoriesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const categories = await prisma.taxCategory.findMany({ orderBy: { code: "asc" } });
    res.json(categories);
  })
);
