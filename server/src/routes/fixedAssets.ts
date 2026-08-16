import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
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

export const fixedAssetsRouter = Router();

fixedAssetsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    res.json(await listFixedAssets(businessId));
  })
);

fixedAssetsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    res.json(await getFixedAsset(businessId, req.params.id));
  })
);

fixedAssetsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const input = fixedAssetInputSchema.parse(req.body);
    res.status(201).json(await createFixedAsset(businessId, input));
  })
);

fixedAssetsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    await deleteFixedAsset(businessId, req.params.id);
    res.status(204).send();
  })
);

fixedAssetsRouter.post(
  "/:id/post-depreciation",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const { fiscalYearId } = req.body as { fiscalYearId?: string };
    if (!fiscalYearId) badRequest("fiscalYearIdを指定してください");
    const entry = await postDepreciationForFiscalYear(businessId, req.params.id, fiscalYearId!);
    res.json(entry);
  })
);
