import { KeirioIcon } from "../components/KeirioIcon";
import { useState } from "react";
import { CheckCircle2, LogOut, Wallet } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

const FEATURES = [
  "複式簿記の仕訳入力・自動バランス検証",
  "総勘定元帳・試算表・損益計算書・貸借対照表",
  "請求書発行・入金消込",
  "銀行/カード明細CSV自動取込",
  "固定資産台帳・減価償却の自動計算",
  "青色申告決算書の出力",
];

export default function Billing() {
  const { user, subscription, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setError(null);
    setLoading(true);
    try {
      const { url } = await api.startCheckout();
      if (url) {
        window.location.href = url;
      } else {
        setError("決済ページを開けませんでした。しばらくしてから再度お試しください。");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "決済の開始に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const isCanceled = subscription?.status === "CANCELED" || subscription?.status === "PAST_DUE";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-6">
          <KeirioIcon size={36} />
          <div className="text-xl font-bold text-gray-900">keirio</div>
        </div>

        <Card className="p-8">
          <h1 className="text-lg font-bold text-gray-900 mb-1 text-center">
            {isCanceled ? "プランの更新が必要です" : `ようこそ${user?.name ? `、${user.name}さん` : ""}`}
          </h1>
          <p className="text-sm text-gray-500 text-center mb-6">
            {isCanceled ? "お支払い方法をご確認のうえ、プランを再開してください。" : "続けるには月額プランへのご登録が必要です(14日間無料)"}
          </p>

          <div className="bg-brand-50 border border-brand-100 rounded-xl p-5 mb-6">
            <div className="flex items-baseline justify-center gap-1 mb-4">
              <span className="text-3xl font-bold text-brand-800">¥1,980</span>
              <span className="text-sm text-brand-600">/ 月(税込)</span>
            </div>
            <ul className="space-y-2">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle2 size={15} className="text-brand-500 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg border border-red-200 mb-4">{error}</div>}

          <Button className="w-full justify-center" loading={loading} onClick={handleSubscribe}>
            {isCanceled ? "プランを再開する" : "14日間無料で始める"}
          </Button>
          <button
            className="w-full text-sm text-gray-400 hover:text-gray-600 mt-4 flex items-center justify-center gap-1"
            onClick={() => logout()}
          >
            <LogOut size={14} /> ログアウト
          </button>
        </Card>
      </div>
    </div>
  );
}
