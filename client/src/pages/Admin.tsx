import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Users, TrendingUp, CircleCheck, Clock, LogOut, Wallet, Search, Download, AlertTriangle, XCircle, Building2, KeyRound, Copy, X, Check, ScrollText } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { formatDate, formatYen } from "../lib/format";
import type { AdminBusiness, AdminStats, AdminUser, AuditLog, SubscriptionStatus } from "../lib/types";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { TableSkeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { inputClass, selectClass } from "../lib/formStyles";
import { useToast } from "../components/ui/Toast";
import { useConfirm } from "../components/ui/ConfirmDialog";

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

const AUDIT_LABELS: Record<string, { label: string; tone: "gray" | "green" | "yellow" | "red" | "blue" }> = {
  LOGIN_SUCCESS: { label: "ログイン成功", tone: "green" },
  LOGIN_FAILED: { label: "ログイン失敗", tone: "red" },
  SIGNUP: { label: "新規登録", tone: "blue" },
  PASSWORD_RESET: { label: "パスワード再設定", tone: "yellow" },
  ROLE_CHANGE: { label: "権限変更", tone: "blue" },
  SUBSCRIPTION_CHANGE: { label: "契約変更", tone: "gray" },
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

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
  const confirm = useConfirm();
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | "ALL">("ALL");
  const [resetResult, setResetResult] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.adminListUsers(), api.adminGetStats(), api.adminListBusinesses(), api.adminListAuditLogs(100)])
      .then(([u, s, b, logs]) => {
        setUsers(u);
        setStats(s);
        setBusinesses(b);
        setAuditLogs(logs);
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

  const handleResetPassword = async (target: AdminUser) => {
    const ok = await confirm({
      title: "パスワードを再設定しますか?",
      description: `${target.email} の新しい一時パスワードを発行します。本人に安全な方法で伝え、ログイン後に変更してもらってください。`,
      confirmLabel: "一時パスワードを発行",
    });
    if (!ok) return;
    try {
      const res = await api.adminResetPassword(target.id);
      setResetResult({ email: res.email, password: res.password });
      setCopied(false);
      toast.success("パスワードを再設定しました");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "再設定に失敗しました");
    }
  };

  const copyPassword = async () => {
    if (!resetResult) return;
    try {
      await navigator.clipboard.writeText(resetResult.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("コピーできませんでした");
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
                        <div className="flex items-center gap-2">
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
                          <button
                            className="text-gray-400 hover:text-brand-600 shrink-0"
                            title="パスワードを再設定(一時パスワード発行)"
                            onClick={() => handleResetPassword(u)}
                          >
                            <KeyRound size={15} />
                          </button>
                        </div>
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
        <Card className="overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 font-semibold text-sm text-gray-700 flex items-center gap-1.5">
            <ScrollText size={15} className="text-gray-400" />
            操作ログ・ログイン履歴(直近100件)
          </div>
          {loading ? (
            <div className="p-4">
              <TableSkeleton rows={5} />
            </div>
          ) : auditLogs.length === 0 ? (
            <EmptyState title="ログがまだありません" description="ログインや管理操作が記録されるとここに表示されます" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5 whitespace-nowrap">日時</th>
                    <th className="text-left font-medium px-4 py-2.5">操作</th>
                    <th className="text-left font-medium px-4 py-2.5">対象ユーザー</th>
                    <th className="text-left font-medium px-4 py-2.5">詳細</th>
                    <th className="text-left font-medium px-4 py-2.5">IPアドレス</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditLogs.map((log) => {
                    const meta = AUDIT_LABELS[log.action] ?? { label: log.action, tone: "gray" as const };
                    return (
                      <tr key={log.id}>
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                        <td className="px-4 py-2.5">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">{log.userEmail ?? "-"}</td>
                        <td className="px-4 py-2.5 text-gray-500">{log.detail ?? "-"}</td>
                        <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{log.ipAddress ?? "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {resetResult && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/30 px-4" onClick={() => setResetResult(null)}>
          <div className="bg-white rounded-xl shadow-lg border w-full max-w-md p-5 animate-[modal-in_0.12s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <KeyRound size={18} className="text-brand-600" /> 一時パスワードを発行しました
              </h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setResetResult(null)}>
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              <span className="font-medium">{resetResult.email}</span> の新しいパスワードです。
              この画面を閉じると再表示できません。安全な方法で本人に伝えてください。
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-base font-mono tracking-wide text-gray-900 select-all">
                {resetResult.password}
              </code>
              <Button variant="secondary" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={copyPassword}>
                {copied ? "コピー済" : "コピー"}
              </Button>
            </div>
            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              セキュリティのため、ログイン後に本人がパスワードを変更することを推奨してください。
            </div>
            <div className="flex justify-end mt-5">
              <Button onClick={() => setResetResult(null)}>閉じる</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
