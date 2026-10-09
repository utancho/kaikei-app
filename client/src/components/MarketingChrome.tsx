import { KeirioIcon } from "./KeirioIcon";
import "../studio.css";
import "../refined.css";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";

const NAV_ITEMS = [
  { href: "/#features", label: "機能" },
  { href: "/#workflow", label: "使い方" },
  { href: "/#pricing", label: "料金" },
  { href: "/blog", label: "ブログ" },
  { href: "/#help", label: "サポート" },
];

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <KeirioIcon size={36} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.05rem] font-semibold tracking-[0.08em] text-[#f6f1e7]">keirio</span>
        {!compact && <span className="mt-1 text-[9px] font-medium tracking-[0.22em] text-[#aab7b2]">FINANCIAL DESK</span>}
      </span>
    </span>
  );
}

export function MarketingHeader({ sectionLabel }: { sectionLabel?: string }) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) { setOpen(false); menuButton.current?.focus(); }
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    desktop.addEventListener("change", closeOnDesktop);
    return () => { document.removeEventListener("keydown", closeOnEscape); desktop.removeEventListener("change", closeOnDesktop); };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b1714]/95 text-white backdrop-blur-xl">
      <div className="marketing-container flex h-[4.5rem] items-center justify-between">
        <Link to="/" aria-label="keirio ホーム" onClick={() => setOpen(false)} className="flex items-center gap-3">
          <BrandMark />
          {sectionLabel && <span className="hidden border-l border-white/15 pl-3 text-xs tracking-[0.14em] text-[#b9c4bf] sm:block">{sectionLabel}</span>}
        </Link>
        <nav className="hidden items-center gap-7 lg:flex" aria-label="メインナビゲーション">
          {NAV_ITEMS.map((item) => <a key={item.href} href={item.href} className="text-[13px] font-medium tracking-wide text-[#cbd4d0] transition-colors hover:text-white">{item.label}</a>)}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <Link to="/login" className="px-3 py-2 text-sm text-[#cbd4d0] transition-colors hover:text-white">ログイン</Link>
          <Link to="/signup" className="marketing-button marketing-button-gold text-sm">14日間無料で試す <ArrowRight size={15} /></Link>
        </div>
        <button ref={menuButton} type="button" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-[#e7ece9] lg:hidden" aria-expanded={open} aria-controls="mobile-marketing-nav" aria-label={open ? "メニューを閉じる" : "メニューを開く"} onClick={() => setOpen((value) => !value)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <div id="mobile-marketing-nav" className="border-t border-white/10 bg-[#0b1714] px-5 pb-6 pt-3 lg:hidden">
          <nav className="flex flex-col" aria-label="モバイルナビゲーション">
            {NAV_ITEMS.map((item) => <a key={item.href} href={item.href} onClick={() => setOpen(false)} className="border-b border-white/10 py-3.5 text-sm text-[#d8dfdc]">{item.label}</a>)}
          </nav>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link to="/login" onClick={() => setOpen(false)} className="marketing-button marketing-button-outline">ログイン</Link>
            <Link to="/signup" onClick={() => setOpen(false)} className="marketing-button marketing-button-gold">無料で試す</Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#091310] text-[#b8c2be]">
      <div className="marketing-container py-14 sm:py-16">
        <div className="grid gap-10 border-b border-white/10 pb-10 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div><Link to="/" aria-label="keirio ホーム"><BrandMark /></Link><p className="mt-5 max-w-sm text-sm leading-7 text-[#8f9d97]">数字に追われる毎日から、数字を味方にする経営へ。日本の小さな事業のための会計ワークスペースです。</p></div>
          <div><p className="text-xs font-semibold tracking-[0.18em] text-[#d5bb79]">PRODUCT</p><div className="mt-4 flex flex-col gap-3 text-sm"><a href="/#features" className="hover:text-white">機能紹介</a><a href="/#pricing" className="hover:text-white">料金プラン</a><Link to="/blog" className="hover:text-white">ブログ</Link></div></div>
          <div><p className="text-xs font-semibold tracking-[0.18em] text-[#d5bb79]">LEGAL</p><div className="mt-4 flex flex-col gap-3 text-sm"><Link to="/legal/tokushoho" className="hover:text-white">特定商取引法に基づく表示</Link><Link to="/legal/privacy" className="hover:text-white">プライバシーポリシー</Link><Link to="/legal/terms" className="hover:text-white">利用規約</Link></div></div>
        </div>
        <div className="flex flex-col gap-3 pt-7 text-xs text-[#718079] sm:flex-row sm:items-center sm:justify-between"><span>&copy; {new Date().getFullYear()} keirio. All rights reserved.</span><span>会計業務を、静かに、美しく。</span></div>
      </div>
    </footer>
  );
}
