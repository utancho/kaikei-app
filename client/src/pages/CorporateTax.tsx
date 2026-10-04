import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api } from "../lib/api";
import { formatYen } from "../lib/format";
import type { CorporateTaxReturn } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";

function Row({ label, amount, sub, bold }: { label: string; amount: number; sub?: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline py-2 px-5 text-sm ${bold ? "font-bold border-t border-gray-100 bg-gray-50" : "text-gray-600"}`}>
      <span className={bold ? "text-gray-800" : ""}>
        {label}
        {sub && <span className="text-xs text-gray-400 ml-2">{sub}</span>}
      </span>
      <span className={`tabular-nums ${bold ? "text-gray-900" : ""}`}>{formatYen(amount)}</span>
    </div>
  );
}

export default function CorporateTax() {
  const { currentBusiness } = useBusiness();
  const [data, setData] = useState<CorporateTaxReturn | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentBusiness) return;
    setLoading(true);
    api
      .getCorporateTax(currentBusiness.id)
      .then(setData)
      .finally(() => setLoading(false));
  }, [currentBusiness]);

  if (!currentBusiness) return null;
  if (loading || !data) {
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
        title="法人税申告書(概算)"
        subtitle={`${data.period.from.slice(0, 10)} 〜 ${data.period.to.slice(0, 10)}`}
        action={
          <Button variant="secondary" icon={<Printer size={14} />} onClick={() => window.print()} className="no-print">
            印刷 / PDF
          </Button>
        }
      />

      {currentBusiness.type !== "CORPORATE" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          この帳票は法人向けです。個人事業主の方は「青色申告決算書」をご利用ください。
        </div>
      )}

      <Card className="overflow-hidden divide-y divide-gray-100">
        <Row label="税引前当期純利益" amount={data.pretaxIncome} />
        <Row label="課税所得(加算・減算調整前の概算)" amount={data.taxableIncome} bold />

        <Row label="法人税 (軽減税率分)" amount={data.corporateTax.reducedAmount} sub={`${data.corporateTax.reducedRate}% × ${formatYen(data.corporateTax.reducedBase)}`} />
        <Row label="法人税 (標準税率分)" amount={data.corporateTax.standardAmount} sub={`${data.corporateTax.standardRate}% × ${formatYen(data.corporateTax.standardBase)}`} />
        <Row label="法人税 合計" amount={data.corporateTax.total} bold />

        <Row label="地方法人税" amount={data.localCorporateTax.amount} sub={`法人税 × ${data.localCorporateTax.rate}%`} />
        <Row label="法人住民税 (法人税割)" amount={data.inhabitantTax.corporateTaxLevy} sub={`法人税 × ${data.inhabitantTax.corporateTaxLevyRate}%`} />
        <Row label="法人住民税 (均等割)" amount={data.inhabitantTax.perCapita} />
        <Row label="法人事業税" amount={data.enterpriseTax.amount} sub={`所得 × ${data.enterpriseTax.rate}%`} />

        <div className="flex justify-between py-3 px-5 text-base font-bold bg-brand-50 text-brand-800">
          <span>税額合計(概算)</span>
          <span className="tabular-nums">{formatYen(data.totalTax)}</span>
        </div>
        {data.effectiveRate !== null && (
          <div className="flex justify-between py-2 px-5 text-xs text-gray-500">
            <span>実効税率(概算)</span>
            <span className="tabular-nums">{data.effectiveRate.toFixed(1)} %</span>
          </div>
        )}
      </Card>

      <p className="text-xs text-gray-400">
        ※ 本書は中小法人の標準的な税率による概算です。課税所得は税引前当期純利益をそのまま用いており、
        税務上の加算・減算(交際費・減価償却超過額・繰越欠損金など)や、自治体ごとの税率・各種特例は
        反映していません。実際の申告は税理士にご相談のうえ、別表で正確に計算してください。
      </p>
    </div>
  );
}
