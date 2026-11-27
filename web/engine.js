import {directions} from './sobol.js';
const methods = ['Random','Sobol','Gaussian process','Trust-region GP','GP expected improvement','Differential evolution'];
const mean = a => a.reduce((sum,x)=>sum+x,0)/a.length;

function generator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ state >>> 15, state | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Cholesky factor of K + jitter for a Gaussian-process posterior.
function normalCdf(z) {
  // Five-term approximation of the standard normal distribution function.
  const t=1/(1+.2316419*Math.abs(z));
  const tail=Math.exp(-z*z/2)/Math.sqrt(2*Math.PI)*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
  return z>=0?1-tail:tail;
}

function differentialTrial(population,target,random){
  const donors=population.filter((_,i)=>i!==target);
  for(let i=0;i<3;i++){
    const j=i+Math.floor(random()*(donors.length-i));
    [donors[i],donors[j]]=[donors[j],donors[i]];
  }
  const [a,b,c]=donors, forced=Math.floor(random()*a.length);
  return population[target].map((v,j)=>j===forced||random()<.7?Math.max(0,Math.min(1,a[j]+.6*(b[j]-c[j]))):v);
}

function gpModel(points, observed, dimension, expectedImprovement) {
  const n=points.length, L=new Float64Array(n*n);
  function kernel(a,b) {
    let distance=0;
    for(let j=0;j<dimension;j++) distance+=(a[j]-b[j])**2;
    return Math.exp(-distance/(2*.28**2*dimension));
  }
  for(let i=0;i<n;i++) for(let j=0;j<=i;j++) {
    let value=kernel(points[i],points[j])+(i===j?.01:0);
    for(let k=0;k<j;k++) value-=L[i*n+k]*L[j*n+k];
    L[i*n+j]=i===j?Math.sqrt(value):value/L[j*n+j];
  }
  const avg=mean(observed), scale=Math.sqrt(mean(observed.map(v=>(v-avg)**2)))||1;
  const alpha=Float64Array.from(observed,v=>(v-avg)/scale);
  for(let i=0;i<n;i++){
    for(let j=0;j<i;j++) alpha[i]-=L[i*n+j]*alpha[j];
    alpha[i]/=L[i*n+i];
  }
  // Both alpha and k are whitened; their dot product is the posterior mean.
  const cross=new Float64Array(n);
  const incumbent=(Math.min(...observed)-avg)/scale;
  return candidate=>{
    let prediction=0,variance=1;
    for(let i=0;i<n;i++){
      let value=kernel(points[i],candidate);
      for(let j=0;j<i;j++) value-=L[i*n+j]*cross[j];
      cross[i]=value/L[i*n+i];
      prediction+=alpha[i]*cross[i]; variance-=cross[i]**2;
    }
    const sd=Math.sqrt(Math.max(variance,0));
    if(expectedImprovement){
      const gain=incumbent-prediction;
      if(sd<1e-10)return -Math.max(0,gain);
      const z=gain/sd;
      return -(gain*normalCdf(z)+sd*Math.exp(-.5*z*z)/Math.sqrt(2*Math.PI));
    }
    return prediction-1.6*sd;
  };
}

export function benchmark(config, progress=()=>{}) {
  const {d,active,budget,seed,noise,constrained,objective}=config;
  if(![d,active,budget,seed].every(Number.isInteger)||d<2||d>100||active<1||active>d||
    budget<12||budget>120||seed<0||seed>999999||!Number.isFinite(noise)||noise<0||noise>1||
    !['Sphere','Rastrigin'].includes(objective)) throw Error('Check the task settings and try again.');
  const rng=generator(seed), coords=Array.from({length:d},(_,i)=>i);
  for(let i=d-1;i>0;i--){const j=Math.floor(rng()*(i+1));[coords[i],coords[j]]=[coords[j],coords[i]];}
  const center=Array.from({length:active},()=>.15+.3*rng());
  const loss=p=>mean(center.map((c,i)=>{
    const z=p[coords[i]]-c;
    return objective==='Sphere'?z*z:(5.12*z)**2+10*(1-Math.cos(2*Math.PI*5.12*z));
  }));
  const allowed=p=>!constrained||mean(p)<=.5;
  function randomPoint(random){return Array.from({length:d},random);}
  function feasible(draw){let p;do{p=draw();}while(!allowed(p));return p;}
  const warm=Array.from({length:6},()=>feasible(()=>randomPoint(rng)));
  const errors=Array.from({length:budget},()=>noise*Math.sqrt(-2*Math.log(1-rng()))*Math.cos(2*Math.PI*rng()));
  const target=Math.min(...warm.map(loss))*.5;
  const rows=methods.map((method,m)=>{
    const start=performance.now(), random=generator(seed+10007*(m+1));
    const points=[],observed=[],trace=[],shift=Array.from({length:d},()=>Math.floor(random()*4096));
    const population=warm.slice(),fitness=[];
    let sequence=0, radius=.5,wins=0,misses=0,best=0;
    function sobol(){
      const gray=sequence^(sequence>>>1); sequence++;
      return shift.map((mask,j)=>{
        for(let k=0;k<12;k++) if(gray&(1<<k)) mask^=directions[j][k];
        return mask/4096;
      });
    }
    for(let i=0;i<budget;i++){
      let p;
      const targetIndex=i%warm.length;
      if(i<6) p=warm[i];
      else if(m===0) p=feasible(()=>randomPoint(random));
      else if(m===1) p=feasible(sobol);
      else if(method==='Differential evolution'){
        // A bounded retry avoids stalling on constrained populations.
        for(let attempt=0;attempt<32&&!p;attempt++){
          const trial=differentialTrial(population,targetIndex,random);
          if(allowed(trial))p=trial;
        }
        if(!p)p=feasible(()=>randomPoint(random));
      }else {
        const acquisition=gpModel(points,observed,d,method==='GP expected improvement');
        let lowest=Infinity;
        for(let j=0;j<128;j++){
          const trial=Array.from({length:d},(_,k)=>{
            if(method!=='Trust-region GP') return random();
            const low=Math.max(0,points[best][k]-radius),high=Math.min(1,points[best][k]+radius);
            return low+(high-low)*random();
          });
          if(!allowed(trial)) continue;
          const score=acquisition(trial);
          if(score<lowest){lowest=score;p=trial;}
        }
        if(!p) p=feasible(()=>randomPoint(random));
      }
      const value=loss(p), measurement=value+errors[i], improved=i===0||measurement<observed[best];
      if(method==='Differential evolution'&&(i<6||measurement<=fitness[targetIndex])){
        population[targetIndex]=p;fitness[targetIndex]=measurement;
      }
      if(m===3&&i>=6){
        wins=improved?wins+1:0; misses=improved?0:misses+1;
        if(wins===3){radius=Math.min(.8,radius*2);wins=0;}
        if(misses===4){radius=Math.max(.035,radius/2);misses=0;}
      }
      if(improved) best=i;
      points.push(p);observed.push(measurement);trace.push(i?Math.min(value,trace[i-1]):value);
      if(i%5===0||i===budget-1) progress({method,completed:m*budget+i+1,total:methods.length*budget});
    }
    const reached=trace.findIndex(v=>v<=target);
    return {method,trace,final_gap:trace.at(-1),mean_gap:mean(trace),target_calls:reached<0?budget+1:reached+1,
      seconds:(performance.now()-start)/1000,score:0,contributions:{}};
  });
  let baseline=0;
  for(const [key,weight] of Object.entries({final_gap:50,mean_gap:30,target_calls:20})){
    const vals=rows.map(r=>r[key]), high=Math.max(...vals), low=Math.min(...vals);
    const points=vals.map(v=>high===low?weight/2:weight*(high-v)/(high-low)),avg=mean(points);
    baseline+=avg;
    rows.forEach((r,i)=>{r.score+=points[i];r.contributions[key]=points[i]-avg;});
  }
  return {engine:'browser-gp-v2',config,rows:rows.sort((a,b)=>b.score-a.score),target,baseline};
}
