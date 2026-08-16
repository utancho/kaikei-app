import { useEffect, useState } from "react";
import { Download, BookOpenText } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api } from "../lib/api";
import { formatDate, formatYen } from "../lib/format";
import type { Account, GeneralLedger as GeneralLedgerData } from "../lib/types";
import { AccountSelect } from "../components/AccountSelect";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { TableSkeleton } from "../components/ui/Skeleton";
import { labelClass } from "../lib/formStyles";
import { downloadCsv } from "../lib/csvExport";

export default function GeneralLedger() {
  const { currentBusiness } = useBusiness();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [ledger, setLedger] = useState<GeneralLedgerData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentBusiness) return;
    api.listAccounts(currentBusiness.id).then((accs) => {
      setAccounts(accs);
      if (!accountId && accs.length > 0) {
        const cash = accs.find((a) => a.code === "1030") ?? accs[0];
        setAccountId(cash.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBusiness]);

  useEffect(() => {
    if (!currentBusiness || !accountId) return;
    setLoading(true);
    api
      .getGeneralLedger(currentBusiness.id, accountId)
      .then(setLedger)
      .finally(() => setLoading(false));
  }, [currentBusiness, accountId]);

  if (!currentBusiness) return null;

  const handleExport = () => {
    if (!ledger) return;
    downloadCsv(
      `総勘定元帳_${ledger.account.code}_${ledger.account.name}.csv`,
      ["日付", "摘要", "取引先", "借方", "貸方", "残高"],
      [
        ["", "期首残高", "", "", "", ledger.openingBalance],
        ...ledger.rows.map((r) => [
          formatDate(r.entryDate),
          r.description ?? "",
          r.partnerName ?? "",
          r.side === "DEBIT" ? r.amount : "",
          r.side === "CREDIT" ? r.amount : "",
          r.balance,
        ]),
      ]
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader title="総勘定元帳" />

      <Card className="p-4 flex items-end justify-between flex-wrap gap-3">
        <div>
          <label className={labelClass}>勘定科目</label>
          <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} className="w-64" />
        </div>
        <Button variant="secondary" icon={<Download size={14} />} onClick={handleExport} disabled={!ledger}>
          CSV出力
        </Button>
      </Card>

      <Card className="overflow-hidden">
        {loading || !ledger ? (
          <TableSkeleton rows={6} cols={6} />
        ) : (
          <>
            <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between text-sm flex-wrap gap-2">
              <div className="font-semibold text-gray-800">
                {ledger.account.code} {ledger.account.name}
              </div>
              <div className="text-gray-500">
                期首残高: <span className="font-medium text-gray-700">{formatYen(ledger.openingBalance)}</span> / 期末残高:{" "}
                <span className="font-medium text-gray-700">{formatYen(ledger.closingBalance)}</span>
              </div>
            </div>
            {ledger.rows.length === 0 ? (
              <EmptyState icon={<BookOpenText size={40} />} title="この期間の取引はありません" />
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-gray-400 text-xs">
                  <tr>
                    <th className="px-5 py-2.5 font-normal w-28">日付</th>
                    <th className="px-5 py-2.5 font-normal">摘要</th>
                    <th className="px-5 py-2.5 font-normal">取引先</th>
                    <th className="px-5 py-2.5 font-normal text-right w-32">借方</th>
                    <th className="px-5 py-2.5 font-normal text-right w-32">貸方</th>
                    <th className="px-5 py-2.5 font-normal text-right w-32">残高</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-100 bg-gray-50">
                    <td className="px-5 py-2" colSpan={5}>
                      期首残高
                    </td>
                    <td className="px-5 py-2 text-right font-semibold">{formatYen(ledger.openingBalance)}</td>
                  </tr>
                  {ledger.rows.map((r, i) => (
                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-5 py-2 text-gray-500">{formatDate(r.entryDate)}</td>
                      <td className="px-5 py-2">{r.description || "(摘要なし)"}</td>
                      <td className="px-5 py-2 text-xs text-gray-500">{r.partnerName ?? ""}</td>
                      <td className="px-5 py-2 text-right tabular-nums">{r.side === "DEBIT" ? formatYen(r.amount) : ""}</td>
                      <td className="px-5 py-2 text-right tabular-nums">{r.side === "CREDIT" ? formatYen(r.amount) : ""}</td>
                      <td className="px-5 py-2 text-right tabular-nums font-medium">{formatYen(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
