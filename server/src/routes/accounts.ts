import { Hono } from "hono";
import { prisma } from "../lib/prisma.js";
import { requireBusinessId } from "../lib/requestHelpers.js";
import { accountInputSchema } from "../lib/zodSchemas.js";
import { normalBalanceForCategory } from "../lib/enums.js";
import type { AccountCategory } from "../lib/enums.js";
import { notFound } from "../lib/httpError.js";
import type { AppEnv } from "../types/env.js";

export const accountsRouter = new Hono<AppEnv>();

accountsRouter.get("/", async (c) => {
  const businessId = requireBusinessId(c);
  const includeInactive = c.req.query("includeInactive") === "true";
  const accounts = await prisma.account.findMany({
    where: { businessId, ...(includeInactive ? {} : { isActive: true }) },
    include: { subAccounts: true, defaultTaxCategory: true },
    orderBy: [{ category: "asc" }, { displayOrder: "asc" }],
  });
  return c.json(accounts);
});

accountsRouter.post("/", async (c) => {
  const businessId = requireBusinessId(c);
  const input = accountInputSchema.parse(await c.req.json());
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
  return c.json(account, 201);
});

accountsRouter.patch("/:id", async (c) => {
  const businessId = requireBusinessId(c);
  const existing = await prisma.account.findFirst({ where: { id: c.req.param("id"), businessId } });
  if (!existing) notFound("勘定科目が見つかりません");
  const body = await c.req.json();
  const input = accountInputSchema
    .pick({ name: true, subcategory: true, defaultTaxCategoryId: true })
    .partial()
    .parse(body);
  const account = await prisma.account.update({
    where: { id: c.req.param("id") },
    data: {
      name: input.name,
      subcategory: input.subcategory,
      defaultTaxCategoryId: input.defaultTaxCategoryId || undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    },
  });
  return c.json(account);
});

export const taxCategoriesRouter = new Hono<AppEnv>();

taxCategoriesRouter.get("/", async (c) => {
  const categories = await prisma.taxCategory.findMany({ orderBy: { code: "asc" } });
  return c.json(categories);
});
