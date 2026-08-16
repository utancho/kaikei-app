import { Hono } from "hono";
import { requireBusinessId } from "../lib/requestHelpers.js";
import { budgetBulkInputSchema } from "../lib/zodSchemas.js";
import { getBudgetActual, listBudgets, upsertBudgets } from "../services/budgetService.js";
import type { AppEnv } from "../types/env.js";

export const budgetsRouter = new Hono<AppEnv>();

budgetsRouter.get("/", async (c) => {
  const businessId = requireBusinessId(c);
  const year = Number(c.req.query("year")) || new Date().getFullYear();
  return c.json(await listBudgets(businessId, year));
});

budgetsRouter.get("/actual", async (c) => {
  const businessId = requireBusinessId(c);
  const year = Number(c.req.query("year")) || new Date().getFullYear();
  return c.json(await getBudgetActual(businessId, year));
});

budgetsRouter.put("/", async (c) => {
  const businessId = requireBusinessId(c);
  const { entries } = budgetBulkInputSchema.parse(await c.req.json());
  const result = await upsertBudgets(businessId, entries);
  return c.json(result);
});
