import { Fragment, useEffect, useState } from "react";
import { Plus, Package, Trash2, ChevronDown, Send } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api, ApiError } from "../lib/api";
import { formatDate, formatYen, toInputDate } from "../lib/format";
import type { Account, DepreciationMethod, FiscalYear, FixedAsset } from "../lib/types";
import { AccountSelect } from "../components/AccountSelect";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { TableSkeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { useConfirm } from "../components/ui/ConfirmDialog";
import { inputClass, selectClass, labelClass } from "../lib/formStyles";

const METHOD_LABELS: Record<DepreciationMethod, string> = { STRAIGHT_LINE: "定額法", DECLINING_BALANCE: "定率法" };

function emptyForm() {
  return {
    name: "",
    assetAccountId: "",
    expenseAccountId: "",
    acquisitionDate: toInputDate(new Date()),
    acquisitionCost: "",
    usefulLifeYears: "4",
    depreciationMethod: "STRAIGHT_LINE" as DepreciationMethod,
    memo: "",
  };
}

export default function FixedAssets() {
  const { currentBusiness } = useBusiness();
  const toast = useToast();
  const confirm = useConfirm();
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<FixedAsset | null>(null);

  const load = () => {
    if (!currentBusiness) return;
    setLoading(true);
    Promise.all([api.listFixedAssets(currentBusiness.id), api.listAccounts(currentBusiness.id), api.listFiscalYears(currentBusiness.id)])
      .then(([a, accs, fys]) => {
        setAssets(a);
        setAccounts(accs);
        setFiscalYears(fys);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [currentBusiness]);

  if (!currentBusiness) return null;

  const currentFiscalYear = fiscalYears.find((fy) => new Date(fy.startDate) <= new Date() && new Date() <= new Date(fy.endDate));

  const handleCreate = async () => {
    if (!form.name || !form.assetAccountId || !form.expenseAccountId || !form.acquisitionCost) {
      toast.error("必須項目を入力してください");
      return;
    }
    try {
      await api.createFixedAsset(currentBusiness.id, {
        ...form,
        acquisitionCost: Number(form.acquisitionCost),
        usefulLifeYears: Number(form.usefulLifeYears),
      });
      toast.success(`「${form.name}」を登録しました`);
      setForm(emptyForm());
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "登録に失敗しました");
    }
  };

  const handleDelete = async (a: FixedAsset) => {
    const ok = await confirm({ title: `「${a.name}」を削除しますか?`, danger: true, confirmLabel: "削除する" });
    if (!ok) return;
    try {
      await api.deleteFixedAsset(currentBusiness.id, a.id);
      toast.success("固定資産を削除しました");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "削除に失敗しました");
    }
  };

  const toggleExpand = async (a: FixedAsset) => {
    if (expanded === a.id) {
      setExpanded(null);
      return;
    }
    setExpanded(a.id);
    const full = await api.getFixedAsset(currentBusiness.id, a.id);
    setDetail(full);
  };

  const handlePostDepreciation = async (assetId: string) => {
    if (!currentFiscalYear) {
      toast.error("会計期間が見つかりません");
      return;
    }
    try {
      await api.postDepreciation(currentBusiness.id, assetId, currentFiscalYear.id);
      toast.success("減価償却費を仕訳に計上しました");
      load();
      const full = await api.getFixedAsset(currentBusiness.id, assetId);
      setDetail(full);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "計上に失敗しました");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="固定資産台帳"
        subtitle="登録すると耐用年数に応じた減価償却費を自動計算します"
        action={
          <Button icon={<Plus size={16} />} onClick={() => setShowForm((v) => !v)}>
            固定資産を登録
          </Button>
        }
      />

      {showForm && (
        <Card className="p-4 space-y-3">
          <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
            固定資産の登録は減価償却費の計算・仕訳のためのものです。購入時の仕訳(現金/資産科目など)は別途「仕訳帳」から入力してください。
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>資産名</label>
              <input className={`${inputClass} w-full`} placeholder="例: 営業用軽自動車" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>取得日</label>
              <input type="date" className={`${inputClass} w-full`} value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>資産科目</label>
              <AccountSelect accounts={accounts.filter((a) => a.category === "ASSET")} value={form.assetAccountId} onChange={(v) => setForm({ ...form, assetAccountId: v })} className="w-full" />
            </div>
            <div>
              <label className={labelClass}>費用科目(通常は減価償却費)</label>
              <AccountSelect accounts={accounts.filter((a) => a.category === "EXPENSE")} value={form.expenseAccountId} onChange={(v) => setForm({ ...form, expenseAccountId: v })} className="w-full" />
            </div>
            <div>
              <label className={labelClass}>取得価額</label>
              <input type="number" className={`${inputClass} w-full`} value={form.acquisitionCost} onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>耐用年数</label>
              <input type="number" className={`${inputClass} w-full`} value={form.usefulLifeYears} onChange={(e) => setForm({ ...form, usefulLifeYears: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>償却方法</label>
              <select className={`${selectClass} w-full`} value={form.depreciationMethod} onChange={(e) => setForm({ ...form, depreciationMethod: e.target.value as DepreciationMethod })}>
                <option value="STRAIGHT_LINE">定額法</option>
                <option value="DECLINING_BALANCE">定率法(簡易計算)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>メモ</label>
              <input className={`${inputClass} w-full`} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
            </div>
          </div>
          <Button onClick={handleCreate}>登録</Button>
        </Card>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : assets.length === 0 ? (
          <EmptyState icon={<Package size={40} />} title="固定資産がまだ登録されていません" />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 text-xs">
              <tr>
                <th className="px-5 py-2.5 font-normal">資産名</th>
                <th className="px-5 py-2.5 font-normal">資産科目</th>
                <th className="px-5 py-2.5 font-normal">取得日</th>
                <th className="px-5 py-2.5 font-normal text-right">取得価額</th>
                <th className="px-5 py-2.5 font-normal">償却方法</th>
                <th className="px-5 py-2.5 font-normal text-right">現在の簿価</th>
                <th className="px-5 py-2.5 font-normal w-16"></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <Fragment key={a.id}>
                  <tr className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer group" onClick={() => toggleExpand(a)}>
                    <td className="px-5 py-2.5">
                      <span className="flex items-center gap-1.5 font-medium text-gray-800">
                        <ChevronDown size={13} className={`text-gray-300 transition-transform ${expanded === a.id ? "rotate-180" : ""}`} />
                        {a.name}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-xs text-gray-500">{a.assetAccount?.name}</td>
                    <td className="px-5 py-2.5 text-gray-500">{formatDate(a.acquisitionDate)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{formatYen(a.acquisitionCost)}</td>
                    <td className="px-5 py-2.5">
                      <Badge>{METHOD_LABELS[a.depreciationMethod]}</Badge>
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums font-medium">{formatYen(a.currentBookValue ?? 0)}</td>
                    <td className="px-5 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <button className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(a)}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                  {expanded === a.id && detail && detail.id === a.id && (
                    <tr className="bg-gray-50 border-t border-gray-100">
                      <td></td>
                      <td colSpan={6} className="px-5 py-4">
                        <div className="flex flex-wrap gap-6 text-xs text-gray-500 mb-3">
                          <div>
                            残存価額: <span className="text-gray-800 font-medium">{formatYen(detail.residualValue)}</span>
                          </div>
                          <div>
                            耐用年数: <span className="text-gray-800 font-medium">{detail.usefulLifeYears}年</span>
                          </div>
                          <div>
                            費用科目: <span className="text-gray-800 font-medium">{detail.expenseAccount?.name}</span>
                          </div>
                        </div>
                        {currentFiscalYear && (
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-xs text-gray-500">
                              当期({formatDate(currentFiscalYear.startDate)}〜{formatDate(currentFiscalYear.endDate)})分の予定額:{" "}
                              <span className="font-semibold text-gray-800">
                                {formatYen(
                                  (detail.schedule ?? [])
                                    .filter((m) => new Date(m.date) >= new Date(currentFiscalYear.startDate) && new Date(m.date) <= new Date(currentFiscalYear.endDate))
                                    .reduce((s, m) => s + m.depreciation, 0)
                                )}
                              </span>
                            </span>
                            <Button size="sm" icon={<Send size={13} />} onClick={() => handlePostDepreciation(a.id)}>
                              当期分を仕訳計上
                            </Button>
                          </div>
                        )}
                        {detail.depreciations && detail.depreciations.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-1">計上履歴</div>
                            <table className="text-xs w-full max-w-md">
                              <tbody>
                                {detail.depreciations.map((d) => (
                                  <tr key={d.id} className="border-t border-gray-200">
                                    <td className="py-1 text-gray-500">{formatDate(d.postedAt)}</td>
                                    <td className="py-1 text-right text-gray-800">{formatYen(d.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
