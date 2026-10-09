import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { BlogPost as BlogPostType } from "../lib/types";
import { updatePageSeo } from "../lib/pageSeo";
import { articleBlocks,articleSections,inlineTokens,articleStructuredData } from '../../../server/src/lib/blogContent';

function formatDate(value: string | null, fallback: string) {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Tokyo" }).format(new Date(value ?? fallback));
}

function InlineText({text}:{text:string}){return <>{inlineTokens(text).map((t,i)=>t.type==='text'?t.text:<a key={i} href={t.href} className="text-emerald-800 underline underline-offset-4" {...(t.external?{target:'_blank',rel:'noopener noreferrer'}:{})}>{t.text}</a>)}</>;}
function ArticleBody({content}:{content:string}){return <div className="article-body">{articleBlocks(content).map((b,i)=>b.kind==='heading'?(b.level===3?<h3 id={b.id} key={i}><InlineText text={b.text}/></h3>:<h2 id={b.id} key={i}><InlineText text={b.text}/></h2>):b.kind==='list'?(b.ordered?<ol key={i} className="list-decimal pl-6">{b.items.map((l,k)=><li key={k}><InlineText text={l}/></li>)}</ol>:<ul key={i}>{b.items.map((l,k)=><li key={k}><InlineText text={l}/></li>)}</ul>):b.kind==='code'?<pre key={i} className="overflow-x-auto rounded-lg bg-emerald-50 p-4 text-sm"><code>{b.text}</code></pre>:<p key={i} className="whitespace-pre-line"><InlineText text={b.text}/></p>)}</div>;}

export default function BlogPost() {
  const { slug = "" } = useParams();
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [related,setRelated]=useState<{slug:string;title:string}[]>([]);

  useEffect(() => {
    let active=true;
    setLoading(true);
    setError("");
    setPost(null);setRelated([]);
    api.getBlogPost(slug).then((data) => {
      if(!active)return;
      setPost(data);
      updatePageSeo(data.title+" | keirio",data.excerpt??data.title,articleStructuredData(data),data.coverImageUrl);
      api.listBlogPosts(data.category?{category:data.category}:{}).then(posts=>{if(active)setRelated(posts.filter(p=>p.slug!==data.slug).slice(0,3));}).catch(()=>{});
      const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (meta && data.excerpt) meta.content = data.excerpt;
    }).catch((e) => {if(active){const missing=e instanceof ApiError && e.status === 404;setError(missing ? "記事が見つかりません" : "記事の読み込みに失敗しました");updatePageSeo((missing?'記事が見つかりません':'記事を読み込めません')+' | keirio','ブログ一覧から記事をご確認ください。');const robots=document.querySelector<HTMLMetaElement>('meta[name="robots"]');if(robots)robots.content='noindex';document.querySelector('script[data-keirio-seo][type="application/ld+json"]')?.remove();}}).finally(() => {if(active)setLoading(false);});
    return()=>{active=false;};
  }, [slug]);

  if (loading) return <div className="marketing-container max-w-4xl py-16"><div className="mb-5 h-8 w-2/3 animate-pulse rounded bg-[#e3ded3]" /><div className="h-96 animate-pulse rounded-3xl bg-[#e3ded3]" /></div>;
  if (!post || error) return <div className="marketing-container max-w-2xl py-28 text-center"><BookOpen size={38} className="mx-auto text-[#b7ad99]" /><h1 className="mt-5 font-display text-2xl">{error || "記事が見つかりません"}</h1><Link to="/blog" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#7f6128]"><ArrowLeft size={15} />ブログ一覧へ戻る</Link></div>;

  return (
    <article>
      <header className="border-b border-[#d9d3c7] bg-[#f3f7f0]">
        <div className="marketing-container max-w-4xl py-12 sm:py-20">
          <nav aria-label="パンくず" className="flex flex-wrap gap-2 text-xs text-[#64716b]"><Link to="/">keirio</Link><span>/</span><Link to="/blog">Journal</Link><span>/</span><span>{post.title}</span></nav>
          <div className="mt-10 flex flex-wrap items-center gap-3 text-xs text-[#7b8781]">{post.category && <span className="font-semibold tracking-[0.1em] text-[#8d6b2c]">{post.category}</span>}<span className="inline-flex items-center gap-1.5"><CalendarDays size={13} />{formatDate(post.publishedAt, post.createdAt)}</span><span>約{Math.max(1, Math.ceil(post.content.length / 500))}分で読めます</span></div>
          <h1 className="mt-5 font-display text-4xl leading-[1.25] tracking-[-0.02em] text-[#14261f] sm:text-6xl">{post.title}</h1>
          {post.excerpt && <p className="mt-7 max-w-3xl text-base leading-8 text-[#63706a] sm:text-lg">{post.excerpt}</p>}
          <p className="mt-4 text-xs text-[#63706a]">編集：<Link to="/blog/editorial-policy" className="underline">keirio編集部</Link> · 更新日：{formatDate(post.updatedAt,post.createdAt)}</p>
        </div>
      </header>
      {post.coverImageUrl && <div className="marketing-container max-w-6xl pt-10 sm:pt-14"><img src={post.coverImageUrl} alt="" className="aspect-[16/8] w-full rounded-[1.75rem] border border-[#d4cec0] object-cover" /></div>}
      <div className="marketing-container max-w-3xl py-12 sm:py-20"><nav aria-label="記事の目次" className="mb-10 rounded-xl border border-emerald-100 bg-[#f3f7f0] p-5"><h2 className="text-sm font-semibold">この記事の内容</h2><ul className="mt-3 space-y-2 text-sm">{articleSections(post.content).map(s=><li key={s.id} className={s.level===3?'pl-4':''}><a href={'#'+s.id} className="text-emerald-800 underline underline-offset-4">{s.title}</a></li>)}</ul></nav><ArticleBody content={post.content} />{related.length>0&&<aside className="mt-12 border-t pt-6"><h2 className="text-lg font-semibold">関連する記事</h2><ul className="mt-4 space-y-3">{related.map(p=><li key={p.slug}><Link className="text-emerald-800 underline underline-offset-4" to={'/blog/'+p.slug}>{p.title}</Link></li>)}</ul></aside>}<aside className="mt-16 border-y border-[#cfc8b9] py-9 text-center"><p className="marketing-eyebrow">START WITH keirio</p><h2 className="mt-4 font-display text-3xl">会計を整え、経営に集中する。</h2><p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#6a7670]">仕訳から決算準備まで、ひとつの流れで。プラン申込みから14日間無料でお試しいただけます。</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link to="/signup" className="marketing-button marketing-button-dark">14日間無料で試す <ArrowRight size={15} /></Link><a href="/#features" className="marketing-button border border-emerald-200 text-emerald-800">操作画面を見る</a></div></aside></div>
    </article>
  );
}
