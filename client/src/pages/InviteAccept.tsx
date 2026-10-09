import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
const KEY = "keirio:pending-invite";
export default function InviteAccept() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => {
    const incoming = new URLSearchParams(location.hash.slice(1)).get("token");
    if (incoming) return incoming;
    try { return sessionStorage.getItem(KEY) ?? ""; } catch { return ""; }
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (/^[0-9a-f]{64}$/.test(token)) {
      try { sessionStorage.setItem(KEY, token); history.replaceState(history.state, "", "/invite"); }
      catch { setError("ログイン後に、この招待リンクをもう一度開いてください。"); }
    }
  }, [token]);
  const accept = async () => {
    setBusy(true); setError("");
    try {
      const result = await api.acceptInvite(token);
      try { localStorage.setItem("kaikei.currentBusinessId", result.businessId); sessionStorage.removeItem(KEY); } catch { /* server membership still active */ }
      navigate("/", { replace: true });
    } catch(e) { setError(e instanceof Error ? e.message : "招待を承認できませんでした"); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto max-w-lg p-6 pt-16"><h1 className="text-2xl font-semibold text-emerald-900">共有ワークスペースへの招待</h1><p className="mt-5 text-sm leading-7 text-gray-600">招待先のメールアドレスでログインし、承認すると事業者の共有データを開けます。権限と共有元の契約状況はオーナーが管理します。</p>{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}{!token ? <p className="mt-4 text-sm text-red-700">招待リンクをもう一度開いてください。</p> : user ? <><p className="mt-5 text-sm">ログイン中：{user.email}</p><button type="button" disabled={busy} onClick={accept} className="mt-6 rounded-lg bg-emerald-700 px-5 py-3 text-white disabled:opacity-50">{busy ? "承認中…" : "招待を承認して開く"}</button></> : <div className="mt-6 flex gap-4"><Link to="/login?next=/invite" className="rounded-lg bg-emerald-700 px-5 py-3 text-white">ログイン</Link><Link to="/signup?next=/invite" className="rounded-lg border px-5 py-3 text-emerald-800">アカウント登録</Link></div>}</main>;
}
