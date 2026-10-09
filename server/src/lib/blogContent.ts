/** Shared safe editorial renderer for initial HTML and hydrated React pages. */
export const BLOG_ORIGIN='https://keirio-hub.com';
export type ArticleBlock={kind:'heading';level:2|3;id:string;text:string}|{kind:'list';ordered:boolean;items:string[]}|{kind:'code';language:string;text:string}|{kind:'paragraph';text:string};
export type InlineToken={type:'text';text:string}|{type:'link';text:string;href:string;external:boolean};
export function escapeEditorialHtml(text:string){return text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
export function safeEditorialUrl(value:string):string|null {
  if(/[\u0000-\u0020\u007f\\]/.test(value)||value.startsWith('//'))return null;
  if(value.startsWith('#'))return /^#[a-zA-Z0-9_-]+$/.test(value)?value:null;
  try{const url=new URL(value,BLOG_ORIGIN);if(url.protocol!=='https:')return null;if(value.startsWith('/'))return url.origin===BLOG_ORIGIN?url.pathname+url.search+url.hash:null;return /^https:\/\//i.test(value)?url.href:null;}catch{return null;}
}
export function inlineTokens(text:string):InlineToken[]{
  const tokens:InlineToken[]=[];const pattern=/\[([^\]\n]+)\]\(([^\s)]+)\)/g;let cursor=0;
  for(const match of text.matchAll(pattern)){
    const at=match.index!;if(at>cursor)tokens.push({type:'text',text:text.slice(cursor,at)});
    const href=safeEditorialUrl(match[2]);tokens.push(href?{type:'link',text:match[1],href,external:href.startsWith('https://')&&!href.startsWith(BLOG_ORIGIN+'/')}:{type:'text',text:match[1]});cursor=at+match[0].length;
  }
  if(cursor<text.length)tokens.push({type:'text',text:text.slice(cursor)});return tokens;
}
export function articleBlocks(content:string):ArticleBlock[]{
  let number=0;return content.split(/\n{2,}/).map(v=>v.trim()).filter(Boolean).map(text=>{
    const code=text.match(/^```([a-zA-Z0-9_-]*)\n([\s\S]*)\n```$/);if(code)return {kind:'code',language:code[1],text:code[2]};
    const heading=text.match(/^(#{1,3}) ([^\n]+)$/);if(heading)return {kind:'heading',level:heading[1].length===3?3:2,id:`section-${++number}`,text:heading[2]};
    const lines=text.split('\n');if(lines.every(l=>/^[-*] /.test(l)))return {kind:'list',ordered:false,items:lines.map(l=>l.slice(2))};
    if(lines.every(l=>/^\d+\. /.test(l)))return {kind:'list',ordered:true,items:lines.map(l=>l.replace(/^\d+\. /,''))};
    return {kind:'paragraph',text};
  });
}
export function articleSections(content:string){return articleBlocks(content).filter((b):b is Extract<ArticleBlock,{kind:'heading'}>=>b.kind==='heading').map(({id,text,level})=>({id,title:text,level}));}
function inlineHtml(text:string){return inlineTokens(text).map(t=>t.type==='text'?escapeEditorialHtml(t.text):`<a href="${escapeEditorialHtml(t.href)}"${t.external?' target="_blank" rel="noopener noreferrer"':''}>${escapeEditorialHtml(t.text)}</a>`).join('');}
export function renderArticleHtml(content:string){return articleBlocks(content).map(b=>b.kind==='heading'?`<h${b.level} id="${b.id}">${inlineHtml(b.text)}</h${b.level}>`:b.kind==='list'?`<${b.ordered?'ol':'ul'}>${b.items.map(l=>`<li>${inlineHtml(l)}</li>`).join('')}</${b.ordered?'ol':'ul'}>`:b.kind==='code'?`<pre><code>${escapeEditorialHtml(b.text)}</code></pre>`:`<p>${inlineHtml(b.text).replace(/\n/g,'<br>')}</p>`).join('');}
type ArticleMeta={slug:string;title:string;excerpt?:string|null;publishedAt:string|Date|null;createdAt:string|Date;updatedAt:string|Date;coverImageUrl?:string|null};
export function articleStructuredData(post:ArticleMeta){
  const url=`${BLOG_ORIGIN}/blog/${encodeURIComponent(post.slug)}`;
  const imageUrl=post.coverImageUrl?safeEditorialUrl(post.coverImageUrl):null;
  const image=imageUrl?new URL(imageUrl,BLOG_ORIGIN).href:`${BLOG_ORIGIN}/brand/keirio-icon.png`;
  return {'@context':'https://schema.org','@graph':[
    {'@type':'BlogPosting','@id':url+'#article',headline:post.title,description:post.excerpt??post.title,datePublished:new Date(post.publishedAt??post.createdAt).toISOString(),dateModified:new Date(post.updatedAt).toISOString(),inLanguage:'ja-JP',author:{'@type':'Organization',name:'keirio編集部',url:BLOG_ORIGIN+'/blog/editorial-policy'},publisher:{'@type':'Organization',name:'keirio',url:BLOG_ORIGIN,logo:{'@type':'ImageObject',url:BLOG_ORIGIN+'/brand/keirio-icon.png'}},mainEntityOfPage:url,image},
    {'@type':'BreadcrumbList','@id':url+'#breadcrumb',itemListElement:[{'@type':'ListItem',position:1,name:'keirio',item:BLOG_ORIGIN+'/'},{'@type':'ListItem',position:2,name:'Journal',item:BLOG_ORIGIN+'/blog'},{'@type':'ListItem',position:3,name:post.title,item:url}]},
  ]};
}
