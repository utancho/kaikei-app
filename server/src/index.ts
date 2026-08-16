import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";

// cwd に依存せず、このファイルの場所を基準に server/.env を読み込む
// (本番プラットフォームが環境変数を直接注入する場合は .env が無くても問題ない)
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import { billingRouter, stripeWebhookHandler } from "./routes/billing.js";
import { businessRouter } from "./routes/business.js";
import { accountsRouter, taxCategoriesRouter } from "./routes/accounts.js";
import { partnersRouter } from "./routes/partners.js";
import { journalEntriesRouter } from "./routes/journalEntries.js";
import { reportsRouter } from "./routes/reports.js";
import { invoicesRouter } from "./routes/invoices.js";
import { bankImportRouter } from "./routes/bankImport.js";
import { fixedAssetsRouter } from "./routes/fixedAssets.js";
import { templatesRouter } from "./routes/templates.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireActiveSubscription, requireAuth, verifyBusinessOwnership } from "./middleware/auth.js";

const app = express();
const port = Number(process.env.PORT) || 4000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors({ origin: true, credentials: true }));

// Stripe Webhookは署名検証のため生のリクエストボディが必要なので、
// express.json() より前に、このルートだけ raw ボディで受け取る。
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);

app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/billing", requireAuth, billingRouter);

const businessScoped = [requireAuth, requireActiveSubscription, verifyBusinessOwnership];

app.use("/api/businesses", requireAuth, requireActiveSubscription, businessRouter);
app.use("/api/accounts", ...businessScoped, accountsRouter);
app.use("/api/tax-categories", requireAuth, requireActiveSubscription, taxCategoriesRouter);
app.use("/api/partners", ...businessScoped, partnersRouter);
app.use("/api/journal-entries", ...businessScoped, journalEntriesRouter);
app.use("/api/reports", ...businessScoped, reportsRouter);
app.use("/api/invoices", ...businessScoped, invoicesRouter);
app.use("/api/bank-import", ...businessScoped, bankImportRouter);
app.use("/api/fixed-assets", ...businessScoped, fixedAssetsRouter);
app.use("/api/templates", ...businessScoped, templatesRouter);

// 本番ビルドではクライアントの静的ファイルも同じサーバーから配信する(単一サービスでデプロイするため)。
const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) res.status(404).send("Not found");
  });
});

app.use(errorHandler);

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
