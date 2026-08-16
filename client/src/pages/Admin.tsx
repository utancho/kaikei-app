import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Users, TrendingUp, CircleCheck, Clock, LogOut, Wallet, Search, Download, AlertTriangle, XCircle, Building2 } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { formatDate, formatYen } from "../lib/format";
import type { AdminBusiness, AdminStats, AdminUser, SubscriptionStatus } from "../lib/types";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { TableSkeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { inputClass, selectClass } from "../lib/formStyles";
import { useToast } from "../components/ui/Toast";

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  NONE: "未契約",
  TRIALING: "トライアル中",
  ACTIVE: "契約中",
  PAST_DUE: "支払い遅延",
  CANCELED: "解約済み",
};

const STATUS_TONES: Record<SubscriptionStatus, "gray" | "green" | "yellow" | "red" | "blue"> = {
  NONE: "gray",
  TRIALING: "blue",
  ACTIVE: "green",
  PAST_DUE: "yellow",
  CANCELED: "red",
};

const STATUS_OPTIONS: SubscriptionStatus[] = ["NONE", "TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"];
const STATUS_FILTERS: (SubscriptionStatus | "ALL")[] = ["ALL", "TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "NONE"];

function StatCard({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          tone === "warning" ? "bg-amber-50 text-amber-600" : "bg-brand-50 text-brand-600"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-xl font-bold mt-0.5 truncate text-gray-900">{value}</div>
      </div>
    </Card>
  );
}

function buildSignupSeries(users: AdminUser[]) {
  if (users.length === 0) return [];
  const days = 30;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const counts = new Map<string, number>();
  for (const u of users) {
    const d = new Date(u.createdAt);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const series: { date: string; label: string; count: number; cumulative: number }[] = [];
  const usersBeforeWindow = users.filter((u) => {
    const d = new Date(u.createdAt);
    const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
    return diffDays >= days;
  }).length;
  let cumulative = usersBeforeWindow;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = counts.get(key) ?? 0;
    cumulative += count;
    series.push({ date: key, label: `${d.getMonth() + 1}/${d.getDate()}`, count, cumulative });
  }
  return series;
}

function exportUsersCsv(users: AdminUser[]) {
  const header = ["メールアドレス", "名前", "権限", "登録日", "事業者数", "契約状況"];
  const rows = users.map((u) => [
    u.email,
    u.name ?? "",
    u.role,
    formatDate(u.createdAt),
    String(u.businesses.length),
    STATUS_LABELS[u.subscription.status],
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kaikei-users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Admin() {
  const toast = useToast();
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | "ALL">("ALL");

  const load = () => {
    setLoading(true);
    Promise.all([api.adminListUsers(), api.adminGetStats(), api.adminListBusinesses()])
      .then(([u, s, b]) => {
        setUsers(u);
        setStats(s);
        setBusinesses(b);
      })
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "読み込みに失敗しました"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleStatusChange = async (userId: string, status: SubscriptionStatus) => {
    try {
      await api.adminUpdateSubscription(userId, status);
      toast.success("契約状況を更新しました");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "更新に失敗しました");
    }
  };

  const handleRoleToggle = async (target: AdminUser) => {
    const nextRole = target.role === "ADMIN" ? "USER" : "ADMIN";
    if (target.id === user?.id && nextRole === "USER") {
      toast.error("自分自身の管理者権限は削除できません");
      return;
    }
    try {
      await api.adminUpdateRole(target.id, nextRole);
      toast.success(nextRole === "ADMIN" ? `${target.email} を管理者にしました` : `${target.email} の管理者権限を外しました`);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "更新に失敗しました");
    }
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== "ALL" && u.subscription.status !== statusFilter) return false;
      if (!q) return true;
      return u.email.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q);
    });
  }, [users, search, statusFilter]);

  const signupSeries = useMemo(() => buildSignupSeries(users), [users]);
  const newLast30Days = useMemo(() => signupSeries.reduce((sum, d) => sum + d.count, 0), [signupSeries]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="h-14 bg-brand-900 text-white flex items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center shrink-0">
            <Wallet size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold">Kaikei 管理者</span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-brand-100">
          <span className="truncate max-w-[200px]">{user?.email}</span>
          <button className="flex items-center gap-1.5 hover:text-white" onClick={() => logout()}>
            <LogOut size={14} /> ログアウト
          </button>
        </div>
      </header>
      <div className="p-6 space-y-5 max-w-6xl mx-auto">
        <PageHeader
          title="管理者ダッシュボード"
          subtitle="全ユーザーの登録状況と契約状況を確認できます"
          action={
            <button
              className="flex items-center gap-1.5 text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-700 bg-white"
              onClick={() => exportUsersCsv(filteredUsers)}
              disabled={filteredUsers.length === 0}
            >
              <Download size={14} /> CSVエクスポート
            </button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Users size={18} />} label="総ユーザー数" value={stats ? String(stats.totalUsers) : "-"} />
          <StatCard icon={<CircleCheck size={18} />} label="契約中" value={stats ? String(stats.activeCount) : "-"} />
          <StatCard icon={<Clock size={18} />} label="トライアル中" value={stats ? String(stats.trialingCount) : "-"} />
          <StatCard
            icon={<TrendingUp size={18} />}
            label="MRR(月次経常収益)"
            value={stats?.mrrJpy != null ? formatYen(stats.mrrJpy) : "未設定"}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<AlertTriangle size={18} />} label="支払い遅延" value={stats ? String(stats.pastDueCount) : "-"} tone="warning" />
          <StatCard icon={<XCircle size={18} />} label="解約済み" value={stats ? String(stats.canceledCount) : "-"} />
          <StatCard
            icon={<Users size={18} />}
            label="事業者内訳(個人/法人)"
            value={stats ? `${stats.individualBusinessCount} / ${stats.corporateBusinessCount}` : "-"}
          />
          <StatCard icon={<TrendingUp size={18} />} label="過去30日の新規登録" value={String(newLast30Days)} />
        </div>

        <Card className="p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3">登録者数の推移(過去30日・累計)</div>
          {signupSeries.length === 0 ? (
            <div className="text-sm text-gray-400 py-8 text-center">データがありません</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={signupSeries} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="signupGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2f8a70" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2f8a70" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip
                  formatter={(value, name) => [String(value), name === "cumulative" ? "累計ユーザー数" : "新規登録"]}
                  labelFormatter={(label) => label}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Area type="monotone" dataKey="cumulative" stroke="#2f8a70" strokeWidth={2} fill="url(#signupGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className={`${inputClass} pl-9`}
              placeholder="メールアドレス・名前で検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className={`${selectClass} sm:w-48`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as SubscriptionStatus | "ALL")}>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "すべての契約状況" : STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-4">
              <TableSkeleton rows={6} />
            </div>
          ) : filteredUsers.length === 0 ? (
            <EmptyState title="該当するユーザーがいません" description="検索条件やフィルターを変更してください" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5">メールアドレス</th>
                    <th className="text-left font-medium px-4 py-2.5">名前</th>
                    <th className="text-left font-medium px-4 py-2.5">権限</th>
                    <th className="text-left font-medium px-4 py-2.5">登録日</th>
                    <th className="text-left font-medium px-4 py-2.5">事業者</th>
                    <th className="text-left font-medium px-4 py-2.5">契約状況</th>
                    <th className="text-left font-medium px-4 py-2.5">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-2.5 text-gray-900">{u.email}</td>
                      <td className="px-4 py-2.5 text-gray-500">{u.name ?? "-"}</td>
                      <td className="px-4 py-2.5">
                        <button
                          className="hover:opacity-70"
                          title={u.role === "ADMIN" ? "クリックで管理者権限を外す" : "クリックで管理者にする"}
                          onClick={() => handleRoleToggle(u)}
                        >
                          {u.role === "ADMIN" ? <Badge tone="blue">管理者</Badge> : <Badge tone="gray">一般</Badge>}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-2.5 text-gray-500">
                        {u.businesses.length === 0 ? (
                          "-"
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {u.businesses.map((b) => (
                              <span
                                key={b.id}
                                title={b.name}
                                className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 truncate max-w-[100px]"
                              >
                                {b.name}
                                <span className="text-gray-400">{b.type === "INDIVIDUAL" ? "(個)" : "(法)"}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={STATUS_TONES[u.subscription.status]}>{STATUS_LABELS[u.subscription.status]}</Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          className={`${selectClass} !py-1 !text-xs w-32`}
                          value={u.subscription.status}
                          onChange={(e) => handleStatusChange(u.id, e.target.value as SubscriptionStatus)}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 font-semibold text-sm text-gray-700 flex items-center gap-1.5">
            <Building2 size={15} className="text-gray-400" />
            全事業者({businesses.length})
          </div>
          {loading ? (
            <div className="p-4">
              <TableSkeleton rows={4} />
            </div>
          ) : businesses.length === 0 ? (
            <EmptyState title="事業者がまだありません" description="ユーザーが事業者を作成するとここに表示されます" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5">事業者名</th>
                    <th className="text-left font-medium px-4 py-2.5">オーナー</th>
                    <th className="text-left font-medium px-4 py-2.5">種別</th>
                    <th className="text-left font-medium px-4 py-2.5">メンバー数</th>
                    <th className="text-left font-medium px-4 py-2.5">仕訳数</th>
                    <th className="text-left font-medium px-4 py-2.5">作成日</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {businesses.map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-2.5 text-gray-900">{b.name}</td>
                      <td className="px-4 py-2.5 text-gray-500">{b.ownerEmail}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={b.type === "INDIVIDUAL" ? "gray" : "blue"}>{b.type === "INDIVIDUAL" ? "個人" : "法人"}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{b.memberCount}</td>
                      <td className="px-4 py-2.5 text-gray-500">{b.journalEntryCount}</td>
                      <td className="px-4 py-2.5 text-gray-500">{formatDate(b.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
