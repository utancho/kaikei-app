import { useEffect, useState } from "react";
import { Download, AlertTriangle } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api } from "../lib/api";
import { formatYen } from "../lib/format";
import type { BalanceSheet as BalanceSheetData } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { downloadCsv } from "../lib/csvExport";

function Row({ label, amount, bold = false }: { label: string; amount: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-2 px-5 text-sm ${bold ? "font-bold border-t border-gray-100 bg-gray-50 text-gray-900" : "text-gray-600"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatYen(amount)}</span>
    </div>
  );
}

export default function BalanceSheet() {
  const { currentBusiness } = useBusiness();
  const [bs, setBs] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentBusiness) return;
    setLoading(true);
    api
      .getBalanceSheet(currentBusiness.id)
      .then(setBs)
      .finally(() => setLoading(false));
  }, [currentBusiness]);

  if (!currentBusiness) return null;
  if (loading || !bs) {
    return (
      <div className="space-y-5 max-w-4xl">
        <Skeleton className="h-7 w-40" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const assets = bs.lineItems.filter((l) => l.category === "ASSET");
  const liabilities = bs.lineItems.filter((l) => l.category === "LIABILITY");
  const equity = bs.lineItems.filter((l) => l.category === "EQUITY");

  const handleExport = () => {
    downloadCsv(
      "貸借対照表.csv",
      ["区分", "科目", "金額"],
      [
        ...assets.map((a) => ["資産", a.name, a.amount]),
        ["資産", "資産合計", bs.totalAssets],
        ...liabilities.map((l) => ["負債", l.name, l.amount]),
        ["負債", "負債合計", bs.totalLiabilities],
        ...equity.map((e) => ["純資産", e.name, e.amount]),
        ["純資産", "当期純利益(未振替)", bs.currentNetIncome],
        ["純資産", "純資産合計", bs.totalEquity],
      ]
    );
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader
        title="貸借対照表"
        subtitle={`${bs.asOf.slice(0, 10)} 時点`}
        action={
          <Button variant="secondary" icon={<Download size={14} />} onClick={handleExport}>
            CSV出力
          </Button>
        }
      />

      {!bs.balanced && (
        <div className="flex items-center gap-2 bg-amber-50 text-amber-800 text-sm px-4 py-2.5 rounded-lg border border-amber-200">
          <AlertTriangle size={16} />
          貸借が一致していません。仕訳データをご確認ください。
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="overflow-hidden divide-y divide-gray-100">
          <CardHeader title="資産の部" />
          {assets.map((l) => (
            <Row key={l.accountId} label={l.name} amount={l.amount} />
          ))}
          <Row label="資産合計" amount={bs.totalAssets} bold />
        </Card>

        <Card className="overflow-hidden divide-y divide-gray-100">
          <CardHeader title="負債の部" />
          {liabilities.map((l) => (
            <Row key={l.accountId} label={l.name} amount={l.amount} />
          ))}
          <Row label="負債合計" amount={bs.totalLiabilities} bold />

          <div className="px-5 py-2.5 bg-gray-50 font-semibold text-sm text-gray-700 border-t border-gray-100">純資産の部</div>
          {equity.map((l) => (
            <Row key={l.accountId} label={l.name} amount={l.amount} />
          ))}
          <Row label="当期純利益(未振替)" amount={bs.currentNetIncome} />
          <Row label="純資産合計" amount={bs.totalEquity} bold />
          <div className="flex justify-between py-3 px-5 text-sm font-bold bg-brand-50 text-brand-800">
            <span>負債・純資産合計</span>
            <span className="tabular-nums">{formatYen(bs.totalLiabilitiesAndEquity)}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
