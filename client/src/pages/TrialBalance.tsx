import { Fragment, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api } from "../lib/api";
import { formatYen } from "../lib/format";
import type { AccountCategory, TrialBalanceRow } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { TableSkeleton } from "../components/ui/Skeleton";
import { downloadCsv } from "../lib/csvExport";

const CATEGORY_LABELS: Record<AccountCategory, string> = {
  ASSET: "資産",
  LIABILITY: "負債",
  EQUITY: "純資産",
  REVENUE: "収益",
  EXPENSE: "費用",
};
const CATEGORY_ORDER: AccountCategory[] = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

export default function TrialBalance() {
  const { currentBusiness } = useBusiness();
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [period, setPeriod] = useState<{ from: string; to: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hideZero, setHideZero] = useState(true);

  useEffect(() => {
    if (!currentBusiness) return;
    setLoading(true);
    api
      .getTrialBalance(currentBusiness.id)
      .then((res) => {
        setRows(res.rows);
        setPeriod(res.period);
      })
      .finally(() => setLoading(false));
  }, [currentBusiness]);

  if (!currentBusiness) return null;

  const visibleRows = hideZero ? rows.filter((r) => r.debitTotal !== 0 || r.creditTotal !== 0) : rows;
  const totalDebit = rows.reduce((s, r) => s + r.debitTotal, 0);
  const totalCredit = rows.reduce((s, r) => s + r.creditTotal, 0);

  const handleExport = () => {
    downloadCsv(
      "合計残高試算表.csv",
      ["科目コード", "科目名", "区分", "借方合計", "貸方合計", "残高"],
      visibleRows.map((r) => [r.code, r.name, CATEGORY_LABELS[r.category], r.debitTotal, r.creditTotal, r.balance])
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="合計残高試算表"
        subtitle={period && `${period.from.slice(0, 10)} 〜 ${period.to.slice(0, 10)}`}
        action={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-gray-500">
              <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} className="rounded" />
              残高ゼロを非表示
            </label>
            <Button variant="secondary" icon={<Download size={14} />} onClick={handleExport}>
              CSV出力
            </Button>
          </div>
        }
      />

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={10} cols={4} />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 text-xs">
              <tr>
                <th className="px-5 py-2.5 font-normal">科目</th>
                <th className="px-5 py-2.5 font-normal text-right">借方合計</th>
                <th className="px-5 py-2.5 font-normal text-right">貸方合計</th>
                <th className="px-5 py-2.5 font-normal text-right">残高</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORY_ORDER.map((cat) => {
                const catRows = visibleRows.filter((r) => r.category === cat);
                if (catRows.length === 0) return null;
                return (
                  <Fragment key={cat}>
                    <tr className="bg-gray-50 border-t border-gray-100">
                      <td className="px-5 py-1.5 font-semibold text-gray-600 text-xs" colSpan={4}>
                        {CATEGORY_LABELS[cat]}
                      </td>
                    </tr>
                    {catRows.map((r) => (
                      <tr key={r.accountId} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-5 py-2">
                          <span className="text-gray-400 tabular-nums mr-2">{r.code}</span>
                          {r.name}
                        </td>
                        <td className="px-5 py-2 text-right tabular-nums text-gray-600">{formatYen(r.debitTotal)}</td>
                        <td className="px-5 py-2 text-right tabular-nums text-gray-600">{formatYen(r.creditTotal)}</td>
                        <td className="px-5 py-2 text-right tabular-nums font-medium">{formatYen(r.balance)}</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 font-bold">
                <td className="px-5 py-3">合計</td>
                <td className="px-5 py-3 text-right tabular-nums">{formatYen(totalDebit)}</td>
                <td className="px-5 py-3 text-right tabular-nums">{formatYen(totalCredit)}</td>
                <td className="px-5 py-3"></td>
              </tr>
            </tfoot>
          </table>
        )}
      </Card>
    </div>
  );
}
