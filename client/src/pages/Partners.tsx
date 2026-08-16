import { useEffect, useState } from "react";
import { Plus, Users, Trash2 } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api, ApiError } from "../lib/api";
import type { Partner } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { TableSkeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { useConfirm } from "../components/ui/ConfirmDialog";
import { inputClass, selectClass, labelClass } from "../lib/formStyles";

const TYPE_LABELS: Record<Partner["type"], string> = { BOTH: "得意先・仕入先", CUSTOMER: "得意先", VENDOR: "仕入先" };

export default function Partners() {
  const { currentBusiness } = useBusiness();
  const toast = useToast();
  const confirm = useConfirm();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", kana: "", type: "BOTH" as Partner["type"], email: "", phone: "" });

  const load = () => {
    if (!currentBusiness) return;
    setLoading(true);
    api
      .listPartners(currentBusiness.id)
      .then(setPartners)
      .finally(() => setLoading(false));
  };

  useEffect(load, [currentBusiness]);

  if (!currentBusiness) return null;

  const handleCreate = async () => {
    if (!form.name) {
      toast.error("取引先名を入力してください");
      return;
    }
    try {
      await api.createPartner(currentBusiness.id, form);
      toast.success(`取引先「${form.name}」を追加しました`);
      setForm({ name: "", kana: "", type: "BOTH", email: "", phone: "" });
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "作成に失敗しました");
    }
  };

  const handleDelete = async (p: Partner) => {
    const ok = await confirm({ title: `「${p.name}」を削除しますか?`, danger: true, confirmLabel: "削除する" });
    if (!ok) return;
    try {
      await api.deletePartner(currentBusiness.id, p.id);
      toast.success("取引先を削除しました");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "削除に失敗しました(仕訳で使用中の可能性があります)");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="取引先"
        action={
          <Button icon={<Plus size={16} />} onClick={() => setShowForm((v) => !v)}>
            取引先を追加
          </Button>
        }
      />

      {showForm && (
        <Card className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className={labelClass}>取引先名</label>
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>フリガナ</label>
              <input className={inputClass} value={form.kana} onChange={(e) => setForm({ ...form, kana: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>区分</label>
              <select className={selectClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Partner["type"] })}>
                <option value="BOTH">得意先・仕入先</option>
                <option value="CUSTOMER">得意先</option>
                <option value="VENDOR">仕入先</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>メール</label>
              <input className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>電話番号</label>
              <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <Button onClick={handleCreate}>追加</Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={4} cols={3} />
        ) : partners.length === 0 ? (
          <EmptyState
            icon={<Users size={40} />}
            title="取引先がまだ登録されていません"
            action={
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowForm(true)}>
                取引先を追加
              </Button>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 text-xs">
              <tr>
                <th className="px-5 py-2.5 font-normal">名前</th>
                <th className="px-5 py-2.5 font-normal">区分</th>
                <th className="px-5 py-2.5 font-normal">連絡先</th>
                <th className="px-5 py-2.5 font-normal w-16"></th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50 group">
                  <td className="px-5 py-2.5 font-medium text-gray-800">{p.name}</td>
                  <td className="px-5 py-2.5">
                    <Badge>{TYPE_LABELS[p.type]}</Badge>
                  </td>
                  <td className="px-5 py-2.5 text-xs text-gray-500">{[p.email, p.phone].filter(Boolean).join(" / ")}</td>
                  <td className="px-5 py-2.5 text-right">
                    <button className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(p)}>
                      <Trash2 size={15} />
                    </button>
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
