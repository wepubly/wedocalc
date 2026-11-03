// Full editorial lifecycle in disposable local D1/R2; never writes remote articles.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const cms=resolve(process.argv[2]),require=createRequire(cms+'/package.json');
const {Miniflare,convertV4MiniflareOptions}=require('miniflare'),{build}=require('esbuild');
const built=await build({entryPoints:[cms+'/worker/homeimprovement-validation.ts'],bundle:true,format:'esm',write:false});
assert.doesNotMatch(readFileSync(cms+'/worker/homeimprovement-validation.ts','utf8'),/async scheduled/); // wrapper exports fetch only
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-10-01',bindings:{ENVIRONMENT:'staging',PUBLIC_ORIGIN:'https://homeimprovement.tools',HI_EDITORIAL_WRITES:'enabled'},d1Databases:{DB:'disposable-editorial'},r2Buckets:['MEDIA'],serviceBindings:{ASSETS:()=>new Response('<html><body>CMS</body></html>',{headers:{'Content-Type':'text/html'}})}}));
const origin='https://homeimprovement.tools';
async function req(path,method='GET',data,expected=200,host=origin){const r=await mf.dispatchFetch(host+path,{method,headers:{Origin:host,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});const raw=await r.text();assert.equal(r.status,expected,method+' '+path+' '+raw.slice(0,200));assert.match(r.headers.get('x-robots-tag'),/noindex/);return {raw,json:()=>JSON.parse(raw)};}
try{
 const db=await mf.getD1Database('DB');
 for(const f of readdirSync(cms+'/migrations').filter(f=>f.endsWith('.sql')).sort()){
  const sql=readFileSync(cms+'/migrations/'+f,'utf8').replace(/^\s*--.*$/gm,'');
  for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();
 }
 assert.equal((await req('/api/editorial/session')).json().authenticated,true);
 const payload={seoTitle:'Local paint guide',title:'Local isolated paint guide',slug:'local-isolated-paint-guide',excerpt:'Measure paint coverage.',body:'## Measure\nUse the [calculator](/paint-calculator/).',language:'en-US',tags:[],category:'Home & Garden',categoryId:'home-garden',subcategoryId:'paint-calculators',calculatorId:'paint-calculator',coverId:'',coverAlt:'',description:'Local fixture only.',sources:[],relatedIds:[]};
 const id=(await req('/api/editorial/articles','POST',payload,201)).json().id;
 const article=(await req('/api/editorial/articles/'+id)).json();assert.equal(article.digest,createHash('sha256').update(JSON.stringify(article.snapshot)).digest('hex'));
 await req('/api/editorial/articles/'+id+'/schedule','POST',{version:1,runAt:new Date(Date.now()+3600000).toISOString()},409);
 await req('/api/editorial/articles/'+id+'/submit-review','POST',{version:1,actor:'Escritor',notes:'Enviado ao Auditor externo.'});
 await req('/api/editorial/articles/'+id+'/approve','POST',{version:1,actor:'Escritor',notes:'Aprovação externa de teste; SHA-256 '+article.digest});
 await req('/api/editorial/articles/'+id+'/schedule','POST',{version:1,runAt:new Date(Date.now()+3600000).toISOString()});
 await req('/api/editorial/articles/'+id,'PUT',{...article.snapshot,title:'Local revised guide',version:1});
 assert.equal((await req('/api/editorial/schedules')).json()[0].status,'cancelled');
 await req('/api/editorial/articles/'+id+'/publish','POST',{version:1},409);
 await req('/api/editorial/articles/'+id+'/publish','POST',{version:2},409);
 for(const action of ['submit-review','approve'])await req('/api/editorial/articles/'+id+'/'+action,'POST',{version:2,actor:'Escritor',notes:'External approval for v2 local fixture.'});
 await req('/api/editorial/articles/'+id+'/publish','POST',{version:2});
 const path='/home-garden/paint-calculators/paint-calculator/local-isolated-paint-guide/';
 assert.match((await req(path)).raw,/https:\/\/homeimprovement.tools/);
 await req('/api/editorial/articles/'+id+'/unpublish','POST');await req(path,'GET',undefined,404);
 for(const host of ['https://homeimprovement-tools.pages.dev','https://homeimprovement-editorial.alex-b81.workers.dev'])await req('/api/editorial/articles','POST',payload,423,host);
 await req('/not-editorial','POST',{},423);
 const cross=await mf.dispatchFetch(origin+'/api/editorial/articles',{method:'POST',headers:{Origin:'https://other.test','Content-Type':'application/json'},body:'{}'});assert.equal(cross.status,403);
 assert.match((await req('/admin')).raw,/automática desligada/);
 console.log('PASS local isolated writer: draft/version/hash, external review recorded by Writer, approval, scheduling, cancellation on edit, manual publish/unpublish, noindex, alternate-host and cross-origin protection.');
}finally{await mf.dispose();}
