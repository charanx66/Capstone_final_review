import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../server/local.js';
import {benchmark} from '../web/engine.js';
const config={objective:'Sphere',d:20,active:5,budget:40,seed:7,noise:0,constrained:false};
test('common starts, score decomposition and repeatability',()=>{
  for(const c of [config,{...config,d:100,budget:18,constrained:true,noise:.1,objective:'Rastrigin'}]){
    const a=benchmark(c),b=benchmark(c);
    a.rows.forEach((r,i)=>{
      assert.deepEqual(r.trace,b.rows[i].trace);assert.equal(r.trace.length,c.budget);
      assert.deepEqual(r.trace.slice(0,6),a.rows[0].trace.slice(0,6));
      assert.ok(r.trace.every((v,j)=>!j||v<=r.trace[j-1]));
      assert.ok(Math.abs(r.score-a.baseline-Object.values(r.contributions).reduce((x,y)=>x+y,0))<1e-7);
    });
  }
});
test('register, authenticate, compute, persist across restart, isolate histories and sign out',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'lab-test-')),file=join(dir,'runs.sqlite');
  let server,base;
  async function start(){server=startServer(file,0);await once(server,'listening');base='http://127.0.0.1:'+server.address().port;}
  async function stop(){await new Promise(ok=>server.close(ok));}
  function request(path,body,cookie){return fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});}
  await start();
  try{
    const account={username:'test_one',password:'test-only-password'};
    assert.equal((await request('runs')).status,401);
    const registered=await request('register',account);assert.equal(registered.status,200);
    assert.equal((await request('register',account)).status,409);
    assert.equal((await request('login',{...account,password:'wrong-password'})).status,401);
    const login=await request('login',account),cookie=login.headers.get('set-cookie').split(';')[0];
    const result=benchmark(config);const saved=await request('runs',{result},cookie);assert.equal(saved.status,201);
    const {id}=await saved.json();await stop();await start();
    assert.equal((await (await request('runs',null,cookie)).json())[0].id,id);
    assert.deepEqual(await (await request('runs/'+id,null,cookie)).json(),result);
    const other=(await request('register',{...account,username:'test_two'})).headers.get('set-cookie').split(';')[0];
    assert.deepEqual(await (await request('runs',null,other)).json(),[]);assert.equal((await request('runs/'+id,null,other)).status,404);
    assert.equal((await request('logout',{},cookie)).status,200);assert.equal((await request('me',null,cookie)).status,401);
  }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});

test('saving from a tab with cookies withheld uses a revocable session',async()=>{
  const server=startServer(':memory:',0);await once(server,'listening');
  try{
    const base='http://127.0.0.1:'+server.address().port+'/api/';
    const headers={'Content-Type':'application/json'};
    const post=(path,data)=>fetch(base+path,{method:'POST',headers,body:JSON.stringify(data)});
    const account={username:'tab_user',password:'test-only-password'};
    await post('register',account);
    const {tabSession}=await (await post('login',account)).json();
    assert.equal((await fetch(base+'me')).status,401);
    headers['X-Notebook-Session']=tabSession;
    const saved=await post('runs',{result:benchmark(config)});assert.equal(saved.status,201);
    const {id}=await saved.json();
    assert.equal((await fetch(base+'runs/'+id,{headers})).status,200);
    await post('logout',{});
    assert.equal((await fetch(base+'runs/'+id,{headers})).status,401);
  }finally{await new Promise(ok=>server.close(ok));}
});
