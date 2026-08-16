import { Hono } from "hono";
import { requireBusinessId, parseDateParam } from "../lib/requestHelpers.js";
import { journalEntryInputSchema } from "../lib/zodSchemas.js";
import {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntry,
  listJournalEntries,
  updateJournalEntry,
} from "../services/journalEntryService.js";
import type { AppEnv } from "../types/env.js";

export const journalEntriesRouter = new Hono<AppEnv>();

journalEntriesRouter.get("/", async (c) => {
  const businessId = requireBusinessId(c);
  const entries = await listJournalEntries(businessId, {
    from: parseDateParam(c.req.query("from")),
    to: parseDateParam(c.req.query("to")),
    accountId: c.req.query("accountId"),
    keyword: c.req.query("keyword"),
  });
  return c.json(entries);
});

journalEntriesRouter.get("/:id", async (c) => {
  const businessId = requireBusinessId(c);
  const entry = await getJournalEntry(businessId, c.req.param("id"));
  return c.json(entry);
});

journalEntriesRouter.post("/", async (c) => {
  const businessId = requireBusinessId(c);
  const input = journalEntryInputSchema.parse(await c.req.json());
  const entry = await createJournalEntry(businessId, input);
  return c.json(entry, 201);
});

journalEntriesRouter.put("/:id", async (c) => {
  const businessId = requireBusinessId(c);
  const input = journalEntryInputSchema.parse(await c.req.json());
  const entry = await updateJournalEntry(businessId, c.req.param("id"), input);
  return c.json(entry);
});

journalEntriesRouter.delete("/:id", async (c) => {
  const businessId = requireBusinessId(c);
  await deleteJournalEntry(businessId, c.req.param("id"));
  return c.body(null, 204);
});
