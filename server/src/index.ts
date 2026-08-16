import express from "express";
import cors from "cors";
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

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/businesses", businessRouter);
app.use("/api/accounts", accountsRouter);
app.use("/api/tax-categories", taxCategoriesRouter);
app.use("/api/partners", partnersRouter);
app.use("/api/journal-entries", journalEntriesRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/bank-import", bankImportRouter);
app.use("/api/fixed-assets", fixedAssetsRouter);
app.use("/api/templates", templatesRouter);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
