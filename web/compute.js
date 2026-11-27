import {benchmark} from './engine.js';
self.onmessage=({data})=>{
  try{const result=benchmark(data,p=>self.postMessage({progress:p}));self.postMessage({result});}
  catch(error){self.postMessage({error:error.message});}
};
