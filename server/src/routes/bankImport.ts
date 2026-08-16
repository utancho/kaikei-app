import { Hono } from "hono";
import { requireBusinessId } from "../lib/requestHelpers.js";
import { badRequest } from "../lib/httpError.js";
import { confirmRow, createImportBatch, getBatchRows, ignoreRow, listImportBatches } from "../services/bankImportService.js";
import type { AppEnv } from "../types/env.js";

export const bankImportRouter = new Hono<AppEnv>();

const MAX_FILE_SIZE = 5 * 1024 * 1024;

bankImportRouter.post("/upload", async (c) => {
  const businessId = requireBusinessId(c);
  const body = await c.req.parseBody();
  const accountId = body.accountId;
  const file = body.file;

  if (typeof accountId !== "string" || !accountId) badRequest("取込先の勘定科目(accountId)を指定してください");
  if (!(file instanceof File)) badRequest("ファイルが指定されていません");
  if (!file.name.toLowerCase().endsWith(".csv")) badRequest("CSVファイルのみアップロードできます");
  if (file.size > MAX_FILE_SIZE) badRequest("ファイルサイズは5MB以下にしてください");

  const content = await file.text();
  const batch = await createImportBatch(businessId, accountId as string, file.name, content);
  return c.json(batch, 201);
});

bankImportRouter.get("/batches", async (c) => {
  const businessId = requireBusinessId(c);
  return c.json(await listImportBatches(businessId));
});

bankImportRouter.get("/batches/:id/rows", async (c) => {
  const businessId = requireBusinessId(c);
  return c.json(await getBatchRows(businessId, c.req.param("id")));
});

bankImportRouter.post("/rows/:id/confirm", async (c) => {
  const businessId = requireBusinessId(c);
  const { counterpartAccountId, description } = (await c.req.json()) as {
    counterpartAccountId?: string;
    description?: string;
  };
  if (!counterpartAccountId) badRequest("相手勘定科目(counterpartAccountId)を指定してください");
  const entry = await confirmRow(businessId, c.req.param("id"), counterpartAccountId, description);
  return c.json(entry);
});

bankImportRouter.post("/rows/:id/ignore", async (c) => {
  const businessId = requireBusinessId(c);
  await ignoreRow(businessId, c.req.param("id"));
  return c.body(null, 204);
});
