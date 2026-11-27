const hex = bytes=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
const bytes = s=>new TextEncoder().encode(s);
const hash = async s=>hex(await crypto.subtle.digest('SHA-256',bytes(s)));
async function derive(password,salt){
  const key=await crypto.subtle.importKey('raw',bytes(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations:100000,salt:bytes(salt)},key,256));
}
function matches(a,b){let diff=a.length^b.length;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
const reply=(data,status=200,headers={})=>Response.json(data,{status,headers:{'cache-control':'no-store',...headers}});
function validResult(r){
  const c=r?.config;
  return r?.engine==='browser-gp-v1'&&c&&['Sphere','Rastrigin'].includes(c.objective)&&
    [c.d,c.active,c.budget,c.seed].every(Number.isInteger)&&c.d>=2&&c.d<=100&&c.active>=1&&c.active<=c.d&&
    c.budget>=12&&c.budget<=120&&c.seed>=0&&c.seed<=999999&&Number.isFinite(c.noise)&&c.noise>=0&&c.noise<=1&&typeof c.constrained==='boolean'&&
    Number.isFinite(r.target)&&Number.isFinite(r.baseline)&&Array.isArray(r.rows)&&r.rows.length===4&&
    new Set(r.rows.map(v=>v?.method)).size===4&&r.rows.every(v=>v&&['Random','Sobol','Gaussian process','Trust-region GP'].includes(v.method)&&
      Array.isArray(v.trace)&&v.trace.length===c.budget&&v.trace.every(Number.isFinite)&&
      [v.score,v.final_gap,v.mean_gap,v.seconds,v.target_calls,...['final_gap','mean_gap','target_calls'].map(k=>v.contributions?.[k])].every(Number.isFinite));
}
export async function api(request,db){
  const url=new URL(request.url),path=url.pathname,post=request.method==='POST';
  if(!post&&request.method!=='GET')return reply({error:'Method not allowed.'},405);
  let body={};
  if(post){
    if((request.headers.get('origin')&&request.headers.get('origin')!==url.origin)||
      !request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'Invalid request origin or content type.'},403);
    const raw=await request.text();
    if(raw.length>75000)return reply({error:'Payload too large.'},413);
    try{body=JSON.parse(raw);}catch{return reply({error:'Invalid JSON.'},400);}
    if(!body||typeof body!=='object')return reply({error:'Invalid request.'},400);
  }
  const query=(sql,...values)=>db.prepare(sql).bind(...values);
  const now=Date.now(),secure=url.protocol==='https:'?'; Secure':'';
  const cookie=(v,age)=>'lab_session='+v+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+age+secure;
  if(post&&['/api/login','/api/register'].includes(path)){
    const username=String(body.username??'').trim().toLowerCase(),pw=body.password;
    if(!/^[a-z0-9_.-]{3,32}$/.test(username)||typeof pw!=='string'||pw.length<8||pw.length>128)return reply({error:'Use a 3–32 character username and an 8–128 character password.'},400);
    let account=await query('SELECT * FROM accounts WHERE username=?',username).first();
    if(path==='/api/register'){
      if(account)return reply({error:'That username is taken.'},409);
      const salt=crypto.randomUUID(),id=crypto.randomUUID(),digest=await derive(pw,salt);
      const ins=await query('INSERT OR IGNORE INTO accounts VALUES (?,?,?,?)',id,username,salt,digest).run();
      if(!ins.meta.changes)return reply({error:'That username is taken.'},409);
      account={id};
    }else{
      const digest=await derive(pw,account?.salt||'unused-account-salt');
      if(!account||!matches(digest,account.digest))return reply({error:'Check your username and password.'},401);
    }
    const token=crypto.randomUUID()+crypto.randomUUID();
    await query('INSERT INTO sessions VALUES (?,?,?)',await hash(token),account.id,now+7*86400000).run();
    return reply({username,tabSession:token},200,{'set-cookie':cookie(token,604800)});
  }
  const cookieToken=request.headers.get('cookie')?.match(/(?:^|;\s*)lab_session=([\w-]{72})(?:;|$)/)?.[1];
  // Embedded browsers can accept the login response but omit the cookie on later requests.
  const presented=request.headers.get('x-notebook-session');
  const token=presented===null?cookieToken:(/^[a-f0-9-]{72}$/.test(presented)?presented:null);
  const digest=token?await hash(token):'';
  const user=token&&await query('SELECT a.id,a.username FROM accounts a JOIN sessions s ON s.owner=a.id WHERE s.token=? AND s.expires>?',digest,now).first();
  if(!user)return reply({error:'Please sign in.'},401);
  if(post&&path==='/api/logout'){await query('DELETE FROM sessions WHERE token=?',digest).run();return reply({},200,{'set-cookie':cookie('',0)});}
  if(!post&&path==='/api/me')return reply({username:user.username});
  if(path==='/api/runs'&&post){
    if(!validResult(body.result))return reply({error:'Incomplete experiment result.'},400);
    const id=crypto.randomUUID(),c=body.result.config,title=c.objective+' · '+c.d+'D · seed '+c.seed;
    await query('INSERT INTO runs VALUES (?,?,?,?,?)',id,user.id,now,title,JSON.stringify(body.result)).run();
    return reply({id,title,created:now},201);
  }
  if(path==='/api/runs'&&!post)return reply((await query('SELECT id,title,created FROM runs WHERE owner=? ORDER BY created DESC',user.id).all()).results);
  if(!post&&path.startsWith('/api/runs/')){
    const item=await query('SELECT result FROM runs WHERE id=? AND owner=?',path.slice(10),user.id).first();
    if(item)return reply(JSON.parse(item.result));
  }
  return reply({error:'Record unavailable.'},404);
}
