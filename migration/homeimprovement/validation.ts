// Validation entry point: independent resources only, no scheduled handler.
import pages from './pages';
import type {Env} from './types';
function isolated(env:Env){
 if(env.PUBLIC_ORIGIN!=='https://homeimprovement.tools'||env.ENVIRONMENT!=='staging')throw Error('Invalid migration environment');
}
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  isolated(env);
  if(!['GET','HEAD'].includes(request.method))return new Response('Editorial writes disabled during migration validation',{status:423,headers:{'X-Robots-Tag':'noindex,nofollow,noarchive'}});
  const url=new URL(request.url);
  if(url.pathname==='/robots.txt')return new Response('User-agent: *\nDisallow: /\n',{headers:{'Content-Type':'text/plain','X-Robots-Tag':'noindex,nofollow,noarchive'}});
  const response=await pages.fetch(request,env);
  const headers=new Headers(response.headers);
  headers.set('X-Robots-Tag','noindex, nofollow, noarchive');headers.set('Cache-Control','no-store');
  // Render-time normalization preserves immutable version snapshots and approval hashes.
  const type=headers.get('Content-Type')||'';
  if(!url.pathname.startsWith('/api/editorial/') && /text\/html|xml|text\/markdown/.test(type)){
   const rendered=(await response.text()).replaceAll('https://metricpedia.com','https://homeimprovement.tools');
   headers.delete('Content-Length');headers.delete('ETag');
   return new Response(request.method==='HEAD'?null:rendered,{status:response.status,headers});
  }
  return new Response(response.body,{status:response.status,headers});
 }
};
