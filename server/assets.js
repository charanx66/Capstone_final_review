export const assets=['/index.html','/web/style.css','/web/ui.js','/web/engine.js','/web/compute.js','/web/sobol.js','/results/browser-reference.json'];
export const types={html:'text/html',js:'text/javascript',css:'text/css',json:'application/json'};
export function serveAsset(path,files){
  const key=path==='/'?'/index.html':path;
  if(!Object.hasOwn(files,key))return new Response('Page not found',{status:404});
  return new Response(files[key],{headers:{'content-type':types[key.split('.').at(-1)]+'; charset=utf-8','x-content-type-options':'nosniff','cache-control':'no-cache'}});
}
