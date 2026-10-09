import { Hono, type Context } from "hono";
import { prisma } from "../lib/prisma.js";
import type { AppEnv } from "../types/env.js";
import { articleSections, renderArticleHtml, articleStructuredData, safeEditorialUrl } from '../lib/blogContent.js';
import {classifyPagePath, PUBLIC_STATIC_PATHS} from '../lib/seoRoutes.js';
import legalPages from '../generated/publicPages.json';
const ORIGIN = "https://keirio-hub.com";
export function escapeHtml(value: string) { return value.replace(/[&<>"']/g, char => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[char]!)); }
const articleBody=renderArticleHtml;
function snapshot(title: string, body: string) {
  return '<div id="seo-snapshot"><header><a href="/">keirio</a><nav><a href="/blog">ブログ</a> · <a href="/login">ログイン</a></nav></header><main><h1>'+escapeHtml(title)+'</h1>'+body+'</main><footer><a href="/legal/privacy">プライバシーポリシー</a> · <a href="/legal/terms">利用規約</a> · <a href="/legal/tokushoho">特定商取引法に基づく表示</a></footer></div>';
}
const styles='<style data-keirio-seo>#seo-snapshot{max-width:900px;margin:auto;padding:28px;color:#244936;font-family:Arial,"Yu Gothic",sans-serif;line-height:1.9}#seo-snapshot header{display:flex;justify-content:space-between;border-bottom:1px solid #dce6d8;padding-bottom:20px}#seo-snapshot a{color:#24744c}#seo-snapshot h1{font-size:clamp(28px,4vw,46px);line-height:1.5;margin:40px 0 20px}#seo-snapshot h2{font-size:24px;margin:40px 0 15px}#seo-snapshot p{margin:22px 0}#seo-snapshot img{max-width:100%;height:auto;border-radius:8px}#seo-snapshot footer{border-top:1px solid #dce6d8;margin-top:40px;padding-top:20px;font-size:12px}</style>';
export const publicSeo = new Hono<AppEnv>();
publicSeo.use('*',async(c,next)=>{
 const url=new URL(c.req.url);
 const normalized=url.pathname.length>1?url.pathname.replace(/\/+$/,''):url.pathname;
 if(normalized!==url.pathname && (classifyPagePath(normalized)!=='unknown'||normalized==='/sitemap.xml')) return c.redirect(normalized+url.search,301);
 await next();
});
async function page(c: Context<AppEnv>, options: {title:string;description:string;path:string;markup?:string;schema?:unknown;private?:boolean;image?:string}) {
  const requestHeaders=new Headers(c.req.raw.headers);
  requestHeaders.delete("If-None-Match");requestHeaders.delete("If-Modified-Since");
  const assetUrl=new URL('/index.html',c.req.url);
  const response=await c.env.ASSETS.fetch(new Request(assetUrl,{headers:requestHeaders}));
  if(!response.ok) return c.text('Page temporarily unavailable',503,{'Retry-After':'60','X-Robots-Tag':'noindex'});
  const url=ORIGIN+options.path;
  const image=options.image&&safeEditorialUrl(options.image)?new URL(options.image,ORIGIN).href:ORIGIN+'/brand/keirio-icon.png';
  const meta='<link rel="canonical" href="'+escapeHtml(url)+'" data-keirio-seo><meta name="robots" content="'+(options.private?"noindex,nofollow":"index,follow")+'" data-keirio-seo><meta property="og:type" content="'+(options.path.startsWith("/blog/")?"article":"website")+'" data-keirio-seo><meta property="og:title" content="'+escapeHtml(options.title)+'" data-keirio-seo><meta property="og:description" content="'+escapeHtml(options.description)+'" data-keirio-seo><meta property="og:url" content="'+escapeHtml(url)+'" data-keirio-seo><meta property="og:image" content="'+escapeHtml(image)+'" data-keirio-seo><meta name="twitter:card" content="summary_large_image" data-keirio-seo>'+styles+(options.schema?'<script type="application/ld+json" data-keirio-seo>'+JSON.stringify(options.schema).replace(/</g,"\\u003c")+'</script>':"");
  const rewriter=new HTMLRewriter().on("title",{element:e=>{e.setInnerContent(options.title);}}).on('meta[name="description"]',{element:e=>{e.setAttribute("content",options.description);}}).on("head",{element:e=>{e.append(meta,{html:true});}});
  if(options.markup) rewriter.on("#root",{element:e=>{e.setInnerContent(options.markup!,{html:true});}});
  const result=rewriter.transform(response);
  const headers=new Headers(result.headers);headers.delete("ETag");headers.delete("Content-Length");headers.set('X-Robots-Tag',options.private?'noindex,nofollow':'index,follow');headers.set("Cache-Control",options.private?"private,no-store":"public,max-age=0,must-revalidate");
  return new Response(result.body,{status:result.status,headers});
}
publicSeo.get("/", async c=>page(c,{title:"keirio | 個人事業主・小さな法人の会計ソフト",description:"銀行CSV取込、仕訳、請求書、月次レポート、税理士共有をひとつに。keirioは月額1,980円（税込）、プラン申込みから14日間無料。",path:"/",markup:snapshot("経理に追われず、経営と向き合う。",'<p>明細を取り込み、仕訳を確認。請求書も月次レポートも同じ場所で。閲覧専用の税理士共有に対応しています。</p><p><a href="/signup">14日間無料で試す</a> · <a href="/app">アプリにログイン</a></p><p>月額1,980円（税込）。無料期間と課金開始日はプランの申込画面でご確認ください。</p>'),schema:{"@context":"https://schema.org","@type":"SoftwareApplication",name:"keirio",applicationCategory:"FinanceApplication",operatingSystem:"Web, Windows, macOS",url:ORIGIN,offers:{"@type":"Offer",price:"1980",priceCurrency:"JPY"}}}));
publicSeo.get("/blog",async c=>{
  const posts=await prisma.blogPost.findMany({where:{published:true},select:{slug:true,title:true,excerpt:true},orderBy:{publishedAt:"desc"}});
  return page(c,{title:"keirio Journal | 記帳・請求・経営の使い方",description:"明細取込、月次チェック、税理士共有など、日々の経理に役立つkeirioの操作ガイド。",path:"/blog",markup:snapshot("毎日の経理に、使える読みもの。",posts.map(post=>'<section><h2><a href="/blog/'+encodeURIComponent(post.slug)+'">'+escapeHtml(post.title)+'</a></h2><p>'+escapeHtml(post.excerpt??"")+'</p></section>').join(""))});
});
publicSeo.get('/blog/editorial-policy',c=>page(c,{title:'記事の編集方針 | keirio Journal',description:'keirio Journalの出典確認、記事更新、一般的な記帳解説と個別の税務判断の区別について。',path:'/blog/editorial-policy',markup:snapshot('記事の編集方針','<p>編集・発行：keirio編集部。個人事業主と小さな法人に向けて、記帳と会計ソフトの操作を解説しています。</p><h2>確認する内容</h2><p>公式資料と実装仕様を確認し、説明用の仮例と実際の機能を区別します。記事の作成にはAIの補助を利用しています。</p><h2>税務情報の扱い</h2><p>税務に関する説明は一般的な情報です。税理士監修済みとは表示せず、個別の適用や税額計算は税理士・税務署へ確認してください。制度の説明には参考資料と確認日を記載します。</p><h2>更新と訂正</h2><p>内容が変わった場合に更新日を変更します。順位のためだけに日付を書き換えません。誤りや古い情報のご連絡は<a href="/legal/privacy">お問い合わせ窓口</a>をご利用ください。</p><p><a href="/blog">記事一覧へ</a></p>') }));
publicSeo.get("/blog/:slug",async c=>{
  if (/\.(svg|png|webp|jpg|jpeg)$/.test(c.req.param("slug"))) return c.env.ASSETS.fetch(c.req.raw);
  const post=await prisma.blogPost.findFirst({where:{slug:c.req.param("slug"),published:true}});
  if(!post) return c.html('<!doctype html><html lang="ja"><head><title>記事が見つかりません | keirio</title><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1">'+styles+'</head><body>'+snapshot("記事が見つかりません",'<p><a href="/blog">ブログ一覧へ戻る</a></p>')+'</body></html>',404);
  const sections=articleSections(post.content);
  const toc=sections.length?'<nav aria-label="記事の目次"><h2>この記事の内容</h2><ul>'+sections.map(s=>'<li><a href="#'+s.id+'">'+escapeHtml(s.title)+'</a></li>').join('')+'</ul></nav>':'';
  const related=await prisma.blogPost.findMany({where:{published:true,slug:{not:post.slug},...(post.category?{category:post.category}:{})},select:{slug:true,title:true},orderBy:{publishedAt:'desc'},take:3});
  const links=related.length?'<aside><h2>関連する記事</h2><ul>'+related.map(p=>'<li><a href="/blog/'+encodeURIComponent(p.slug)+'">'+escapeHtml(p.title)+'</a></li>').join('')+'</ul></aside>':'';
  const byline='<p>編集：<a href="/blog/editorial-policy">keirio編集部</a> · 更新日：'+post.updatedAt.toISOString().slice(0,10)+'</p>';
  return page(c,{title:post.title+" | keirio",description:post.excerpt??post.title,path:"/blog/"+encodeURIComponent(post.slug),image:post.coverImageUrl??undefined,markup:snapshot(post.title,byline+(post.coverImageUrl&&safeEditorialUrl(post.coverImageUrl)?'<img src="'+escapeHtml(post.coverImageUrl)+'" alt="" width="900" height="560">':"")+toc+articleBody(post.content)+links+'<p><a href="/signup">keirioを14日間無料で試す</a></p>'),schema:articleStructuredData(post)});
});
const legalMeta={
 '/legal/privacy':{title:'プライバシーポリシー',description:'keirioの取得する情報、個人情報の利用目的、安全管理、外部サービスとお問い合わせ窓口について。'},
 '/legal/terms':{title:'利用規約',description:'keirioの利用条件、アカウント、料金、データの取り扱いとサービス利用時の責任について。'},
 '/legal/tokushoho':{title:'特定商取引法に基づく表示',description:'keirioの提供者、利用料金、支払方法、無料期間、解約と返金条件について。'},
};
for(const [path,meta] of Object.entries(legalMeta)) publicSeo.get(path,c=>page(c,{title:meta.title+' | keirio',description:meta.description,path,markup:legalPages[path as keyof typeof legalPages]}));
publicSeo.get("/sitemap.xml",async c=>{
  const posts=await prisma.blogPost.findMany({where:{published:true},select:{slug:true,updatedAt:true}});
  const entries=PUBLIC_STATIC_PATHS.map(path=>"<url><loc>"+ORIGIN+path+"</loc></url>").concat(posts.map(post=>"<url><loc>"+ORIGIN+"/blog/"+escapeHtml(encodeURIComponent(post.slug))+"</loc><lastmod>"+post.updatedAt.toISOString()+"</lastmod></url>"));
  return c.body('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+entries.join("")+'</urlset>',200,{"Content-Type":"application/xml; charset=utf-8","Cache-Control":"public,max-age=0,must-revalidate","X-Content-Type-Options":"nosniff"});
});
for(const path of ["/app","/invite","/login","/signup","/forgot-password","/reset-password","/operations","/account","/account-security"]) publicSeo.get(path,c=>page(c,{title:"ログイン | keirio",description:"keirioの会計ワークスペースへログイン。",path,private:true}));
publicSeo.get('*',async c=>{
 if(c.req.path.startsWith('/api/')) return c.json({error:'Not found'},404);
 if(classifyPagePath(c.req.path)==='private') return page(c,{title:'会計ワークスペース | keirio',description:'keirioの会計ワークスペース。',path:c.req.path,private:true});
 const asset=await c.env.ASSETS.fetch(c.req.raw);
 if(asset.status!==404) return asset;
 return c.html('<!doctype html><html lang="ja"><head><title>ページが見つかりません | keirio</title><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1">'+styles+'</head><body>'+snapshot('ページが見つかりません','<p>URLをご確認ください。</p><p><a href="/">ホームへ</a> · <a href="/blog">ブログへ</a></p>')+'</body></html>',404,{'X-Robots-Tag':'noindex','Cache-Control':'no-store'});
});
