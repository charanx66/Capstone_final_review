// Embed the small static client in the deployable Worker. No runtime CDN dependencies.
import {mkdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {assets} from '../server/assets.js';
mkdirSync('dist/server',{recursive:true});mkdirSync('dist/.openai',{recursive:true});
const text=p=>readFileSync(p,'utf8');
const files=Object.fromEntries(assets.map(p=>[p,text('.'+p)]));
const moduleBody=p=>text(p).replace(/^export /gm,'');
const handler=`
export default {async fetch(request,env){
  const path=new URL(request.url).pathname;
  return path.startsWith('/api/')?api(request,env.DB):serveAsset(path,files);
}};
`;
writeFileSync('dist/server/index.js',[moduleBody('server/api.js'),moduleBody('server/assets.js'),'const files='+JSON.stringify(files)+';',handler].join('\n'));
copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
