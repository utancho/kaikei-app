import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Wallet, TrendingUp, TrendingDown, PlusCircle, ArrowRight, Receipt } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api } from "../lib/api";
import { formatDate, formatYen } from "../lib/format";
import type { JournalEntry, ProfitLoss } from "../lib/types";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";

const PIE_COLORS = ["#2f8a70", "#4fa389", "#7ebfa9", "#aed7c8", "#d6ebe3", "#9ca3af"];

function StatCard({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "negative";
}) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${tone === "negative" ? "bg-red-50 text-red-500" : "bg-brand-50 text-brand-600"}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className={`text-xl font-bold mt-0.5 truncate ${tone === "negative" ? "text-red-600" : "text-gray-900"}`}>{value}</div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { currentBusiness } = useBusiness();
  const navigate = useNavigate();
  const [pl, setPl] = useState<ProfitLoss | null>(null);
  const [cashTotal, setCashTotal] = useState(0);
  const [cashTrend, setCashTrend] = useState<{ month: string; balance: number }[]>([]);
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentBusiness) return;
    setLoading(true);
    Promise.all([
      api.getProfitLoss(currentBusiness.id),
      api.getTrialBalance(currentBusiness.id),
      api.listJournalEntries(currentBusiness.id),
      api.getCashTrend(currentBusiness.id, 6),
    ])
      .then(([plData, tb, entries, trend]) => {
        setPl(plData);
        setCashTotal(
          tb.rows.filter((r) => ["現金", "普通預金", "当座預金", "小口現金", "定期預金"].includes(r.name)).reduce((s, r) => s + r.balance, 0)
        );
        setRecentEntries(entries.slice(0, 6));
        setCashTrend(trend);
      })
      .finally(() => setLoading(false));
  }, [currentBusiness]);

  const expenseBreakdown = useMemo(() => {
    if (!pl) return [];
    const expenseItems = pl.lineItems.filter((l) => l.category === "EXPENSE" && l.amount > 0).sort((a, b) => b.amount - a.amount);
    const top = expenseItems.slice(0, 5);
    const restTotal = expenseItems.slice(5).reduce((s, l) => s + l.amount, 0);
    const result = top.map((l) => ({ name: l.name, value: l.amount }));
    if (restTotal > 0) result.push({ name: "その他", value: restTotal });
    return result;
  }, [pl]);

  if (!currentBusiness) return null;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const netIncome = pl?.summary.netIncome ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">ダッシュボード</h1>
        <Button icon={<PlusCircle size={16} />} onClick={() => navigate("/journal-entries/new")}>
          仕訳を入力
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<Wallet size={18} />} label="現預金残高" value={formatYen(cashTotal)} />
        <StatCard icon={<Receipt size={18} />} label="当期売上高" value={formatYen(pl?.summary.sales ?? 0)} />
        <StatCard
          icon={netIncome < 0 ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
          label="当期純利益(見込み)"
          value={formatYen(netIncome)}
          tone={netIncome < 0 ? "negative" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="現預金残高の推移" subtitle="直近6か月" />
          <div className="p-4 h-64">
            {cashTrend.every((p) => p.balance === 0) ? (
              <EmptyState title="データがまだありません" description="仕訳を入力すると推移が表示されます" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashTrend} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2f8a70" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#2f8a70" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${Math.round(v / 10000)}万`}
                    width={48}
                  />
                  <Tooltip
                    formatter={(v) => formatYen(Number(v))}
                    labelStyle={{ fontSize: 12 }}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Area type="monotone" dataKey="balance" stroke="#2f8a70" strokeWidth={2} fill="url(#cashGradient)" name="残高" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="費用の内訳" subtitle="当期" />
          <div className="p-4 h-64">
            {expenseBreakdown.length === 0 ? (
              <EmptyState title="費用データがありません" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expenseBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {expenseBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatYen(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {expenseBreakdown.length > 0 && (
            <div className="px-4 pb-4 space-y-1.5">
              {expenseBreakdown.map((e, i) => (
                <div key={e.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {e.name}
                  </span>
                  <span className="text-gray-500">{formatYen(e.value)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="最近の仕訳"
          action={
            <Link to="/journal-entries" className="text-sm text-brand-600 hover:underline flex items-center gap-1">
              すべて見る <ArrowRight size={14} />
            </Link>
          }
        />
        {recentEntries.length === 0 ? (
          <EmptyState
            title="仕訳がまだありません"
            description="最初の取引を入力して記帳を始めましょう"
            action={
              <Button size="sm" icon={<PlusCircle size={14} />} onClick={() => navigate("/journal-entries/new")}>
                仕訳を入力
              </Button>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 text-xs">
              <tr>
                <th className="px-5 py-2 font-normal">日付</th>
                <th className="px-5 py-2 font-normal">摘要</th>
                <th className="px-5 py-2 font-normal text-right">金額</th>
              </tr>
            </thead>
            <tbody>
              {recentEntries.map((e) => (
                <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-2.5 text-gray-500">{formatDate(e.entryDate)}</td>
                  <td className="px-5 py-2.5">{e.description || "(摘要なし)"}</td>
                  <td className="px-5 py-2.5 text-right font-medium">
                    {formatYen(e.lines.filter((l) => l.side === "DEBIT").reduce((s, l) => s + l.amount, 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
