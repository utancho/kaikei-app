import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, TrendingUp, CircleCheck, Clock, LogOut, Wallet } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { formatDate, formatYen } from "../lib/format";
import type { AdminStats, AdminUser, SubscriptionStatus } from "../lib/types";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { TableSkeleton } from "../components/ui/Skeleton";
import { selectClass } from "../lib/formStyles";
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-brand-50 text-brand-600">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-xl font-bold mt-0.5 truncate text-gray-900">{value}</div>
      </div>
    </Card>
  );
}

export default function Admin() {
  const toast = useToast();
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([api.adminListUsers(), api.adminGetStats()])
      .then(([u, s]) => {
        setUsers(u);
        setStats(s);
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
        <PageHeader title="管理者ダッシュボード" subtitle="全ユーザーの登録状況と契約状況を確認できます" />

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

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={6} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">メールアドレス</th>
                  <th className="text-left font-medium px-4 py-2.5">名前</th>
                  <th className="text-left font-medium px-4 py-2.5">権限</th>
                  <th className="text-left font-medium px-4 py-2.5">登録日</th>
                  <th className="text-left font-medium px-4 py-2.5">事業者数</th>
                  <th className="text-left font-medium px-4 py-2.5">契約状況</th>
                  <th className="text-left font-medium px-4 py-2.5">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2.5 text-gray-900">{u.email}</td>
                    <td className="px-4 py-2.5 text-gray-500">{u.name ?? "-"}</td>
                    <td className="px-4 py-2.5">
                      {u.role === "ADMIN" ? <Badge tone="blue">管理者</Badge> : <Badge tone="gray">一般</Badge>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-2.5 text-gray-500">{u.businessCount}</td>
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
      </div>
    </div>
  );
}
