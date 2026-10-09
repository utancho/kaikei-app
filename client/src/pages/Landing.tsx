import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUpRight, ArrowRight, Apple, Monitor, Pause, Play } from "lucide-react";
import FeatureCarousel from "../components/FeatureCarousel";
import { MarketingFooter, MarketingHeader } from "../components/MarketingChrome";
import { Scene } from "../components/StructureFlowScene";
import "../studio.css";
import ProductDemo, { FeatureFinder } from "../components/ProductDemo";
import "../refined.css";
import HelpCenter from "../components/HelpCenter";
import EntranceIntro from "../components/EntranceIntro";
import LaunchJournal from "../components/LaunchJournal";
import ScrollWorkflow from "../components/ScrollWorkflow";
import { useMarketingMotion } from "../hooks/useMarketingMotion";
import "../motion.css";
import { updatePageSeo } from "../lib/pageSeo";

const RELEASES = "https://github.com/utancho/kaikei-releases/releases/latest/download";
export default function Landing() {
  const [motion, setMotion] = useState(false);
  useMarketingMotion(motion);
  useEffect(() => {
    updatePageSeo("keirio | 個人事業主・小さな法人の会計ソフト","銀行CSV取込、仕訳、請求書、月次レポート、税理士共有をひとつに。プラン申込みから14日間無料。");
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    setMotion(!preference.matches);
    const update = () => setMotion(!preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  return <div className="marketing-site keirio-studio">
    <EntranceIntro />
    <div className="motion-progress" aria-hidden="true" />
    <a className="studio-skip" href="#main-content">本文へスキップ</a>
    <MarketingHeader />
    <main id="main-content">
      <section className="studio-hero">
        <div className="studio-field" aria-hidden="true">{motion && <Scene />}</div>
        <div className="studio-scrim" aria-hidden="true" />
        <div className="studio-container studio-hero-content">
          <div className="studio-kicker"><span>keirio / 会計のワークスペース</span><span>記帳・請求・決算</span></div>
          <div className="refined-hero-grid"><div className="refined-hero-copy"><p className="refined-eyebrow">個人事業主・小さな法人のための会計</p><h1>経理に追われず、<br /><span>経営と向き合う。</span></h1>
          <div className="studio-hero-bottom">
            <p>明細を取り込み、仕訳を確認。<br />請求書も、月末のレポートも、同じ場所で。</p>
            <div className="studio-hero-actions"><Link className="studio-cta" to="/signup">14日間、無料で試す <ArrowUpRight size={21} /></Link><a className="studio-text-link" href="#features">プロダクトを見る <ArrowDown size={17} /></a></div>
          </div>
          <div className="studio-hero-meta"><span>月額1,980円（税込）· プラン申込みから14日間無料</span><button onClick={() => setMotion(!motion)} aria-pressed={motion} aria-label={motion ? "サイトの動きを停止" : "サイトの動きを再生"}>{motion ? <Pause size={14} /> : <Play size={14} />} <span>{motion ? "動きを停止" : "動きを再生"}</span></button></div>
          </div><ProductDemo /></div>
        </div>
        <div className="studio-watermark" aria-hidden="true">keirio</div>
      </section>
      <div className="refined-benefits studio-container"><span>仕訳・請求・決算をひとつに</span><span>Mac / Windows対応</span><span>14日間すべての機能を試せる</span></div>
      <FeatureFinder />
      <section className="studio-intro studio-container">
        <div className="studio-section-label">会計の道具として</div>
        <div><h2>数字を整える。<br /><span>仕事が動き出す。</span></h2><div className="studio-intro-copy"><p>月末の入力も、請求書の管理も、決算前の確認も。別々だった作業を、ひとつのワークスペースに。</p><p>必要な情報をすぐに見つけ、取引からレポートまで自然につながる。keirioは、毎日の会計のための道具です。</p></div></div>
      </section>
      <section id="features" className="studio-features studio-container">
        <div className="studio-section-top"><span className="studio-section-label">できること</span><span className="studio-micro">操作画面のイメージ</span></div>
        <h2 className="studio-display">日々の取引から、<br />次の判断まで。</h2>
        <div className="studio-carousel"><FeatureCarousel /></div>
        <div className="studio-specs">{[["INPUT", "銀行・カード明細のCSV取込"], ["INVOICE", "請求書と売上仕訳を連携"], ["REPORT", "損益・残高・資金繰りを確認"], ["CLOSING", "固定資産・決算帳票を集計"]].map(([tag, text]) => <div key={tag}><span>{tag}</span><p>{text}</p></div>)}</div>
      </section>
      <ScrollWorkflow motion={motion} />
      <section id="pricing" className="studio-container studio-pricing"><div><div className="studio-section-label">料金プラン</div><h2 className="studio-display">明快な料金。<br />すべての機能。</h2><p>仕訳、請求書、帳票、経営レポート。<br />ひとつのプランにまとめました。</p></div><div className="studio-plan"><div className="studio-plan-top"><span>STANDARD</span><span>14日間無料</span></div><div className="studio-price">¥1,980<span>/ 月・税込</span></div><ul>{["事業者数の制限なし", "仕訳・請求書・各種帳票", "明細取込・固定資産管理", "経営レポート・決算準備"].map(item => <li key={item}><ArrowRight size={14} />{item}</li>)}</ul><Link className="studio-cta" to="/signup">無料で始める <ArrowUpRight size={21} /></Link><p className="studio-plan-note">申込画面で課金開始日・解約条件を確認できます</p></div></section>
      <LaunchJournal />
      <section className="studio-container studio-utilities"><div><div className="studio-section-label">DESKTOP</div><h2>いつものPCで。</h2><p>Mac・Windows向けアプリも利用できます。</p><div className="studio-downloads"><a href={RELEASES + "/Kaikei.dmg"}><Apple size={20} /> macOS <ArrowUpRight size={16} /></a><a href={RELEASES + "/Kaikei-Setup.exe"}><Monitor size={20} /> Windows <ArrowUpRight size={16} /></a></div><small>初回起動時に未署名アプリの警告が表示される場合があります。</small></div><div className="data-note"><div className="studio-section-label">データの扱いを、わかりやすく。</div><h2>安心して始めるために。</h2><p>認証には二要素認証を用意しています。会計データはクラウドに、月次タスクはこのブラウザに保存されます。</p><div className="data-note-links"><Link to="/legal/privacy">データの取扱い →</Link><Link to="/legal/tokushoho">料金・解約の条件 →</Link></div></div></section>
      <HelpCenter />
      <section className="studio-final studio-container"><span className="studio-section-label">まずは操作を試してみてください</span><h2>次の一歩を、<br />ここから。</h2><Link className="studio-cta" to="/signup">keirioを無料で試す <ArrowUpRight size={22} /></Link></section>
    </main><MarketingFooter />
  </div>;
}
