import { useEffect, useState } from "react";
import { Plus, ListTree } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api, ApiError } from "../lib/api";
import type { Account, AccountCategory } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { TableSkeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { inputClass, selectClass, labelClass } from "../lib/formStyles";

const CATEGORY_LABELS: Record<AccountCategory, string> = {
  ASSET: "資産",
  LIABILITY: "負債",
  EQUITY: "純資産",
  REVENUE: "収益",
  EXPENSE: "費用",
};

const CATEGORY_ORDER: AccountCategory[] = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

export default function Accounts() {
  const { currentBusiness } = useBusiness();
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", category: "EXPENSE" as AccountCategory, subcategory: "" });

  const load = () => {
    if (!currentBusiness) return;
    setLoading(true);
    api
      .listAccounts(currentBusiness.id, true)
      .then(setAccounts)
      .finally(() => setLoading(false));
  };

  useEffect(load, [currentBusiness]);

  if (!currentBusiness) return null;

  const grouped = CATEGORY_ORDER.map((cat) => ({ category: cat, accounts: accounts.filter((a) => a.category === cat) }));

  const handleCreate = async () => {
    if (!form.code || !form.name || !form.subcategory) {
      toast.error("コード・科目名・グループを入力してください");
      return;
    }
    try {
      await api.createAccount(currentBusiness.id, form);
      toast.success(`科目「${form.name}」を追加しました`);
      setForm({ code: "", name: "", category: "EXPENSE", subcategory: "" });
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "作成に失敗しました");
    }
  };

  const toggleActive = async (a: Account) => {
    await api.updateAccount(currentBusiness.id, a.id, { isActive: !a.isActive });
    toast.success(a.isActive ? `「${a.name}」を無効化しました` : `「${a.name}」を有効化しました`);
    load();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="勘定科目"
        subtitle="freee標準の勘定科目に加え、独自の科目を追加できます"
        action={
          <Button icon={<Plus size={16} />} onClick={() => setShowForm((v) => !v)}>
            科目を追加
          </Button>
        }
      />

      {showForm && (
        <Card className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className={labelClass}>コード</label>
              <input className={`${inputClass} w-24`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>科目名</label>
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>区分</label>
              <select className={selectClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as AccountCategory })}>
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>グループ(表示用)</label>
              <input
                className={inputClass}
                placeholder="例: 販売費及び一般管理費"
                value={form.subcategory}
                onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
              />
            </div>
            <Button onClick={handleCreate}>追加</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <Card>
          <TableSkeleton rows={8} cols={4} />
        </Card>
      ) : accounts.length === 0 ? (
        <Card>
          <EmptyState icon={<ListTree size={40} />} title="勘定科目がありません" />
        </Card>
      ) : (
        grouped.map(
          ({ category, accounts: accs }) =>
            accs.length > 0 && (
              <Card key={category} className="overflow-hidden">
                <CardHeader title={CATEGORY_LABELS[category]} subtitle={`${accs.length}科目`} />
                <table className="w-full text-sm">
                  <tbody>
                    {accs.map((a) => (
                      <tr key={a.id} className={`border-t border-gray-100 ${a.isActive ? "" : "opacity-40"}`}>
                        <td className="px-5 py-2 w-20 text-gray-400 tabular-nums">{a.code}</td>
                        <td className="px-5 py-2 font-medium text-gray-800">{a.name}</td>
                        <td className="px-5 py-2 text-xs text-gray-500">{a.subcategory}</td>
                        <td className="px-5 py-2">
                          <Badge tone={a.isDefault ? "gray" : "blue"}>{a.isDefault ? "標準科目" : "追加科目"}</Badge>
                        </td>
                        <td className="px-5 py-2 text-right">
                          <button className="text-xs text-brand-600 hover:underline" onClick={() => toggleActive(a)}>
                            {a.isActive ? "無効化" : "有効化"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )
        )
      )}
    </div>
  );
}
