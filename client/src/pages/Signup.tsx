import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Wallet } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { inputClass, labelClass } from "../lib/formStyles";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signup(email, password, name || undefined);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "登録に失敗しました");
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
          <h1 className="text-lg font-bold text-gray-900 mb-1 text-center">14日間無料でお試し</h1>
          <p className="text-sm text-gray-500 text-center mb-6">クレジットカード登録は次のステップで行います</p>
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg border border-red-200 mb-4">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>お名前</label>
              <input className={`${inputClass} w-full`} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>メールアドレス</label>
              <input type="email" required className={`${inputClass} w-full`} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>パスワード</label>
              <input type="password" required minLength={8} className={`${inputClass} w-full`} value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">8文字以上</p>
            </div>
            <Button type="submit" className="w-full justify-center" loading={loading}>
              無料で始める
            </Button>
          </form>
          <p className="text-sm text-gray-500 text-center mt-6">
            すでにアカウントをお持ちの方は{" "}
            <Link to="/login" className="text-brand-600 hover:underline font-medium">
              ログイン
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
