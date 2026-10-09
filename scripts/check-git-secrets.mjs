// Never prints matched secret values. Checks current commit candidates and fetched history.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const git=(args)=>execFileSync('git',args,{maxBuffer:100*1024*1024}).toString();
const patterns={stripe:/\b(?:sk_(?:live|test)|rk_(?:live|test)|whsec)_[A-Za-z0-9]{16,}/g,github:/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/g,privateKey:/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,aws:/\bAKIA[A-Z0-9]{16}\b/g,openai:/\bsk-(?:proj-)?[A-Za-z0-9_-]{35,}/g};
let findings=0;
function scan(text,label){for(const[name,re]of Object.entries(patterns)){re.lastIndex=0;if(re.test(text)){console.error('STOP: '+name+' candidate in '+label);findings++;}}}
const paths=[...new Set(git(['ls-files','-z','--cached','--others','--exclude-standard']).split('\0').filter(Boolean))];
for(const file of paths){try{const data=readFileSync(file);if(!data.subarray(0,8000).includes(0))scan(data.toString(),file);}catch(e){if(e.code!=='ENOENT')throw e;}}
const history=git(['log','--all','-p','--no-ext-diff']);
scan(history,'all fetched Git history');
const sensitive=git(['log','--all','--format=','--name-only']).split('\n').filter(p=>/(^|\/)(\.env(?:\..+)?|\.dev\.vars(?:\..+)?|ADMIN_LOGIN\.txt|ログイン情報\.txt)$/.test(p)&&!p.endsWith('.example'));
if(sensitive.length){console.error('STOP: sensitive historical filenames: '+[...new Set(sensitive)].join(', '));findings++;}
console.log(JSON.stringify({candidateFiles:paths.length,historyBytes:Buffer.byteLength(history),findings,limitation:'Pattern scan is not a guarantee; review ignored paths and credential-like assignments separately.'}));
process.exitCode=findings?1:0;
