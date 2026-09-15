import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { BusinessProvider, useBusiness } from "./context/BusinessContext";
import { Layout } from "./components/Layout";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Billing = lazy(() => import("./pages/Billing"));
const BillingSuccess = lazy(() => import("./pages/BillingSuccess"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const JournalEntries = lazy(() => import("./pages/JournalEntries"));
const JournalEntryForm = lazy(() => import("./pages/JournalEntryForm"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Partners = lazy(() => import("./pages/Partners"));
const GeneralLedger = lazy(() => import("./pages/GeneralLedger"));
const TrialBalance = lazy(() => import("./pages/TrialBalance"));
const ProfitLoss = lazy(() => import("./pages/ProfitLoss"));
const BalanceSheet = lazy(() => import("./pages/BalanceSheet"));
const Invoices = lazy(() => import("./pages/Invoices"));
const InvoiceForm = lazy(() => import("./pages/InvoiceForm"));
const InvoicePrint = lazy(() => import("./pages/InvoicePrint"));
const BankImport = lazy(() => import("./pages/BankImport"));
const Settings = lazy(() => import("./pages/Settings"));
const OnboardingWizard = lazy(() => import("./pages/OnboardingWizard"));
const FixedAssets = lazy(() => import("./pages/FixedAssets"));
const JournalEntryTemplates = lazy(() => import("./pages/JournalEntryTemplates"));
const BlueReturn = lazy(() => import("./pages/BlueReturn"));
const BlueReturnPrint = lazy(() => import("./pages/BlueReturnPrint"));
const ConsumptionTax = lazy(() => import("./pages/ConsumptionTax"));
const Budget = lazy(() => import("./pages/Budget"));
const CashFlowForecast = lazy(() => import("./pages/CashFlowForecast"));
const ReceiptScan = lazy(() => import("./pages/ReceiptScan"));
const PartnerBalances = lazy(() => import("./pages/PartnerBalances"));
const MonthlyTrend = lazy(() => import("./pages/MonthlyTrend"));
const Admin = lazy(() => import("./pages/Admin"));
const CommercialTransactions = lazy(() => import("./pages/legal/CommercialTransactions"));
const PrivacyPolicy = lazy(() => import("./pages/legal/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/legal/TermsOfService"));

function PageFallback() {
  return <div className="flex items-center justify-center h-screen text-gray-400">読み込み中...</div>;
}

function LegalRoutes() {
  return (
    <>
      <Route path="/legal/tokushoho" element={<CommercialTransactions />} />
      <Route path="/legal/privacy" element={<PrivacyPolicy />} />
      <Route path="/legal/terms" element={<TermsOfService />} />
    </>
  );
}

function WorkspaceRoutes() {
  const { loading, currentBusiness } = useBusiness();

  if (loading) {
    return <PageFallback />;
  }

  if (!currentBusiness) {
    return <OnboardingWizard />;
  }

  return (
    <Routes>
      <Route path="/invoices/:id/print" element={<InvoicePrint />} />
      <Route path="/reports/blue-return/print" element={<BlueReturnPrint />} />
      {LegalRoutes()}
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/journal-entries" element={<JournalEntries />} />
        <Route path="/journal-entries/:id" element={<JournalEntryForm />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/partners" element={<Partners />} />
        <Route path="/general-ledger" element={<GeneralLedger />} />
        <Route path="/reports/trial-balance" element={<TrialBalance />} />
        <Route path="/reports/profit-loss" element={<ProfitLoss />} />
        <Route path="/reports/balance-sheet" element={<BalanceSheet />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/:id" element={<InvoiceForm />} />
        <Route path="/bank-import" element={<BankImport />} />
        <Route path="/fixed-assets" element={<FixedAssets />} />
        <Route path="/journal-entry-templates" element={<JournalEntryTemplates />} />
        <Route path="/reports/blue-return" element={<BlueReturn />} />
        <Route path="/reports/consumption-tax" element={<ConsumptionTax />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/reports/cash-flow-forecast" element={<CashFlowForecast />} />
        <Route path="/receipt-scan" element={<ReceiptScan />} />
        <Route path="/reports/monthly-trend" element={<MonthlyTrend />} />
        <Route path="/reports/partner-balances" element={<PartnerBalances />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function AppRoutes() {
  const { user, loading, isSubscriptionActive } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageFallback />;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        {LegalRoutes()}
        <Route path="*" element={<Landing />} />
      </Routes>
    );
  }

  if (user.role === "ADMIN" && location.pathname.startsWith("/admin")) {
    return (
      <Routes>
        <Route path="/admin" element={<Admin />} />
      </Routes>
    );
  }

  if (!isSubscriptionActive) {
    return (
      <Routes>
        <Route path="/billing/success" element={<BillingSuccess />} />
        {LegalRoutes()}
        <Route path="*" element={<Billing />} />
      </Routes>
    );
  }

  return (
    <BusinessProvider>
      <WorkspaceRoutes />
    </BusinessProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageFallback />}>
        <AppRoutes />
      </Suspense>
    </AuthProvider>
  );
}
