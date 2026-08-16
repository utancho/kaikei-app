import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api } from "../lib/api";
import { formatYen } from "../lib/format";
import type { BlueReturnStatement } from "../lib/types";
import { Button } from "../components/ui/Button";

function Row({ label, amount, bold = false }: { label: string; amount: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 border-b border-gray-200 ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatYen(amount)}</span>
    </div>
  );
}

export default function BlueReturnPrint() {
  const { currentBusiness } = useBusiness();
  const [statement, setStatement] = useState<BlueReturnStatement | null>(null);

  useEffect(() => {
    if (!currentBusiness) return;
    api.getBlueReturn(currentBusiness.id).then(setStatement);
  }, [currentBusiness]);

  if (!currentBusiness || !statement) return <div className="p-10 text-gray-400 text-sm">読み込み中...</div>;

  const bs = statement.balanceSheet;

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      <div className="max-w-2xl mx-auto mb-4 flex justify-end no-print">
        <Button icon={<Printer size={16} />} onClick={() => window.print()}>
          印刷する
        </Button>
      </div>
      <div className="max-w-2xl mx-auto bg-white shadow-sm print:shadow-none p-10 text-sm text-gray-800">
        <h1 className="text-xl font-bold text-center mb-1">青色申告決算書(一般用・簡易フォーマット)</h1>
        <p className="text-center text-xs text-gray-400 mb-6">
          {statement.period.from.slice(0, 10)} 〜 {statement.period.to.slice(0, 10)}
        </p>

        <div className="flex justify-between mb-6 text-xs text-gray-500">
          <span>屋号: {statement.business.name}</span>
          <span>氏名: {statement.business.representativeName ?? ""}</span>
        </div>

        <h2 className="font-semibold border-b-2 border-gray-800 pb-1 mb-1">損益計算書</h2>
        <Row label="売上(収入)金額" amount={statement.sales} />
        <Row label="仕入金額" amount={statement.purchases} />
        <Row label="差引金額" amount={statement.grossProfit} bold />

        <div className="mt-3 mb-1 text-xs text-gray-400">経費</div>
        {statement.expenseLines.map((l) => (
          <Row key={l.key} label={l.label} amount={l.amount} />
        ))}
        <Row label="経費計" amount={statement.expenseTotal} bold />

        <Row label="差引金額" amount={statement.incomeBeforeDeductions} bold />
        <Row label="専従者給与" amount={statement.specialAllowanceWages} />
        <Row label="青色申告特別控除前の所得金額" amount={statement.incomeAfterWages} bold />
        <Row label="青色申告特別控除額" amount={statement.blueReturnDeduction} />
        <div className="flex justify-between py-2 font-bold text-base bg-brand-50 px-2 rounded mt-1">
          <span>所得金額</span>
          <span className="tabular-nums">{formatYen(statement.finalIncome)}</span>
        </div>

        <h2 className="font-semibold border-b-2 border-gray-800 pb-1 mb-1 mt-8">貸借対照表(参考・{bs.asOf.slice(0, 10)}時点)</h2>
        <div className="grid grid-cols-2 gap-6 mt-2">
          <div>
            <div className="text-xs text-gray-400 mb-1">資産の部</div>
            {bs.lineItems
              .filter((l) => l.category === "ASSET")
              .map((l) => (
                <Row key={l.accountId} label={l.name} amount={l.amount} />
              ))}
            <Row label="資産合計" amount={bs.totalAssets} bold />
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">負債・純資産の部</div>
            {bs.lineItems
              .filter((l) => l.category === "LIABILITY" || l.category === "EQUITY")
              .map((l) => (
                <Row key={l.accountId} label={l.name} amount={l.amount} />
              ))}
            <Row label="当期純利益(未振替)" amount={bs.currentNetIncome} />
            <Row label="負債・純資産合計" amount={bs.totalLiabilitiesAndEquity} bold />
          </div>
        </div>

        <p className="text-[10px] text-gray-400 mt-8 leading-relaxed">
          ※ 本書は国税庁の青色申告決算書の様式を参考にした簡易フォーマットであり、正式な提出書類ではありません。棚卸資産・貸倒引当金等は反映されていないため、実際の申告にあたっては内容をご確認のうえ、必要に応じて税理士にご相談ください。
        </p>
      </div>
    </div>
  );
}
