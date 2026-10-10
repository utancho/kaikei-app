import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api } from "../lib/api";
import { formatDate, formatYen } from "../lib/format";
import type { Invoice } from "../lib/types";
import { Button } from "../components/ui/Button";

export default function InvoicePrint() {
  const { currentBusiness } = useBusiness();
  const { id } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    if (!currentBusiness || !id) return;
    api.getInvoice(currentBusiness.id, id).then(setInvoice);
  }, [currentBusiness, id]);

  if (!currentBusiness || !invoice) return <div className="p-10 text-gray-400 text-sm">読み込み中...</div>;
  const issuer = invoice.issuer ?? currentBusiness;

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      {!invoice.issuer && invoice.status !== 'DRAFT' && <p role="alert" className="max-w-2xl mx-auto mb-4 p-3 bg-amber-50 text-amber-900 text-sm no-print">この旧請求書には発行時の事業者情報が保存されていません。再印刷前に原本と照合してください。表示には現在の事業者情報を使用しています。</p>}
      <div className="max-w-2xl mx-auto mb-4 flex justify-end no-print">
        <Button icon={<Printer size={16} />} onClick={() => window.print()}>
          印刷する
        </Button>
      </div>
      <div className="max-w-2xl mx-auto bg-white shadow-sm print:shadow-none p-10 text-sm text-gray-800">
        <h1 className="text-2xl font-bold text-center tracking-wide mb-8">請求書</h1>

        <div className="flex justify-between mb-8">
          <div>
            <div className="text-lg font-semibold border-b border-gray-800 pb-1 mb-2">{invoice.partner?.name} 御中</div>
            <div className="text-gray-500 mt-4">請求書番号: {invoice.invoiceNumber}</div>
            <div className="text-gray-500">発行日: {formatDate(invoice.issueDate)}</div>
            {invoice.dueDate && <div className="text-gray-500">支払期限: {formatDate(invoice.dueDate)}</div>}
          </div>
          <div className="text-right">
            <div className="font-semibold">{issuer.name}</div>
            {issuer.representativeName && <div className="text-gray-500">{issuer.representativeName}</div>}
            {issuer.address && <div className="text-gray-500">{issuer.address}</div>}
            {issuer.invoiceRegistrationNumber && <div className="text-gray-500">登録番号: {issuer.invoiceRegistrationNumber}</div>}
          </div>
        </div>

        <div className="bg-brand-50 border border-brand-100 rounded-lg px-5 py-4 mb-8 flex justify-between items-center">
          <span className="font-semibold text-brand-800">御請求金額</span>
          <span className="text-2xl font-bold text-brand-800">{formatYen(invoice.total)}</span>
        </div>

        <table className="w-full mb-8">
          <thead>
            <tr className="border-b-2 border-gray-800 text-left text-xs text-gray-500">
              <th className="py-2 font-normal">品目</th>
              <th className="py-2 font-normal text-right w-16">数量</th>
              <th className="py-2 font-normal text-right w-28">単価</th>
              <th className="py-2 font-normal text-right w-16">税率</th>
              <th className="py-2 font-normal text-right w-32">金額</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="py-2">{it.description}{invoice.taxBreakdown?.some(group=>group.isReducedRate && group.lineNumbers.includes(it.lineNumber ?? i+1)) ? ' ※' : ''}</td>
                <td className="py-2 text-right tabular-nums">{it.quantity}</td>
                <td className="py-2 text-right tabular-nums">{formatYen(it.unitPrice)}</td>
                <td className="py-2 text-right">{invoice.taxBreakdown?.find(group=>group.lineNumbers.includes(it.lineNumber ?? i+1))?.rate !== undefined ? `${Math.round(invoice.taxBreakdown.find(group=>group.lineNumbers.includes(it.lineNumber ?? i+1))!.rate*100)}%` : '—'}</td>
                <td className="py-2 text-right tabular-nums">{formatYen(it.amount ?? it.quantity * it.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {invoice.taxBreakdown?.some(group=>group.isReducedRate) && <p className="text-xs text-gray-500 mb-4">※ 軽減税率対象</p>}
        {invoice.taxBreakdown && <div className="mb-4 space-y-1 text-xs text-right text-gray-600">
          {invoice.taxBreakdown.map(group=><div key={group.rate}>{Math.round(group.rate*100)}%対象（税抜）: {formatYen(group.subtotal)} ／ 消費税: {formatYen(group.taxAmount)}</div>)}
        </div>}

        <div className="flex justify-end mb-8">
          <div className="w-56 space-y-1.5">
            <div className="flex justify-between text-gray-500">
              <span>小計</span>
              <span className="tabular-nums">{formatYen(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>消費税</span>
              <span className="tabular-nums">{formatYen(invoice.taxAmount)}</span>
            </div>
            <div className="flex justify-between font-bold border-t border-gray-300 pt-1.5">
              <span>合計</span>
              <span className="tabular-nums">{formatYen(invoice.total)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="border-t border-gray-200 pt-4 text-gray-500 whitespace-pre-wrap">
            <div className="font-medium text-gray-700 mb-1">備考</div>
            {invoice.notes}
          </div>
        )}
      </div>
    </div>
  );
}
