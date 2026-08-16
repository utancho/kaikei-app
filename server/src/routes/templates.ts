import { Hono } from "hono";
import { requireBusinessId } from "../lib/requestHelpers.js";
import { templateInputSchema } from "../lib/zodSchemas.js";
import { createTemplate, deleteTemplate, listTemplates, updateTemplate } from "../services/templateService.js";
import type { AppEnv } from "../types/env.js";

export const templatesRouter = new Hono<AppEnv>();

templatesRouter.get("/", async (c) => {
  const businessId = requireBusinessId(c);
  return c.json(await listTemplates(businessId));
});

templatesRouter.post("/", async (c) => {
  const businessId = requireBusinessId(c);
  const input = templateInputSchema.parse(await c.req.json());
  return c.json(await createTemplate(businessId, input), 201);
});

templatesRouter.put("/:id", async (c) => {
  const businessId = requireBusinessId(c);
  const input = templateInputSchema.parse(await c.req.json());
  return c.json(await updateTemplate(businessId, c.req.param("id"), input));
});

templatesRouter.delete("/:id", async (c) => {
  const businessId = requireBusinessId(c);
  await deleteTemplate(businessId, c.req.param("id"));
  return c.body(null, 204);
});
