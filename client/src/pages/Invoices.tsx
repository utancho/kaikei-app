import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, FileText, Pencil, Trash2, Send, Wallet } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api, ApiError } from "../lib/api";
import { formatDate, formatYen, toInputDate } from "../lib/format";
import type { Account, Invoice } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { TableSkeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { useConfirm } from "../components/ui/ConfirmDialog";
import { Modal } from "../components/ui/Modal";
import { AccountSelect } from "../components/AccountSelect";
import { inputClass, labelClass } from "../lib/formStyles";

const STATUS_META: Record<Invoice["status"], { label: string; tone: "gray" | "green" | "blue" | "red" }> = {
  DRAFT: { label: "下書き", tone: "gray" },
  SENT: { label: "計上済み", tone: "blue" },
  PAID: { label: "入金済み", tone: "green" },
  VOID: { label: "取消", tone: "red" },
};

export default function Invoices() {
  const { currentBusiness } = useBusiness();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [paymentDate, setPaymentDate] = useState(toInputDate(new Date()));
  const [recording, setRecording] = useState(false);

  const load = () => {
    if (!currentBusiness) return;
    setLoading(true);
    Promise.all([api.listInvoices(currentBusiness.id), api.listAccounts(currentBusiness.id)])
      .then(([inv, accs]) => {
        setInvoices(inv);
        setAccounts(accs);
        const cash = accs.find((a) => a.code === "1030");
        if (cash) setPaymentAccountId(cash.id);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [currentBusiness]);

  if (!currentBusiness) return null;

  const handlePost = async (inv: Invoice) => {
    const ok = await confirm({
      title: "仕訳に計上しますか?",
      description: `「${inv.invoiceNumber}」を売掛金/売上高として仕訳帳に記帳します。`,
      confirmLabel: "計上する",
    });
    if (!ok) return;
    try {
      await api.postInvoiceToJournal(currentBusiness.id, inv.id);
      toast.success("仕訳に計上しました");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "計上に失敗しました");
    }
  };

  const handleDelete = async (inv: Invoice) => {
    const ok = await confirm({ title: `「${inv.invoiceNumber}」を削除しますか?`, danger: true, confirmLabel: "削除する" });
    if (!ok) return;
    try {
      await api.deleteInvoice(currentBusiness.id, inv.id);
      toast.success("請求書を削除しました");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "削除に失敗しました");
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentTarget || !paymentAccountId) {
      toast.error("入金口座を選択してください");
      return;
    }
    setRecording(true);
    try {
      await api.recordInvoicePayment(currentBusiness.id, paymentTarget.id, paymentAccountId, paymentDate);
      toast.success("入金を記録し、売掛金を消し込みました");
      setPaymentTarget(null);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "入金記録に失敗しました");
    } finally {
      setRecording(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="請求書"
        action={
          <Button icon={<Plus size={16} />} onClick={() => navigate("/invoices/new")}>
            請求書を作成
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={<FileText size={40} />}
            title="請求書がまだありません"
            action={
              <Button size="sm" icon={<Plus size={14} />} onClick={() => navigate("/invoices/new")}>
                請求書を作成
              </Button>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 text-xs">
              <tr>
                <th className="px-5 py-2.5 font-normal">請求書番号</th>
                <th className="px-5 py-2.5 font-normal">取引先</th>
                <th className="px-5 py-2.5 font-normal">発行日</th>
                <th className="px-5 py-2.5 font-normal text-right">金額(税込)</th>
                <th className="px-5 py-2.5 font-normal">状態</th>
                <th className="px-5 py-2.5 font-normal w-36"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const meta = STATUS_META[inv.status];
                return (
                  <tr key={inv.id} className="border-t border-gray-100 hover:bg-gray-50 group">
                    <td className="px-5 py-2.5 font-medium text-gray-800">{inv.invoiceNumber}</td>
                    <td className="px-5 py-2.5">{inv.partner?.name}</td>
                    <td className="px-5 py-2.5 text-gray-500">{formatDate(inv.issueDate)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums font-medium">{formatYen(inv.total)}</td>
                    <td className="px-5 py-2.5">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {inv.status === "DRAFT" && (
                          <button className="text-gray-400 hover:text-brand-600" title="仕訳計上" onClick={() => handlePost(inv)}>
                            <Send size={15} />
                          </button>
                        )}
                        {inv.status === "SENT" && (
                          <button
                            className="text-gray-400 hover:text-brand-600"
                            title="入金を記録"
                            onClick={() => {
                              setPaymentTarget(inv);
                              setPaymentDate(toInputDate(new Date()));
                            }}
                          >
                            <Wallet size={15} />
                          </button>
                        )}
                        <Link className="text-gray-400 hover:text-brand-600" to={`/invoices/${inv.id}`}>
                          <Pencil size={15} />
                        </Link>
                        <button className="text-gray-400 hover:text-red-500" onClick={() => handleDelete(inv)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {paymentTarget && (
        <Modal title="入金を記録" onClose={() => setPaymentTarget(null)}>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              「{paymentTarget.invoiceNumber}」({formatYen(paymentTarget.total)})の入金を記録します。売掛金が自動的に消し込まれます。
            </p>
            <div>
              <label className={labelClass}>入金口座</label>
              <AccountSelect
                accounts={accounts.filter((a) => a.category === "ASSET")}
                value={paymentAccountId}
                onChange={setPaymentAccountId}
                className="w-full"
              />
            </div>
            <div>
              <label className={labelClass}>入金日</label>
              <input type="date" className={`${inputClass} w-full`} value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setPaymentTarget(null)}>
                キャンセル
              </Button>
              <Button loading={recording} onClick={handleRecordPayment}>
                記録する
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
