import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {api} from './api.js';
import {assets,serveAsset} from './assets.js';
const root=new URL('../',import.meta.url);
export function startServer(filename,port,host='127.0.0.1'){
  const database=new DatabaseSync(filename);
  if(!database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'").get())
    database.exec('BEGIN;'+readFileSync(new URL('drizzle/0000_notebook.sql',root),'utf8')+'COMMIT;');
  const db={prepare(sql){const stmt=database.prepare(sql);return {bind(...params){return {
    first:()=>stmt.get(...params),all:()=>({results:stmt.all(...params)}),run:()=>({meta:stmt.run(...params)})
  };}};}};
  const files=Object.fromEntries(assets.map(p=>[p,readFileSync(new URL(p.slice(1),root),'utf8')]));
  const server=http.createServer(async(req,res)=>{
    try{
      const chunks=[];let length=0;
      for await (const part of req){length+=part.length;if(length>80000){res.writeHead(413).end();return;}chunks.push(part);}
      const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,body:chunks.length?Buffer.concat(chunks):undefined});
      const path=new URL(request.url).pathname;
      const out=path.startsWith('/api/')?await api(request,db):serveAsset(path,files);
      res.writeHead(out.status,Object.fromEntries(out.headers));res.end(Buffer.from(await out.arrayBuffer()));
    }catch(err){console.error(err.message);res.writeHead(500).end('Notebook request failed');}
  });
  server.on('close',()=>database.close());return server.listen(port,host);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const portArg=process.argv.indexOf('--port');
  const port=Number(portArg>=0?process.argv[portArg+1]:process.env.PORT||8000);
  startServer(process.env.LAB_DB||fileURLToPath(new URL('notebook.sqlite',root)),port,process.env.HOST||'127.0.0.1');
  console.log('Optimizer Lab: http://127.0.0.1:'+port);
}
