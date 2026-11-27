import {benchmark} from '../web/engine.js';
const base={d:20,active:5,budget:40,noise:0,constrained:false};
for(const objective of ['Sphere','Rastrigin']){
  const tally={};
  for(let seed=0;seed<10;seed++){
    const winner=benchmark({...base,objective,seed}).rows[0].method;
    tally[winner]=(tally[winner]||0)+1;
  }
  console.log(objective,tally);
}
