import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api } from "../lib/api";
import { formatYen } from "../lib/format";
import type { ProfitLoss as ProfitLossData } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { downloadCsv } from "../lib/csvExport";

function Row({ label, amount, bold = false, indent = false }: { label: string; amount: number; bold?: boolean; indent?: boolean }) {
  return (
    <div className={`flex justify-between py-2 px-5 text-sm ${bold ? "font-bold border-t border-gray-100 bg-gray-50" : "text-gray-600"}`}>
      <span className={indent ? "pl-4" : bold ? "text-gray-800" : ""}>{label}</span>
      <span className={`tabular-nums ${amount < 0 ? "text-red-600" : bold ? "text-gray-900" : ""}`}>{formatYen(amount)}</span>
    </div>
  );
}

export default function ProfitLoss() {
  const { currentBusiness } = useBusiness();
  const [pl, setPl] = useState<ProfitLossData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentBusiness) return;
    setLoading(true);
    api
      .getProfitLoss(currentBusiness.id)
      .then(setPl)
      .finally(() => setLoading(false));
  }, [currentBusiness]);

  if (!currentBusiness) return null;
  if (loading || !pl) {
    return (
      <div className="space-y-5 max-w-3xl">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const s = pl.summary;
  const itemsFor = (subcategory: string) => pl.lineItems.filter((l) => l.subcategory === subcategory);

  const section = (subcategory: string, subtotalLabel: string, subtotalAmount: number) => (
    <>
      {itemsFor(subcategory).map((l) => (
        <Row key={l.accountId} label={l.name} amount={l.amount} indent />
      ))}
      <Row label={subtotalLabel} amount={subtotalAmount} />
    </>
  );

  const handleExport = () => {
    downloadCsv(
      "損益計算書.csv",
      ["項目", "金額"],
      [
        ["売上高", s.sales],
        ["売上原価", s.cogs],
        ["売上総利益", s.grossProfit],
        ["販売費及び一般管理費", s.sga],
        ["営業利益", s.operatingIncome],
        ["営業外収益", s.nonOperatingRevenue],
        ["営業外費用", s.nonOperatingExpense],
        ["経常利益", s.ordinaryIncome],
        ["特別利益", s.extraordinaryGain],
        ["特別損失", s.extraordinaryLoss],
        ["税引前当期純利益", s.incomeBeforeTax],
        ["法人税等", s.taxes],
        ["当期純利益", s.netIncome],
      ]
    );
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader
        title="損益計算書"
        subtitle={`${pl.period.from.slice(0, 10)} 〜 ${pl.period.to.slice(0, 10)}`}
        action={
          <Button variant="secondary" icon={<Download size={14} />} onClick={handleExport}>
            CSV出力
          </Button>
        }
      />

      <Card className="overflow-hidden divide-y divide-gray-100">
        {section("売上高", "売上高 合計", s.sales)}
        {section("売上原価", "売上原価 合計", s.cogs)}
        <Row label="売上総利益" amount={s.grossProfit} bold />

        {section("販売費及び一般管理費", "販売費及び一般管理費 合計", s.sga)}
        <Row label="営業利益" amount={s.operatingIncome} bold />

        {section("営業外収益", "営業外収益 合計", s.nonOperatingRevenue)}
        {section("営業外費用", "営業外費用 合計", s.nonOperatingExpense)}
        <Row label="経常利益" amount={s.ordinaryIncome} bold />

        {section("特別利益", "特別利益 合計", s.extraordinaryGain)}
        {section("特別損失", "特別損失 合計", s.extraordinaryLoss)}
        <Row label="税引前当期純利益" amount={s.incomeBeforeTax} bold />

        {section("法人税等", "法人税等 合計", s.taxes)}
        <div className="flex justify-between py-3 px-5 text-base font-bold bg-brand-50 text-brand-800">
          <span>当期純利益</span>
          <span className="tabular-nums">{formatYen(s.netIncome)}</span>
        </div>
      </Card>
    </div>
  );
}
