import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Upload, ArrowRight, Sparkles } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api, ApiError } from "../lib/api";
import type { Account, ReceiptExtraction } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { AccountSelect } from "../components/AccountSelect";
import { useToast } from "../components/ui/Toast";
import { inputClass, labelClass } from "../lib/formStyles";

export default function ReceiptScan() {
  const { currentBusiness } = useBusiness();
  const navigate = useNavigate();
  const toast = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ReceiptExtraction | null>(null);

  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");

  useEffect(() => {
    if (!currentBusiness) return;
    api.listAccounts(currentBusiness.id).then(setAccounts);
  }, [currentBusiness]);

  const handleFileChange = (f: File | null) => {
    setFile(f);
    setResult(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  };

  const handleAnalyze = async () => {
    if (!currentBusiness || !file) return;
    setAnalyzing(true);
    try {
      const extraction = await api.analyzeReceipt(currentBusiness.id, file);
      setResult(extraction);
      setDate(extraction.date ?? "");
      setDescription(extraction.description ?? extraction.vendorName ?? "");
      setAmount(extraction.amount != null ? String(extraction.amount) : "");
      setAccountId(extraction.suggestedAccountId ?? "");
      if (!extraction.amount) toast.error("金額を読み取れませんでした。内容をご確認・修正のうえ仕訳を作成してください");
      else toast.success("領収書を解析しました。内容を確認してください");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "解析に失敗しました");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateEntry = () => {
    const params = new URLSearchParams();
    if (date) params.set("receiptDate", date);
    if (description) params.set("receiptDescription", description);
    if (amount) params.set("receiptAmount", amount);
    if (accountId) params.set("receiptAccountId", accountId);
    navigate(`/journal-entries/new?${params.toString()}`);
  };

  if (!currentBusiness) return null;

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader title="レシートから仕訳作成" subtitle="領収書・レシートの写真をアップロードすると、日付・金額・勘定科目を自動で読み取ります" />

      <Card className="p-5 space-y-4">
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-10 cursor-pointer hover:border-brand-300 hover:bg-brand-50/30 transition-colors">
          {previewUrl ? (
            <img src={previewUrl} alt="レシートプレビュー" className="max-h-64 rounded-lg object-contain" />
          ) : (
            <>
              <Camera size={28} className="text-gray-300" />
              <span className="text-sm text-gray-500">タップして画像を選択(またはカメラで撮影)</span>
            </>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />
        </label>

        <Button icon={<Upload size={15} />} onClick={handleAnalyze} loading={analyzing} disabled={!file} className="w-full justify-center">
          解析する
        </Button>
      </Card>

      {result && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
            <Sparkles size={15} className="text-brand-500" />
            読み取り結果(内容を確認・修正してください)
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>日付</label>
              <input type="date" className={`${inputClass} w-full`} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>金額</label>
              <input
                type="number"
                className={`${inputClass} w-full`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="円"
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>摘要</label>
            <input className={`${inputClass} w-full`} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>勘定科目(候補)</label>
            <AccountSelect accounts={accounts.filter((a) => a.category === "EXPENSE")} value={accountId} onChange={setAccountId} />
          </div>

          <Button icon={<ArrowRight size={15} />} onClick={handleCreateEntry} disabled={!amount} className="w-full justify-center">
            この内容で仕訳を作成
          </Button>
        </Card>
      )}
    </div>
  );
}
