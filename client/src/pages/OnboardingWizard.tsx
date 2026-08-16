import { useState } from "react";
import { Building2, User, ArrowLeft, ArrowRight, Wallet, CheckCircle2 } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api, ApiError } from "../lib/api";
import type { BusinessType } from "../lib/types";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useToast } from "../components/ui/Toast";
import { inputClass, selectClass, labelClass } from "../lib/formStyles";

const STEPS = ["事業形態", "基本情報", "消費税", "確認"];

const TAXATION_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "EXEMPT", label: "免税事業者", description: "消費税の申告・納税義務がない事業者(開業間もない場合など)" },
  { value: "GENERAL", label: "本則課税", description: "実際の課税売上・課税仕入に基づいて消費税を計算する方式" },
  { value: "SIMPLIFIED", label: "簡易課税", description: "業種ごとのみなし仕入率で消費税を計算する簡便な方式" },
];

export default function OnboardingWizard() {
  const { refresh, setCurrentBusinessId } = useBusiness();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<BusinessType | null>(null);
  const [name, setName] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(4);
  const [taxationType, setTaxationType] = useState("EXEMPT");

  const canProceed = [type !== null, name.trim().length > 0, true, true][step];

  const handleCreate = async () => {
    if (!type || !name) return;
    setSaving(true);
    try {
      const created = await api.createBusiness({ name, type, representativeName, fiscalYearStartMonth, taxationType });
      await refresh();
      setCurrentBusinessId(created.id);
      toast.success(`「${name}」を作成しました`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "作成に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center">
            <Wallet size={20} className="text-white" />
          </div>
          <div className="text-xl font-bold text-gray-900">Kaikei</div>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  i < step ? "bg-brand-600 text-white" : i === step ? "bg-brand-100 text-brand-700 border-2 border-brand-500" : "bg-gray-100 text-gray-400"
                }`}
              >
                {i < step ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span className={`text-xs ${i === step ? "text-gray-700 font-medium" : "text-gray-400"}`}>{label}</span>
              {i < STEPS.length - 1 && <div className="w-6 h-px bg-gray-200" />}
            </div>
          ))}
        </div>

        <Card className="p-8">
          {step === 0 && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">はじめまして</h2>
              <p className="text-sm text-gray-500 mb-6">まずは事業の形態を教えてください。あとから変更はできません。</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  className={`rounded-xl border-2 p-5 text-left transition-colors ${type === "INDIVIDUAL" ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-gray-300"}`}
                  onClick={() => setType("INDIVIDUAL")}
                >
                  <User size={24} className="text-brand-600 mb-2" />
                  <div className="font-semibold text-gray-900">個人事業主</div>
                  <div className="text-xs text-gray-500 mt-1">青色申告・白色申告をされている方</div>
                </button>
                <button
                  className={`rounded-xl border-2 p-5 text-left transition-colors ${type === "CORPORATE" ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-gray-300"}`}
                  onClick={() => setType("CORPORATE")}
                >
                  <Building2 size={24} className="text-brand-600 mb-2" />
                  <div className="font-semibold text-gray-900">法人</div>
                  <div className="text-xs text-gray-500 mt-1">株式会社・合同会社など</div>
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900 mb-1">基本情報を入力してください</h2>
              <div>
                <label className={labelClass}>{type === "INDIVIDUAL" ? "屋号" : "会社名"}</label>
                <input className={`${inputClass} w-full`} placeholder={type === "INDIVIDUAL" ? "例: サンプル商店" : "例: 株式会社サンプル"} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div>
                <label className={labelClass}>代表者名</label>
                <input className={`${inputClass} w-full`} value={representativeName} onChange={(e) => setRepresentativeName(e.target.value)} />
              </div>
              {type === "CORPORATE" && (
                <div>
                  <label className={labelClass}>会計期間開始月</label>
                  <select className={selectClass} value={fiscalYearStartMonth} onChange={(e) => setFiscalYearStartMonth(Number(e.target.value))}>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <option key={i} value={i + 1}>
                        {i + 1}月
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {type === "INDIVIDUAL" && <div className="text-xs text-gray-400">個人事業主の会計期間は1月〜12月固定です。</div>}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900 mb-1">消費税の課税区分</h2>
              <p className="text-sm text-gray-500 mb-2">わからない場合は「免税事業者」を選んでおき、あとから設定画面で変更できます。</p>
              <div className="space-y-2">
                {TAXATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`w-full text-left rounded-lg border-2 p-3.5 transition-colors ${taxationType === opt.value ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-gray-300"}`}
                    onClick={() => setTaxationType(opt.value)}
                  >
                    <div className="font-medium text-sm text-gray-900">{opt.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900 mb-1">この内容で作成します</h2>
              <dl className="text-sm divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                {[
                  ["事業形態", type === "INDIVIDUAL" ? "個人事業主" : "法人"],
                  [type === "INDIVIDUAL" ? "屋号" : "会社名", name],
                  ["代表者名", representativeName || "(未設定)"],
                  ...(type === "CORPORATE" ? [["会計期間開始月", `${fiscalYearStartMonth}月`]] : []),
                  ["消費税課税区分", TAXATION_OPTIONS.find((o) => o.value === taxationType)?.label ?? ""],
                ].map(([k, v]) => (
                  <div key={k} className="flex px-4 py-2.5 bg-white">
                    <dt className="w-32 text-gray-400 shrink-0">{k}</dt>
                    <dd className="text-gray-800 font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-gray-400">
                作成すると、freee標準の勘定科目一式が自動でセットアップされます。あとから科目の追加・編集も可能です。
              </p>
            </div>
          )}

          <div className="flex justify-between mt-8">
            <Button variant="secondary" icon={<ArrowLeft size={14} />} onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
              戻る
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed}>
                次へ <ArrowRight size={14} />
              </Button>
            ) : (
              <Button loading={saving} onClick={handleCreate}>
                作成する
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
