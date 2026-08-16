import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireBusinessId, parseDateParam } from "../lib/requestHelpers.js";
import { journalEntryInputSchema } from "../lib/zodSchemas.js";
import {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntry,
  listJournalEntries,
  updateJournalEntry,
} from "../services/journalEntryService.js";

export const journalEntriesRouter = Router();

journalEntriesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const entries = await listJournalEntries(businessId, {
      from: parseDateParam(req.query.from),
      to: parseDateParam(req.query.to),
      accountId: req.query.accountId as string | undefined,
      keyword: req.query.keyword as string | undefined,
    });
    res.json(entries);
  })
);

journalEntriesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const entry = await getJournalEntry(businessId, req.params.id);
    res.json(entry);
  })
);

journalEntriesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const input = journalEntryInputSchema.parse(req.body);
    const entry = await createJournalEntry(businessId, input);
    res.status(201).json(entry);
  })
);

journalEntriesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const input = journalEntryInputSchema.parse(req.body);
    const entry = await updateJournalEntry(businessId, req.params.id, input);
    res.json(entry);
  })
);

journalEntriesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    await deleteJournalEntry(businessId, req.params.id);
    res.status(204).send();
  })
);
