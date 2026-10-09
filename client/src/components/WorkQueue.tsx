import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useBusiness } from "../context/BusinessContext";
import { workflowPath, workflowRequest, type WorkflowOverview } from "../lib/workflowApi";
const labels: Record<string, string> = { unpaidInvoices: "未入金の請求書", overdueInvoices: "支払期限超過", draftEntries: "下書き仕訳", missingEvidence: "証憑未添付", pendingReviews: "未対応のレビュー", unmatchedRows:"未処理明細" };
export default function WorkQueue() {
  const { currentBusiness } = useBusiness();
  const [state, setState] = useState<{ id: string; data?: WorkflowOverview; error?: string }>({ id: "" });
  useEffect(() => { const id = currentBusiness?.id; if (!id) { setState({ id: "" }); return; } let active = true; setState({ id }); workflowRequest<WorkflowOverview>(workflowPath(id, "overview")).then(data => { if (active) setState({ id, data }); }).catch(e => { if (active) setState({ id, error: e.message }); }); return () => { active = false; }; }, [currentBusiness?.id]);
  const data = state.id === currentBusiness?.id ? state.data : undefined;
  return <section className="rounded-xl border bg-white p-5"><div className="flex justify-between gap-3"><h2 className="font-semibold">実務の確認待ち</h2><Link to="/operations" className="text-sm text-brand-700">実務管理へ →</Link></div>{state.error && state.id === currentBusiness?.id ? <p role="alert" className="mt-3 text-sm text-red-700">{state.error}</p> : !data ? <p className="mt-3 text-sm text-gray-500">読み込み中…</p> : <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{Object.entries(data.counts).map(([key, count]) => <div key={key} className="rounded-lg bg-brand-50 p-3 text-sm"><p className="text-gray-600">{labels[key] || key}</p><p className="mt-1 text-lg font-semibold text-brand-800">{count} 件</p></div>)}</div>}</section>;
}
