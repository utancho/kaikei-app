import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, LineChart as LineChartIcon, Printer } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api } from "../lib/api";
import { formatYen } from "../lib/format";
import type { AnalysisIndicator, BusinessAnalysis } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";

function formatIndicator(value: number | null, unit: AnalysisIndicator["unit"]): string {
  if (value === null) return "—";
  if (unit === "倍") return `${value.toFixed(2)} 倍`;
  return `${value.toFixed(1)} %`;
}

function DeltaBadge({ indicator }: { indicator: AnalysisIndicator }) {
  if (indicator.value === null || indicator.previous === null) {
    return <span className="text-xs text-gray-400">前年比 —</span>;
  }
  const diff = indicator.value - indicator.previous;
  if (Math.abs(diff) < 0.05) {
    return (
      <span className="text-xs text-gray-400 flex items-center gap-0.5">
        <Minus size={12} /> 前年並み
      </span>
    );
  }
  const improved = indicator.higherIsBetter ? diff > 0 : diff < 0;
  const Icon = diff > 0 ? ArrowUpRight : ArrowDownRight;
  const suffix = indicator.unit === "倍" ? "pt" : "pt";
  return (
    <span className={`text-xs flex items-center gap-0.5 font-medium ${improved ? "text-emerald-600" : "text-red-500"}`}>
      <Icon size={12} />
      前年比 {diff > 0 ? "+" : ""}
      {diff.toFixed(indicator.unit === "倍" ? 2 : 1)}
      {suffix}
    </span>
  );
}

function IndicatorCard({ indicator }: { indicator: AnalysisIndicator }) {
  return (
    <div className="p-4 rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-700">{indicator.label}</span>
        <DeltaBadge indicator={indicator} />
      </div>
      <div className="mt-1.5 text-2xl font-bold text-gray-900 tabular-nums">
        {formatIndicator(indicator.value, indicator.unit)}
      </div>
      {indicator.previous !== null && (
        <div className="text-xs text-gray-400 mt-0.5">前年: {formatIndicator(indicator.previous, indicator.unit)}</div>
      )}
      <p className="text-xs text-gray-500 mt-2 leading-relaxed">{indicator.description}</p>
    </div>
  );
}

function IndicatorSection({ title, items }: { title: string; items: AnalysisIndicator[] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 mb-2.5">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((ind) => (
          <IndicatorCard key={ind.key} indicator={ind} />
        ))}
      </div>
    </div>
  );
}

export default function ManagementAnalysis() {
  const { currentBusiness } = useBusiness();
  const [data, setData] = useState<BusinessAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentBusiness) return;
    setLoading(true);
    api
      .getBusinessAnalysis(currentBusiness.id)
      .then(setData)
      .finally(() => setLoading(false));
  }, [currentBusiness]);

  if (!currentBusiness) return null;
  if (loading || !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-7 w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const maxYoy = Math.max(1, ...data.yoy.map((r) => Math.max(Math.abs(r.current), Math.abs(r.previous))));

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="経営分析"
        subtitle={`${data.period.from.slice(0, 10)} 〜 ${data.period.to.slice(0, 10)}(前年同期比)`}
        action={
          data.hasData ? (
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => window.print()} className="no-print">
              印刷 / PDF
            </Button>
          ) : undefined
        }
      />

      {!data.hasData ? (
        <Card>
          <EmptyState
            icon={<LineChartIcon size={40} />}
            title="分析できるデータがありません"
            description="仕訳を入力すると、収益性・安全性・効率性の指標が自動で計算されます"
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "売上高", value: data.summary.sales },
              { label: "営業利益", value: data.summary.operatingIncome },
              { label: "当期純利益", value: data.summary.netIncome },
              { label: "総資産", value: data.summary.totalAssets },
            ].map((s) => (
              <Card key={s.label} className="p-4">
                <div className="text-xs text-gray-500">{s.label}</div>
                <div className={`text-xl font-bold mt-1 tabular-nums ${s.value < 0 ? "text-red-600" : "text-gray-900"}`}>
                  {formatYen(s.value)}
                </div>
              </Card>
            ))}
          </div>

          <IndicatorSection title="収益性" items={data.indicators.profitability} />
          <IndicatorSection title="安全性" items={data.indicators.safety} />
          <IndicatorSection title="効率性" items={data.indicators.efficiency} />

          <Card>
            <CardHeader title="損益分岐点分析" subtitle="変動費≈売上原価・固定費≈販管費 とみなした簡易モデル" />
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-500">損益分岐点売上高</div>
                <div className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">
                  {data.breakEven.breakEvenSales === null ? "—" : formatYen(data.breakEven.breakEvenSales)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">限界利益率</div>
                <div className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">
                  {data.breakEven.marginalProfitRatio === null ? "—" : `${data.breakEven.marginalProfitRatio.toFixed(1)} %`}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">安全余裕率</div>
                <div
                  className={`text-xl font-bold mt-0.5 tabular-nums ${
                    (data.breakEven.marginOfSafetyRatio ?? 0) < 0 ? "text-red-600" : "text-gray-900"
                  }`}
                >
                  {data.breakEven.marginOfSafetyRatio === null ? "—" : `${data.breakEven.marginOfSafetyRatio.toFixed(1)} %`}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">固定費(販管費)</div>
                <div className="text-sm font-medium text-gray-700 mt-1 tabular-nums">{formatYen(data.breakEven.fixedCosts)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">変動費(売上原価)</div>
                <div className="text-sm font-medium text-gray-700 mt-1 tabular-nums">{formatYen(data.breakEven.variableCosts)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">当期売上高</div>
                <div className="text-sm font-medium text-gray-700 mt-1 tabular-nums">{formatYen(data.breakEven.sales)}</div>
              </div>
            </div>
            {data.breakEven.breakEvenSales !== null && data.breakEven.sales > 0 && (
              <div className="px-5 pb-5">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span>損益分岐点</span>
                  <span>当期売上</span>
                </div>
                <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-brand-500 rounded-full"
                    style={{ width: `${Math.min(100, (data.breakEven.sales / Math.max(data.breakEven.breakEvenSales, data.breakEven.sales)) * 100)}%` }}
                  />
                  <div
                    className="absolute inset-y-0 w-0.5 bg-red-500"
                    style={{ left: `${Math.min(100, (data.breakEven.breakEvenSales / Math.max(data.breakEven.breakEvenSales, data.breakEven.sales)) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {data.breakEven.sales >= data.breakEven.breakEvenSales
                    ? "当期売上は損益分岐点を上回っています(黒字体質)。"
                    : "当期売上が損益分岐点を下回っています。固定費の見直しや売上増が必要です。"}
                </p>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="前年同期比較" subtitle={`前年: ${data.previousPeriod.from.slice(0, 10)} 〜 ${data.previousPeriod.to.slice(0, 10)}`} />
            {!data.hasPrevious ? (
              <div className="px-5 py-8 text-sm text-gray-400 text-center">前年同期のデータがありません</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.yoy.map((row) => (
                  <div key={row.key} className="px-5 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">{row.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums font-semibold text-gray-900">{formatYen(row.current)}</span>
                        {row.changePct !== null && (
                          <span
                            className={`text-xs font-medium w-16 text-right ${
                              row.changePct >= 0 ? "text-emerald-600" : "text-red-500"
                            }`}
                          >
                            {row.changePct >= 0 ? "+" : ""}
                            {row.changePct.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full"
                          style={{ width: `${Math.max(0, (row.current / maxYoy) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-gray-400 w-28 text-right tabular-nums">前年 {formatYen(row.previous)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <p className="text-xs text-gray-400">
            ※ 指標は確定済みの仕訳をもとに自動計算した参考値です。期中の場合は年換算されていない点にご注意ください。
          </p>
        </>
      )}
    </div>
  );
}
