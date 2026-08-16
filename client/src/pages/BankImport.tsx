import { useEffect, useRef, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, Ban } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { api, ApiError } from "../lib/api";
import { formatDate, formatYen } from "../lib/format";
import type { Account, BankImportBatch, BankTransactionRow } from "../lib/types";
import { AccountSelect } from "../components/AccountSelect";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import { labelClass } from "../lib/formStyles";

export default function BankImport() {
  const { currentBusiness } = useBusiness();
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [batches, setBatches] = useState<BankImportBatch[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [rows, setRows] = useState<BankTransactionRow[]>([]);
  const [counterparts, setCounterparts] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadBatches = () => {
    if (!currentBusiness) return;
    api.listImportBatches(currentBusiness.id).then(setBatches);
  };

  useEffect(() => {
    if (!currentBusiness) return;
    api.listAccounts(currentBusiness.id).then((accs) => {
      setAccounts(accs);
      const cash = accs.find((a) => a.code === "1030");
      if (cash) setBankAccountId(cash.id);
    });
    loadBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBusiness]);

  const loadRows = (batchId: string) => {
    if (!currentBusiness) return;
    api.getBatchRows(currentBusiness.id, batchId).then((res) => {
      setRows(res.rows);
      setActiveBatchId(batchId);
    });
  };

  if (!currentBusiness) return null;

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("CSVファイルを選択してください");
      return;
    }
    if (!bankAccountId) {
      toast.error("取込先の口座(勘定科目)を選択してください");
      return;
    }
    setUploading(true);
    try {
      const batch = await api.uploadBankCsv(currentBusiness.id, bankAccountId, file);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success(`${file.name} を取り込みました`);
      loadBatches();
      loadRows(batch.id);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "取込に失敗しました");
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async (rowId: string) => {
    const row = rows.find((r) => r.id === rowId);
    const counterpartAccountId = counterparts[rowId] ?? row?.suggestedAccountId ?? "";
    if (!counterpartAccountId) {
      toast.error("相手勘定科目を選択してください");
      return;
    }
    try {
      await api.confirmBankRow(currentBusiness.id, rowId, counterpartAccountId);
      toast.success("仕訳を作成しました");
      if (activeBatchId) loadRows(activeBatchId);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "仕訳計上に失敗しました");
    }
  };

  const handleIgnore = async (rowId: string) => {
    await api.ignoreBankRow(currentBusiness.id, rowId);
    if (activeBatchId) loadRows(activeBatchId);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="取引明細(CSV取込)" />

      <Card className="p-5 space-y-3">
        <div className="text-sm text-gray-500">
          銀行やクレジットカードの明細CSVをアップロードすると、取引を自動的に読み取り、仕訳の候補を提示します。
          対応形式: 「日付, 摘要, 金額」または「日付, 摘要, 出金金額, 入金金額, 残高」を含むCSV。
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className={labelClass}>取込先口座</label>
            <AccountSelect accounts={accounts.filter((a) => a.category === "ASSET")} value={bankAccountId} onChange={setBankAccountId} className="w-48" />
          </div>
          <div>
            <label className={labelClass}>CSVファイル</label>
            <input ref={fileInputRef} type="file" accept=".csv" className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 file:text-sm hover:file:bg-brand-100" />
          </div>
          <Button icon={<Upload size={14} />} loading={uploading} onClick={handleUpload}>
            取込
          </Button>
        </div>
      </Card>

      <div className="flex gap-4">
        <Card className="w-64 shrink-0 overflow-hidden self-start">
          <CardHeader title="取込履歴" />
          {batches.length === 0 ? (
            <div className="p-4 text-sm text-gray-400">まだありません</div>
          ) : (
            <ul>
              {batches.map((b) => (
                <li key={b.id}>
                  <button
                    className={`w-full text-left px-4 py-2.5 text-sm border-t border-gray-100 hover:bg-gray-50 ${activeBatchId === b.id ? "bg-brand-50" : ""}`}
                    onClick={() => loadRows(b.id)}
                  >
                    <div className="truncate font-medium text-gray-700">{b.fileName}</div>
                    <div className="text-xs text-gray-400">{b._count?.rows ?? 0}件</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex-1 overflow-hidden">
          {!activeBatchId ? (
            <EmptyState icon={<FileSpreadsheet size={40} />} title="取込データを選択してください" description="左の履歴からファイルを選ぶと明細が表示されます" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-gray-400 text-xs">
                <tr>
                  <th className="px-4 py-2.5 font-normal w-28">日付</th>
                  <th className="px-4 py-2.5 font-normal">摘要</th>
                  <th className="px-4 py-2.5 font-normal text-right w-28">金額</th>
                  <th className="px-4 py-2.5 font-normal w-48">相手科目</th>
                  <th className="px-4 py-2.5 font-normal w-24">状態</th>
                  <th className="px-4 py-2.5 font-normal w-32"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-gray-500">{formatDate(r.date)}</td>
                    <td className="px-4 py-2">{r.description}</td>
                    <td className={`px-4 py-2 text-right tabular-nums font-medium ${r.amount < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {formatYen(r.amount)}
                    </td>
                    <td className="px-4 py-2">
                      {r.status === "UNMATCHED" ? (
                        <AccountSelect
                          accounts={accounts}
                          value={counterparts[r.id] ?? r.suggestedAccountId ?? ""}
                          onChange={(v) => setCounterparts((prev) => ({ ...prev, [r.id]: v }))}
                          className="w-full"
                        />
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {r.status === "MATCHED" ? (
                        <Badge tone="green">計上済み</Badge>
                      ) : r.status === "IGNORED" ? (
                        <Badge>無視</Badge>
                      ) : (
                        <Badge tone="yellow">未処理</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {r.status === "UNMATCHED" && (
                        <div className="flex items-center justify-end gap-2">
                          <button className="text-gray-400 hover:text-brand-600" title="仕訳作成" onClick={() => handleConfirm(r.id)}>
                            <CheckCircle2 size={16} />
                          </button>
                          <button className="text-gray-400 hover:text-gray-600" title="無視" onClick={() => handleIgnore(r.id)}>
                            <Ban size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
