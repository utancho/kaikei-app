import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarDays, Search } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { BlogPostSummary } from "../lib/types";

function formatBlogDate(value: string | null, fallback: string) {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Tokyo" }).format(new Date(value ?? fallback));
}

function EditorialImage({ post, featured = false }: { post: BlogPostSummary; featured?: boolean }) {
  if (post.coverImageUrl) return <img src={post.coverImageUrl} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />;
  return <div className={`editorial-placeholder flex h-full w-full items-center justify-center ${featured ? "min-h-[19rem]" : "min-h-[14rem]"}`}><div className="text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#9abd8e]/50 text-[#56865d]"><BookOpen size={24} strokeWidth={1.5} /></span><span className="mt-4 block text-[10px] font-semibold tracking-[0.22em] text-[#64816a]">keirio JOURNAL</span></div></div>;
}

export default function Blog() {
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("すべて");

  useEffect(() => {
    document.title = "keirio Journal｜会計と経営の読みもの";
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = "日々の記帳、確定申告、経営の数字を実務目線でわかりやすく解説するkeirio Journal。";
    api.listBlogPosts().then(setPosts).catch((e) => setError(e instanceof ApiError ? e.message : "記事の読み込みに失敗しました")).finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => ["すべて", ...Array.from(new Set(posts.map((post) => post.category).filter((value): value is string => Boolean(value))))], [posts]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return posts.filter((post) => (category === "すべて" || post.category === category) && (!normalized || [post.title, post.excerpt ?? "", post.category ?? ""].some((value) => value.toLowerCase().includes(normalized))));
  }, [posts, query, category]);
  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div>
      <section className="border-b border-[#dce7d6] bg-[#f3f7f0]">
        <div className="marketing-container py-14 sm:py-20">
          <p className="marketing-eyebrow">keirio JOURNAL</p>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-end"><h1 className="font-display text-4xl leading-tight text-[#12231d] sm:text-6xl">毎日の経理に、<br />使える読みもの。</h1><p className="max-w-lg text-sm leading-7 text-[#64716b] sm:text-base">銀行CSVを取り込むとき。月末の残高を確かめるとき。keirioの使い方を、作業の順番に沿って紹介します。</p></div>
        </div>
      </section>

      <section className="marketing-container py-10 sm:py-14">
        <div className="flex flex-col gap-5 border-b border-[#dce7d6] pb-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="marketing-scrollbar-none flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="記事カテゴリー">{categories.map((item) => <button key={item} role="tab" aria-selected={category === item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-medium transition-colors ${category === item ? "border-[#183129] bg-[#183129] text-white" : "border-[#d4e2cf] text-[#5f6d67] hover:border-[#518060]"}`}>{item}</button>)}</div>
          <label className="relative block w-full lg:w-72"><Search size={15} className="absolute left-0 top-1/2 -translate-y-1/2 text-[#8b9691]" /><span className="sr-only">記事を検索</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="記事を検索" className="w-full border-b border-[#b2c8ab] bg-transparent py-2 pl-6 pr-2 text-sm outline-none transition-colors placeholder:text-[#9ba39f] focus:border-[#367850]" /></label>
        </div>

        {loading ? (
          <div className="mt-10 grid gap-6 lg:grid-cols-2"><div className="h-[30rem] animate-pulse rounded-3xl bg-[#e5eedf]" /><div className="h-[30rem] animate-pulse rounded-3xl bg-[#e5eedf]" /></div>
        ) : error ? (
          <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 px-5 py-12 text-center text-sm text-red-700">{error}</div>
        ) : !featured ? (
          <div className="mt-10 rounded-[1.75rem] border border-[#dce7d6] bg-[#f8fbf5] px-6 py-20 text-center"><BookOpen size={30} className="mx-auto text-[#b5ab97]" /><h2 className="mt-5 font-display text-2xl">該当する記事がありません</h2><p className="mt-2 text-sm text-[#7b8680]">検索条件を変えてお試しください。</p></div>
        ) : (
          <>
            <Link to={`/blog/${featured.slug}`} className="group mt-10 grid overflow-hidden rounded-[1.75rem] border border-[#dce7d6] bg-[#fff] shadow-[0_18px_50px_rgba(25,37,31,0.08)] lg:grid-cols-[1.1fr_0.9fr]">
              <div className="min-h-[20rem] overflow-hidden"><EditorialImage post={featured} featured /></div>
              <div className="flex flex-col justify-center p-7 sm:p-10"><div className="flex items-center gap-3 text-[11px] text-[#84908a]">{featured.category && <span className="font-semibold tracking-[0.1em] text-[#397b51]">{featured.category}</span>}<span className="inline-flex items-center gap-1"><CalendarDays size={12} />{formatBlogDate(featured.publishedAt, featured.createdAt)}</span></div><p className="mt-5 text-[10px] font-semibold tracking-[0.2em] text-[#55845f]">FEATURED STORY</p><h2 className="mt-3 font-display text-3xl leading-tight text-[#152720] transition-colors group-hover:text-[#28734a]">{featured.title}</h2>{featured.excerpt && <p className="mt-4 text-sm leading-7 text-[#67736e]">{featured.excerpt}</p>}<span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#21372f]">記事を読む <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" /></span></div>
            </Link>
            {rest.length > 0 && <div className="mt-12 grid gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3">{rest.map((post) => <Link key={post.id} to={`/blog/${post.slug}`} className="group"><div className="aspect-[16/10] overflow-hidden rounded-2xl border border-[#dce7d6]"><EditorialImage post={post} /></div><div className="pt-5"><div className="flex items-center gap-3 text-[10px] text-[#89938e]">{post.category && <span className="font-semibold tracking-[0.08em] text-[#397b51]">{post.category}</span>}<span>{formatBlogDate(post.publishedAt, post.createdAt)}</span></div><h2 className="mt-3 font-display text-2xl leading-snug text-[#172820] transition-colors group-hover:text-[#28734a]">{post.title}</h2>{post.excerpt && <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#6d7973]">{post.excerpt}</p>}<span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold">READ MORE <ArrowRight size={13} /></span></div></Link>)}</div>}
          </>
        )}
      </section>
    </div>
  );
}
