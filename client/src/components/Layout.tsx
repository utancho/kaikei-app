import { NavLink, Outlet } from "react-router-dom";
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
  Contact,
  BarChart3,
} from "lucide-react";
import { useState } from "react";
import { useBusiness } from "../context/BusinessContext";

const NAV_ITEMS = [
  { to: "/", label: "ダッシュボード", end: true, icon: LayoutDashboard },
  { to: "/journal-entries", label: "仕訳帳", icon: BookText },
  { to: "/journal-entry-templates", label: "仕訳テンプレート", icon: Repeat },
  { to: "/bank-import", label: "取引明細(CSV取込)", icon: Upload },
  { to: "/invoices", label: "請求書", icon: FileText },
  { to: "/partners", label: "取引先", icon: Users },
  { to: "/fixed-assets", label: "固定資産台帳", icon: Package },
  { to: "/general-ledger", label: "総勘定元帳", icon: BookOpenText },
  { to: "/reports/trial-balance", label: "試算表", icon: Table2 },
  { to: "/reports/profit-loss", label: "損益計算書", icon: TrendingUp },
  { to: "/reports/balance-sheet", label: "貸借対照表", icon: Scale },
  { to: "/reports/monthly-trend", label: "月次推移表", icon: BarChart3 },
  { to: "/reports/partner-balances", label: "取引先別残高", icon: Contact },
  { to: "/reports/blue-return", label: "青色申告決算書", icon: FileBadge, individualOnly: true },
  { to: "/accounts", label: "勘定科目", icon: ListTree },
  { to: "/settings", label: "設定", icon: SettingsIcon },
];

export function Layout() {
  const { businesses, currentBusiness, setCurrentBusinessId } = useBusiness();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const navItems = NAV_ITEMS.filter((item) => !item.individualOnly || currentBusiness?.type === "INDIVIDUAL");

  return (
    <div className="flex h-full min-h-screen">
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
        <nav className="flex-1 overflow-y-auto py-1 px-2 space-y-0.5">
          {navItems.map((item) => (
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
        </header>
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
