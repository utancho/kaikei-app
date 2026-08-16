import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api } from "../lib/api";
import { formatYen } from "../lib/format";
import type { PartnerBalancesResponse } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";

function BalanceTable({ rows, label }: { rows: { partnerId: string; partnerName: string; balance: number }[]; label: string }) {
  if (rows.length === 0) {
    return <EmptyState title={`${label}はありません`} />;
  }
  const total = rows.reduce((s, r) => s + r.balance, 0);
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.partnerId} className="border-t border-gray-100">
            <td className="px-5 py-2">{r.partnerName}</td>
            <td className="px-5 py-2 text-right tabular-nums font-medium">{formatYen(r.balance)}</td>
          </tr>
        ))}
        <tr className="border-t-2 border-gray-200 font-bold">
          <td className="px-5 py-2.5">合計</td>
          <td className="px-5 py-2.5 text-right tabular-nums">{formatYen(total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

export default function PartnerBalances() {
  const { currentBusiness } = useBusiness();
  const [data, setData] = useState<PartnerBalancesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentBusiness) return;
    setLoading(true);
    api
      .getPartnerBalances(currentBusiness.id)
      .then(setData)
      .finally(() => setLoading(false));
  }, [currentBusiness]);

  if (!currentBusiness) return null;
  if (loading || !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="取引先別残高" subtitle="現時点で未回収の売掛金・未払いの買掛金を取引先ごとに集計します" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="overflow-hidden">
          <CardHeader title="売掛金(未回収)" subtitle={`合計 ${formatYen(data.totalReceivables)}`} />
          {data.receivables.length === 0 ? (
            <EmptyState icon={<Users size={36} />} title="未回収の売掛金はありません" />
          ) : (
            <BalanceTable rows={data.receivables} label="売掛金" />
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="買掛金(未払い)" subtitle={`合計 ${formatYen(data.totalPayables)}`} />
          {data.payables.length === 0 ? (
            <EmptyState icon={<Users size={36} />} title="未払いの買掛金はありません" />
          ) : (
            <BalanceTable rows={data.payables} label="買掛金" />
          )}
        </Card>
      </div>
    </div>
  );
}
