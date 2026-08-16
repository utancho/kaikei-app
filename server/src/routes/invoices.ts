import { Hono } from "hono";
import { requireBusinessId } from "../lib/requestHelpers.js";
import { invoiceInputSchema } from "../lib/zodSchemas.js";
import { badRequest } from "../lib/httpError.js";
import {
  createInvoice,
  deleteInvoice,
  getInvoice,
  listInvoices,
  postInvoiceToJournal,
  recordInvoicePayment,
  updateInvoice,
} from "../services/invoiceService.js";
import type { AppEnv } from "../types/env.js";

export const invoicesRouter = new Hono<AppEnv>();

invoicesRouter.get("/", async (c) => {
  const businessId = requireBusinessId(c);
  return c.json(await listInvoices(businessId));
});

invoicesRouter.get("/:id", async (c) => {
  const businessId = requireBusinessId(c);
  return c.json(await getInvoice(businessId, c.req.param("id")));
});

invoicesRouter.post("/", async (c) => {
  const businessId = requireBusinessId(c);
  const input = invoiceInputSchema.parse(await c.req.json());
  return c.json(await createInvoice(businessId, input), 201);
});

invoicesRouter.put("/:id", async (c) => {
  const businessId = requireBusinessId(c);
  const input = invoiceInputSchema.parse(await c.req.json());
  return c.json(await updateInvoice(businessId, c.req.param("id"), input));
});

invoicesRouter.delete("/:id", async (c) => {
  const businessId = requireBusinessId(c);
  await deleteInvoice(businessId, c.req.param("id"));
  return c.body(null, 204);
});

invoicesRouter.post("/:id/post-journal", async (c) => {
  const businessId = requireBusinessId(c);
  return c.json(await postInvoiceToJournal(businessId, c.req.param("id")));
});

invoicesRouter.post("/:id/record-payment", async (c) => {
  const businessId = requireBusinessId(c);
  const { paymentAccountId, paymentDate } = (await c.req.json()) as { paymentAccountId?: string; paymentDate?: string };
  if (!paymentAccountId) badRequest("paymentAccountIdを指定してください");
  const date = paymentDate ? new Date(paymentDate) : new Date();
  return c.json(await recordInvoicePayment(businessId, c.req.param("id"), paymentAccountId!, date));
});
