import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, X, Printer } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api, ApiError } from "../lib/api";
import { toInputDate } from "../lib/format";
import type { Partner, TaxCategory } from "../lib/types";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useToast } from "../components/ui/Toast";
import { inputClass, selectClass, labelClass } from "../lib/formStyles";

interface ItemDraft {
  description: string;
  quantity: string;
  unitPrice: string;
  taxCategoryId: string;
}

function emptyItem(): ItemDraft {
  return { description: "", quantity: "1", unitPrice: "", taxCategoryId: "" };
}

export default function InvoiceForm() {
  const { currentBusiness } = useBusiness();
  const { id } = useParams();
  const isEdit = Boolean(id) && id !== "new";
  const navigate = useNavigate();
  const toast = useToast();

  const [partners, setPartners] = useState<Partner[]>([]);
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [partnerId, setPartnerId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(toInputDate(new Date()));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentBusiness) return;
    api.listPartners(currentBusiness.id).then(setPartners);
    api.listTaxCategories().then((cats) => setTaxCategories(cats.filter((c) => c.kind === "TAXABLE_SALES")));
  }, [currentBusiness]);

  useEffect(() => {
    if (!currentBusiness || !isEdit || !id) return;
    api.getInvoice(currentBusiness.id, id).then((inv) => {
      if (inv.status !== 'DRAFT') {
        navigate(`/invoices/${id}/print`, { replace: true });
        return;
      }
      setPartnerId(inv.partnerId);
      setInvoiceNumber(inv.invoiceNumber);
      setIssueDate(toInputDate(inv.issueDate));
      setDueDate(inv.dueDate ? toInputDate(inv.dueDate) : "");
      setNotes(inv.notes ?? "");
      setItems(
        inv.items.map((it) => ({
          description: it.description,
          quantity: String(it.quantity),
          unitPrice: String(it.unitPrice),
          taxCategoryId: it.taxCategoryId ?? "",
        }))
      );
    });
  }, [currentBusiness, isEdit, id]);

  useEffect(() => {
    if (!isEdit && !invoiceNumber) {
      setInvoiceNumber(`INV-${toInputDate(new Date()).replace(/-/g, "")}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!currentBusiness) return null;

  const updateItem = (i: number, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const rateById = new Map(taxCategories.map((t) => [t.id, t.rate]));
  const computedItems = items.map((it) => ({
    ...it,
    amount: (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
  }));
  const subtotal = computedItems.reduce((s, it) => s + it.amount, 0);
  const groupByRate = new Map<number, number>();
  for (const it of computedItems) {
    const rate = it.taxCategoryId ? (rateById.get(it.taxCategoryId) ?? 0) : 0;
    groupByRate.set(rate, (groupByRate.get(rate) ?? 0) + it.amount);
  }
  let taxAmount = 0;
  for (const [rate, sub] of groupByRate) taxAmount += Math.round(sub * rate);
  const total = subtotal + taxAmount;

  const handleSubmit = async () => {
    if (!partnerId) {
      toast.error("取引先を選択してください");
      return;
    }
    const payloadItems = items
      .filter((it) => it.description && Number(it.unitPrice))
      .map((it) => ({
        description: it.description,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice),
        taxCategoryId: it.taxCategoryId || undefined,
      }));
    if (payloadItems.length === 0) {
      toast.error("明細を1件以上入力してください");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        partnerId,
        invoiceNumber,
        issueDate,
        dueDate: dueDate || undefined,
        notes: notes || undefined,
        items: payloadItems,
      };
      if (isEdit && id) {
        await api.updateInvoice(currentBusiness.id, id, payload);
        toast.success("請求書を更新しました");
      } else {
        await api.createInvoice(currentBusiness.id, payload);
        toast.success("請求書を作成しました");
      }
      navigate("/invoices");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="text-gray-400 hover:text-gray-600" onClick={() => navigate("/invoices")}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">{isEdit ? "請求書の編集" : "請求書を作成"}</h1>
        </div>
        {isEdit && id && (
          <Button variant="secondary" icon={<Printer size={14} />} onClick={() => window.open(`/invoices/${id}/print`, "_blank")}>
            印刷 / PDF
          </Button>
        )}
      </div>

      <Card className="p-4 grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>取引先</label>
          <select className={`${selectClass} w-full`} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">選択してください</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>請求書番号</label>
          <input className={`${inputClass} w-full`} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>発行日</label>
          <input type="date" className={`${inputClass} w-full`} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>支払期限</label>
          <input type="date" className={`${inputClass} w-full`} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-400 text-xs">
            <tr>
              <th className="px-4 py-2.5 font-normal">品目</th>
              <th className="px-4 py-2.5 font-normal w-20">数量</th>
              <th className="px-4 py-2.5 font-normal w-28">単価</th>
              <th className="px-4 py-2.5 font-normal w-36">税区分</th>
              <th className="px-4 py-2.5 font-normal w-28 text-right">金額</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {computedItems.map((it, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-4 py-1.5">
                  <input className={`${inputClass} w-full`} value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} />
                </td>
                <td className="px-4 py-1.5">
                  <input type="number" className={`${inputClass} w-full text-right`} value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} />
                </td>
                <td className="px-4 py-1.5">
                  <input type="number" className={`${inputClass} w-full text-right`} value={it.unitPrice} onChange={(e) => updateItem(i, { unitPrice: e.target.value })} />
                </td>
                <td className="px-4 py-1.5">
                  <select className={`${selectClass} w-full`} value={it.taxCategoryId} onChange={(e) => updateItem(i, { taxCategoryId: e.target.value })}>
                    <option value="">対象外</option>
                    {taxCategories.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">{it.amount.toLocaleString()}</td>
                <td className="px-4 py-1.5 text-right">
                  {items.length > 1 && (
                    <button className="text-gray-300 hover:text-red-500" onClick={() => removeItem(i)}>
                      <X size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-3 border-t border-gray-100">
          <button className="text-sm text-brand-600 hover:underline flex items-center gap-1" onClick={addItem}>
            <Plus size={14} /> 明細行を追加
          </button>
        </div>
        <div className="border-t border-gray-100 p-4 space-y-1.5 text-sm ml-auto w-64">
          <div className="flex justify-between text-gray-500">
            <span>小計</span>
            <span className="tabular-nums">{subtotal.toLocaleString()}円</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>消費税</span>
            <span className="tabular-nums">{taxAmount.toLocaleString()}円</span>
          </div>
          <div className="flex justify-between font-bold border-t border-gray-100 pt-1.5 text-gray-900">
            <span>合計</span>
            <span className="tabular-nums">{total.toLocaleString()}円</span>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <label className={labelClass}>備考</label>
        <textarea className={`${inputClass} w-full`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate("/invoices")}>
          キャンセル
        </Button>
        <Button loading={saving} onClick={handleSubmit}>
          保存
        </Button>
      </div>
    </div>
  );
}
