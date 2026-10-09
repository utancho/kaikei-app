export const PUBLIC_STATIC_PATHS = ['/', '/blog', '/blog/editorial-policy', '/legal/privacy', '/legal/terms', '/legal/tokushoho'] as const;
export function classifyPagePath(path: string): 'public'|'article'|'private'|'unknown' {
 if ((PUBLIC_STATIC_PATHS as readonly string[]).includes(path)) return 'public';
 if (/^\/blog\/[^/.]+$/.test(path)) return 'article';
 if (/^\/(app|invite|login|signup|forgot-password|reset-password|operations|account|account-security|accounts|partners|general-ledger|bank-import|fixed-assets|journal-entry-templates|budget|receipt-scan|settings)$/.test(path)) return 'private';
 if (/^\/(journal-entries|invoices)(\/[^/]+(\/print)?)?$/.test(path) || /^\/reports\/(trial-balance|profit-loss|balance-sheet|blue-return|consumption-tax|corporate-tax|cash-flow-forecast|monthly-trend|management-analysis|year-end-closing|partner-balances)(\/print)?$/.test(path) || /^\/admin(\/blog)?$/.test(path) || path==='/billing/success') return 'private';
 return 'unknown';
}
