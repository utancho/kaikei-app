import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  PlusCircle,
  Search,
  BookText,
  Pencil,
  Trash2,
  ChevronDown,
  Download,
  Upload,
  Repeat,
  Copy,
  X,
  FileWarning,
} from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api } from "../lib/api";
import { formatDate, formatYen } from "../lib/format";
import type { Account, JournalEntry, JournalImportEntry, JournalImportResult } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { TableSkeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { useConfirm } from "../components/ui/ConfirmDialog";
import { inputClass, selectClass } from "../lib/formStyles";
import { downloadCsv, parseCsv } from "../lib/csvExport";

const SOURCE_LABELS: Record<JournalEntry["source"], { label: string; tone: "gray" | "blue" | "green" }> = {
  MANUAL: { label: "手入力", tone: "gray" },
  BANK_IMPORT: { label: "CSV取込", tone: "blue" },
  INVOICE: { label: "請求書", tone: "green" },
};

const debitTotal = (e: JournalEntry) => e.lines.filter((l) => l.side === "DEBIT").reduce((s, l) => s + l.amount, 0);

export default function JournalEntries() {
  const { currentBusiness } = useBusiness();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [keyword, setKeyword] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [accountId, setAccountId] = useState("");
  const [source, setSource] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<JournalImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // overrides を渡すと、その値でサーバ検索する(クリア時に古い state を参照しないため)。
  const load = (overrides?: { keyword?: string; from?: string; to?: string; accountId?: string }) => {
    if (!currentBusiness) return;
    setLoading(true);
    setSelected(new Set());
    api
      .listJournalEntries(currentBusiness.id, {
        keyword: (overrides?.keyword ?? keyword) || undefined,
        from: (overrides?.from ?? from) || undefined,
        to: (overrides?.to ?? to) || undefined,
        accountId: (overrides?.accountId ?? accountId) || undefined,
      })
      .then(setEntries)
      .finally(() => setLoading(false));
  };

  useEffect(load, [currentBusiness]);

  useEffect(() => {
    if (!currentBusiness) return;
    api.listAccounts(currentBusiness.id).then(setAccounts).catch(() => {});
  }, [currentBusiness]);

  const visibleEntries = useMemo(() => {
    const min = minAmount ? Number(minAmount) : 0;
    return entries.filter((e) => {
      if (source && e.source !== source) return false;
      if (min > 0 && debitTotal(e) < min) return false;
      return true;
    });
  }, [entries, source, minAmount]);

  if (!currentBusiness) return null;

  const resetFilters = () => {
    setKeyword("");
    setFrom("");
    setTo("");
    setAccountId("");
    setSource("");
    setMinAmount("");
    load({ keyword: "", from: "", to: "", accountId: "" });
  };

  const handleExport = () => {
    downloadCsv(
      "仕訳帳.csv",
      ["No.", "日付", "摘要", "借方科目", "借方金額", "貸方科目", "貸方金額"],
      visibleEntries.flatMap((e) => {
        const debits = e.lines.filter((l) => l.side === "DEBIT");
        const credits = e.lines.filter((l) => l.side === "CREDIT");
        const rowCount = Math.max(debits.length, credits.length);
        return Array.from({ length: rowCount }).map((_, i) => [
          i === 0 ? e.entryNumber : "",
          i === 0 ? formatDate(e.entryDate) : "",
          i === 0 ? e.description ?? "" : "",
          debits[i]?.account?.name ?? "",
          debits[i]?.amount ?? "",
          credits[i]?.account?.name ?? "",
          credits[i]?.amount ?? "",
        ]);
      })
    );
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: "この仕訳を削除しますか?", description: "削除すると元に戻せません。", danger: true, confirmLabel: "削除する" });
    if (!ok) return;
    try {
      await api.deleteJournalEntry(currentBusiness.id, id);
      toast.success("仕訳を削除しました");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = visibleEntries.length > 0 && visibleEntries.every((e) => selected.has(e.id));
  const toggleSelectAll = () => {
    if (allVisibleSelected) setSelected(new Set());
    else setSelected(new Set(visibleEntries.map((e) => e.id)));
  };

  const handleBulkDelete = async () => {
    const ids = [...selected];
    const ok = await confirm({
      title: `${ids.length}件の仕訳を削除しますか?`,
      description: "削除すると元に戻せません。",
      danger: true,
      confirmLabel: "まとめて削除",
    });
    if (!ok) return;
    let okCount = 0;
    for (const id of ids) {
      try {
        await api.deleteJournalEntry(currentBusiness.id, id);
        okCount++;
      } catch {
        // continue
      }
    }
    toast.success(`${okCount}件の仕訳を削除しました`);
    load();
  };

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      toast.error("CSVにデータ行がありません");
      return;
    }
    const header = rows[0].map((h) => h.trim());
    const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
    const iDate = idx(["日付", "取引日", "取引日付"]);
    const iDesc = idx(["摘要", "備考", "摘要/備考"]);
    const iDAcc = idx(["借方科目", "借方勘定科目"]);
    const iDAmt = idx(["借方金額", "借方"]);
    const iCAcc = idx(["貸方科目", "貸方勘定科目"]);
    const iCAmt = idx(["貸方金額", "貸方"]);
    if (iDate < 0 || iDAcc < 0 || iCAcc < 0) {
      toast.error("ヘッダーに「日付」「借方科目」「貸方科目」の列が必要です");
      return;
    }

    const parseNum = (s?: string) => {
      const n = Number((s ?? "").replace(/[,¥￥\s]/g, ""));
      return isNaN(n) ? 0 : n;
    };

    const entriesToImport: JournalImportEntry[] = [];
    let cur: JournalImportEntry | null = null;
    for (const r of rows.slice(1)) {
      const date = (r[iDate] ?? "").trim();
      if (date) {
        cur = { entryDate: date, description: iDesc >= 0 ? (r[iDesc] ?? "").trim() : "", lines: [] };
        entriesToImport.push(cur);
      }
      if (!cur) continue;
      const dAcc = (r[iDAcc] ?? "").trim();
      const dAmt = parseNum(r[iDAmt]);
      const cAcc = (r[iCAcc] ?? "").trim();
      const cAmt = parseNum(r[iCAmt]);
      if (dAcc && dAmt > 0) cur.lines.push({ side: "DEBIT", accountName: dAcc, amount: dAmt });
      if (cAcc && cAmt > 0) cur.lines.push({ side: "CREDIT", accountName: cAcc, amount: cAmt });
    }

    const valid = entriesToImport.filter((e) => e.lines.length > 0);
    if (valid.length === 0) {
      toast.error("取り込める仕訳がありませんでした");
      return;
    }

    setImporting(true);
    setImportResult(null);
    try {
      const res = await api.importJournalEntries(currentBusiness.id, valid);
      setImportResult(res);
      if (res.created > 0) toast.success(`${res.created}件の仕訳を取り込みました`);
      if (res.errors.length === 0) {
        setImportOpen(false);
      } else {
        toast.error(`${res.errors.length}件は取り込めませんでした`);
      }
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "取込に失敗しました");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="仕訳帳"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={<Upload size={14} />} onClick={() => { setImportResult(null); setImportOpen(true); }}>
              CSVインポート
            </Button>
            <Button variant="secondary" icon={<Download size={14} />} onClick={handleExport} disabled={visibleEntries.length === 0}>
              CSV出力
            </Button>
            <Button variant="secondary" icon={<Repeat size={14} />} onClick={() => navigate("/journal-entry-templates")}>
              テンプレートから入力
            </Button>
            <Button icon={<PlusCircle size={16} />} onClick={() => navigate("/journal-entries/new")}>
              仕訳を入力
            </Button>
          </div>
        }
      />

      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className={`${inputClass} pl-8 w-44`}
            placeholder="キーワード検索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-gray-400 text-sm pb-2">〜</span>
        <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
        <select className={`${selectClass} w-40`} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">勘定科目(すべて)</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select className={`${selectClass} w-32`} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">区分(すべて)</option>
          <option value="MANUAL">手入力</option>
          <option value="BANK_IMPORT">CSV取込</option>
          <option value="INVOICE">請求書</option>
        </select>
        <input
          type="number"
          className={`${inputClass} w-32`}
          placeholder="金額(以上)"
          value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
        />
        <Button variant="secondary" onClick={() => load()}>
          検索
        </Button>
        <button className="text-sm text-gray-400 hover:text-gray-600 pb-2" onClick={resetFilters}>
          クリア
        </button>
      </Card>

      {selected.size > 0 && (
        <div className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-lg px-4 py-2.5">
          <span className="text-sm text-brand-800 font-medium">{selected.size}件を選択中</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={handleBulkDelete}>
              まとめて削除
            </Button>
            <button className="text-sm text-gray-500 hover:text-gray-700" onClick={() => setSelected(new Set())}>
              選択解除
            </button>
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : visibleEntries.length === 0 ? (
          <EmptyState
            icon={<BookText size={40} />}
            title="仕訳がありません"
            description="条件を変えるか、新しく仕訳を入力してください"
            action={
              <Button size="sm" icon={<PlusCircle size={14} />} onClick={() => navigate("/journal-entries/new")}>
                仕訳を入力
              </Button>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 text-xs">
              <tr>
                <th className="pl-5 pr-2 py-2.5 w-8">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} className="accent-brand-600" />
                </th>
                <th className="px-3 py-2.5 font-normal w-12">No.</th>
                <th className="px-3 py-2.5 font-normal w-28">日付</th>
                <th className="px-3 py-2.5 font-normal">摘要</th>
                <th className="px-3 py-2.5 font-normal w-24">区分</th>
                <th className="px-3 py-2.5 font-normal text-right w-32">金額</th>
                <th className="px-3 py-2.5 font-normal w-24"></th>
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((e) => {
                const src = SOURCE_LABELS[e.source];
                const isSelected = selected.has(e.id);
                return (
                  <Fragment key={e.id}>
                    <tr className={`border-t border-gray-100 hover:bg-gray-50 group ${isSelected ? "bg-brand-50/50" : ""}`}>
                      <td className="pl-5 pr-2 py-2.5" onClick={(ev) => ev.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(e.id)} className="accent-brand-600" />
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 cursor-pointer" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                        {e.entryNumber}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 cursor-pointer" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                        {formatDate(e.entryDate)}
                      </td>
                      <td className="px-3 py-2.5 cursor-pointer" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                        <span className="flex items-center gap-1.5">
                          <ChevronDown size={13} className={`text-gray-300 transition-transform ${expanded === e.id ? "rotate-180" : ""}`} />
                          {e.description || "(摘要なし)"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={src.tone}>{src.label}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">{formatYen(debitTotal(e))}</td>
                      <td className="px-3 py-2.5 text-right" onClick={(ev) => ev.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="text-gray-400 hover:text-brand-600"
                            title="複製して新規作成"
                            onClick={() => navigate(`/journal-entries/new?duplicateId=${e.id}`)}
                          >
                            <Copy size={15} />
                          </button>
                          <Link className="text-gray-400 hover:text-brand-600" to={`/journal-entries/${e.id}`} title="編集">
                            <Pencil size={15} />
                          </Link>
                          <button className="text-gray-400 hover:text-red-500" onClick={() => handleDelete(e.id)} title="削除">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded === e.id && (
                      <tr className="bg-gray-50 border-t border-gray-100">
                        <td></td>
                        <td colSpan={6} className="px-5 py-3">
                          <table className="w-full text-xs">
                            <thead className="text-gray-400">
                              <tr>
                                <th className="text-left font-normal py-1">借方科目</th>
                                <th className="text-right font-normal py-1">借方金額</th>
                                <th className="text-left font-normal py-1 pl-8">貸方科目</th>
                                <th className="text-right font-normal py-1">貸方金額</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Array.from({
                                length: Math.max(
                                  e.lines.filter((l) => l.side === "DEBIT").length,
                                  e.lines.filter((l) => l.side === "CREDIT").length
                                ),
                              }).map((_, i) => {
                                const debit = e.lines.filter((l) => l.side === "DEBIT")[i];
                                const credit = e.lines.filter((l) => l.side === "CREDIT")[i];
                                return (
                                  <tr key={i}>
                                    <td className="py-1 text-gray-700">{debit?.account?.name ?? ""}</td>
                                    <td className="py-1 text-right text-gray-700">{debit ? formatYen(debit.amount) : ""}</td>
                                    <td className="py-1 pl-8 text-gray-700">{credit?.account?.name ?? ""}</td>
                                    <td className="py-1 text-right text-gray-700">{credit ? formatYen(credit.amount) : ""}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {!loading && visibleEntries.length > 0 && (
        <div className="text-xs text-gray-400 text-right">{visibleEntries.length}件表示中</div>
      )}

      {importOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/30 px-4" onClick={() => setImportOpen(false)}>
          <div
            className="bg-white rounded-xl shadow-lg border w-full max-w-lg p-5 animate-[modal-in_0.12s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">仕訳のCSVインポート</h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setImportOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="text-sm text-gray-600 space-y-2">
              <p>以下の列を含むCSVファイルを選択してください(列の順序は自由です)。</p>
              <code className="block bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700">
                日付, 摘要, 借方科目, 借方金額, 貸方科目, 貸方金額
              </code>
              <ul className="text-xs text-gray-500 list-disc pl-5 space-y-0.5">
                <li>勘定科目は名称で照合します(例: 普通預金、売上高)。</li>
                <li>日付が空の行は直前の仕訳の明細行として扱います(複合仕訳に対応)。</li>
                <li>「CSV出力」したファイルをそのまま取り込めます。</li>
              </ul>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportFile(f);
                e.target.value = "";
              }}
            />

            {importResult && importResult.errors.length > 0 && (
              <div className="mt-4 border border-amber-200 bg-amber-50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-sm font-medium text-amber-800 mb-1.5">
                  <FileWarning size={15} /> {importResult.created}件取込・{importResult.errors.length}件スキップ
                </div>
                <div className="max-h-40 overflow-y-auto text-xs text-amber-800 space-y-0.5">
                  {importResult.errors.map((er) => (
                    <div key={er.row}>
                      {er.row}件目: {er.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <Button variant="secondary" onClick={() => setImportOpen(false)}>
                閉じる
              </Button>
              <Button icon={<Upload size={14} />} loading={importing} onClick={() => fileRef.current?.click()}>
                CSVファイルを選択
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
