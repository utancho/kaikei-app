import { Suspense, lazy, useState } from "react";
import { capturePendingVerification } from "./lib/pendingVerification";
import {classifyPagePath} from '../../server/src/lib/seoRoutes';
import NotFound from './pages/NotFound';
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { BusinessProvider, useBusiness } from "./context/BusinessContext";
import { Layout } from "./components/Layout";
// Marketing and animation code are loaded only on public pages.
const Landing = lazy(() => import("./pages/Landing"));
const InviteAccept = lazy(() => import("./pages/InviteAccept"));
import DesktopShell from "./components/DesktopShell";
import RouteSeo from "./components/RouteSeo";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
// それ以外のページはルート単位で遅延読み込みし、初回ロードを軽くする。
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
const Operations = lazy(() => import("./pages/Operations"));
const AccountSecurity = lazy(() => import("./pages/AccountSecurity"));
const OnboardingWizard = lazy(() => import("./pages/OnboardingWizard"));
const FixedAssets = lazy(() => import("./pages/FixedAssets"));
const JournalEntryTemplates = lazy(() => import("./pages/JournalEntryTemplates"));
const BlueReturn = lazy(() => import("./pages/BlueReturn"));
const BlueReturnPrint = lazy(() => import("./pages/BlueReturnPrint"));
const ConsumptionTax = lazy(() => import("./pages/ConsumptionTax"));
const CorporateTax = lazy(() => import("./pages/CorporateTax"));
const Budget = lazy(() => import("./pages/Budget"));
const CashFlowForecast = lazy(() => import("./pages/CashFlowForecast"));
const ReceiptScan = lazy(() => import("./pages/ReceiptScan"));
const PartnerBalances = lazy(() => import("./pages/PartnerBalances"));
const MonthlyTrend = lazy(() => import("./pages/MonthlyTrend"));
const ManagementAnalysis = lazy(() => import("./pages/ManagementAnalysis"));
const YearEndClosing = lazy(() => import("./pages/YearEndClosing"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminBlog = lazy(() => import("./pages/AdminBlog"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const EditorialPolicy = lazy(() => import("./pages/EditorialPolicy"));
const BlogLayout = lazy(() => import("./components/BlogLayout"));
const CommercialTransactions = lazy(() => import("./pages/legal/CommercialTransactions"));
const PrivacyPolicy = lazy(() => import("./pages/legal/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/legal/TermsOfService"));

function PageLoader() {
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

function PublicBlogRoutes() {
  return (
    <Routes>
      <Route element={<BlogLayout />}>
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/editorial-policy" element={<EditorialPolicy />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
      </Route>
    </Routes>
  );
}

function WorkspaceRoutes() {
  const { loading, error, refresh, currentBusiness, businesses, setCurrentBusinessId } = useBusiness();
  const { isSubscriptionActive, logout } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (error) return <div className="mx-auto max-w-lg p-8"><h1 className="text-xl font-semibold">データを読み込めませんでした</h1><p role="alert" className="mt-4 text-sm text-red-700">{error}</p><button onClick={()=>refresh()} className="mt-5 rounded border px-4 py-3">再読み込み</button></div>;
  if (!currentBusiness) {
    if (!isSubscriptionActive) return <Billing />;
    return <OnboardingWizard />;
  }
  if (!(currentBusiness.planActive ?? isSubscriptionActive)) {
    if (currentBusiness.isOwner) return <Billing />;
    return <div className="mx-auto max-w-lg p-8"><h1 className="text-xl font-semibold">共有元の契約をご確認ください</h1><p className="mt-4 text-sm leading-7 text-gray-600">この事業者のオーナーの契約が利用可能な状態になると、共有データを開けます。オーナーへご確認ください。</p><label className="mt-6 block text-sm">事業者を切り替える<select className="mt-2 block w-full rounded border p-3" value={currentBusiness.id} onChange={e=>setCurrentBusinessId(e.target.value)}>{businesses.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><button className="mt-5 rounded border px-4 py-3 text-sm" onClick={()=>logout()}>ログアウト</button></div>;
  }

  return (
    <Routes>
      <Route path="/invoices/:id/print" element={<InvoicePrint />} />
      <Route path="/reports/blue-return/print" element={<BlueReturnPrint />} />
      {LegalRoutes()}
      <Route element={<Layout />}>
        <Route path="/app" element={<Dashboard />} />
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
        <Route path="/reports/corporate-tax" element={<CorporateTax />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/reports/cash-flow-forecast" element={<CashFlowForecast />} />
        <Route path="/receipt-scan" element={<ReceiptScan />} />
        <Route path="/reports/monthly-trend" element={<MonthlyTrend />} />
        <Route path="/reports/management-analysis" element={<ManagementAnalysis />} />
        <Route path="/reports/year-end-closing" element={<YearEndClosing />} />
        <Route path="/reports/partner-balances" element={<PartnerBalances />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/operations" element={<Operations />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function AppRoutes() {
  useState(capturePendingVerification);
  const { user, loading } = useAuth();
  const location = useLocation();

  if(classifyPagePath(location.pathname)==='unknown') return <NotFound />;

  if (loading) {
    return <PageLoader />;
  }

  if (location.pathname === "/blog" || location.pathname.startsWith("/blog/")) {
    return <PublicBlogRoutes />;
  }
  if (location.pathname === "/invite") return <InviteAccept />;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/account" element={<Navigate to="/login?next=/account" replace />} />
        <Route path="/account-security" element={<Navigate to="/login?next=/account" replace />} />
        <Route path="/app" element={<Navigate to="/login" replace />} />
        <Route path="/operations" element={<Navigate to="/login?next=/operations" replace />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {LegalRoutes()}
        <Route path="/" element={window.keirioDesktop?.isDesktop ? <Navigate to="/login" replace /> : <Landing />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (user.role === "ADMIN" && location.pathname.startsWith("/admin")) {
    return (
      <Routes>
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/blog" element={<AdminBlog />} />
      </Routes>
    );
  }

  if (location.pathname === "/billing/success") return <BillingSuccess />;
  if (location.pathname === "/account-security" || location.pathname === "/account") return <AccountSecurity />;

  return (
    <BusinessProvider>
      <WorkspaceRoutes />
    </BusinessProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageLoader />}>
        <DesktopShell><AppErrorBoundary><RouteSeo /><AppRoutes /></AppErrorBoundary></DesktopShell>
      </Suspense>
    </AuthProvider>
  );
}
