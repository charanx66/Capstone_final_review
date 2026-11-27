const el=id=>document.getElementById(id);
const colors={'Random':'#ce9de0','Sobol':'#ffb478','Gaussian process':'#cce985','Trust-region GP':'#71cddb'};
const names={final_gap:'final gap',mean_gap:'mean gap',target_calls:'calls to target'};
let mode='login',shown,reference,owner,worker,tabSession,pendingSave,revision=0;
async function api(path,body){
  const headers={};
  if(tabSession)headers['X-Notebook-Session']=tabSession;
  if(body!==undefined)headers['Content-Type']='application/json';
  const response=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers,
    credentials:'same-origin',body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();
  if(!response.ok){throw Object.assign(Error(data.error||'Request failed.'),{status:response.status});}
  return data;
}
function chart(data,axes=true){
  const w=740,h=axes?225:150,left=axes?56:0,top=10,bottom=h-(axes?36:8),right=w-8;
  const peak=Math.max(...data.rows.map(r=>r.trace[0]))||1, budget=data.config.budget;
  const y=v=>bottom-v/peak*(bottom-top),x=i=>left+i/(budget-1)*(right-left);
  let content='';
  for(let j=0;j<=4;j++){
    const v=peak*j/4;content+='<path stroke="#365354" d="M'+left+' '+y(v)+'H'+right+'"/>';
    if(axes)content+='<text x="'+(left-6)+'" y="'+(y(v)+4)+'" text-anchor="end">'+v.toPrecision(2)+'</text>';
  }
  for(const r of data.rows)content+='<polyline fill="none" stroke-width="2.7" stroke="'+colors[r.method]+'" points="'+r.trace.map((v,i)=>x(i)+','+y(v)).join(' ')+'"/>';
  if(axes)content+='<text x="'+left+'" y="'+(h-8)+'">1</text><text x="340" y="'+(h-8)+'">Evaluation</text><text x="'+right+'" y="'+(h-8)+'" text-anchor="end">'+budget+'</text>';
  return '<svg class="plot" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Best objective gap by evaluation">'+content+'</svg>';
}
function render(result,type){
  shown=result; const c=result.config;
  el('chartType').textContent=type;el('caption').textContent=c.objective+' · '+c.d+' dimensions · '+c.active+' active · '+c.budget+' evaluations per method · seed '+c.seed;
  el('plot').innerHTML=chart(result);el('legend').innerHTML=Object.entries(colors).map(([k,c])=>'<span><i style="background:'+c+'"></i>'+k+'</span>').join('');
  const tbody=el('ranking');tbody.replaceChildren();
  for(const r of result.rows){
    const tr=tbody.insertRow();
    for(const v of [r.method,r.score.toFixed(1),r.final_gap.toPrecision(3),r.mean_gap.toPrecision(3),r.target_calls>c.budget?'Unreached':r.target_calls,r.seconds.toFixed(3)])tr.insertCell().textContent=v;
  }
  const top=result.rows[0];
  el('explain').textContent=top.method+' scored '+top.score.toFixed(1)+' against a cohort average of '+result.baseline.toFixed(1)+'. Contributions: '+Object.entries(top.contributions).map(([k,v])=>names[k]+' '+(v>=0?'+':'')+v.toFixed(1)).join(', ')+'.';
}
function changeMode(next){
  mode=next;const reg=next==='register';
  el('registerTab').setAttribute('aria-pressed',reg);el('loginTab').setAttribute('aria-pressed',!reg);
  el('authHeading').textContent=reg?'Create your notebook':'Open your notebook';
  el('authIntro').textContent=reg?'Choose a username and a password of at least eight characters.':'Sign in to run benchmarks and revisit your experiments.';
  el('authGo').textContent=reg?'Create account':'Sign in';el('auth').elements.password.autocomplete=reg?'new-password':'current-password';el('authMsg').textContent='';
}
function view(history){
  el('work').hidden=history;el('history').hidden=!history;
  el('historyTab').setAttribute('aria-pressed',history);el('newTab').setAttribute('aria-pressed',!history);
}
function signOutView(){
  revision++;owner=null;tabSession=null;pendingSave=null;el('reauth').hidden=true;worker?.terminate();worker=null;shown=null;
  el('desk').hidden=true;el('identity').hidden=true;el('gate').hidden=false;el('entries').replaceChildren();el('run').disabled=false;el('status').textContent='';el('settings').reset();el('auth').reset();changeMode('login');
}
function enter(user){
  tabSession=user.tabSession||null;owner=user.username;el('user').textContent=owner;
  el('desk').hidden=false;el('identity').hidden=false;el('gate').hidden=true;view(false);render(reference,'Reference run');
}
el('loginTab').onclick=()=>changeMode('login');el('registerTab').onclick=()=>changeMode('register');
el('auth').onsubmit=async e=>{
  e.preventDefault();el('authGo').disabled=true;
  try{
    enter(await api(mode,Object.fromEntries(new FormData(e.target))));el('auth').reset();
    const pending=pendingSave;pendingSave=null;
    if(pending&&pending.owner===owner){
      render(pending.result,'Current run');
      await saveResult(pending.result,revision);
    }
  }
  catch(err){el('authMsg').textContent=err.message;}finally{el('authGo').disabled=false;}
};
el('logout').onclick=async()=>{try{await api('logout',{});signOutView();}catch(err){if(err.status===401)signOutView();else alert(err.message);}};
el('newTab').onclick=()=>view(false);
el('historyTab').onclick=async()=>{
  const stamp=revision;view(true);const box=el('entries');box.textContent='Loading experiments…';
  try{const rows=await api('runs');if(stamp!==revision)return;box.textContent=rows.length?'':'Your first completed benchmark will appear here.';
    for(const row of rows){const b=document.createElement('button');b.className='entry';b.textContent=row.title;const t=document.createElement('time');t.textContent=new Date(row.created).toLocaleString();b.append(t);
      b.onclick=async()=>{try{const r=await api('runs/'+row.id);if(stamp!==revision)return;render(r,'Saved run');
        for(const [name,value] of Object.entries(r.config)){const input=el('settings').elements[name];if(input.type==='checkbox')input.checked=value;else input.value=value;}el('status').textContent='Opened from your notebook.';view(false);}
        catch(err){box.textContent=err.message;}};box.append(b);}
  }catch(err){box.textContent=err.message;}
};
el('reauth').onclick=()=>{
  const pending=pendingSave;
  signOutView();pendingSave=pending;
  el('authMsg').textContent='Sign in to the same account to save this run.';
};
async function saveResult(result,stamp){
  try{
    await api('runs',{result});
    if(stamp===revision){render(result,'Saved run');el('status').textContent='Saved to your experiments.';}
  }catch(err){
    if(stamp!==revision)return;
    el('status').textContent='Result ready. '+(err.status===401?'Your session expired. Sign in to save, or export the JSON.':'Save failed. Export the JSON to keep this run.');
    if(err.status===401){pendingSave={owner,result};el('reauth').hidden=false;}
  }
}
el('settings').onsubmit=e=>{
  e.preventDefault();const f=e.target.elements;
  const c={objective:f.objective.value,constrained:f.constrained.checked};
  for(const k of ['d','active','budget','noise','seed'])c[k]=Number(f[k].value);
  if(c.active>c.d){el('status').textContent='Active dimensions must fit within total dimensions.';return;}
  pendingSave=null;el('reauth').hidden=true;el('run').disabled=true;el('status').textContent='Starting benchmark…';const stamp=revision;
  worker=new Worker('/web/compute.js',{type:'module'});
  function finish(){worker?.terminate();worker=null;el('run').disabled=false;}
  worker.onerror=()=>{el('status').textContent='The benchmark worker stopped. Try running it again.';finish();};
  worker.onmessage=async({data})=>{
    if(data.progress){const p=data.progress;el('status').textContent=p.method+' · '+p.completed+' / '+p.total+' evaluations';return;}
    if(data.error){el('status').textContent=data.error;finish();return;}
    render(data.result,'Current run');el('status').textContent='Saving experiment…';
    await saveResult(data.result,stamp);
    if(stamp===revision)finish();
  };worker.postMessage(c);
};
el('export').onclick=()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(shown,null,2)],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download=shown.config.objective+'-seed-'+shown.config.seed+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
};
try{reference=await (await fetch('/results/browser-reference.json')).json();el('coverPlot').innerHTML=chart(reference,false);
  const response=await fetch('/api/me');if(response.ok)enter(await response.json());}
catch{el('authMsg').textContent='Could not load the notebook. Refresh to try again.';}
