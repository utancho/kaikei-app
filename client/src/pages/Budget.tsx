import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api, ApiError } from "../lib/api";
import { formatYen } from "../lib/format";
import type { BudgetActualResponse } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";

const CATEGORY_LABELS: Record<string, string> = { REVENUE: "収益", EXPENSE: "費用" };

export default function Budget() {
  const { currentBusiness } = useBusiness();
  const toast = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<BudgetActualResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // key: `${accountId}-${month}` -> edited value (string, to allow empty while typing)
  const [edits, setEdits] = useState<Record<string, string>>({});

  const load = () => {
    if (!currentBusiness) return;
    setLoading(true);
    setEdits({});
    api
      .getBudgetActual(currentBusiness.id, year)
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(load, [currentBusiness, year]);

  const handleChange = (accountId: string, month: number, value: string) => {
    setEdits((prev) => ({ ...prev, [`${accountId}-${month}`]: value }));
  };

  const dirtyCount = Object.keys(edits).length;

  const handleSave = async () => {
    if (!currentBusiness || dirtyCount === 0) return;
    setSaving(true);
    try {
      const entries = Object.entries(edits).map(([key, value]) => {
        const [accountId, monthStr] = key.split("-");
        return { accountId, year, month: Number(monthStr), amount: Math.max(0, Math.round(Number(value) || 0)) };
      });
      await api.saveBudgets(currentBusiness.id, entries);
      toast.success("予算を保存しました");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const totals = useMemo(() => {
    if (!data) return null;
    const revenue = data.rows.filter((r) => r.category === "REVENUE");
    const expense = data.rows.filter((r) => r.category === "EXPENSE");
    const sum = (rows: typeof data.rows, key: "budgetTotal" | "actualTotal") => rows.reduce((s, r) => s + r[key], 0);
    return {
      budgetProfit: sum(revenue, "budgetTotal") - sum(expense, "budgetTotal"),
      actualProfit: sum(revenue, "actualTotal") - sum(expense, "actualTotal"),
    };
  }, [data]);

  if (!currentBusiness) return null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="予算実績管理"
        subtitle="月ごとの予算を入力し、実績と比較できます"
        action={
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500" onClick={() => setYear((y) => y - 1)}>
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-gray-700 w-16 text-center">{year}年</span>
            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500" onClick={() => setYear((y) => y + 1)}>
              <ChevronRight size={16} />
            </button>
            <Button icon={<Save size={14} />} onClick={handleSave} loading={saving} disabled={dirtyCount === 0}>
              保存{dirtyCount > 0 ? `(${dirtyCount})` : ""}
            </Button>
          </div>
        }
      />

      {loading || !data ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          {totals && (
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="text-xs text-gray-500">予算上の年間損益</div>
                <div className="text-xl font-bold mt-1 text-gray-900">{formatYen(totals.budgetProfit)}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-gray-500">実績の年間損益</div>
                <div className={`text-xl font-bold mt-1 ${totals.actualProfit < 0 ? "text-red-600" : "text-gray-900"}`}>
                  {formatYen(totals.actualProfit)}
                </div>
              </Card>
            </div>
          )}

          {(["REVENUE", "EXPENSE"] as const).map((category) => {
            const rows = data.rows.filter((r) => r.category === category);
            if (rows.length === 0) return null;
            return (
              <Card key={category} className="overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 font-semibold text-sm text-gray-700">{CATEGORY_LABELS[category]}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-gray-400">
                      <tr>
                        <th className="text-left font-normal px-4 py-2 sticky left-0 bg-white">科目</th>
                        {Array.from({ length: 12 }, (_, i) => (
                          <th key={i} className="font-normal px-1.5 py-2 text-center whitespace-nowrap">
                            {i + 1}月
                          </th>
                        ))}
                        <th className="font-normal px-3 py-2 text-right whitespace-nowrap">年間予算</th>
                        <th className="font-normal px-3 py-2 text-right whitespace-nowrap">年間実績</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.map((row) => (
                        <tr key={row.accountId}>
                          <td className="px-4 py-1.5 text-gray-700 whitespace-nowrap sticky left-0 bg-white">{row.name}</td>
                          {row.months.map((m) => {
                            const key = `${row.accountId}-${m.month}`;
                            const value = edits[key] ?? String(m.budget || "");
                            return (
                              <td key={m.month} className="px-1 py-1">
                                <input
                                  className="w-16 text-right text-xs border border-transparent hover:border-gray-200 focus:border-brand-400 rounded px-1 py-1 outline-none tabular-nums"
                                  value={value}
                                  onChange={(e) => handleChange(row.accountId, m.month, e.target.value)}
                                  inputMode="numeric"
                                />
                              </td>
                            );
                          })}
                          <td className="px-3 py-1.5 text-right tabular-nums text-gray-500 whitespace-nowrap">{formatYen(row.budgetTotal)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-medium text-gray-900 whitespace-nowrap">{formatYen(row.actualTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
