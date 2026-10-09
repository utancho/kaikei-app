import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { browserOriginGuard, securityHeaders } from "./middleware/security.js";
import { runWithPrisma } from "./lib/prisma.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireActiveSubscription, requireAdmin, requireAuth, verifyBusinessAccess } from "./middleware/auth.js";
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
import { budgetsRouter } from "./routes/budgets.js";
import { receiptsRouter } from "./routes/receipts.js";
import { blogRouter } from "./routes/blog.js";
import { publicSeo } from "./routes/publicSeo.js";
import { workflowRouter, recordBusinessOperation } from "./routes/workflows.js";
import { accountSecurityRouter } from "./routes/accountSecurity.js";
import type { AppEnv } from "./types/env.js";

const app = new Hono<AppEnv>();
app.use("*", securityHeaders);
app.use("/api/*", browserOriginGuard);
app.use("/api/*", bodyLimit({ maxSize: 10 * 1024 * 1024, onError: c => c.json({ error: "送信データが大きすぎます" }, 413) }));

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

// ブログはログイン前にも閲覧できる公開API。
app.route("/api/blog", blogRouter);

app.route("/api/auth", authRouter);
app.route("/api/account-security", accountSecurityRouter);
app.route("/api/workflows", workflowRouter);
// StripeのWebhookは署名検証のため生ボディが必要かつCookie認証も不要なので、
// requireAuthより前・別ルートとしてマウントする。
app.route("/api/billing/webhook", webhookRouter);
app.use("/api/billing/*", requireAuth);
app.route("/api/billing", billingRouter);

const businessScoped = [requireAuth, verifyBusinessAccess, requireActiveSubscription, recordBusinessOperation] as const;

app.use("/api/businesses/*", requireAuth);
app.route("/api/businesses", businessRouter);

app.use("/api/accounts/*", ...businessScoped);
app.route("/api/accounts", accountsRouter);

app.use("/api/tax-categories/*", requireAuth);
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

app.use("/api/budgets/*", ...businessScoped);
app.route("/api/budgets", budgetsRouter);

app.use("/api/receipts/*", ...businessScoped);
app.route("/api/receipts", receiptsRouter);

app.use("/api/admin/*", requireAuth, requireAdmin);
app.route("/api/admin", adminRouter);
app.route("/", publicSeo);

export default app;
