import { NavLink, Outlet, Link } from "react-router-dom";
import {
  LayoutDashboard,
  BookText,
  Upload,
  FileText,
  Users,
  BookOpenText,
  Table2,
  TrendingUp,
  Scale,
  ListTree,
  Settings as SettingsIcon,
  ChevronsUpDown,
  Wallet,
  Package,
  Repeat,
  FileBadge,
  Percent,
  Target,
  Waves,
  ScanLine,
  Contact,
  BarChart3,
  LineChart,
  LogOut,
  ShieldCheck,
  Search,
} from "lucide-react";
import { useState } from "react";
import { useBusiness } from "../context/BusinessContext";
import { useAuth } from "../context/AuthContext";
import { CommandPalette } from "./CommandPalette";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  individualOnly?: boolean;
}

const NAV_GROUPS: { heading?: string; items: NavItem[] }[] = [
  {
    items: [{ to: "/", label: "ダッシュボード", end: true, icon: LayoutDashboard }],
  },
  {
    heading: "取引入力",
    items: [
      { to: "/journal-entries", label: "仕訳帳", icon: BookText },
      { to: "/journal-entry-templates", label: "仕訳テンプレート", icon: Repeat },
      { to: "/bank-import", label: "取引明細(CSV取込)", icon: Upload },
      { to: "/receipt-scan", label: "レシート読取", icon: ScanLine },
      { to: "/invoices", label: "請求書", icon: FileText },
      { to: "/partners", label: "取引先", icon: Users },
      { to: "/fixed-assets", label: "固定資産台帳", icon: Package },
    ],
  },
  {
    heading: "レポート",
    items: [
      { to: "/reports/management-analysis", label: "経営分析", icon: LineChart },
      { to: "/general-ledger", label: "総勘定元帳", icon: BookOpenText },
      { to: "/reports/trial-balance", label: "試算表", icon: Table2 },
      { to: "/reports/profit-loss", label: "損益計算書", icon: TrendingUp },
      { to: "/reports/balance-sheet", label: "貸借対照表", icon: Scale },
      { to: "/reports/monthly-trend", label: "月次推移表", icon: BarChart3 },
      { to: "/reports/partner-balances", label: "取引先別残高", icon: Contact },
      { to: "/reports/blue-return", label: "青色申告決算書", icon: FileBadge, individualOnly: true },
      { to: "/reports/consumption-tax", label: "消費税申告書", icon: Percent },
      { to: "/budget", label: "予算実績管理", icon: Target },
      { to: "/reports/cash-flow-forecast", label: "資金繰り表", icon: Waves },
    ],
  },
  {
    heading: "設定",
    items: [
      { to: "/accounts", label: "勘定科目", icon: ListTree },
      { to: "/settings", label: "設定", icon: SettingsIcon },
    ],
  },
];

export function Layout() {
  const { businesses, currentBusiness, setCurrentBusinessId } = useBusiness();
  const { user, logout } = useAuth();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const isIndividual = currentBusiness?.type === "INDIVIDUAL";

  return (
    <div className="flex h-full min-h-screen">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <aside className="w-56 shrink-0 bg-brand-900 text-brand-50 flex flex-col">
        <div className="px-4 py-5 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shrink-0">
            <Wallet size={18} className="text-white" />
          </div>
          <div>
            <div className="text-base font-bold tracking-wide leading-none">Kaikei</div>
            <div className="text-[11px] text-brand-300 mt-0.5">会計ソフト</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-3">
          {NAV_GROUPS.map((group, gi) => {
            const items = group.items.filter((item) => !item.individualOnly || isIndividual);
            if (items.length === 0) return null;
            return (
              <div key={gi} className="space-y-0.5">
                {group.heading && (
                  <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-300/70">
                    {group.heading}
                  </div>
                )}
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive ? "bg-brand-600 text-white font-medium shadow-sm" : "text-brand-100/80 hover:bg-brand-800 hover:text-white"
                      }`
                    }
                  >
                    <item.icon size={16} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
          <div className="text-sm text-gray-600 flex items-center gap-2">
            {currentBusiness ? (
              <>
                <span className="font-medium">{currentBusiness.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100">
                  {currentBusiness.type === "INDIVIDUAL" ? "個人事業主" : "法人"}
                </span>
              </>
            ) : (
              "事業者未設定"
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 border border-gray-300 rounded-lg pl-2.5 pr-2 py-1.5 text-sm text-gray-400 hover:bg-gray-50 hover:border-gray-400 transition-colors"
              title="検索(Ctrl+K)"
            >
              <Search size={14} />
              <span className="hidden sm:inline">検索</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-sans border border-gray-200 rounded px-1 py-0.5 text-gray-400 bg-gray-50">
                Ctrl K
              </kbd>
            </button>
          {businesses.length > 1 && currentBusiness && (
            <div className="relative">
              <button
                className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50"
                onClick={() => setSwitcherOpen((v) => !v)}
              >
                {currentBusiness.name}
                <ChevronsUpDown size={14} className="text-gray-400" />
              </button>
              {switcherOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSwitcherOpen(false)} />
                  <div className="absolute right-0 mt-1 w-56 bg-white border rounded-lg shadow-lg z-20 py-1">
                    {businesses.map((b) => (
                      <button
                        key={b.id}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${
                          b.id === currentBusiness.id ? "text-brand-700 font-medium" : "text-gray-700"
                        }`}
                        onClick={() => {
                          setCurrentBusinessId(b.id);
                          setSwitcherOpen(false);
                        }}
                      >
                        {b.name}
                        <span className="text-[10px] text-gray-400">{b.type === "INDIVIDUAL" ? "個人" : "法人"}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="relative ml-3">
            <button
              className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-sm font-semibold flex items-center justify-center hover:bg-brand-200"
              onClick={() => setUserMenuOpen((v) => !v)}
              title={user?.email}
            >
              {(user?.name || user?.email || "?").charAt(0).toUpperCase()}
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg z-20 py-1">
                  <div className="px-3 py-2 text-xs text-gray-400 truncate border-b border-gray-100">{user?.email}</div>
                  {user?.role === "ADMIN" && (
                    <Link
                      to="/admin"
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <ShieldCheck size={14} /> 管理者ダッシュボード
                    </Link>
                  )}
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    onClick={() => logout()}
                  >
                    <LogOut size={14} /> ログアウト
                  </button>
                </div>
              </>
            )}
          </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
