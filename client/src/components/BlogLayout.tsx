import { Outlet } from "react-router-dom";
import { MarketingFooter, MarketingHeader } from "./MarketingChrome";

export default function BlogLayout() {
  return (
    <div className="marketing-site keirio-studio refined-blog flex min-h-screen flex-col">
      <MarketingHeader sectionLabel="JOURNAL" />
      <main className="flex-1"><Outlet /></main>
      <MarketingFooter />
    </div>
  );
}
