import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, Package, Sparkles } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api, ApiError } from "../lib/api";
import { formatYen } from "../lib/format";
import type { YearEndClosing as YearEndClosingData } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { useConfirm } from "../components/ui/ConfirmDialog";

const STATUS_ICON = {
  done: <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />,
  pending: <AlertCircle size={18} className="text-amber-500 shrink-0" />,
  info: <Info size={18} className="text-sky-500 shrink-0" />,
};

export default function YearEndClosing() {
  const { currentBusiness } = useBusiness();
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<YearEndClosingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const load = () => {
    if (!currentBusiness) return;
    setLoading(true);
    api
      .getYearEndClosing(currentBusiness.id)
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(load, [currentBusiness]);

  if (!currentBusiness) return null;
  if (loading || !data) {
    return (
      <div className="space-y-5 max-w-4xl">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  const handlePostAll = async () => {
    const ok = await confirm({
      title: "減価償却費を一括計上しますか?",
      description: `未計上の固定資産 ${data.depreciation.pendingCount} 件に、当期の減価償却費(計 ${formatYen(
        data.depreciation.pendingTotal
      )})を仕訳計上します。`,
      confirmLabel: "一括計上する",
    });
    if (!ok) return;
    setPosting(true);
    try {
      const res = await api.postAllDepreciation(currentBusiness.id);
      if (res.posted > 0) toast.success(`${res.posted}件の減価償却費(計 ${formatYen(res.totalAmount)})を計上しました`);
      if (res.errors.length > 0) toast.error(`${res.errors.length}件は計上できませんでした`);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "一括計上に失敗しました");
    } finally {
      setPosting(false);
    }
  };

  const fy = data.fiscalYear;

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader title="決算処理" subtitle={`対象期間: ${fy.startDate.slice(0, 10)} 〜 ${fy.endDate.slice(0, 10)}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-gray-500">当期売上高</div>
          <div className="text-lg font-bold text-gray-900 mt-1 tabular-nums">{formatYen(data.summary.sales)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-500">当期純利益(見込み)</div>
          <div className={`text-lg font-bold mt-1 tabular-nums ${data.summary.netIncome < 0 ? "text-red-600" : "text-gray-900"}`}>
            {formatYen(data.summary.netIncome)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-500">総資産</div>
          <div className="text-lg font-bold text-gray-900 mt-1 tabular-nums">{formatYen(data.summary.totalAssets)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-500">貸借一致</div>
          <div className="mt-1.5">
            {data.summary.balanced ? <Badge tone="green">一致</Badge> : <Badge tone="red">不一致</Badge>}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="決算整理チェックリスト" subtitle="期末に確認すべき項目" />
        <div className="divide-y divide-gray-100">
          {data.checklist.map((item) => (
            <div key={item.key} className="flex items-start gap-3 px-5 py-3">
              {STATUS_ICON[item.status]}
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800">{item.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="固定資産の減価償却"
          subtitle="当期分の減価償却費の計上状況"
          action={
            data.depreciation.pendingCount > 0 ? (
              <Button size="sm" icon={<Sparkles size={14} />} loading={posting} onClick={handlePostAll}>
                未計上を一括計上
              </Button>
            ) : undefined
          }
        />
        {data.depreciation.assets.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
            <Package size={28} className="text-gray-300" />
            対象の固定資産がありません
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 text-xs">
              <tr>
                <th className="px-5 py-2 font-normal">資産名</th>
                <th className="px-5 py-2 font-normal text-right">当期償却予定額</th>
                <th className="px-5 py-2 font-normal text-right w-28">状態</th>
              </tr>
            </thead>
            <tbody>
              {data.depreciation.assets.map((a) => (
                <tr key={a.id} className="border-t border-gray-100">
                  <td className="px-5 py-2.5 text-gray-700">{a.name}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-gray-700">
                    {formatYen(a.posted ? a.postedAmount : a.scheduledAmount)}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {a.posted ? (
                      <Badge tone="green">計上済み</Badge>
                    ) : a.scheduledAmount > 0 ? (
                      <Badge tone="yellow">未計上</Badge>
                    ) : (
                      <Badge tone="gray">対象外</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <p className="text-xs text-gray-400">
        ※ 本アプリは当期純利益を仕訳から自動算出するため、損益振替(決算振替仕訳)は不要です。
        減価償却や各種引当など、仕訳が必要な決算整理のみを上記で管理します。
      </p>
    </div>
  );
}
