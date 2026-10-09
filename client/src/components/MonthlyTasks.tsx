import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useBusiness } from "../context/BusinessContext";

const TASKS = [
  { id: "import", label: "銀行・カード明細を取り込む", to: "/bank-import" },
  { id: "entries", label: "仕訳と証憑を確認する", to: "/journal-entries" },
  { id: "invoices", label: "請求・入金を確認する", to: "/invoices" },
  { id: "balances", label: "月次の残高を確認する", to: "/reports/trial-balance" },
];
export default function MonthlyTasks() {
  const { currentBusiness } = useBusiness();
  const [month, setMonth] = useState(() => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit" }).format(new Date()));
  const key = "kaikei:monthly-tasks:v1:" + currentBusiness?.id + ":" + month;
  const [saved, setSaved] = useState<{ key: string; done: string[] }>({ key: "", done: [] });
  const [error, setError] = useState("");
  useEffect(() => {
    setError("");
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) || "[]");
      setSaved({ key, done: Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && TASKS.some(task => task.id === item)))] : [] });
    } catch { setSaved({ key, done: [] }); setError("保存内容を読み込めません。このブラウザの保存設定をご確認ください。"); }
  }, [key]);
  const done = saved.key === key ? saved.done : [];
  const toggle = (id: string) => {
    const next = done.includes(id) ? done.filter(item => item !== id) : [...done, id];
    setSaved({ key, done: next });
    try { localStorage.setItem(key, JSON.stringify(next)); setError(""); }
    catch { setError("保存できませんでした。チェック状態は画面を閉じると失われます。"); }
  };
  if (!currentBusiness) return null;
  const exportTasks = () => {
    const rows = [["対象月", "タスク", "状態"], ...TASKS.map(task => [month, task.label, done.includes(task.id) ? "確認済み" : "未確認"])];
    const csv = "\uFEFF" + rows.map(row => row.map(cell => '"' + cell.replace(/"/g, '""') + '"').join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "kaikei-monthly-tasks-" + month + ".csv";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="rounded-xl border border-gray-200 bg-white p-5" aria-labelledby="monthly-tasks-title">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="monthly-tasks-title" className="text-sm font-semibold text-gray-900">月次タスク</h2><p className="mt-1 text-xs text-gray-500">確認済み {done.length} / {TASKS.length} · このブラウザに事業者別で保存</p></div><label className="text-xs text-gray-600">対象月 <input type="month" value={month} onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value)) setMonth(event.target.value); }} className="ml-2 rounded-md border border-gray-200 px-2 py-2 text-sm" /></label></div>
    <progress className="mt-4 h-1.5 w-full accent-emerald-700" value={done.length} max={TASKS.length} aria-label="月次タスクの進捗" />
    <div className="mt-3 divide-y divide-gray-100">{TASKS.map(task => <div key={task.id} className="flex items-center justify-between gap-3 py-2"><label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-gray-700"><input type="checkbox" checked={done.includes(task.id)} onChange={() => toggle(task.id)} className="h-4 w-4 accent-emerald-700" />{task.label}</label><Link to={task.to} className="shrink-0 rounded-md px-3 py-3 text-xs font-medium text-emerald-700 hover:bg-emerald-50">開く →</Link></div>)}</div>
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs leading-5 text-gray-500">確認メモ用です。仕訳や帳票は変更されません。</p><button type="button" onClick={exportTasks} className="min-h-11 rounded-md border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-50">チェック結果をCSV保存</button></div>
  </section>;
}
