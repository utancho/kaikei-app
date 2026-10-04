import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  CornerDownLeft,
  LayoutDashboard,
  BookText,
  PlusCircle,
  FileText,
  Users,
  Upload,
  ScanLine,
  Package,
  LineChart,
  TrendingUp,
  Scale,
  Table2,
  BookOpenText,
  BarChart3,
  Contact,
  FileBadge,
  Percent,
  Target,
  Waves,
  ListTree,
  Settings as SettingsIcon,
  Repeat,
  ClipboardCheck,
  Landmark,
} from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api } from "../lib/api";
import { formatDate, formatYen } from "../lib/format";
import type { Invoice, JournalEntry, Partner } from "../lib/types";

interface Command {
  id: string;
  label: string;
  sublabel?: string;
  section: string;
  icon: ReactNode;
  keywords?: string;
  run: () => void;
}

const PAGES: { to: string; label: string; icon: ReactNode; keywords: string; individualOnly?: boolean; corporateOnly?: boolean }[] = [
  { to: "/", label: "ダッシュボード", icon: <LayoutDashboard size={16} />, keywords: "dashboard home ホーム" },
  { to: "/journal-entries", label: "仕訳帳", icon: <BookText size={16} />, keywords: "journal しわけ 仕訳" },
  { to: "/journal-entry-templates", label: "仕訳テンプレート", icon: <Repeat size={16} />, keywords: "template てんぷれ" },
  { to: "/bank-import", label: "取引明細(CSV取込)", icon: <Upload size={16} />, keywords: "bank csv 銀行 明細 取込" },
  { to: "/receipt-scan", label: "レシート読取", icon: <ScanLine size={16} />, keywords: "receipt ocr れしーと" },
  { to: "/invoices", label: "請求書", icon: <FileText size={16} />, keywords: "invoice せいきゅう 請求" },
  { to: "/partners", label: "取引先", icon: <Users size={16} />, keywords: "partner とりひきさき" },
  { to: "/fixed-assets", label: "固定資産台帳", icon: <Package size={16} />, keywords: "asset こてい 減価償却" },
  { to: "/reports/management-analysis", label: "経営分析", icon: <LineChart size={16} />, keywords: "analysis けいえい 指標 ratio" },
  { to: "/general-ledger", label: "総勘定元帳", icon: <BookOpenText size={16} />, keywords: "ledger もとちょう 元帳" },
  { to: "/reports/trial-balance", label: "試算表", icon: <Table2 size={16} />, keywords: "trial balance しさん" },
  { to: "/reports/profit-loss", label: "損益計算書", icon: <TrendingUp size={16} />, keywords: "pl profit loss そんえき" },
  { to: "/reports/balance-sheet", label: "貸借対照表", icon: <Scale size={16} />, keywords: "bs balance sheet たいしゃく" },
  { to: "/reports/monthly-trend", label: "月次推移表", icon: <BarChart3 size={16} />, keywords: "monthly trend げつじ" },
  { to: "/reports/partner-balances", label: "取引先別残高", icon: <Contact size={16} />, keywords: "partner balance 残高" },
  { to: "/reports/blue-return", label: "青色申告決算書", icon: <FileBadge size={16} />, keywords: "blue return あおいろ 申告", individualOnly: true },
  { to: "/reports/consumption-tax", label: "消費税申告書", icon: <Percent size={16} />, keywords: "consumption tax しょうひぜい" },
  { to: "/reports/corporate-tax", label: "法人税申告書", icon: <Landmark size={16} />, keywords: "corporate tax ほうじんぜい", corporateOnly: true },
  { to: "/budget", label: "予算実績管理", icon: <Target size={16} />, keywords: "budget よさん" },
  { to: "/reports/cash-flow-forecast", label: "資金繰り表", icon: <Waves size={16} />, keywords: "cash flow しきんぐり" },
  { to: "/reports/year-end-closing", label: "決算処理", icon: <ClipboardCheck size={16} />, keywords: "closing けっさん 期末 決算" },
  { to: "/accounts", label: "勘定科目", icon: <ListTree size={16} />, keywords: "account かんじょうかもく" },
  { to: "/settings", label: "設定", icon: <SettingsIcon size={16} />, keywords: "settings せってい" },
];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { currentBusiness } = useBusiness();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [journalHits, setJournalHits] = useState<JournalEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Ctrl/Cmd+K でトグル(入力中でも開ける)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // 開くたびに現在の事業者のマスタを読み込む(事業者を切り替えても古いデータが残らないように)
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(0);
    setTimeout(() => inputRef.current?.focus(), 20);
    if (!currentBusiness) return;
    api.listPartners(currentBusiness.id).then(setPartners).catch(() => {});
    api.listInvoices(currentBusiness.id).then(setInvoices).catch(() => {});
  }, [open, currentBusiness]);

  // 仕訳はキーワードでAPI検索(デバウンス)
  useEffect(() => {
    if (!open || !currentBusiness) return;
    const q = query.trim();
    if (q.length < 1) {
      setJournalHits([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .listJournalEntries(currentBusiness.id, { keyword: q })
        .then((rows) => setJournalHits(rows.slice(0, 5)))
        .catch(() => setJournalHits([]));
    }, 220);
    return () => clearTimeout(t);
  }, [query, open, currentBusiness]);

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  const commands: Command[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const isIndividual = currentBusiness?.type === "INDIVIDUAL";

    const actions: Command[] = [
      {
        id: "action-new-journal",
        label: "新しい仕訳を入力",
        section: "操作",
        icon: <PlusCircle size={16} />,
        keywords: "new journal 新規 しわけ 入力",
        run: () => go("/journal-entries/new"),
      },
      {
        id: "action-new-invoice",
        label: "請求書を作成",
        section: "操作",
        icon: <FileText size={16} />,
        keywords: "new invoice 新規 請求",
        run: () => go("/invoices/new"),
      },
    ];

    const pageCmds: Command[] = PAGES.filter(
      (p) => (!p.individualOnly || isIndividual) && (!p.corporateOnly || !isIndividual)
    ).map((p) => ({
      id: `page-${p.to}`,
      label: p.label,
      section: "ページ",
      icon: p.icon,
      keywords: p.keywords,
      run: () => go(p.to),
    }));

    const match = (c: { label: string; keywords?: string }) =>
      q === "" || c.label.toLowerCase().includes(q) || (c.keywords ?? "").toLowerCase().includes(q);

    const staticCmds = [...actions.filter(match), ...pageCmds.filter(match)];

    const journalCmds: Command[] =
      q === ""
        ? []
        : journalHits.map((e) => ({
            id: `journal-${e.id}`,
            label: e.description || "(摘要なし)",
            sublabel: `${formatDate(e.entryDate)} ・ ${formatYen(
              e.lines.filter((l) => l.side === "DEBIT").reduce((s, l) => s + l.amount, 0)
            )}`,
            section: "仕訳",
            icon: <BookText size={16} />,
            run: () => go(`/journal-entries/${e.id}`),
          }));

    const partnerCmds: Command[] =
      q === ""
        ? []
        : partners
            .filter((p) => p.name.toLowerCase().includes(q) || (p.kana ?? "").toLowerCase().includes(q))
            .slice(0, 5)
            .map((p) => ({
              id: `partner-${p.id}`,
              label: p.name,
              sublabel: "取引先",
              section: "取引先",
              icon: <Users size={16} />,
              run: () => go("/partners"),
            }));

    const invoiceCmds: Command[] =
      q === ""
        ? []
        : invoices
            .filter(
              (iv) =>
                iv.invoiceNumber.toLowerCase().includes(q) || (iv.partner?.name ?? "").toLowerCase().includes(q)
            )
            .slice(0, 5)
            .map((iv) => ({
              id: `invoice-${iv.id}`,
              label: `${iv.invoiceNumber}`,
              sublabel: `${iv.partner?.name ?? ""} ・ ${formatYen(iv.total)}`,
              section: "請求書",
              icon: <FileText size={16} />,
              run: () => go(`/invoices/${iv.id}`),
            }));

    return [...staticCmds, ...journalCmds, ...partnerCmds, ...invoiceCmds];
  }, [query, journalHits, partners, invoices, currentBusiness]);

  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, commands.length - 1)));
  }, [commands.length]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, commands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commands[selected]?.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  // セクション見出しを挟みつつ描画するためのインデックス管理
  let runningIndex = -1;
  let lastSection = "";

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center pt-[12vh] px-4 bg-black/30" onClick={() => onOpenChange(false)}>
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-xl overflow-hidden animate-[modal-in_0.12s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 border-b border-gray-100">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="ページ・操作・仕訳・取引先・請求書を検索…"
            className="flex-1 py-3.5 text-sm outline-none placeholder:text-gray-400"
          />
          <kbd className="text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1.5">
          {commands.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-400">該当する項目がありません</div>
          ) : (
            commands.map((cmd) => {
              runningIndex++;
              const index = runningIndex;
              const showHeading = cmd.section !== lastSection;
              lastSection = cmd.section;
              const active = index === selected;
              return (
                <div key={cmd.id}>
                  {showHeading && (
                    <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {cmd.section}
                    </div>
                  )}
                  <button
                    onMouseEnter={() => setSelected(index)}
                    onClick={() => cmd.run()}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm ${
                      active ? "bg-brand-50 text-brand-800" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className={active ? "text-brand-600" : "text-gray-400"}>{cmd.icon}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{cmd.label}</span>
                      {cmd.sublabel && <span className="block text-xs text-gray-400 truncate">{cmd.sublabel}</span>}
                    </span>
                    {active && <CornerDownLeft size={14} className="text-brand-400 shrink-0" />}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
