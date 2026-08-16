import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireBusinessId } from "../lib/requestHelpers.js";
import { badRequest } from "../lib/httpError.js";
import {
  confirmRow,
  createImportBatch,
  getBatchRows,
  ignoreRow,
  listImportBatches,
} from "../services/bankImportService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith(".csv")) {
      cb(new Error("CSVファイルのみアップロードできます"));
      return;
    }
    cb(null, true);
  },
});

export const bankImportRouter = Router();

bankImportRouter.post(
  "/upload",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const accountId = req.body.accountId as string;
    if (!accountId) badRequest("取込先の勘定科目(accountId)を指定してください");
    if (!req.file) badRequest("ファイルが指定されていません");

    const content = req.file!.buffer.toString("utf-8");
    const batch = await createImportBatch(businessId, accountId, req.file!.originalname, content);
    res.status(201).json(batch);
  })
);

bankImportRouter.get(
  "/batches",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    res.json(await listImportBatches(businessId));
  })
);

bankImportRouter.get(
  "/batches/:id/rows",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    res.json(await getBatchRows(businessId, req.params.id));
  })
);

bankImportRouter.post(
  "/rows/:id/confirm",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    const { counterpartAccountId, description } = req.body as {
      counterpartAccountId?: string;
      description?: string;
    };
    if (!counterpartAccountId) badRequest("相手勘定科目(counterpartAccountId)を指定してください");
    const entry = await confirmRow(businessId, req.params.id, counterpartAccountId, description);
    res.json(entry);
  })
);

bankImportRouter.post(
  "/rows/:id/ignore",
  asyncHandler(async (req, res) => {
    const businessId = requireBusinessId(req);
    await ignoreRow(businessId, req.params.id);
    res.status(204).send();
  })
);
