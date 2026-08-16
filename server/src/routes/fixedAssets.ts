import { Hono } from "hono";
import { requireBusinessId } from "../lib/requestHelpers.js";
import { fixedAssetInputSchema } from "../lib/zodSchemas.js";
import { badRequest } from "../lib/httpError.js";
import {
  createFixedAsset,
  deleteFixedAsset,
  getFixedAsset,
  listFixedAssets,
  postDepreciationForFiscalYear,
} from "../services/fixedAssetService.js";
import type { AppEnv } from "../types/env.js";

export const fixedAssetsRouter = new Hono<AppEnv>();

fixedAssetsRouter.get("/", async (c) => {
  const businessId = requireBusinessId(c);
  return c.json(await listFixedAssets(businessId));
});

fixedAssetsRouter.get("/:id", async (c) => {
  const businessId = requireBusinessId(c);
  return c.json(await getFixedAsset(businessId, c.req.param("id")));
});

fixedAssetsRouter.post("/", async (c) => {
  const businessId = requireBusinessId(c);
  const input = fixedAssetInputSchema.parse(await c.req.json());
  return c.json(await createFixedAsset(businessId, input), 201);
});

fixedAssetsRouter.delete("/:id", async (c) => {
  const businessId = requireBusinessId(c);
  await deleteFixedAsset(businessId, c.req.param("id"));
  return c.body(null, 204);
});

fixedAssetsRouter.post("/:id/post-depreciation", async (c) => {
  const businessId = requireBusinessId(c);
  const { fiscalYearId } = (await c.req.json()) as { fiscalYearId?: string };
  if (!fiscalYearId) badRequest("fiscalYearIdを指定してください");
  const entry = await postDepreciationForFiscalYear(businessId, c.req.param("id"), fiscalYearId!);
  return c.json(entry);
});
