import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Wallet, ShieldCheck } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { inputClass, labelClass } from "../lib/formStyles";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("パスワードは8文字以上で入力してください");
      return;
    }
    if (password !== confirm) {
      setError("確認用パスワードが一致しません");
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "再設定に失敗しました");
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
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck size={24} />
              </div>
              <h1 className="text-lg font-bold text-gray-900 mb-2">再設定が完了しました</h1>
              <p className="text-sm text-gray-600">新しいパスワードでログインできます。ログイン画面に移動します…</p>
            </div>
          ) : !token ? (
            <div className="text-center">
              <h1 className="text-lg font-bold text-gray-900 mb-2">リンクが無効です</h1>
              <p className="text-sm text-gray-600">再設定リンクが正しくありません。お手数ですが再度お手続きください。</p>
              <Link to="/forgot-password" className="inline-block mt-5 text-sm text-brand-600 hover:underline font-medium">
                再設定をやり直す
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-bold text-gray-900 mb-6 text-center">新しいパスワードを設定</h1>
              {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg border border-red-200 mb-4">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={labelClass}>新しいパスワード(8文字以上)</label>
                  <input type="password" required className={`${inputClass} w-full`} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>新しいパスワード(確認)</label>
                  <input type="password" required className={`${inputClass} w-full`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </div>
                <Button type="submit" className="w-full justify-center" loading={loading}>
                  パスワードを再設定
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
