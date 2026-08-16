import { Link } from "react-router-dom";
import {
  Wallet,
  BookText,
  Upload,
  FileText,
  Package,
  FileBadge,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Download,
  Apple,
  MonitorDown,
} from "lucide-react";
import { Button } from "../components/ui/Button";

const RELEASES_BASE = "https://github.com/utancho/kaikei-releases/releases/latest/download";

const FEATURES = [
  {
    icon: BookText,
    title: "かんたん複式簿記",
    description: "借方・貸方のバランスをリアルタイムで検証。簿記の知識がなくても迷わず仕訳できます。",
  },
  {
    icon: Upload,
    title: "明細を自動で取込",
    description: "銀行・カードのCSV明細をアップロードするだけで、勘定科目を自動で提案し仕訳化します。",
  },
  {
    icon: FileText,
    title: "請求書もそのまま記帳",
    description: "作成した請求書はワンクリックで売上仕訳に。入金があれば消込までこの画面で完結。",
  },
  {
    icon: Package,
    title: "固定資産・減価償却",
    description: "資産を登録するだけで、定額法・定率法の減価償却費を自動計算し、期末に仕訳計上。",
  },
  {
    icon: FileBadge,
    title: "青色申告決算書に対応",
    description: "収支から控除額まで自動集計。確定申告の直前でも慌てず準備できます。",
  },
  {
    icon: BarChart3,
    title: "経営状況がひと目でわかる",
    description: "現預金推移・月次損益・取引先別残高をグラフとレポートでいつでも確認。",
  },
];

const FAQS = [
  {
    q: "簿記の知識がなくても使えますか?",
    a: "はい。勘定科目は日本語でグループ表示され、貸借のバランスは自動でチェックされるので、迷わず入力できます。",
  },
  {
    q: "無料期間はありますか?",
    a: "はい、登録から14日間は無料ですべての機能をお試しいただけます。期間終了後は自動で有料プランに切り替わります。",
  },
  {
    q: "個人事業主・法人どちらでも使えますか?",
    a: "どちらにも対応しています。事業形態に応じて勘定科目や決算書のフォーマットが自動で切り替わります。",
  },
  {
    q: "解約はいつでもできますか?",
    a: "はい。設定画面からいつでも解約でき、違約金などは発生しません。",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Wallet size={18} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">Kaikei</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">
              ログイン
            </Link>
            <Link to="/signup">
              <Button size="sm">無料で始める</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-1.5 bg-brand-50 text-brand-700 text-xs font-medium px-3 py-1 rounded-full mb-6">
          個人事業主・法人向けクラウド会計
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-tight mb-6">
          記帳の悩みを、
          <br />
          <span className="text-brand-600">最短ルート</span>で終わらせる。
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10">
          仕訳入力から請求書、銀行明細の取込、青色申告決算書まで。日々の記帳をひとつの画面でシンプルに。
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/signup">
            <Button size="md" icon={<ArrowRight size={16} />} className="px-6 py-3 text-base">
              14日間無料で試す
            </Button>
          </Link>
          <Link to="/login">
            <Button variant="secondary" size="md" className="px-6 py-3 text-base">
              ログイン
            </Button>
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-4">クレジットカード登録は無料期間終了前でOK</p>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 sm:p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">デスクトップアプリもあります</h2>
          <p className="text-sm text-gray-500 mb-6">ブラウザ不要。Mac / Windows にインストールしてすぐ使えます。</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href={`${RELEASES_BASE}/Kaikei.dmg`}>
              <Button variant="secondary" icon={<Apple size={16} />} className="px-5 py-2.5">
                Macでダウンロード
              </Button>
            </a>
            <a href={`${RELEASES_BASE}/Kaikei-Setup.exe`}>
              <Button variant="secondary" icon={<MonitorDown size={16} />} className="px-5 py-2.5">
                Windowsでダウンロード
              </Button>
            </a>
          </div>
          <p className="text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
            <Download size={12} />
            初回起動時、未署名アプリの警告が表示される場合があります(詳細から実行できます)
          </p>
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">記帳に必要な機能を、ぜんぶひとつに</h2>
          <p className="text-center text-gray-500 mb-12">日々の入力から決算書の準備まで、これひとつで完結します</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center mb-4">
                  <f.icon size={20} className="text-brand-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1.5">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-2xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">シンプルな料金プラン</h2>
        <p className="text-center text-gray-500 mb-10">複雑な料金体系はありません。すべての機能が使えて月額ひとつだけ。</p>
        <div className="bg-white border-2 border-brand-500 rounded-2xl p-8 shadow-sm">
          <div className="text-center mb-6">
            <div className="text-sm text-gray-500 mb-1">スタンダードプラン</div>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold text-gray-900">¥1,980</span>
              <span className="text-gray-500">/ 月(税込)</span>
            </div>
            <div className="text-xs text-brand-600 mt-2">初回14日間は無料</div>
          </div>
          <ul className="space-y-2.5 mb-8">
            {[
              "事業者数の制限なし",
              "仕訳・請求書・帳票すべての機能",
              "銀行/カード明細の自動取込",
              "固定資産台帳・青色申告決算書",
              "メールでのサポート",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle2 size={16} className="text-brand-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <Link to="/signup" className="block">
            <Button className="w-full justify-center py-3 text-base">14日間無料で始める</Button>
          </Link>
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">よくあるご質問</h2>
          <div className="space-y-6">
            {FAQS.map((f) => (
              <div key={f.q}>
                <h3 className="font-semibold text-gray-900 mb-1.5">{f.q}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-sm text-gray-400">
          <span>&copy; {new Date().getFullYear()} Kaikei</span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-brand-600 flex items-center justify-center">
              <Wallet size={14} className="text-white" />
            </div>
            <span className="font-medium text-gray-600">Kaikei</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
