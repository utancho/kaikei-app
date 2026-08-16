import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { BusinessProvider, useBusiness } from "./context/BusinessContext";
import { Layout } from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Billing from "./pages/Billing";
import BillingSuccess from "./pages/BillingSuccess";
import Dashboard from "./pages/Dashboard";
import JournalEntries from "./pages/JournalEntries";
import JournalEntryForm from "./pages/JournalEntryForm";
import Accounts from "./pages/Accounts";
import Partners from "./pages/Partners";
import GeneralLedger from "./pages/GeneralLedger";
import TrialBalance from "./pages/TrialBalance";
import ProfitLoss from "./pages/ProfitLoss";
import BalanceSheet from "./pages/BalanceSheet";
import Invoices from "./pages/Invoices";
import InvoiceForm from "./pages/InvoiceForm";
import InvoicePrint from "./pages/InvoicePrint";
import BankImport from "./pages/BankImport";
import Settings from "./pages/Settings";
import OnboardingWizard from "./pages/OnboardingWizard";
import FixedAssets from "./pages/FixedAssets";
import JournalEntryTemplates from "./pages/JournalEntryTemplates";
import BlueReturn from "./pages/BlueReturn";
import BlueReturnPrint from "./pages/BlueReturnPrint";
import ConsumptionTax from "./pages/ConsumptionTax";
import Budget from "./pages/Budget";
import CashFlowForecast from "./pages/CashFlowForecast";
import PartnerBalances from "./pages/PartnerBalances";
import MonthlyTrend from "./pages/MonthlyTrend";
import Admin from "./pages/Admin";
import CommercialTransactions from "./pages/legal/CommercialTransactions";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import TermsOfService from "./pages/legal/TermsOfService";

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
    return <div className="flex items-center justify-center h-screen text-gray-400">読み込み中...</div>;
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
    return <div className="flex items-center justify-center h-screen text-gray-400">読み込み中...</div>;
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
      <AppRoutes />
    </AuthProvider>
  );
}
