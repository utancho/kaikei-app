import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireBusinessId } from "../lib/requestHelpers.js";
import { templateInputSchema } from "../lib/zodSchemas.js";
import { createTemplate, deleteTemplate, listTemplates, updateTemplate } from "../services/templateService.js";

export const templatesRouter = Router();

templatesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    res.json(await listTemplates(businessId));
  })
);

templatesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const input = templateInputSchema.parse(req.body);
    res.status(201).json(await createTemplate(businessId, input));
  })
);

templatesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const input = templateInputSchema.parse(req.body);
    res.json(await updateTemplate(businessId, req.params.id, input));
  })
);

templatesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    await deleteTemplate(businessId, req.params.id);
    res.status(204).send();
  })
);
