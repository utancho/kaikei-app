import { useState } from "react";
import { Link } from "react-router-dom";
import { Wallet, MailCheck } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { inputClass, labelClass } from "../lib/formStyles";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.forgotPassword(email);
      setEmailEnabled(res.emailEnabled);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "送信に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center">
            <Wallet size={20} className="text-white" />
          </div>
          <div className="text-xl font-bold text-gray-900">Kaikei</div>
        </Link>

        <Card className="p-8">
          {done ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-3">
                <MailCheck size={24} />
              </div>
              <h1 className="text-lg font-bold text-gray-900 mb-2">メールを確認してください</h1>
              {emailEnabled ? (
                <p className="text-sm text-gray-600">
                  ご登録のメールアドレス宛に、パスワード再設定用のリンクを送信しました(登録がある場合)。
                  リンクの有効期限は1時間です。
                </p>
              ) : (
                <p className="text-sm text-amber-700">
                  現在メール送信が設定されていないため、自動送信できませんでした。
                  お手数ですが管理者にパスワードの再設定を依頼してください。
                </p>
              )}
              <Link to="/login" className="inline-block mt-5 text-sm text-brand-600 hover:underline font-medium">
                ログインに戻る
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-bold text-gray-900 mb-2 text-center">パスワードをお忘れですか?</h1>
              <p className="text-sm text-gray-500 mb-6 text-center">
                ご登録のメールアドレスを入力してください。再設定用のリンクをお送りします。
              </p>
              {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg border border-red-200 mb-4">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={labelClass}>メールアドレス</label>
                  <input type="email" required className={`${inputClass} w-full`} value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <Button type="submit" className="w-full justify-center" loading={loading}>
                  再設定リンクを送信
                </Button>
              </form>
              <p className="text-sm text-gray-500 text-center mt-6">
                <Link to="/login" className="text-brand-600 hover:underline font-medium">
                  ログインに戻る
                </Link>
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
