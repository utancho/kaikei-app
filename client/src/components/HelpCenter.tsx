import { useState } from "react";
import { Search, Mail, ArrowUpRight } from "lucide-react";
const QUESTIONS = [
  ["無料期間と支払いはどうなりますか？", "アカウント登録後、Stripeの画面でプランを申し込むと14日間の無料期間が始まります。無料期間終了後は月額1,980円（税込）で自動更新されます。課金開始日は申込画面でご確認ください。"],
  ["解約はどこからできますか？", "ログイン後の「設定」から「お支払い方法・プランを管理」を開き、Stripeの管理画面で解約できます。次回更新前に手続きをすると、以降の更新分の請求は発生しません。"],
  ["スマートフォンでも使えますか？", "ブラウザから利用できます。幅の広い帳票は横スクロールして確認してください。デスクトップアプリはMac・Windows向けです。"],
  ["会計データを書き出せますか？", "仕訳帳や対応するレポートのCSV出力をご利用ください。月次タスクもCSVでダウンロードできます。"],
  ["月次タスクは別の端末と同期されますか？", "月次タスクはこのブラウザに、事業者・対象月ごとに保存されます。端末間の同期はありません。必要に応じてCSVを保存してください。"],
  ["レシートの画像はどう扱われますか？", "読取操作時に画像をCloudflare Workers AIへ送信して解析します。不要な個人情報は送信前に除いてください。詳細はプライバシーポリシーをご覧ください。"],
];
export default function HelpCenter() {
  const [query, setQuery] = useState("");
  const filtered = QUESTIONS.filter(([question,answer]) => (question + answer).includes(query.trim()));
  return <section className="help-center studio-container" id="help" aria-labelledby="help-title">
    <div className="help-heading"><div><p className="studio-section-label">ご利用ガイド</p><h2 id="help-title">迷ったときも、ここから。</h2></div><label className="help-search"><Search size={16} aria-hidden="true" /><span className="sr-only">よくある質問を検索</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="支払い、解約、データ保存…" /></label></div>
    <p className="sr-only" role="status">{filtered.length}件の質問</p>
    <div className="help-questions">{filtered.map(([question,answer])=><details key={question}><summary>{question}<span aria-hidden="true">＋</span></summary><p>{answer}</p></details>)}</div>
    {filtered.length === 0 && <p className="help-empty">該当する質問がありません。検索語を変えるか、メールでお問い合わせください。</p>}
    <div className="help-support"><div><Mail size={18} /><span>解決しない場合は、メールでご相談ください。</span></div><a href="mailto:suzukishion522@icloud.com?subject=keirioへのお問い合わせ">お問い合わせ <ArrowUpRight size={16} /></a></div>
  </section>;
}
