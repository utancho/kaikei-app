import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
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

export const invoicesRouter = Router();

invoicesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    res.json(await listInvoices(businessId));
  })
);

invoicesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    res.json(await getInvoice(businessId, req.params.id));
  })
);

invoicesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const input = invoiceInputSchema.parse(req.body);
    res.status(201).json(await createInvoice(businessId, input));
  })
);

invoicesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const input = invoiceInputSchema.parse(req.body);
    res.json(await updateInvoice(businessId, req.params.id, input));
  })
);

invoicesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    await deleteInvoice(businessId, req.params.id);
    res.status(204).send();
  })
);

invoicesRouter.post(
  "/:id/post-journal",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    res.json(await postInvoiceToJournal(businessId, req.params.id));
  })
);

invoicesRouter.post(
  "/:id/record-payment",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const { paymentAccountId, paymentDate } = req.body as { paymentAccountId?: string; paymentDate?: string };
    if (!paymentAccountId) badRequest("paymentAccountIdを指定してください");
    const date = paymentDate ? new Date(paymentDate) : new Date();
    res.json(await recordInvoicePayment(businessId, req.params.id, paymentAccountId!, date));
  })
);
