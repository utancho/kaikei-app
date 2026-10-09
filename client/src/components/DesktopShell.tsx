import { useEffect, useState, type ReactNode } from "react";
import { KeirioIcon } from "./KeirioIcon";
declare global { interface Window { keirioDesktop?: { isDesktop: boolean; platform?: string }; } }
export default function DesktopShell({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  if (!window.keirioDesktop?.isDesktop) return <>{children}</>;
  return <div className="desktop-shell" data-platform={window.keirioDesktop.platform}><div className="desktop-titlebar"><KeirioIcon size={24} /><span>keirio</span><span className="desktop-status">{online ? "会計ワークスペース" : "オフライン"}</span></div><div className="desktop-content">{!online && <p role="status" className="desktop-offline">ネット接続を確認してください。未保存の入力は、接続が戻るまでこの画面で保持してください。</p>}{children}</div></div>;
}
