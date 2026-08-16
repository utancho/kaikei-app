import { Hono } from "hono";
import { cors } from "hono/cors";
import { runWithPrisma } from "./lib/prisma.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireActiveSubscription, requireAdmin, requireAuth, verifyBusinessOwnership } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { billingRouter, webhookRouter } from "./routes/billing.js";
import { businessRouter } from "./routes/business.js";
import { accountsRouter, taxCategoriesRouter } from "./routes/accounts.js";
import { partnersRouter } from "./routes/partners.js";
import { journalEntriesRouter } from "./routes/journalEntries.js";
import { reportsRouter } from "./routes/reports.js";
import { invoicesRouter } from "./routes/invoices.js";
import { bankImportRouter } from "./routes/bankImport.js";
import { fixedAssetsRouter } from "./routes/fixedAssets.js";
import { templatesRouter } from "./routes/templates.js";
import type { AppEnv } from "./types/env.js";

const app = new Hono<AppEnv>();

// 各リクエストの間だけ有効なPrismaClientをAsyncLocalStorageに載せる。
// (services/*.ts からの `prisma.xxx` はこのスコープ内でのみ動く)
app.use("*", async (c, next) => {
  await runWithPrisma(c.env.DB, () => next());
});

app.use(
  "*",
  cors({
    origin: (origin, c) => (origin === c.env.APP_URL ? origin : c.env.APP_URL),
    credentials: true,
  })
);

app.onError(errorHandler);

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.route("/api/auth", authRouter);
// StripeのWebhookは署名検証のため生ボディが必要かつCookie認証も不要なので、
// requireAuthより前・別ルートとしてマウントする。
app.route("/api/billing/webhook", webhookRouter);
app.use("/api/billing/*", requireAuth);
app.route("/api/billing", billingRouter);

const businessScoped = [requireAuth, requireActiveSubscription, verifyBusinessOwnership] as const;

app.use("/api/businesses/*", requireAuth, requireActiveSubscription);
app.route("/api/businesses", businessRouter);

app.use("/api/accounts/*", ...businessScoped);
app.route("/api/accounts", accountsRouter);

app.use("/api/tax-categories/*", requireAuth, requireActiveSubscription);
app.route("/api/tax-categories", taxCategoriesRouter);

app.use("/api/partners/*", ...businessScoped);
app.route("/api/partners", partnersRouter);

app.use("/api/journal-entries/*", ...businessScoped);
app.route("/api/journal-entries", journalEntriesRouter);

app.use("/api/reports/*", ...businessScoped);
app.route("/api/reports", reportsRouter);

app.use("/api/invoices/*", ...businessScoped);
app.route("/api/invoices", invoicesRouter);

app.use("/api/bank-import/*", ...businessScoped);
app.route("/api/bank-import", bankImportRouter);

app.use("/api/fixed-assets/*", ...businessScoped);
app.route("/api/fixed-assets", fixedAssetsRouter);

app.use("/api/templates/*", ...businessScoped);
app.route("/api/templates", templatesRouter);

app.use("/api/admin/*", requireAuth, requireAdmin);
app.route("/api/admin", adminRouter);

export default app;
