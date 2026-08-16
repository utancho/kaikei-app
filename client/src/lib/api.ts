import type {
  Account,
  BalanceSheet,
  BankImportBatch,
  BankTransactionRow,
  BlueReturnStatement,
  Business,
  FiscalYear,
  FixedAsset,
  GeneralLedger,
  Invoice,
  JournalEntry,
  JournalEntryTemplate,
  MonthlyTrendPoint,
  Partner,
  PartnerBalancesResponse,
  ProfitLoss,
  TaxCategory,
  TrialBalanceRow,
} from "./types";

// ローカル開発ではVite Proxy経由の相対パス "/api" を使う(vite.config.tsのproxy参照)。
// 本番も静的サイトとAPIが同一Worker・同一オリジンから配信されるため、常に相対パスでよい。
const API_BASE = "/api";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers:
      options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json", ...options.headers }
        : options.headers,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function qs(params: Record<string, string | undefined>): string {
  const filtered = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (filtered.length === 0) return "";
  return "?" + new URLSearchParams(filtered as [string, string][]).toString();
}

export const api = {
  // Auth
  signup: (email: string, password: string, name?: string) =>
    request<{ user: { id: string; email: string; name: string | null } }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),
  login: (email: string, password: string) =>
    request<{ user: { id: string; email: string; name: string | null } }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () =>
    request<{
      user: { id: string; email: string; name: string | null };
      subscription: { status: string; currentPeriodEnd: string | null } | null;
    }>("/auth/me"),

  // Billing
  getBillingStatus: () => request<{ status: string; currentPeriodEnd: string | null }>("/billing/status"),
  startCheckout: () => request<{ url: string | null }>("/billing/checkout", { method: "POST" }),
  openBillingPortal: () => request<{ url: string | null }>("/billing/portal", { method: "POST" }),

  // Business
  listBusinesses: () => request<Business[]>("/businesses"),
  createBusiness: (data: Partial<Business>) =>
    request<Business>("/businesses", { method: "POST", body: JSON.stringify(data) }),
  updateBusiness: (id: string, data: Partial<Business>) =>
    request<Business>(`/businesses/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  listFiscalYears: (businessId: string) =>
    request<FiscalYear[]>(`/businesses/${businessId}/fiscal-years`),

  // Accounts
  listAccounts: (businessId: string, includeInactive = false) =>
    request<Account[]>(`/accounts${qs({ businessId, includeInactive: includeInactive ? "true" : undefined })}`),
  createAccount: (businessId: string, data: Partial<Account>) =>
    request<Account>(`/accounts?businessId=${businessId}`, { method: "POST", body: JSON.stringify(data) }),
  updateAccount: (businessId: string, id: string, data: Partial<Account> & { isActive?: boolean }) =>
    request<Account>(`/accounts/${id}?businessId=${businessId}`, { method: "PATCH", body: JSON.stringify(data) }),

  listTaxCategories: () => request<TaxCategory[]>("/tax-categories"),

  // Partners
  listPartners: (businessId: string) => request<Partner[]>(`/partners${qs({ businessId })}`),
  createPartner: (businessId: string, data: Partial<Partner>) =>
    request<Partner>(`/partners?businessId=${businessId}`, { method: "POST", body: JSON.stringify(data) }),
  updatePartner: (businessId: string, id: string, data: Partial<Partner>) =>
    request<Partner>(`/partners/${id}?businessId=${businessId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePartner: (businessId: string, id: string) =>
    request<void>(`/partners/${id}?businessId=${businessId}`, { method: "DELETE" }),

  // Journal entries
  listJournalEntries: (
    businessId: string,
    filters: { from?: string; to?: string; accountId?: string; keyword?: string } = {}
  ) => request<JournalEntry[]>(`/journal-entries${qs({ businessId, ...filters })}`),
  getJournalEntry: (businessId: string, id: string) =>
    request<JournalEntry>(`/journal-entries/${id}${qs({ businessId })}`),
  createJournalEntry: (businessId: string, data: unknown) =>
    request<JournalEntry>(`/journal-entries?businessId=${businessId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateJournalEntry: (businessId: string, id: string, data: unknown) =>
    request<JournalEntry>(`/journal-entries/${id}?businessId=${businessId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteJournalEntry: (businessId: string, id: string) =>
    request<void>(`/journal-entries/${id}?businessId=${businessId}`, { method: "DELETE" }),

  // Reports
  getTrialBalance: (businessId: string, from?: string, to?: string) =>
    request<{ period: { from: string; to: string }; rows: TrialBalanceRow[] }>(
      `/reports/trial-balance${qs({ businessId, from, to })}`
    ),
  getGeneralLedger: (businessId: string, accountId: string, from?: string, to?: string) =>
    request<GeneralLedger>(`/reports/general-ledger/${accountId}${qs({ businessId, from, to })}`),
  getProfitLoss: (businessId: string, from?: string, to?: string) =>
    request<ProfitLoss>(`/reports/profit-loss${qs({ businessId, from, to })}`),
  getBalanceSheet: (businessId: string, from?: string, to?: string) =>
    request<BalanceSheet>(`/reports/balance-sheet${qs({ businessId, from, to })}`),
  getJournalBook: (businessId: string, from?: string, to?: string) =>
    request<JournalEntry[]>(`/reports/journal-book${qs({ businessId, from, to })}`),
  getCashTrend: (businessId: string, months = 6) =>
    request<{ month: string; balance: number }[]>(`/reports/cash-trend${qs({ businessId, months: String(months) })}`),
  getPartnerBalances: (businessId: string) =>
    request<PartnerBalancesResponse>(`/reports/partner-balances${qs({ businessId })}`),
  getMonthlyTrend: (businessId: string, months = 12) =>
    request<MonthlyTrendPoint[]>(`/reports/monthly-trend${qs({ businessId, months: String(months) })}`),

  // Invoices
  listInvoices: (businessId: string) => request<Invoice[]>(`/invoices${qs({ businessId })}`),
  getInvoice: (businessId: string, id: string) =>
    request<Invoice>(`/invoices/${id}${qs({ businessId })}`),
  createInvoice: (businessId: string, data: unknown) =>
    request<Invoice>(`/invoices?businessId=${businessId}`, { method: "POST", body: JSON.stringify(data) }),
  updateInvoice: (businessId: string, id: string, data: unknown) =>
    request<Invoice>(`/invoices/${id}?businessId=${businessId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteInvoice: (businessId: string, id: string) =>
    request<void>(`/invoices/${id}?businessId=${businessId}`, { method: "DELETE" }),
  postInvoiceToJournal: (businessId: string, id: string) =>
    request<JournalEntry>(`/invoices/${id}/post-journal?businessId=${businessId}`, { method: "POST" }),
  recordInvoicePayment: (businessId: string, id: string, paymentAccountId: string, paymentDate: string) =>
    request<JournalEntry>(`/invoices/${id}/record-payment?businessId=${businessId}`, {
      method: "POST",
      body: JSON.stringify({ paymentAccountId, paymentDate }),
    }),

  // Bank import
  listImportBatches: (businessId: string) =>
    request<BankImportBatch[]>(`/bank-import/batches${qs({ businessId })}`),
  getBatchRows: (businessId: string, batchId: string) =>
    request<{ batch: BankImportBatch; rows: BankTransactionRow[] }>(
      `/bank-import/batches/${batchId}/rows${qs({ businessId })}`
    ),
  uploadBankCsv: (businessId: string, accountId: string, file: File) => {
    const form = new FormData();
    form.append("accountId", accountId);
    form.append("file", file);
    return request<BankImportBatch>(`/bank-import/upload?businessId=${businessId}`, {
      method: "POST",
      body: form,
    });
  },
  confirmBankRow: (businessId: string, rowId: string, counterpartAccountId: string, description?: string) =>
    request<JournalEntry>(`/bank-import/rows/${rowId}/confirm?businessId=${businessId}`, {
      method: "POST",
      body: JSON.stringify({ counterpartAccountId, description }),
    }),
  ignoreBankRow: (businessId: string, rowId: string) =>
    request<void>(`/bank-import/rows/${rowId}/ignore?businessId=${businessId}`, { method: "POST" }),

  // Fixed assets
  listFixedAssets: (businessId: string) => request<FixedAsset[]>(`/fixed-assets${qs({ businessId })}`),
  getFixedAsset: (businessId: string, id: string) => request<FixedAsset>(`/fixed-assets/${id}${qs({ businessId })}`),
  createFixedAsset: (businessId: string, data: unknown) =>
    request<FixedAsset>(`/fixed-assets?businessId=${businessId}`, { method: "POST", body: JSON.stringify(data) }),
  deleteFixedAsset: (businessId: string, id: string) =>
    request<void>(`/fixed-assets/${id}?businessId=${businessId}`, { method: "DELETE" }),
  postDepreciation: (businessId: string, id: string, fiscalYearId: string) =>
    request<JournalEntry>(`/fixed-assets/${id}/post-depreciation?businessId=${businessId}`, {
      method: "POST",
      body: JSON.stringify({ fiscalYearId }),
    }),

  // Journal entry templates
  listTemplates: (businessId: string) => request<JournalEntryTemplate[]>(`/templates${qs({ businessId })}`),
  createTemplate: (businessId: string, data: unknown) =>
    request<JournalEntryTemplate>(`/templates?businessId=${businessId}`, { method: "POST", body: JSON.stringify(data) }),
  updateTemplate: (businessId: string, id: string, data: unknown) =>
    request<JournalEntryTemplate>(`/templates/${id}?businessId=${businessId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTemplate: (businessId: string, id: string) =>
    request<void>(`/templates/${id}?businessId=${businessId}`, { method: "DELETE" }),

  // Blue return statement (青色申告決算書)
  getBlueReturn: (businessId: string, from?: string, to?: string) =>
    request<BlueReturnStatement>(`/reports/blue-return${qs({ businessId, from, to })}`),
};

export { ApiError };
