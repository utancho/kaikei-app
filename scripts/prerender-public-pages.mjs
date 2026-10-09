// Build the actual legal components, not a separately maintained copy of their text.
import {build} from 'esbuild';
import {writeFile,mkdir,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const output=path.resolve('scripts/.public-pages-build.mjs');
process.env.NODE_ENV='production';
await build({stdin:{contents:`import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {MemoryRouter} from 'react-router-dom';
import Privacy from './client/src/pages/legal/PrivacyPolicy'; import Terms from './client/src/pages/legal/TermsOfService'; import Commercial from './client/src/pages/legal/CommercialTransactions';
export default Object.fromEntries([['/legal/privacy',Privacy],['/legal/terms',Terms],['/legal/tokushoho',Commercial]].map(([url,Component])=>[url,renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:[url]},React.createElement(Component)))]));`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external',loader:{'.css':'empty'},outfile:output});
try {
 const {default:pages}=await import(pathToFileURL(output).href);
 await mkdir('server/src/generated',{recursive:true});
 await writeFile('server/src/generated/publicPages.json',JSON.stringify(pages,null,2)+'\n');
 console.log('Prerendered '+Object.keys(pages).length+' existing legal pages');
} finally { await rm(output,{force:true}); }
