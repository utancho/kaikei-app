import { useEffect, useState } from "react";
import { Printer, Info } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api } from "../lib/api";
import { formatYen } from "../lib/format";
import type { BlueReturnStatement } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";

function Row({ label, amount, bold = false }: { label: string; amount: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-2 px-5 text-sm ${bold ? "font-bold border-t border-gray-100 bg-gray-50 text-gray-900" : "text-gray-600"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatYen(amount)}</span>
    </div>
  );
}

export default function BlueReturn() {
  const { currentBusiness } = useBusiness();
  const [statement, setStatement] = useState<BlueReturnStatement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentBusiness) return;
    setLoading(true);
    api
      .getBlueReturn(currentBusiness.id)
      .then(setStatement)
      .finally(() => setLoading(false));
  }, [currentBusiness]);

  if (!currentBusiness) return null;
  if (loading || !statement) {
    return (
      <div className="space-y-5 max-w-3xl">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader
        title="青色申告決算書(参考)"
        subtitle={`${statement.period.from.slice(0, 10)} 〜 ${statement.period.to.slice(0, 10)}`}
        action={
          <Button variant="secondary" icon={<Printer size={14} />} onClick={() => window.open("/reports/blue-return/print", "_blank")}>
            印刷 / PDF
          </Button>
        }
      />

      <div className="flex items-start gap-2 bg-sky-50 text-sky-800 text-xs px-4 py-2.5 rounded-lg border border-sky-200">
        <Info size={15} className="shrink-0 mt-0.5" />
        国税庁「青色申告決算書(一般用)」の様式を参考にした簡易フォーマットです。仕訳データから自動集計していますが、提出前に必ず内容をご確認ください(貸倒引当金・棚卸資産の増減などは反映されません)。
      </div>

      <Card className="overflow-hidden divide-y divide-gray-100">
        <div className="px-5 py-2 bg-gray-50 font-semibold text-sm text-gray-700">収入・売上原価</div>
        <Row label="売上(収入)金額" amount={statement.sales} />
        <Row label="仕入金額" amount={statement.purchases} />
        <Row label="差引金額(売上総利益)" amount={statement.grossProfit} bold />

        <div className="px-5 py-2 bg-gray-50 font-semibold text-sm text-gray-700">経費</div>
        {statement.expenseLines.map((l) => (
          <Row key={l.key} label={l.label} amount={l.amount} />
        ))}
        <Row label="経費計" amount={statement.expenseTotal} bold />

        <Row label="差引金額" amount={statement.incomeBeforeDeductions} bold />
        <Row label="専従者給与" amount={statement.specialAllowanceWages} />
        <Row label="青色申告特別控除前の所得金額" amount={statement.incomeAfterWages} bold />
        <Row label="青色申告特別控除額" amount={statement.blueReturnDeduction} />
        <div className="flex justify-between py-3 px-5 text-base font-bold bg-brand-50 text-brand-800">
          <span>所得金額</span>
          <span className="tabular-nums">{formatYen(statement.finalIncome)}</span>
        </div>
      </Card>
    </div>
  );
}
