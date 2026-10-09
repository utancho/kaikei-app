import { Link, useLocation } from "react-router-dom";
import { Printer, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MarketingHeader, MarketingFooter } from "../../components/MarketingChrome";
import {updatePageSeo} from '../../lib/pageSeo';

const LEGAL_LINKS = [
  { to: "/legal/tokushoho", label: "特定商取引法に基づく表示" },
  { to: "/legal/privacy", label: "プライバシーポリシー" },
  { to: "/legal/terms", label: "利用規約" },
];

export function LegalLayout({ title, updatedAt, children }: { title: string; updatedAt: string; children: ReactNode }) {
  const location = useLocation();
  const content = useRef<HTMLDivElement>(null);
  const [sections, setSections] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    updatePageSeo(title+' | keirio',title+'：keirioのサービス利用条件とお問い合わせについて。');
    const headings = [...(content.current?.querySelectorAll("section h2") ?? [])];
    setSections(headings.map((heading, index) => {
      heading.id = "legal-section-" + index;
      return { id: heading.id, title: heading.textContent ?? "" };
    }));
  }, [title]);
  return (
    <div className="marketing-site keirio-studio legal-site">
      <a className="studio-skip" href="#legal-main">本文へスキップ</a>
      <MarketingHeader />
      <main id="legal-main" className="studio-container legal-main">
        <nav className="legal-breadcrumb" aria-label="パンくず"><Link to="/">ホーム</Link><span>/</span><span>サービスのご利用について</span></nav>
        <div className="legal-title"><div><p>ご利用の前に</p><h1>{title}</h1><span>最終更新日：{updatedAt}</span></div><button type="button" onClick={() => window.print()}><Printer size={16} />印刷・PDF保存</button></div>
        <div className="legal-grid"><aside className="legal-sidebar"><nav aria-label="法的ページ">{LEGAL_LINKS.map(link => <Link key={link.to} to={link.to} aria-current={location.pathname === link.to ? "page" : undefined}>{link.label}</Link>)}</nav>{sections.length > 0 && <nav className="legal-toc" aria-label="このページの目次"><p>目次</p>{sections.map(section => <a key={section.id} href={"#" + section.id}>{section.title}</a>)}</nav>}<a className="legal-contact" href="mailto:suzukishion522@icloud.com"><Mail size={16} />お問い合わせ</a></aside>
        <div ref={content} className="prose-legal">{children}<div className="legal-help"><h2>ご不明な点がある場合</h2><p>サービスや記載内容については、メールでお問い合わせください。</p><a href="mailto:suzukishion522@icloud.com">suzukishion522@icloud.com</a></div></div></div>
      </main><MarketingFooter />
    </div>
  );
}
