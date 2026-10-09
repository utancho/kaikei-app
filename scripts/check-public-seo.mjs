// Read-only HTTP regression audit. Defaults to the local Worker; never submits to Google.
import assert from 'node:assert/strict';
const base=new URL(process.argv[2]??'http://127.0.0.1:4000');
const robots=await fetch(new URL('/robots.txt',base));
assert.equal(robots.status,200);
const robotsText=await robots.text();
assert.match(robotsText,/Allow: \/api\/blog/);
assert.match(robotsText,/Disallow: \/api\//);
assert.match(robotsText,/Sitemap: https:\/\/keirio-hub.com\/sitemap.xml/);
const sitemap=await fetch(new URL('/sitemap.xml',base));
assert.equal(sitemap.status,200);
assert.match(sitemap.headers.get('content-type')??'',/application\/xml/);
const xml=await sitemap.text();
assert.match(xml,/<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
const urls=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
assert.ok(urls.length>=6);
assert.equal(new Set(urls).size,urls.length);
for(const url of urls){
 const canonical=new URL(url);
 assert.equal(canonical.origin,'https://keirio-hub.com');
 for(const agent of ['Mozilla/5.0','Googlebot']){
  const response=await fetch(new URL(canonical.pathname,base),{headers:{'User-Agent':agent},redirect:'manual'});
  assert.equal(response.status,200,url);
  const html=await response.text();
  assert.ok(html.includes('rel="canonical" href="'+url+'"'),url);
  assert.equal((html.match(/<h1(?:\s|>)/g)||[]).length,1,url);
  assert.ok(!/<meta name="robots" content="noindex/.test(html),url);
 }
}
for(const path of ['/seo-check-missing','/legal/seo-check-missing','/blog/seo-check-missing','/assets/seo-check-missing.js']){
 assert.equal((await fetch(new URL(path,base),{redirect:'manual'})).status,404,path);
}
for(const path of ['/app','/settings','/invoices/example/print','/reports/trial-balance']){
 const response=await fetch(new URL(path,base),{redirect:'manual'});
 assert.equal(response.status,200,path);
 assert.match(response.headers.get('x-robots-tag')??'',/noindex/,path);
}
const slash=await fetch(new URL('/legal/privacy/',base),{redirect:'manual'});
assert.equal(slash.status,301);
assert.equal(slash.headers.get('location'),'/legal/privacy');
assert.equal((await fetch(new URL('/sitemap.xml',base),{method:'HEAD'})).status,200);
console.log('PASS: '+urls.length+' public URLs (normal + Googlebot UA), 404s, private noindex, canonical redirect and sitemap HEAD');
