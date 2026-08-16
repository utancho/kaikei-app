import { Link } from "react-router-dom";
import { Wallet, ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function LegalLayout({ title, updatedAt, children }: { title: string; updatedAt: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Wallet size={18} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">Kaikei</span>
          </Link>
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
            <ArrowLeft size={14} /> トップに戻る
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-xs text-gray-400 mb-10">最終更新日: {updatedAt}</p>
        <div className="prose-legal space-y-8 text-sm text-gray-700 leading-relaxed">{children}</div>
      </main>
    </div>
  );
}
