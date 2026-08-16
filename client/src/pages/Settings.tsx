import { useEffect, useState } from "react";
import { Plus, Building2, CreditCard, Users, Trash2, Mail } from "lucide-react";
import { useBusiness } from "../context/BusinessContext";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import type { BusinessType, BusinessMembersResponse } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useToast } from "../components/ui/Toast";
import { useConfirm } from "../components/ui/ConfirmDialog";
import { inputClass, selectClass, labelClass } from "../lib/formStyles";

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  TRIALING: "無料お試し期間中",
  ACTIVE: "利用中",
  PAST_DUE: "お支払いに問題があります",
  CANCELED: "解約済み",
  NONE: "未登録",
};

export default function Settings() {
  const { currentBusiness, businesses, refresh, setCurrentBusinessId } = useBusiness();
  const { user, subscription } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [portalLoading, setPortalLoading] = useState(false);

  const [members, setMembers] = useState<BusinessMembersResponse | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const loadMembers = () => {
    if (!currentBusiness) return;
    api.listMembers(currentBusiness.id).then(setMembers);
  };

  useEffect(loadMembers, [currentBusiness]);

  const handleInvite = async () => {
    if (!currentBusiness || !inviteEmail) return;
    setInviting(true);
    try {
      await api.inviteMember(currentBusiness.id, inviteEmail);
      toast.success(`${inviteEmail} を招待しました`);
      setInviteEmail("");
      loadMembers();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "招待に失敗しました");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string, email: string) => {
    if (!currentBusiness) return;
    const ok = await confirm({ title: `${email} をメンバーから削除しますか?`, danger: true, confirmLabel: "削除する" });
    if (!ok) return;
    try {
      await api.removeMember(currentBusiness.id, memberId);
      toast.success("メンバーを削除しました");
      loadMembers();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "削除に失敗しました");
    }
  };

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const { url } = await api.openBillingPortal();
      if (url) window.location.href = url;
      else toast.error("課金ポータルを開けませんでした");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "課金ポータルを開けませんでした");
    } finally {
      setPortalLoading(false);
    }
  };

  const [name, setName] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [taxationType, setTaxationType] = useState("EXEMPT");
  const [simplifiedTaxCategory, setSimplifiedTaxCategory] = useState(5);
  const [blueReturnDeduction, setBlueReturnDeduction] = useState(0);
  const [saving, setSaving] = useState(false);
  const [taxCategories, setTaxCategories] = useState<{ id: number; label: string; rate: number }[]>([]);

  useEffect(() => {
    api.getSimplifiedTaxCategories().then(setTaxCategories);
  }, []);

  useEffect(() => {
    if (currentBusiness) {
      setName(currentBusiness.name);
      setRepresentativeName(currentBusiness.representativeName ?? "");
      setTaxationType(currentBusiness.taxationType);
      setSimplifiedTaxCategory(currentBusiness.simplifiedTaxCategory);
      setBlueReturnDeduction(currentBusiness.blueReturnDeduction);
    }
  }, [currentBusiness]);

  const handleSaveExisting = async () => {
    if (!currentBusiness) return;
    setSaving(true);
    try {
      await api.updateBusiness(currentBusiness.id, { name, representativeName, taxationType, simplifiedTaxCategory, blueReturnDeduction });
      await refresh();
      toast.success("設定を保存しました");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState({
    name: "",
    type: "INDIVIDUAL" as BusinessType,
    representativeName: "",
    fiscalYearStartMonth: 4,
    taxationType: "EXEMPT",
  });
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newForm.name) {
      toast.error("屋号・会社名を入力してください");
      return;
    }
    setCreating(true);
    try {
      const created = await api.createBusiness(newForm);
      await refresh();
      setCurrentBusinessId(created.id);
      setShowNewForm(false);
      toast.success(`「${newForm.name}」を作成しました`);
      setNewForm({ name: "", type: "INDIVIDUAL", representativeName: "", fiscalYearStartMonth: 4, taxationType: "EXEMPT" });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "作成に失敗しました");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader title="設定" />

      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard size={16} className="text-gray-400" />
          <h2 className="font-semibold text-sm text-gray-800">アカウント・お支払い</h2>
        </div>
        <div className="text-sm text-gray-600">{user?.email}</div>
        <div className="text-sm text-gray-500">
          プラン状況: <span className="font-medium text-gray-800">{SUBSCRIPTION_STATUS_LABELS[subscription?.status ?? "NONE"]}</span>
        </div>
        <Button variant="secondary" size="sm" loading={portalLoading} onClick={handleOpenPortal}>
          お支払い方法・プランを管理
        </Button>
      </Card>

      {currentBusiness && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={16} className="text-gray-400" />
            <h2 className="font-semibold text-sm text-gray-800">事業者情報</h2>
          </div>
          <div>
            <label className={labelClass}>屋号・会社名</label>
            <input className={`${inputClass} w-full`} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>代表者名</label>
            <input className={`${inputClass} w-full`} value={representativeName} onChange={(e) => setRepresentativeName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>種別</label>
              <input className={`${inputClass} w-full bg-gray-50 text-gray-400`} value={currentBusiness.type === "INDIVIDUAL" ? "個人事業主" : "法人"} disabled />
            </div>
            <div>
              <label className={labelClass}>会計期間開始月</label>
              <input className={`${inputClass} w-full bg-gray-50 text-gray-400`} value={`${currentBusiness.fiscalYearStartMonth}月`} disabled />
            </div>
          </div>
          <div>
            <label className={labelClass}>消費税課税区分</label>
            <select className={`${selectClass} w-full`} value={taxationType} onChange={(e) => setTaxationType(e.target.value)}>
              <option value="EXEMPT">免税事業者</option>
              <option value="GENERAL">本則課税</option>
              <option value="SIMPLIFIED">簡易課税</option>
            </select>
          </div>
          {taxationType === "SIMPLIFIED" && (
            <div>
              <label className={labelClass}>簡易課税の事業区分</label>
              <select
                className={`${selectClass} w-full`}
                value={simplifiedTaxCategory}
                onChange={(e) => setSimplifiedTaxCategory(Number(e.target.value))}
              >
                {taxCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}(みなし仕入率{(c.rate * 100).toFixed(0)}%)
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">「消費税申告書」画面のみなし仕入税額の計算に使われます。</p>
            </div>
          )}
          {currentBusiness.type === "INDIVIDUAL" && (
            <div>
              <label className={labelClass}>青色申告特別控除額</label>
              <select className={`${selectClass} w-full`} value={blueReturnDeduction} onChange={(e) => setBlueReturnDeduction(Number(e.target.value))}>
                <option value={0}>白色申告(控除なし)</option>
                <option value={100000}>10万円(青色申告特別控除)</option>
                <option value={550000}>55万円(e-Tax未使用)</option>
                <option value={650000}>65万円(e-Tax・電子帳簿保存)</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">「青色申告決算書」画面の控除額計算に反映されます。</p>
            </div>
          )}
          <Button loading={saving} onClick={handleSaveExisting}>
            保存
          </Button>
        </Card>
      )}

      {currentBusiness && members && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Users size={16} className="text-gray-400" />
            <h2 className="font-semibold text-sm text-gray-800">メンバー</h2>
          </div>

          <div className="divide-y divide-gray-100">
            <div className="flex items-center justify-between py-2">
              <div className="text-sm text-gray-700">
                {members.owner?.email}
                <span className="text-xs text-gray-400 ml-1">{members.owner?.name}</span>
              </div>
              <Badge tone="blue">オーナー</Badge>
            </div>
            {members.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2">
                <div className="text-sm text-gray-700">{m.email}</div>
                <div className="flex items-center gap-2">
                  <Badge tone={m.status === "ACTIVE" ? "green" : "yellow"}>{m.status === "ACTIVE" ? "参加済み" : "招待中"}</Badge>
                  {currentBusiness.isOwner && (
                    <button className="text-gray-400 hover:text-red-600" onClick={() => handleRemoveMember(m.id, m.email)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {members.members.length === 0 && <div className="py-2 text-sm text-gray-400">まだメンバーはいません</div>}
          </div>

          {currentBusiness.isOwner && (
            <div className="flex items-center gap-2 pt-2">
              <div className="relative flex-1">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className={`${inputClass} pl-8 w-full`}
                  placeholder="招待するメールアドレス"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <Button size="sm" loading={inviting} onClick={handleInvite} disabled={!inviteEmail}>
                招待
              </Button>
            </div>
          )}
          <p className="text-xs text-gray-400">
            招待されたメンバーはオーナーの契約プランで、この事業者の記帳・請求書・レポート機能を利用できます(事業者設定の変更・メンバー管理はオーナーのみ)。
          </p>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader
          title="事業者を追加"
          subtitle="複数の事業・会社を切り替えて管理できます"
          action={
            <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={() => setShowNewForm((v) => !v)}>
              {showNewForm ? "閉じる" : "追加"}
            </Button>
          }
        />
        {showNewForm && (
          <div className="p-5 space-y-3">
            <div>
              <label className={labelClass}>屋号・会社名</label>
              <input className={`${inputClass} w-full`} value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>種別</label>
                <select className={`${selectClass} w-full`} value={newForm.type} onChange={(e) => setNewForm({ ...newForm, type: e.target.value as BusinessType })}>
                  <option value="INDIVIDUAL">個人事業主</option>
                  <option value="CORPORATE">法人</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>代表者名</label>
                <input className={`${inputClass} w-full`} value={newForm.representativeName} onChange={(e) => setNewForm({ ...newForm, representativeName: e.target.value })} />
              </div>
            </div>
            {newForm.type === "CORPORATE" && (
              <div>
                <label className={labelClass}>会計期間開始月</label>
                <select
                  className={selectClass}
                  value={newForm.fiscalYearStartMonth}
                  onChange={(e) => setNewForm({ ...newForm, fiscalYearStartMonth: Number(e.target.value) })}
                >
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1}月
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className={labelClass}>消費税課税区分</label>
              <select className={`${selectClass} w-full`} value={newForm.taxationType} onChange={(e) => setNewForm({ ...newForm, taxationType: e.target.value })}>
                <option value="EXEMPT">免税事業者</option>
                <option value="GENERAL">本則課税</option>
                <option value="SIMPLIFIED">簡易課税</option>
              </select>
            </div>
            <Button loading={creating} onClick={handleCreate}>
              作成
            </Button>
          </div>
        )}
        {!showNewForm && businesses.length > 0 && (
          <div className="divide-y divide-gray-100">
            {businesses.map((b) => (
              <div key={b.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{b.name}</span>
                <span className="text-xs text-gray-400">{b.type === "INDIVIDUAL" ? "個人事業主" : "法人"}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
