import { useState } from "react";
import { ArrowRight, Check, BookText, FileText, TrendingUp } from "lucide-react";

const MODES = [
  { key: "ledger", label: "記帳", icon: BookText, title: "今日の取引", caption: "入力から確認まで、ひとつの画面で。" },
  { key: "invoice", label: "請求書", icon: FileText, title: "請求書の管理", caption: "請求の状態と金額を見渡す。" },
  { key: "report", label: "レポート", icon: TrendingUp, title: "経営の現在地", caption: "毎月の変化を、数字から読み取る。" },
] as const;
export default function ProductDemo() {
  const [mode, setMode] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const current = MODES[mode];
  return <div className="product-demo">
    <div className="demo-chrome"><span className="demo-logo">keirio</span><span>操作デモ · サンプルデータ</span><span className="demo-avatar">S</span></div>
    <div className="demo-tabs" role="tablist" aria-label="操作デモの画面">{MODES.map((item, index) => <button key={item.key} type="button" role="tab" aria-selected={index === mode} aria-controls="demo-panel" id={"demo-tab-" + index} onClick={() => setMode(index)}><item.icon size={15} aria-hidden="true" />{item.label}</button>)}</div>
    <div className="demo-content" id="demo-panel" role="tabpanel" aria-labelledby={"demo-tab-" + mode}>
      <div className="demo-heading"><div><span>SUZU STUDIO</span><h2>{current.title}</h2></div><span className="demo-period">2026年10月</span></div>
      {mode === 0 && <><div className="demo-table"><div className="demo-row demo-table-head"><span>日付</span><span>取引内容</span><span>金額</span></div>{[["10/08", "売上の入金", "128,000"], ["10/07", "事務用品の購入", "18,420"], ["10/06", "通信費の支払い", "7,980"]].map(row => <div key={row[0]} className="demo-row"><span>{row[0]}</span><span>{row[1]}</span><strong>¥{row[2]}</strong></div>)}</div><div className="demo-check"><span><Check size={15} />貸借が一致しています</span><button type="button" onClick={() => setConfirmed(!confirmed)}>{confirmed ? "確認を取り消す" : "確認済みにする"}<ArrowRight size={14} /></button></div><p className="demo-feedback" role="status">{confirmed ? "サンプルの取引を確認済みにしました。" : "確認ボタンを押して、操作を試せます。"}</p></>}
      {mode === 1 && <><div className="demo-total"><span>請求合計（サンプル）</span><strong>¥480,000</strong></div><div className="demo-table">{[["デザイン制作", "入金済み", "240,000"], ["サイト更新", "送付済み", "180,000"], ["保守サポート", "下書き", "60,000"]].map(row => <div key={row[0]} className="demo-row invoice-row"><span>{row[0]}</span><span className="demo-pill">{row[1]}</span><strong>¥{row[2]}</strong></div>)}</div></>}
      {mode === 2 && <><div className="demo-total"><span>10月の売上（サンプル）</span><strong>¥1,280,000</strong></div><div className="demo-chart" role="img" aria-label="サンプル売上推移: 5月60万円、6月78万円、7月68万円、8月95万円、9月104万円、10月128万円">{[60,78,68,95,104,128].map((value,index) => <div key={index}><div style={{ height: value }} /><span>{index+5}月</span></div>)}</div></>}
      <p className="demo-caption">{current.caption}</p>
    </div>
  </div>;
}

const NEEDS = [
  { title: "入力の時間を減らしたい", lead: "明細取込 ＋ 仕訳テンプレート", description: "銀行・カードのCSVを取り込み、定型取引にはテンプレートを。繰り返す入力を短くします。" },
  { title: "お金の流れを把握したい", lead: "資金繰り表 ＋ 取引先別残高", description: "現預金の推移と取引先ごとの残高を確認。入金・支払いの見通しを整理できます。" },
  { title: "月末・決算を整えたい", lead: "月次タスク ＋ 決算チェック", description: "毎月の確認をチェックリストにして、期末は決算処理へ。確認漏れを減らせます。" },
];
export function FeatureFinder() {
  const [selected, setSelected] = useState(0);
  return <section className="feature-finder studio-container" aria-labelledby="finder-title">
    <div className="studio-section-label">あなたに合う使い方</div>
    <div className="finder-layout"><div><h2 id="finder-title">今、整えたいことは？</h2><p>近いものを選ぶと、おすすめの機能がわかります。</p><div className="finder-options" role="group" aria-label="解決したい課題">{NEEDS.map((need,index) => <button type="button" key={need.title} aria-pressed={selected === index} onClick={() => setSelected(index)}><span className="finder-dot">{selected === index && <Check size={12} />}</span>{need.title}<ArrowRight size={16} /></button>)}</div></div><div className="finder-result" aria-live="polite"><span>おすすめの組み合わせ</span><h3>{NEEDS[selected].lead}</h3><p>{NEEDS[selected].description}</p><a href="#features">機能を詳しく見る <ArrowRight size={16} /></a></div></div>
  </section>;
}
