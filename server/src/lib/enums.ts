export const BUSINESS_TYPES = ["INDIVIDUAL", "CORPORATE"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const TAXATION_TYPES = ["EXEMPT", "GENERAL", "SIMPLIFIED"] as const;
export type TaxationType = (typeof TAXATION_TYPES)[number];

export const FISCAL_YEAR_STATUSES = ["OPEN", "CLOSED"] as const;

export const ACCOUNT_CATEGORIES = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
] as const;
export type AccountCategory = (typeof ACCOUNT_CATEGORIES)[number];

export const NORMAL_BALANCES = ["DEBIT", "CREDIT"] as const;
export type NormalBalance = (typeof NORMAL_BALANCES)[number];

export const ENTRY_SIDES = ["DEBIT", "CREDIT"] as const;
export type EntrySide = (typeof ENTRY_SIDES)[number];

export const JOURNAL_ENTRY_STATUSES = ["DRAFT", "CONFIRMED"] as const;
export const JOURNAL_ENTRY_SOURCES = ["MANUAL", "BANK_IMPORT", "INVOICE"] as const;

export const PARTNER_TYPES = ["CUSTOMER", "VENDOR", "BOTH"] as const;

export const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID", "VOID"] as const;

export const IMPORT_ROW_STATUSES = ["UNMATCHED", "MATCHED", "IGNORED"] as const;

export const TAX_KINDS = [
  "TAXABLE_SALES",
  "TAXABLE_PURCHASE",
  "EXEMPT",
  "OUT_OF_SCOPE",
  "EXPORT",
] as const;

// 勘定科目のノーマル残高(借方科目か貸方科目か)を区分から自動判定
export function normalBalanceForCategory(category: AccountCategory): NormalBalance {
  return category === "ASSET" || category === "EXPENSE" ? "DEBIT" : "CREDIT";
}
