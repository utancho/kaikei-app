import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Info, Wallet } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api } from "../lib/api";
import { formatYen } from "../lib/format";
import type { CashFlowForecast as CashFlowForecastData } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";

export default function CashFlowForecast() {
  const { currentBusiness } = useBusiness();
  const [data, setData] = useState<CashFlowForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentBusiness) return;
    setLoading(true);
    api
      .getCashFlowForecast(currentBusiness.id, 6)
      .then(setData)
      .finally(() => setLoading(false));
  }, [currentBusiness]);

  if (!currentBusiness) return null;
  if (loading || !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  const chartData: { month: string; actual: number | null; forecast: number | null }[] = [
    ...data.history.map((h) => ({ month: h.month, actual: h.balance, forecast: null })),
    ...data.forecast.map((f) => ({ month: f.month, actual: null, forecast: f.balance })),
  ];
  // 実績の最終点を予測の開始点にもつなげる
  if (chartData.length > data.history.length) {
    chartData[data.history.length - 1] = { ...chartData[data.history.length - 1], forecast: chartData[data.history.length - 1].actual };
  }

  const usesBudget = data.forecast.some((f) => f.source === "budget");

  return (
    <div className="space-y-5">
      <PageHeader title="資金繰り表(予測)" subtitle="現預金残高の推移と、今後6か月の予測" />

      <div className="flex items-start gap-2 bg-sky-50 text-sky-800 text-xs px-4 py-2.5 rounded-lg border border-sky-200">
        <Info size={15} className="shrink-0 mt-0.5" />
        予測は{usesBudget ? "予算実績管理で入力した金額(入力がない月は直近の増減トレンド)" : "直近6か月の現預金増減の平均"}
        から算出した参考値です。実際の入出金予定とは異なる場合があります。
      </div>

      <Card className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-brand-50 text-brand-600">
          <Wallet size={18} />
        </div>
        <div>
          <div className="text-xs text-gray-500">現在の現預金残高</div>
          <div className="text-xl font-bold mt-0.5 text-gray-900">{formatYen(data.currentBalance)}</div>
        </div>
      </Card>

      <Card className="p-4 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2f8a70" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#2f8a70" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9ca3af" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#9ca3af" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 10000)}万`} width={48} />
            <Tooltip formatter={(v) => formatYen(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="actual" name="実績" stroke="#2f8a70" strokeWidth={2} fill="url(#actualGradient)" connectNulls={false} />
            <Area
              type="monotone"
              dataKey="forecast"
              name="予測"
              stroke="#9ca3af"
              strokeWidth={2}
              strokeDasharray="5 4"
              fill="url(#forecastGradient)"
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-400 text-xs">
            <tr>
              <th className="px-5 py-2.5 font-normal">月</th>
              <th className="px-5 py-2.5 font-normal text-right">予測残高</th>
              <th className="px-5 py-2.5 font-normal text-right">根拠</th>
            </tr>
          </thead>
          <tbody>
            {data.forecast.map((f) => (
              <tr key={f.month} className="border-t border-gray-100">
                <td className="px-5 py-2">{f.month}</td>
                <td className={`px-5 py-2 text-right tabular-nums font-medium ${f.balance < 0 ? "text-red-600" : "text-gray-900"}`}>
                  {formatYen(f.balance)}
                </td>
                <td className="px-5 py-2 text-right text-xs text-gray-400">{f.source === "budget" ? "予算" : "直近トレンド"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
