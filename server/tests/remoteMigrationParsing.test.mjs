import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {unstable_splitSqlQuery} from 'wrangler';
test('Wrangler client-side SQL parsing preserves every migration trigger',()=>{
  const db=new DatabaseSync(':memory:');
  const dir=new URL('../migrations/',import.meta.url);
  for(const file of readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()){
    for(const statement of unstable_splitSqlQuery(readFileSync(new URL(file,dir),'utf8'))) {
      assert.doesNotThrow(()=>db.exec(statement),`remote migration statement: ${file}`);
    }
  }
  assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='InvoicePaymentClaim'").get().n,1);
  db.close();
});
