import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export default function BillingSuccess() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Stripe Webhookの反映に多少ラグがあるため、少し待ってから状態を再取得する
    const timer = setTimeout(async () => {
      await refresh();
      setChecking(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [refresh]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <Card className="p-8 max-w-sm w-full text-center">
        <CheckCircle2 size={40} className="text-brand-500 mx-auto mb-4" />
        <h1 className="text-lg font-bold text-gray-900 mb-2">お申し込みありがとうございます</h1>
        <p className="text-sm text-gray-500 mb-6">{checking ? "登録内容を確認しています..." : "ご利用いただけます。"}</p>
        <Button className="w-full justify-center" loading={checking} onClick={() => navigate("/")}>
          アプリを開く
        </Button>
      </Card>
    </div>
  );
}
