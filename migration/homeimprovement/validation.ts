// Isolated editorial entry point: cron is enabled explicitly on the destination Worker only.
import pages from './pages';
import production, {scheduled as publishScheduled} from './production';
// @ts-ignore: reused JavaScript catalogue is covered by its behavior tests.
import {readCatalog,select,card,homeColumns} from './homeimprovement-cards.mjs';
import type {Env} from './types';
function isolated(env:Env){
 if(env.PUBLIC_ORIGIN!=='https://homeimprovement.tools'||env.ENVIRONMENT!=='staging')throw Error('Invalid migration environment');
}
export default {
 async scheduled(_event:ScheduledController,env:Env):Promise<void>{
  isolated(env);
  if((env as Env & {HI_EDITORIAL_CRON?:string}).HI_EDITORIAL_CRON!=='enabled')return;
  await publishScheduled(env);
 },
 async fetch(request:Request,env:Env):Promise<Response>{
  isolated(env);
  const writes=(env as Env & {HI_EDITORIAL_WRITES?:string}).HI_EDITORIAL_WRITES==='enabled';
  if(!['GET','HEAD'].includes(request.method)&&!(writes&&new URL(request.url).origin==='https://homeimprovement.tools'&&new URL(request.url).pathname.startsWith('/api/editorial/')))return new Response('Editorial writes disabled during migration validation',{status:423,headers:{'X-Robots-Tag':'noindex,nofollow,noarchive'}});
  const url=new URL(request.url);
  if(url.pathname==='/robots.txt')return new Response('User-agent: *\nDisallow: /\n',{headers:{'Content-Type':'text/plain','X-Robots-Tag':'noindex,nofollow,noarchive'}});
  let response=await pages.fetch(request,env);
  const slotPage=['/','/paint-calculators','/paint-calculators/','/paint-calculator','/paint-calculator/'].includes(url.pathname);
  if(slotPage && response.headers.get('Content-Type')?.includes('text/html')){
   // In-process read from the destination bindings only: no HTTP request to the origin site.
   const catalogue=await production.fetch(new Request('https://homeimprovement.tools/blog/'),env);
   const rows=await readCatalog(catalogue);
   response=new HTMLRewriter().on('[data-hi-cards]',{element(el){
    const kind=el.getAttribute('data-hi-cards');
    const scope=kind==='home'?{kind:'home'}:kind==='category'?{kind:'category',categoryId:'home-garden',subcategoryId:'paint-calculators'}:{kind:'calculator',categoryId:'home-garden',subcategoryId:'paint-calculators',calculatorId:'paint-calculator'};
    const chosen=select(rows,scope);
    const markup=kind==='home'?homeColumns(chosen,''):chosen.map((row:unknown)=>card(row,kind)).join('');
    el.setInnerContent(markup||'<p>No published guides yet.</p>',{html:true});
   }}).transform(response);
  }
  if(writes&&['/admin','/admin/','/cms','/cms/'].includes(url.pathname)&&response.headers.get('Content-Type')?.includes('text/html')){
   const notice=(env as Env & {HI_EDITORIAL_CRON?:string}).HI_EDITORIAL_CRON==='enabled'
    ? 'HomeImprovement: CMS liberado para o Escritor. Auditoria externa. Publicação automática dos agendamentos aprovada e ativada; verificação a cada minuto em UTC. Site noindex.'
    : 'HomeImprovement: operação manual liberada para o Escritor. Auditoria externa. Publicação automática desligada; agendamentos não serão executados automaticamente. Site noindex.';
   response=new HTMLRewriter().on('body',{element(el){el.prepend('<aside style="padding:12px;background:#fff3cd;color:#332701">'+notice+'</aside>',{html:true});}}).transform(response);
  }
  const headers=new Headers(response.headers);
  headers.set('X-Robots-Tag','noindex, nofollow, noarchive');headers.set('Cache-Control','no-store');
  // Render-time normalization preserves immutable version snapshots and approval hashes.
  const type=headers.get('Content-Type')||'';
  if(!url.pathname.startsWith('/api/editorial/') && /text\/html|xml|text\/markdown/.test(type)){
   const rendered=(await response.text()).replaceAll('metricpedia.com','homeimprovement.tools').replaceAll('Metricpedia.com','homeimprovement.tools').replaceAll('Metricpedia','HomeImprovement');
   headers.delete('Content-Length');headers.delete('ETag');
   return new Response(request.method==='HEAD'?null:rendered,{status:response.status,headers});
  }
  return new Response(response.body,{status:response.status,headers});
 }
};
