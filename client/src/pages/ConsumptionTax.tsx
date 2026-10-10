import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api } from "../lib/api";
import { formatYen } from "../lib/format";
import type { ConsumptionTaxReturn } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";

function Row({ label, amount, bold = false }: { label: string; amount: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-2 px-5 text-sm ${bold ? "font-bold border-t border-gray-100 bg-gray-50 text-gray-900" : "text-gray-600"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatYen(amount)}</span>
    </div>
  );
}

const TAXATION_LABELS: Record<string, string> = {
  EXEMPT: "免税事業者",
  GENERAL: "本則課税",
  SIMPLIFIED: "簡易課税",
};

export default function ConsumptionTax() {
  const { currentBusiness } = useBusiness();
  const [statement, setStatement] = useState<ConsumptionTaxReturn | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentBusiness) return;
    setLoading(true);
    api
      .getConsumptionTax(currentBusiness.id)
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
        title="消費税申告書(参考)"
        subtitle={`${statement.period.from.slice(0, 10)} 〜 ${statement.period.to.slice(0, 10)} / ${TAXATION_LABELS[statement.business.taxationType]}`}
      />

      <div className="flex items-start gap-2 bg-sky-50 text-sky-800 text-xs px-4 py-2.5 rounded-lg border border-sky-200">
        <Info size={15} className="shrink-0 mt-0.5" />
        仕訳の税区分と計上済み請求書の税率別内訳から集計した参考値です。国税・地方消費税の按分は概算です。実際の申告にあたっては税理士等の確認を受けてください。課税方式は「設定」から変更できます。
      </div>

      {((statement.legacyInvoiceCount ?? 0)>0 || (statement.unclassifiedInvoiceSales ?? 0)!==0) && <div role="alert" className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
        集計の確認が必要です。税率別内訳または計上の対応を確認できない旧請求書が{statement.legacyInvoiceCount ?? 0}件、税区分未指定の請求額が{formatYen(statement.unclassifiedInvoiceSales ?? 0)}あります。元の請求書と仕訳を照合してください。
      </div>}
      {statement.isExempt ? (
        <Card className="p-6 text-center text-gray-500 text-sm">
          この事業者は免税事業者に設定されているため、消費税の申告は不要です。
          <br />
          課税方式は「設定」から変更できます。
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden divide-y divide-gray-100">
            <div className="px-5 py-2 bg-gray-50 font-semibold text-sm text-gray-700">課税売上高</div>
            <Row label="標準税率(10%)対象 課税売上高" amount={statement.taxableSales.standard.base} />
            <Row label="軽減税率(8%)対象 課税売上高" amount={statement.taxableSales.reduced.base} />
            <Row label="非課税売上高" amount={statement.exemptSales} />
            <Row label="不課税収入" amount={statement.outOfScopeSales} />
            <Row label="輸出免税売上高" amount={statement.exportSales} />

            <div className="px-5 py-2 bg-gray-50 font-semibold text-sm text-gray-700">課税売上に対する消費税額</div>
            <Row label="標準税率分(国税)" amount={statement.outputTax.standard.national} />
            <Row label="標準税率分(地方消費税)" amount={statement.outputTax.standard.local} />
            <Row label="軽減税率分(国税)" amount={statement.outputTax.reduced.national} />
            <Row label="軽減税率分(地方消費税)" amount={statement.outputTax.reduced.local} />
            <Row label="課税売上に対する消費税額 合計" amount={statement.outputTax.total} bold />
          </Card>

          {statement.taxablePurchases && statement.inputTax && (
            <Card className="overflow-hidden divide-y divide-gray-100">
              <div className="px-5 py-2 bg-gray-50 font-semibold text-sm text-gray-700">課税仕入高(本則課税)</div>
              <Row label="標準税率(10%)対象 課税仕入高" amount={statement.taxablePurchases.standard.base} />
              <Row label="軽減税率(8%)対象 課税仕入高" amount={statement.taxablePurchases.reduced.base} />
              <Row label="仕入税額控除 合計" amount={statement.inputTax.total} bold />
            </Card>
          )}

          {statement.simplified && (
            <Card className="overflow-hidden divide-y divide-gray-100">
              <div className="px-5 py-2 bg-gray-50 font-semibold text-sm text-gray-700">簡易課税(みなし仕入率)</div>
              <div className="py-2 px-5 text-sm text-gray-600">事業区分: {statement.simplified.businessCategoryLabel}</div>
              <div className="flex justify-between py-2 px-5 text-sm text-gray-600">
                <span>みなし仕入率</span>
                <span className="tabular-nums">{(statement.simplified.deemedPurchaseRate * 100).toFixed(0)}%</span>
              </div>
              <Row label="みなし仕入税額(控除額)" amount={statement.simplified.deemedInputTax} bold />
            </Card>
          )}

          {statement.payableTax && (
            <Card className="overflow-hidden divide-y divide-gray-100">
              <div className="px-5 py-2 bg-gray-50 font-semibold text-sm text-gray-700">納付税額</div>
              <Row label="国税分" amount={statement.payableTax.national} />
              <Row label="地方消費税分" amount={statement.payableTax.local} />
              <div className="flex justify-between py-3 px-5 text-base font-bold bg-brand-50 text-brand-800">
                <span>納付税額 合計</span>
                <span className="tabular-nums">{formatYen(statement.payableTax.total)}</span>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
