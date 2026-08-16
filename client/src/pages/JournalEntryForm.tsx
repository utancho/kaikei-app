import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Plus, Trash2, AlertCircle, Home } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api, ApiError } from "../lib/api";
import { toInputDate } from "../lib/format";
import type { Account, EntrySide, Partner } from "../lib/types";
import { AccountSelect } from "../components/AccountSelect";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useToast } from "../components/ui/Toast";
import { inputClass } from "../lib/formStyles";

interface LineDraft {
  side: EntrySide;
  accountId: string;
  partnerId: string;
  amount: string;
  description: string;
  privateUseEnabled: boolean;
  businessRatio: string; // 事業按分率(%)
}

function emptyLine(side: EntrySide): LineDraft {
  return { side, accountId: "", partnerId: "", amount: "", description: "", privateUseEnabled: false, businessRatio: "80" };
}

const PRIVATE_DRAWING_ACCOUNT_CODE = "3030"; // 事業主貸

export default function JournalEntryForm() {
  const { currentBusiness } = useBusiness();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("templateId");
  const duplicateId = searchParams.get("duplicateId");
  const receiptDate = searchParams.get("receiptDate");
  const receiptDescription = searchParams.get("receiptDescription");
  const receiptAmount = searchParams.get("receiptAmount");
  const receiptAccountId = searchParams.get("receiptAccountId");
  const isEdit = Boolean(id) && id !== "new";
  const navigate = useNavigate();
  const toast = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [entryDate, setEntryDate] = useState(toInputDate(new Date()));
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine("DEBIT"), emptyLine("CREDIT")]);
  const [saving, setSaving] = useState(false);

  const isIndividual = currentBusiness?.type === "INDIVIDUAL";
  const privateDrawingAccount = accounts.find((a) => a.code === PRIVATE_DRAWING_ACCOUNT_CODE);

  useEffect(() => {
    if (!currentBusiness) return;
    api.listAccounts(currentBusiness.id).then(setAccounts);
    api.listPartners(currentBusiness.id).then(setPartners);
  }, [currentBusiness]);

  useEffect(() => {
    if (!currentBusiness || !isEdit || !id) return;
    api.getJournalEntry(currentBusiness.id, id).then((entry) => {
      setEntryDate(toInputDate(entry.entryDate));
      setDescription(entry.description ?? "");
      setLines(
        entry.lines.map((l) => ({
          side: l.side,
          accountId: l.accountId,
          partnerId: l.partnerId ?? "",
          amount: String(l.amount),
          description: l.description ?? "",
          privateUseEnabled: false,
          businessRatio: "80",
        }))
      );
    });
  }, [currentBusiness, isEdit, id]);

  useEffect(() => {
    if (!currentBusiness || isEdit || !duplicateId) return;
    api.getJournalEntry(currentBusiness.id, duplicateId).then((entry) => {
      setDescription(entry.description ?? "");
      setLines(
        entry.lines.map((l) => ({
          side: l.side,
          accountId: l.accountId,
          partnerId: l.partnerId ?? "",
          amount: String(l.amount),
          description: l.description ?? "",
          privateUseEnabled: false,
          businessRatio: "80",
        }))
      );
    });
  }, [currentBusiness, isEdit, duplicateId]);

  useEffect(() => {
    if (!currentBusiness || isEdit || !templateId) return;
    api.listTemplates(currentBusiness.id).then((templates) => {
      const t = templates.find((tpl) => tpl.id === templateId);
      if (!t) return;
      setDescription(t.description ?? "");
      setLines(
        t.lines.map((l) => ({
          side: l.side,
          accountId: l.accountId,
          partnerId: l.partnerId ?? "",
          amount: l.amountDefault ? String(l.amountDefault) : "",
          description: "",
          privateUseEnabled: false,
          businessRatio: "80",
        }))
      );
    });
  }, [currentBusiness, isEdit, templateId]);

  useEffect(() => {
    if (isEdit || duplicateId || templateId || !receiptAmount) return;
    if (receiptDate) setEntryDate(receiptDate);
    if (receiptDescription) setDescription(receiptDescription);
    setLines([
      { ...emptyLine("DEBIT"), accountId: receiptAccountId ?? "", amount: receiptAmount },
      { ...emptyLine("CREDIT"), amount: receiptAmount },
    ]);
  }, [isEdit, duplicateId, templateId, receiptDate, receiptDescription, receiptAmount, receiptAccountId]);

  if (!currentBusiness) return null;

  const debitTotal = lines.filter((l) => l.side === "DEBIT").reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const creditTotal = lines.filter((l) => l.side === "CREDIT").reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const diff = debitTotal - creditTotal;
  const isBalanced = diff === 0 && debitTotal > 0;

  const updateLine = (index: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const addLine = (side: EntrySide) => setLines((prev) => [...prev, emptyLine(side)]);
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (lines.some((l) => l.privateUseEnabled && !privateDrawingAccount)) {
      toast.error("家事按分を利用するには「事業主貸」科目が必要です");
      return;
    }

    interface PayloadLine {
      side: EntrySide;
      accountId: string;
      partnerId?: string;
      amount: number;
      description?: string;
    }

    const payloadLines: PayloadLine[] = lines
      .filter((l) => l.accountId && Number(l.amount) > 0)
      .flatMap((l): PayloadLine[] => {
        const amount = Number(l.amount);
        const ratio = Number(l.businessRatio);
        if (l.privateUseEnabled && privateDrawingAccount && ratio > 0 && ratio < 100) {
          const businessAmount = Math.round((amount * ratio) / 100);
          const privateAmount = amount - businessAmount;
          return [
            {
              side: l.side,
              accountId: l.accountId,
              partnerId: l.partnerId || undefined,
              amount: businessAmount,
              description: l.description || `${description || ""}(事業按分${ratio}%)`.trim(),
            },
            {
              side: l.side,
              accountId: privateDrawingAccount.id,
              amount: privateAmount,
              description: `家事按分(${100 - ratio}%)`,
            },
          ];
        }
        return [
          {
            side: l.side,
            accountId: l.accountId,
            partnerId: l.partnerId || undefined,
            amount,
            description: l.description || undefined,
          },
        ];
      });

    if (payloadLines.length < 2) {
      toast.error("借方・貸方それぞれ1行以上入力してください");
      return;
    }

    setSaving(true);
    try {
      const payload = { entryDate, description: description || undefined, lines: payloadLines };
      if (isEdit && id) {
        await api.updateJournalEntry(currentBusiness.id, id, payload);
        toast.success("仕訳を更新しました");
      } else {
        await api.createJournalEntry(currentBusiness.id, payload);
        toast.success("仕訳を保存しました");
      }
      navigate("/journal-entries");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const renderSide = (side: EntrySide) => {
    const sideLines = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.side === side);
    const total = side === "DEBIT" ? debitTotal : creditTotal;
    const accent = side === "DEBIT" ? "border-l-4 border-l-brand-500" : "border-l-4 border-l-sky-500";

    return (
      <Card className={`flex-1 min-w-0 ${accent}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">{side === "DEBIT" ? "借方" : "貸方"}</h3>
          <span className="text-sm font-semibold tabular-nums">{total.toLocaleString()}円</span>
        </div>
        <div className="p-4 space-y-2">
          {sideLines.map(({ l, i }) => {
            const account = accounts.find((a) => a.id === l.accountId);
            const canUsePrivateAllocation = isIndividual && side === "DEBIT" && account?.category === "EXPENSE";
            const businessAmount = l.privateUseEnabled && l.amount ? Math.round((Number(l.amount) * Number(l.businessRatio)) / 100) : null;

            return (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 relative">
                {sideLines.length > 1 && (
                  <button className="absolute top-2 right-2 text-gray-300 hover:text-red-500" onClick={() => removeLine(i)}>
                    <Trash2 size={14} />
                  </button>
                )}
                <AccountSelect accounts={accounts} value={l.accountId} onChange={(v) => updateLine(i, { accountId: v })} className="w-full" />
                <input
                  type="number"
                  placeholder="金額"
                  className={`${inputClass} w-full text-right tabular-nums`}
                  value={l.amount}
                  onChange={(e) => updateLine(i, { amount: e.target.value })}
                />
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
                    placeholder="摘要(任意)"
                    className={inputClass}
                    value={l.description}
                    onChange={(e) => updateLine(i, { description: e.target.value })}
                  />
                </div>
                {canUsePrivateAllocation && (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                    <label className="flex items-center gap-1.5 text-xs text-amber-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={l.privateUseEnabled}
                        onChange={(e) => updateLine(i, { privateUseEnabled: e.target.checked })}
                      />
                      <Home size={12} /> 家事按分を適用(プライベート利用分を除く)
                    </label>
                    {l.privateUseEnabled && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-amber-700">事業按分</span>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          className={`${inputClass} w-16 text-right py-1`}
                          value={l.businessRatio}
                          onChange={(e) => updateLine(i, { businessRatio: e.target.value })}
                        />
                        <span className="text-xs text-amber-700">%</span>
                        {businessAmount !== null && (
                          <span className="text-xs text-amber-600 ml-auto">
                            経費 {businessAmount.toLocaleString()}円 / 事業主貸 {(Number(l.amount) - businessAmount).toLocaleString()}円
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <button className="w-full text-sm text-brand-600 hover:bg-brand-50 rounded-lg py-2 flex items-center justify-center gap-1 border border-dashed border-brand-200" onClick={() => addLine(side)}>
            <Plus size={14} /> {side === "DEBIT" ? "借方" : "貸方"}行を追加
          </button>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-2">
        <button className="text-gray-400 hover:text-gray-600" onClick={() => navigate("/journal-entries")}>
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{isEdit ? "仕訳の編集" : "仕訳を入力"}</h1>
      </div>

      <Card className="p-4 flex flex-wrap gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">取引日</label>
          <input type="date" className={inputClass} value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
        </div>
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">摘要(全体)</label>
          <input className={`${inputClass} w-full`} placeholder="例: 8月分家賃の支払い" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </Card>

      <div className="flex gap-4 flex-col sm:flex-row">
        {renderSide("DEBIT")}
        {renderSide("CREDIT")}
      </div>

      <Card className="p-4 flex items-center justify-between sticky bottom-4 shadow-md">
        <div className={`text-sm font-medium flex items-center gap-1.5 ${isBalanced ? "text-brand-700" : "text-amber-600"}`}>
          {isBalanced ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {isBalanced ? "貸借が一致しています" : diff !== 0 ? `差額: ${Math.abs(diff).toLocaleString()}円` : "金額を入力してください"}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate("/journal-entries")}>
            キャンセル
          </Button>
          <Button loading={saving} disabled={!isBalanced} onClick={handleSubmit}>
            保存
          </Button>
        </div>
      </Card>
    </div>
  );
}
