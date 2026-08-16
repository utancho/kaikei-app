import { useEffect, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { useBusiness } from "../context/BusinessContext";
import { api } from "../lib/api";
import { formatYen } from "../lib/format";
import type { MonthlyTrendPoint } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";

export default function MonthlyTrend() {
  const { currentBusiness } = useBusiness();
  const [points, setPoints] = useState<MonthlyTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentBusiness) return;
    setLoading(true);
    api
      .getMonthlyTrend(currentBusiness.id, 12)
      .then(setPoints)
      .finally(() => setLoading(false));
  }, [currentBusiness]);

  if (!currentBusiness) return null;
  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="月次推移表" subtitle="直近12か月の売上・費用・利益の推移" />

      <Card className="p-4 h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 10000)}万`} width={48} />
            <Tooltip formatter={(v) => formatYen(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="sales" name="売上高" fill="#7ebfa9" radius={[3, 3, 0, 0]} />
            <Bar dataKey="expenses" name="費用" fill="#f3a5a5" radius={[3, 3, 0, 0]} />
            <Line type="monotone" dataKey="netIncome" name="純利益" stroke="#2f8a70" strokeWidth={2.5} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-400 text-xs">
            <tr>
              <th className="px-5 py-2.5 font-normal">月</th>
              <th className="px-5 py-2.5 font-normal text-right">売上高</th>
              <th className="px-5 py-2.5 font-normal text-right">費用</th>
              <th className="px-5 py-2.5 font-normal text-right">純利益</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.month} className="border-t border-gray-100">
                <td className="px-5 py-2">{p.month}</td>
                <td className="px-5 py-2 text-right tabular-nums">{formatYen(p.sales)}</td>
                <td className="px-5 py-2 text-right tabular-nums">{formatYen(p.expenses)}</td>
                <td className={`px-5 py-2 text-right tabular-nums font-medium ${p.netIncome < 0 ? "text-red-600" : ""}`}>{formatYen(p.netIncome)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
