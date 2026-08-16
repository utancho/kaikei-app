import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Repeat, Trash2, X, PlayCircle } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api, ApiError } from "../lib/api";
import { formatYen } from "../lib/format";
import type { Account, EntrySide, JournalEntryTemplate, Partner } from "../lib/types";
import { AccountSelect } from "../components/AccountSelect";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { TableSkeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { useConfirm } from "../components/ui/ConfirmDialog";
import { inputClass, labelClass } from "../lib/formStyles";

interface LineDraft {
  side: EntrySide;
  accountId: string;
  partnerId: string;
  amountDefault: string;
}

function emptyLine(side: EntrySide): LineDraft {
  return { side, accountId: "", partnerId: "", amountDefault: "" };
}

export default function JournalEntryTemplates() {
  const { currentBusiness } = useBusiness();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<JournalEntryTemplate[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine("DEBIT"), emptyLine("CREDIT")]);

  const load = () => {
    if (!currentBusiness) return;
    setLoading(true);
    Promise.all([api.listTemplates(currentBusiness.id), api.listAccounts(currentBusiness.id), api.listPartners(currentBusiness.id)])
      .then(([t, a, p]) => {
        setTemplates(t);
        setAccounts(a);
        setPartners(p);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [currentBusiness]);

  if (!currentBusiness) return null;

  const updateLine = (i: number, patch: Partial<LineDraft>) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = (side: EntrySide) => setLines((prev) => [...prev, emptyLine(side)]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const resetForm = () => {
    setName("");
    setDescription("");
    setLines([emptyLine("DEBIT"), emptyLine("CREDIT")]);
  };

  const handleCreate = async () => {
    if (!name) {
      toast.error("テンプレート名を入力してください");
      return;
    }
    const payloadLines = lines
      .filter((l) => l.accountId)
      .map((l) => ({
        side: l.side,
        accountId: l.accountId,
        partnerId: l.partnerId || undefined,
        amountDefault: l.amountDefault ? Number(l.amountDefault) : undefined,
      }));
    if (payloadLines.length < 2) {
      toast.error("借方・貸方それぞれ1行以上入力してください");
      return;
    }
    try {
      await api.createTemplate(currentBusiness.id, { name, description: description || undefined, lines: payloadLines });
      toast.success(`テンプレート「${name}」を作成しました`);
      resetForm();
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "作成に失敗しました");
    }
  };

  const handleDelete = async (t: JournalEntryTemplate) => {
    const ok = await confirm({ title: `テンプレート「${t.name}」を削除しますか?`, danger: true, confirmLabel: "削除する" });
    if (!ok) return;
    try {
      await api.deleteTemplate(currentBusiness.id, t.id);
      toast.success("テンプレートを削除しました");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "削除に失敗しました");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="仕訳テンプレート"
        subtitle="毎月発生する家賃や光熱費など、よく使う仕訳をテンプレート化できます"
        action={
          <Button icon={<Plus size={16} />} onClick={() => setShowForm((v) => !v)}>
            テンプレートを追加
          </Button>
        }
      />

      {showForm && (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>テンプレート名</label>
              <input className={`${inputClass} w-full`} placeholder="例: 家賃支払い" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>摘要の初期値(任意)</label>
              <input className={`${inputClass} w-full`} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-4 flex-col sm:flex-row">
            {(["DEBIT", "CREDIT"] as const).map((side) => (
              <div key={side} className="flex-1 min-w-0">
                <h3 className="text-xs font-semibold text-gray-500 mb-2">{side === "DEBIT" ? "借方" : "貸方"}</h3>
                <div className="space-y-2">
                  {lines.map((l, i) =>
                    l.side === side ? (
                      <div key={i} className="border border-gray-200 rounded-lg p-2.5 space-y-2 relative">
                        {lines.filter((x) => x.side === side).length > 1 && (
                          <button className="absolute top-2 right-2 text-gray-300 hover:text-red-500" onClick={() => removeLine(i)}>
                            <X size={13} />
                          </button>
                        )}
                        <AccountSelect accounts={accounts} value={l.accountId} onChange={(v) => updateLine(i, { accountId: v })} className="w-full" />
                        <div className="grid grid-cols-2 gap-2">
                          <select className={`${inputClass} bg-white`} value={l.partnerId} onChange={(e) => updateLine(i, { partnerId: e.target.value })}>
                            <option value="">取引先(任意)</option>
                            {partners.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            placeholder="初期金額(任意)"
                            className={`${inputClass} text-right`}
                            value={l.amountDefault}
                            onChange={(e) => updateLine(i, { amountDefault: e.target.value })}
                          />
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
                <button className="mt-2 text-xs text-brand-600 hover:underline" onClick={() => addLine(side)}>
                  + {side === "DEBIT" ? "借方" : "貸方"}行を追加
                </button>
              </div>
            ))}
          </div>

          <Button onClick={handleCreate}>作成</Button>
        </Card>
      )}

      {loading ? (
        <Card>
          <TableSkeleton rows={3} cols={3} />
        </Card>
      ) : templates.length === 0 ? (
        <Card>
          <EmptyState icon={<Repeat size={40} />} title="テンプレートがまだありません" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {templates.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-semibold text-gray-800">{t.name}</div>
                  {t.description && <div className="text-xs text-gray-400">{t.description}</div>}
                </div>
                <button className="text-gray-300 hover:text-red-500" onClick={() => handleDelete(t)}>
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="text-xs text-gray-500 space-y-0.5 mb-3">
                {t.lines.map((l, i) => (
                  <div key={i} className="flex justify-between">
                    <span>
                      {l.side === "DEBIT" ? "借" : "貸"}: {l.account?.name}
                    </span>
                    <span>{l.amountDefault ? formatYen(l.amountDefault) : "―"}</span>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="secondary" icon={<PlayCircle size={13} />} onClick={() => navigate(`/journal-entries/new?templateId=${t.id}`)}>
                この内容で仕訳を作成
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
