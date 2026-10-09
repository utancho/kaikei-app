import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyPagePath, PUBLIC_STATIC_PATHS} from '../src/lib/seoRoutes.ts';

test('unknown routes and missing resources are not SPA pages',()=>{
 for(const path of ['/missing','/legal/missing','/assets/missing.js','/blog/a/b','/robots.txt']) assert.equal(classifyPagePath(path),'unknown');
});
test('existing workspace routes retain their private SPA handling',()=>{
 for(const path of ['/app','/journal-entries/123','/invoices/123/print','/reports/trial-balance','/billing/success','/admin/blog']) assert.equal(classifyPagePath(path),'private');
});
test('only actual public pages qualify for public metadata',()=>{
 for(const path of PUBLIC_STATIC_PATHS) assert.equal(classifyPagePath(path),'public');
 assert.equal(classifyPagePath('/blog/real-slug'),'article');
 assert.equal(classifyPagePath('/blog/missing.svg'),'unknown');
});
