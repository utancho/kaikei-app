export type BusinessType = "INDIVIDUAL" | "CORPORATE";
export type AccountCategory = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
export type NormalBalance = "DEBIT" | "CREDIT";
export type EntrySide = "DEBIT" | "CREDIT";

export interface Business {
  id: string;
  name: string;
  type: BusinessType;
  representativeName?: string | null;
  postalCode?: string | null;
  address?: string | null;
  fiscalYearStartMonth: number;
  taxationType: string;
  simplifiedTaxCategory: number;
  blueReturnDeduction: number;
  isOwner?: boolean;
}

export interface BusinessMemberInfo {
  id: string;
  email: string;
  status: "PENDING" | "ACTIVE";
  role: string;
  invitedAt: string;
  joinedAt: string | null;
}

export interface BusinessMembersResponse {
  owner: { id: string; email: string; name: string | null } | null;
  members: BusinessMemberInfo[];
}

export interface FiscalYear {
  id: string;
  businessId: string;
  startDate: string;
  endDate: string;
  status: "OPEN" | "CLOSED";
}

export interface TaxCategory {
  id: string;
  code: string;
  name: string;
  rate: number;
  kind: string;
  isReducedRate: boolean;
}

export interface Account {
  id: string;
  businessId: string;
  code: string;
  name: string;
  category: AccountCategory;
  subcategory: string;
  normalBalance: NormalBalance;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
  defaultTaxCategoryId?: string | null;
  defaultTaxCategory?: TaxCategory | null;
}

export interface Partner {
  id: string;
  businessId: string;
  name: string;
  kana?: string | null;
  type: "CUSTOMER" | "VENDOR" | "BOTH";
  postalCode?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface JournalEntryLine {
  id: string;
  journalEntryId: string;
  lineNumber: number;
  side: EntrySide;
  accountId: string;
  account?: Account;
  subAccountId?: string | null;
  partnerId?: string | null;
  partner?: Partner | null;
  taxCategoryId?: string | null;
  taxCategory?: TaxCategory | null;
  amount: number;
  taxAmount: number;
  description?: string | null;
}

export interface JournalEntry {
  id: string;
  businessId: string;
  fiscalYearId: string;
  entryNumber: number;
  entryDate: string;
  description?: string | null;
  status: "DRAFT" | "CONFIRMED";
  source: "MANUAL" | "BANK_IMPORT" | "INVOICE";
  lines: JournalEntryLine[];
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  category: AccountCategory;
  subcategory: string;
  normalBalance: NormalBalance;
  debitTotal: number;
  creditTotal: number;
  balance: number;
}

export interface PLLineItem {
  accountId: string;
  code: string;
  name: string;
  category: AccountCategory;
  subcategory: string;
  amount: number;
}

export interface ProfitLoss {
  period: { from: string; to: string };
  lineItems: PLLineItem[];
  summary: {
    sales: number;
    cogs: number;
    grossProfit: number;
    sga: number;
    operatingIncome: number;
    nonOperatingRevenue: number;
    nonOperatingExpense: number;
    ordinaryIncome: number;
    extraordinaryGain: number;
    extraordinaryLoss: number;
    incomeBeforeTax: number;
    taxes: number;
    netIncome: number;
  };
}

export interface BalanceSheet {
  asOf: string;
  lineItems: PLLineItem[];
  currentNetIncome: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  balanced: boolean;
}

export interface GeneralLedgerRow {
  journalEntryId: string;
  entryDate: string;
  entryNumber: number;
  description?: string | null;
  partnerName?: string | null;
  side: EntrySide;
  amount: number;
  balance: number;
}

export interface GeneralLedger {
  account: { id: string; code: string; name: string; normalBalance: NormalBalance };
  openingBalance: number;
  closingBalance: number;
  rows: GeneralLedgerRow[];
}

export interface InvoiceItem {
  id?: string;
  lineNumber?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  taxCategoryId?: string | null;
  amount?: number;
}

export interface Invoice {
  id: string;
  businessId: string;
  partnerId: string;
  partner?: Partner;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string | null;
  status: "DRAFT" | "SENT" | "PAID" | "VOID";
  notes?: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  items: InvoiceItem[];
}

export type DepreciationMethod = "STRAIGHT_LINE" | "DECLINING_BALANCE";

export interface DepreciationScheduleMonth {
  date: string;
  depreciation: number;
  bookValueEnd: number;
}

export interface FixedAssetDepreciationRecord {
  id: string;
  fixedAssetId: string;
  fiscalYearId: string;
  amount: number;
  journalEntryId?: string | null;
  postedAt: string;
}

export interface FixedAsset {
  id: string;
  businessId: string;
  name: string;
  assetAccountId: string;
  assetAccount?: Account | null;
  expenseAccountId: string;
  expenseAccount?: Account | null;
  acquisitionDate: string;
  acquisitionCost: number;
  residualValue: number;
  usefulLifeYears: number;
  depreciationMethod: DepreciationMethod;
  status: "ACTIVE" | "DISPOSED";
  memo?: string | null;
  currentBookValue?: number;
  depreciations?: FixedAssetDepreciationRecord[];
  schedule?: DepreciationScheduleMonth[];
}

export interface JournalEntryTemplateLine {
  id?: string;
  side: EntrySide;
  accountId: string;
  account?: Account;
  partnerId?: string | null;
  partner?: Partner | null;
  taxCategoryId?: string | null;
  amountDefault?: number | null;
  description?: string | null;
}

export interface JournalEntryTemplate {
  id: string;
  businessId: string;
  name: string;
  description?: string | null;
  lines: JournalEntryTemplateLine[];
}

export interface BlueReturnExpenseLine {
  key: string;
  label: string;
  amount: number;
}

export interface BlueReturnStatement {
  business: { name: string; representativeName?: string | null };
  period: { from: string; to: string };
  sales: number;
  purchases: number;
  grossProfit: number;
  expenseLines: BlueReturnExpenseLine[];
  expenseTotal: number;
  incomeBeforeDeductions: number;
  specialAllowanceWages: number;
  incomeAfterWages: number;
  blueReturnDeduction: number;
  finalIncome: number;
  balanceSheet: BalanceSheet;
}

export interface RateGroup {
  base: number;
  tax: number;
}

export interface NationalLocalTax {
  national: number;
  local: number;
}

export interface ConsumptionTaxReturn {
  business: { name: string; taxationType: string };
  period: { from: string; to: string };
  isExempt: boolean;
  taxableSales: { standard: RateGroup; reduced: RateGroup };
  outputTax: { standard: NationalLocalTax; reduced: NationalLocalTax; total: number };
  exemptSales: number;
  outOfScopeSales: number;
  exportSales: number;
  taxablePurchases?: { standard: RateGroup; reduced: RateGroup };
  inputTax?: { standard: NationalLocalTax; reduced: NationalLocalTax; total: number };
  simplified?: {
    businessCategory: number;
    businessCategoryLabel: string;
    deemedPurchaseRate: number;
    deemedInputTax: number;
  };
  payableTax?: { national: number; local: number; total: number };
}

export interface SimplifiedTaxCategory {
  id: number;
  label: string;
  rate: number;
}

export interface BudgetMonth {
  month: number;
  budget: number;
  actual: number;
  variance: number;
}

export interface BudgetActualRow {
  accountId: string;
  code: string;
  name: string;
  category: "REVENUE" | "EXPENSE";
  budgetTotal: number;
  actualTotal: number;
  months: BudgetMonth[];
}

export interface BudgetActualResponse {
  year: number;
  rows: BudgetActualRow[];
}

export interface CashFlowForecastPoint {
  month: string;
  balance: number;
  source: "budget" | "trend";
}

export interface CashFlowForecast {
  currentBalance: number;
  history: { month: string; balance: number }[];
  forecast: CashFlowForecastPoint[];
  trailingAverageMonthlyChange: number;
}

export interface ReceiptExtraction {
  date: string | null;
  vendorName: string | null;
  amount: number | null;
  description: string | null;
  suggestedAccountId: string | null;
}

export interface PartnerBalance {
  partnerId: string;
  partnerName: string;
  balance: number;
}

export interface PartnerBalancesResponse {
  receivables: PartnerBalance[];
  payables: PartnerBalance[];
  totalReceivables: number;
  totalPayables: number;
}

export interface MonthlyTrendPoint {
  month: string;
  sales: number;
  expenses: number;
  netIncome: number;
}

export interface AnalysisIndicator {
  key: string;
  label: string;
  value: number | null;
  previous: number | null;
  unit: "%" | "倍" | "円";
  higherIsBetter: boolean;
  description: string;
}

export interface AnalysisYoyRow {
  key: string;
  label: string;
  current: number;
  previous: number;
  changePct: number | null;
}

export interface BusinessAnalysis {
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  hasData: boolean;
  hasPrevious: boolean;
  summary: {
    sales: number;
    operatingIncome: number;
    ordinaryIncome: number;
    netIncome: number;
    totalAssets: number;
    totalEquity: number;
  };
  indicators: {
    profitability: AnalysisIndicator[];
    safety: AnalysisIndicator[];
    efficiency: AnalysisIndicator[];
  };
  yoy: AnalysisYoyRow[];
}

export interface JournalImportEntry {
  entryDate: string;
  description?: string | null;
  lines: { side: EntrySide; accountName: string; amount: number }[];
}

export interface JournalImportResult {
  total: number;
  created: number;
  errors: { row: number; message: string }[];
}

export interface BankImportBatch {
  id: string;
  businessId: string;
  fileName: string;
  accountId: string;
  importedAt: string;
  _count?: { rows: number };
}

export interface BankTransactionRow {
  id: string;
  batchId: string;
  date: string;
  description: string;
  amount: number;
  balance?: number | null;
  suggestedAccountId?: string | null;
  status: "UNMATCHED" | "MATCHED" | "IGNORED";
  matchedJournalEntryId?: string | null;
}

export type SubscriptionStatus = "NONE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  businesses: { id: string; name: string; type: "INDIVIDUAL" | "CORPORATE" }[];
  subscription: {
    status: SubscriptionStatus;
    currentPeriodEnd: string | null;
  };
}

export interface AdminStats {
  totalUsers: number;
  activeCount: number;
  trialingCount: number;
  pastDueCount: number;
  canceledCount: number;
  individualBusinessCount: number;
  corporateBusinessCount: number;
  mrrJpy: number | null;
}

export interface AdminBusiness {
  id: string;
  name: string;
  type: "INDIVIDUAL" | "CORPORATE";
  taxationType: string;
  ownerEmail: string;
  ownerName: string | null;
  memberCount: number;
  journalEntryCount: number;
  createdAt: string;
}
