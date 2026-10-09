import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderArticleHtml,articleSections,inlineTokens,articleStructuredData} from '../src/lib/blogContent.ts';

test('SSR article links and heading IDs are crawlable and match the contents list',()=>{
 const content='最初の説明。\n\n## 月次の確認\n\n[入金の確認](/blog/receivable-payment-reconciliation)を開きます。\n\n### 残高\n\n- 資料を保存\n- [国税庁](https://www.nta.go.jp/)を確認';
 const html=renderArticleHtml(content);
 assert.match(html,/<h2 id="section-1">月次の確認<\/h2>/);
 assert.match(html,/<h3 id="section-2">残高<\/h3>/);
 assert.match(html,/href="\/blog\/receivable-payment-reconciliation"/);
 assert.match(html,/<ul>/);
 assert.deepEqual(articleSections(content),[{id:'section-1',title:'月次の確認',level:2},{id:'section-2',title:'残高',level:3}]);
});
test('untrusted editorial HTML and dangerous link schemes never become executable markup',()=>{
 const html=renderArticleHtml('<img src=x onerror=alert(1)>\n\n[bad](javascript:alert) [x](//attacker.example) [safe](https://www.nta.go.jp/)');
 assert.ok(!html.includes('<img'));
 assert.ok(!html.includes('href="javascript:'));
 assert.ok(!html.includes('href="//attacker'));
 assert.ok(html.includes('&lt;img'));
 assert.equal(inlineTokens('[bad](data:text/html,test)').some(t=>t.type==='link'),false);
});
test('CSV examples retain exact line breaks inside escaped code blocks',()=>{
 const html=renderArticleHtml('```csv\n日付,摘要,金額\n2026-09-01,<script>,100\n```');
 assert.match(html,/<pre><code/);
 assert.ok(html.includes('日付,摘要,金額\n2026-09-01,&lt;script&gt;,100'));
 assert.ok(!html.includes('```'));
});
test('article structured data uses visible publisher, dates and breadcrumb locations',()=>{
 const graph=articleStructuredData({slug:'example',title:'会計の確認',excerpt:'説明',publishedAt:'2026-10-09T00:00:00Z',createdAt:'2026-10-09T00:00:00Z',updatedAt:'2026-10-09T01:00:00Z',coverImageUrl:'/blog/monthly-checklist.svg'});
 const article=graph['@graph'].find(x=>x['@type']==='BlogPosting');
 assert.equal(article.author.name,'keirio編集部');
 assert.equal(article.publisher.name,'keirio');
 assert.equal(article.mainEntityOfPage,'https://keirio-hub.com/blog/example');
 const trail=graph['@graph'].find(x=>x['@type']==='BreadcrumbList');
 assert.equal(trail.itemListElement[2].item,'https://keirio-hub.com/blog/example');
 assert.equal(article.image,'https://keirio-hub.com/blog/monthly-checklist.svg');
});
