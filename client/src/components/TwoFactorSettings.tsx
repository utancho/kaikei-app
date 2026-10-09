import { useState } from "react";
import QRCode from "qrcode";
import { ShieldCheck, ShieldAlert, Smartphone, Copy, RefreshCw, KeyRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import { Card, CardHeader } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { useToast } from "./ui/Toast";
import { inputClass, labelClass } from "../lib/formStyles";

type Mode = "idle" | "enrolling" | "disabling" | "regenerating" | "confirming";

export function TwoFactorSettings() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("idle");
  const [loading, setLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const enabled = Boolean(user?.twoFactorEnabled);
  const remaining = user?.twoFactorBackupCodesRemaining ?? 0;

  const copyBackupCodes = async () => {
    if (!backupCodes) return;
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      toast.success("バックアップコードをコピーしました");
    } catch {
      toast.error("コピーできませんでした");
    }
  };

  const regenerate = async () => {
    setLoading(true);
    try {
      const res = await api.twoFactorRegenerateBackupCodes(password, code);
      setBackupCodes(res.backupCodes);
      setMode("idle"); setPassword(""); setCode("");
      toast.success("バックアップコードを再生成しました");
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "再生成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const startEnroll = async () => {
    setLoading(true);
    try {
      const { secret: s, otpauthUrl } = await api.twoFactorSetup(password);
      setSecret(s);
      setQrDataUrl(await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 180 }));
      setMode("enrolling");
      setCode("");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "設定の開始に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const confirmEnable = async () => {
    setLoading(true);
    try {
      const res = await api.twoFactorEnable(code, password);
      setBackupCodes(res.backupCodes);
      toast.success("二要素認証を有効にしました");
      setMode("idle");
      setPassword(""); setCode(""); setSecret(""); setQrDataUrl(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "有効化に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const confirmDisable = async () => {
    setLoading(true);
    try {
      await api.twoFactorDisable(password, code);
      toast.success("二要素認証を無効にしました");
      setMode("idle");
      setPassword("");
      setCode(""); setBackupCodes(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "無効化に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            二要素認証(2FA)
            {enabled ? <Badge tone="green">有効</Badge> : <Badge tone="gray">無効</Badge>}
          </span>
        }
        subtitle="ログイン時に認証アプリのワンタイムコードを要求し、アカウントを保護します"
      />

      {backupCodes && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-800 mb-2">
            <KeyRound size={16} /> バックアップコード(今だけ表示)
          </div>
          <p className="text-xs text-amber-800 mb-3">
            認証アプリが使えないときにログインで使用できます。各コードは1回のみ有効です。安全な場所に保管してください。
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {backupCodes.map((c) => (
              <code key={c} className="bg-white border border-amber-200 rounded px-2 py-1.5 text-center text-sm font-mono text-gray-800">
                {c}
              </code>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={copyBackupCodes}>
              コピー
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setBackupCodes(null)}>
              閉じる
            </Button>
          </div>
        </div>
      )}

      {enabled ? (
        mode === "disabling" || mode === "regenerating" ? (
          <div className="space-y-3 max-w-sm">
            <div>
              <label htmlFor="twofactor-password" className={labelClass}>確認のため現在のパスワードを入力</label>
              <input
                id="twofactor-password"
                autoComplete="current-password"
                type="password"
                className={`${inputClass} w-full`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="twofactor-proof" className={labelClass}>認証コードまたはバックアップコード</label>
              <input id="twofactor-proof" autoComplete="one-time-code" className={`${inputClass} w-full`} value={code} onChange={e => setCode(e.target.value)} maxLength={32} />
            </div>
            <div className="flex gap-2">
              <Button variant={mode === "disabling" ? "danger" : "primary"} loading={loading} disabled={!password || !code} onClick={mode === "disabling" ? confirmDisable : regenerate}>
                {mode === "disabling" ? "無効にする" : "再生成する"}
              </Button>
              <Button variant="secondary" onClick={() => { setMode("idle"); setPassword(""); setCode(""); }}>
                キャンセル
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <ShieldCheck size={20} className="text-emerald-500" />
            <span className="flex-1">
              認証アプリによる二要素認証が有効です。
              <span className="text-gray-400">(残りバックアップコード: {remaining}個)</span>
            </span>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} loading={loading} onClick={() => { setMode("regenerating"); setPassword(""); setCode(""); }}>
              コード再生成
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setMode("disabling"); setPassword(""); setCode(""); }}>
              無効化
            </Button>
          </div>
        )
      ) : mode === "enrolling" ? (
        <div className="space-y-4">
          <ol className="text-sm text-gray-600 space-y-1 list-decimal pl-5">
            <li>認証アプリ(Google Authenticator / 1Password など)でQRコードを読み取ります。</li>
            <li>アプリに表示された6桁のコードを入力して有効化します。</li>
          </ol>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {qrDataUrl && <img src={qrDataUrl} alt="QRコード" className="border border-gray-200 rounded-lg" width={160} height={160} />}
            <div className="space-y-2 flex-1">
              <div>
                <div className="text-xs text-gray-500">手動入力用キー</div>
                <code className="block bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs break-all font-mono text-gray-700 mt-1">
                  {secret}
                </code>
              </div>
              <div>
                <label htmlFor="twofactor-enroll-code" className={labelClass}>認証コード(6桁)</label>
                <input
                  id="twofactor-enroll-code"
                  autoComplete="one-time-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  className={`${inputClass} w-40 tracking-[0.3em] text-center`}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button loading={loading} disabled={code.length !== 6} onClick={confirmEnable}>
                  有効にする
                </Button>
                <Button variant="secondary" onClick={() => { setMode("idle"); setPassword(""); setCode(""); setSecret(""); setQrDataUrl(null); }}>
                  キャンセル
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : mode === "confirming" ? (
        <div className="space-y-3 max-w-sm">
          <label htmlFor="twofactor-password" className={labelClass}>現在のパスワードで本人確認</label>
          <input id="twofactor-password" type="password" autoComplete="current-password" className={`${inputClass} w-full`} value={password} onChange={e => setPassword(e.target.value)} />
          <div className="flex gap-2">
            <Button loading={loading} disabled={!password} onClick={startEnroll}>設定を開始する</Button>
            <Button variant="secondary" onClick={() => { setMode("idle"); setPassword(""); }}>キャンセル</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <ShieldAlert size={20} className="text-amber-500" />
          <span className="flex-1">二要素認証は無効です。有効にするとアカウントの安全性が高まります。</span>
          <Button size="sm" icon={<Smartphone size={14} />} loading={loading} onClick={() => setMode("confirming")}>
            有効化する
          </Button>
        </div>
      )}
    </Card>
  );
}
