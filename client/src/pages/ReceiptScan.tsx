import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Plus, Sparkles, Trash2, Loader2, CheckCircle2, AlertCircle, BookPlus } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api, ApiError } from "../lib/api";
import { toInputDate } from "../lib/format";
import type { Account } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { AccountSelect } from "../components/AccountSelect";
import { useToast } from "../components/ui/Toast";
import { inputClass, labelClass, selectClass } from "../lib/formStyles";

type ItemStatus = "pending" | "analyzing" | "ready" | "error";

interface ReceiptItem {
  id: number;
  file: File;
  previewUrl: string;
  status: ItemStatus;
  date: string;
  amount: string;
  description: string;
  accountId: string;
  error?: string;
}

let nextId = 1;

// 支払方法(貸方)の候補となる代表的な勘定科目コード
const PAYMENT_ACCOUNT_CODES = ["1010", "1030", "2030", "3150", "3170"]; // 現金・普通預金・未払金・事業主借 等

export default function ReceiptScan() {
  const { currentBusiness } = useBusiness();
  const toast = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentBusiness) return;
    api.listAccounts(currentBusiness.id).then((list) => {
      setAccounts(list);
      // 既定の支払方法: 現金(1010) があれば選択
      const cash = list.find((a) => a.code === "1010") ?? list.find((a) => a.category === "ASSET");
      if (cash) setPaymentAccountId((prev) => prev || cash.id);
    });
  }, [currentBusiness]);

  const expenseAccounts = accounts.filter((a) => a.category === "EXPENSE");
  const paymentAccounts = accounts.filter(
    (a) => PAYMENT_ACCOUNT_CODES.includes(a.code) || a.category === "ASSET" || a.category === "LIABILITY" || a.category === "EQUITY"
  );

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const newItems: ReceiptItem[] = [];
    for (const file of Array.from(files)) {
      if (!allowed.includes(file.type)) continue;
      newItems.push({
        id: nextId++,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "pending",
        date: "",
        amount: "",
        description: "",
        accountId: "",
      });
    }
    if (newItems.length === 0) {
      toast.error("対応している画像(JPEG/PNG/WebP)がありませんでした");
      return;
    }
    setItems((prev) => [...prev, ...newItems]);
  };

  const update = (id: number, patch: Partial<ReceiptItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const remove = (id: number) =>
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((it) => it.id !== id);
    });

  const analyzeAll = async () => {
    if (!currentBusiness) return;
    const targets = items.filter((it) => it.status === "pending" || it.status === "error");
    if (targets.length === 0) return;
    setAnalyzing(true);
    for (const it of targets) {
      update(it.id, { status: "analyzing", error: undefined });
      try {
        const ex = await api.analyzeReceipt(currentBusiness.id, it.file);
        update(it.id, {
          status: "ready",
          date: ex.date ?? "",
          amount: ex.amount != null ? String(ex.amount) : "",
          description: ex.description ?? ex.vendorName ?? "",
          accountId: ex.suggestedAccountId ?? "",
        });
      } catch (e) {
        update(it.id, { status: "error", error: e instanceof ApiError ? e.message : "解析に失敗しました" });
      }
    }
    setAnalyzing(false);
    toast.success("解析が完了しました。内容を確認してください");
  };

  const readyToCreate = items.filter((it) => Number(it.amount) > 0 && it.accountId);

  const createAll = async () => {
    if (!currentBusiness || !paymentAccountId) {
      toast.error("支払方法(貸方の勘定科目)を選択してください");
      return;
    }
    if (readyToCreate.length === 0) {
      toast.error("金額と勘定科目が入力済みのレシートがありません");
      return;
    }
    setCreating(true);
    let ok = 0;
    const failedIds = new Set<number>();
    for (const it of readyToCreate) {
      const amount = Math.round(Number(it.amount));
      try {
        await api.createJournalEntry(currentBusiness.id, {
          entryDate: it.date || toInputDate(new Date()),
          description: it.description || "レシート",
          lines: [
            { side: "DEBIT", accountId: it.accountId, amount },
            { side: "CREDIT", accountId: paymentAccountId, amount },
          ],
        });
        ok++;
      } catch {
        failedIds.add(it.id);
      }
    }
    setCreating(false);
    // 成功した項目はリストから除去、失敗分は残す
    setItems((prev) =>
      prev.filter((it) => {
        const wasTarget = readyToCreate.some((r) => r.id === it.id);
        if (wasTarget && !failedIds.has(it.id)) {
          URL.revokeObjectURL(it.previewUrl);
          return false;
        }
        return true;
      })
    );
    if (ok > 0) toast.success(`${ok}件の仕訳を作成しました`);
    if (failedIds.size > 0) toast.error(`${failedIds.size}件は作成できませんでした`);
  };

  if (!currentBusiness) return null;

  const STATUS_BADGE: Record<ItemStatus, React.ReactNode> = {
    pending: <span className="text-xs text-gray-400">未解析</span>,
    analyzing: <span className="text-xs text-brand-600 flex items-center gap-1"><Loader2 size={12} className="animate-spin" />解析中</span>,
    ready: <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12} />読取済</span>,
    error: <span className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />エラー</span>,
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader
        title="レシートから仕訳作成"
        subtitle="スマホで複数のレシートを撮影・選択し、まとめて仕訳にできます"
      />
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">無料運用では外部AIの自動読取を停止しています。<Link className="font-medium underline" to="/operations">実務管理で原本を保存・過去仕訳の候補を確認</Link>できます。手入力は従来の仕訳入力をご利用ください。</p>

      {/* 追加エリア */}
      <Card className="p-4 sm:p-5">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-8 hover:border-brand-300 hover:bg-brand-50/30 transition-colors"
        >
          <Camera size={28} className="text-gray-300" />
          <span className="text-sm text-gray-600 font-medium">タップして撮影 / 画像を選択(複数可)</span>
          <span className="text-xs text-gray-400">スマホならカメラが起動します。まとめて選んでOK</span>
        </button>
      </Card>

      {items.length > 0 && (
        <>
          {/* 一括操作バー */}
          <Card className="p-4 flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className={labelClass}>支払方法(貸方の勘定科目・全件共通)</label>
              <AccountSelect accounts={paymentAccounts} value={paymentAccountId} onChange={setPaymentAccountId} />
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                icon={<Sparkles size={15} />}
                onClick={analyzeAll}
                loading={analyzing}
                disabled={!items.some((it) => it.status === "pending" || it.status === "error")}
              >
                すべて解析
              </Button>
              <Button icon={<BookPlus size={15} />} onClick={createAll} loading={creating} disabled={readyToCreate.length === 0}>
                一括で仕訳作成{readyToCreate.length > 0 ? `(${readyToCreate.length})` : ""}
              </Button>
            </div>
          </Card>

          {/* レシート一覧 */}
          <div className="space-y-3">
            {items.map((it) => (
              <Card key={it.id} className="p-3 sm:p-4">
                <div className="flex gap-3">
                  <img src={it.previewUrl} alt="レシート" className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover border border-gray-200 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      {STATUS_BADGE[it.status]}
                      <button className="text-gray-300 hover:text-red-500 shrink-0" onClick={() => remove(it.id)} aria-label="削除">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {it.status === "error" && <div className="text-xs text-red-500">{it.error}</div>}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-gray-400 mb-0.5">日付</label>
                        <input type="date" className={`${inputClass} w-full !py-1.5`} value={it.date} onChange={(e) => update(it.id, { date: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-400 mb-0.5">金額</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder="円"
                          className={`${inputClass} w-full !py-1.5`}
                          value={it.amount}
                          onChange={(e) => update(it.id, { amount: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-0.5">摘要</label>
                      <input className={`${inputClass} w-full !py-1.5`} value={it.description} onChange={(e) => update(it.id, { description: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-0.5">勘定科目(借方)</label>
                      <select className={`${selectClass} w-full !py-1.5`} value={it.accountId} onChange={(e) => update(it.id, { accountId: e.target.value })}>
                        <option value="">選択してください</option>
                        {expenseAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 py-2"
          >
            <Plus size={16} /> レシートを追加
          </button>

          <p className="text-xs text-gray-400">
            各レシートは「借方=選んだ勘定科目 / 貸方=支払方法」で1件ずつ仕訳化されます。金額と勘定科目が入力済みの {readyToCreate.length} 件が作成対象です。
            {paymentAccounts.find((a) => a.id === paymentAccountId) && `(貸方: ${paymentAccounts.find((a) => a.id === paymentAccountId)!.name})`}
          </p>
        </>
      )}
    </div>
  );
}
