import { Fragment, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PlusCircle, Search, BookText, Pencil, Trash2, ChevronDown, Download, Repeat, Copy } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api } from "../lib/api";
import { formatDate, formatYen } from "../lib/format";
import type { JournalEntry } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { TableSkeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { useConfirm } from "../components/ui/ConfirmDialog";
import { inputClass } from "../lib/formStyles";
import { downloadCsv } from "../lib/csvExport";

const SOURCE_LABELS: Record<JournalEntry["source"], { label: string; tone: "gray" | "blue" | "green" }> = {
  MANUAL: { label: "手入力", tone: "gray" },
  BANK_IMPORT: { label: "CSV取込", tone: "blue" },
  INVOICE: { label: "請求書", tone: "green" },
};

export default function JournalEntries() {
  const { currentBusiness } = useBusiness();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [keyword, setKeyword] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => {
    if (!currentBusiness) return;
    setLoading(true);
    api
      .listJournalEntries(currentBusiness.id, { keyword: keyword || undefined, from: from || undefined, to: to || undefined })
      .then(setEntries)
      .finally(() => setLoading(false));
  };

  useEffect(load, [currentBusiness]);

  if (!currentBusiness) return null;

  const handleExport = () => {
    downloadCsv(
      "仕訳帳.csv",
      ["No.", "日付", "摘要", "借方科目", "借方金額", "貸方科目", "貸方金額"],
      entries.flatMap((e) => {
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="仕訳帳"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={<Download size={14} />} onClick={handleExport} disabled={entries.length === 0}>
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
            className={`${inputClass} pl-8 w-48`}
            placeholder="キーワード検索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-gray-400 text-sm pb-2">〜</span>
        <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
        <Button variant="secondary" onClick={load}>
          検索
        </Button>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : entries.length === 0 ? (
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
                <th className="px-5 py-2.5 font-normal w-12">No.</th>
                <th className="px-5 py-2.5 font-normal w-28">日付</th>
                <th className="px-5 py-2.5 font-normal">摘要</th>
                <th className="px-5 py-2.5 font-normal w-24">区分</th>
                <th className="px-5 py-2.5 font-normal text-right w-32">金額</th>
                <th className="px-5 py-2.5 font-normal w-24"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const src = SOURCE_LABELS[e.source];
                return (
                  <Fragment key={e.id}>
                    <tr className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer group" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                      <td className="px-5 py-2.5 text-gray-400">{e.entryNumber}</td>
                      <td className="px-5 py-2.5 text-gray-500">{formatDate(e.entryDate)}</td>
                      <td className="px-5 py-2.5">
                        <span className="flex items-center gap-1.5">
                          <ChevronDown size={13} className={`text-gray-300 transition-transform ${expanded === e.id ? "rotate-180" : ""}`} />
                          {e.description || "(摘要なし)"}
                        </span>
                      </td>
                      <td className="px-5 py-2.5">
                        <Badge tone={src.tone}>{src.label}</Badge>
                      </td>
                      <td className="px-5 py-2.5 text-right font-medium">
                        {formatYen(e.lines.filter((l) => l.side === "DEBIT").reduce((s, l) => s + l.amount, 0))}
                      </td>
                      <td className="px-5 py-2.5 text-right" onClick={(ev) => ev.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="text-gray-400 hover:text-brand-600"
                            title="複製して新規作成"
                            onClick={() => navigate(`/journal-entries/new?duplicateId=${e.id}`)}
                          >
                            <Copy size={15} />
                          </button>
                          <Link className="text-gray-400 hover:text-brand-600" to={`/journal-entries/${e.id}`}>
                            <Pencil size={15} />
                          </Link>
                          <button className="text-gray-400 hover:text-red-500" onClick={() => handleDelete(e.id)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded === e.id && (
                      <tr className="bg-gray-50 border-t border-gray-100">
                        <td></td>
                        <td colSpan={5} className="px-5 py-3">
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
    </div>
  );
}
