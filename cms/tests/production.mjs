// Ephemeral CI verification of the actual production entry point, never a deployed test site.
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import assert from 'node:assert/strict';
import {setTimeout as pause} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import {selectDestination,articlePath} from '../src/destination.ts';
const cli='node_modules/wrangler/bin/wrangler.js',config='.production-ci.json',state='.wrangler/production-ci';
const cfg=JSON.parse(readFileSync('wrangler.local.json','utf8'));cfg.main='worker/production.ts';cfg.vars.PUBLIC_ORIGIN='http://127.0.0.1:8792';writeFileSync(config,JSON.stringify(cfg));
function cmd(args){const r=spawnSync(process.execPath,[cli,...args,'--config',config,'--persist-to',state],{encoding:'utf8',env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'}});if(r.status!==0)throw Error(r.stdout+r.stderr);return r.stdout;}
cmd(['d1','migrations','apply','metricpedia-cms-local-db','--local']);
const server=spawn(process.execPath,[cli,'dev','--config',config,'--ip','127.0.0.1','--port','8792','--persist-to',state,'--test-scheduled'],{env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});let output='';server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const origin='http://127.0.0.1:8792';
async function req(path,method='GET',data,expected=200){const r=await fetch(origin+path,{method,headers:{Origin:origin,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,redirect:'manual'});const raw=await r.text();assert.equal(r.status,expected,`${method} ${path}: ${raw.slice(0,300)}`);return {r,raw,json:()=>JSON.parse(raw)};}
try{
 let ready=false;for(let i=0;i<100;i++){try{await req('/api/editorial/session');ready=true;break;}catch{if(server.exitCode!==null)break;await pause(200);}}
 if(!ready)throw Error('Production entry point did not start '+output.slice(-2000));
 const routes=(await req('/api/editorial/routes')).json();assert.equal(routes.length,3);
 const selected=selectDestination(routes,{slug:'example'});
 assert.equal(selected.categoryId,'home-garden');assert.equal(selected.subcategoryId,'paint-calculators');assert.equal(selected.calculatorId,'paint-calculator');assert.equal(articlePath(selected),'/home-garden/paint-calculators/paint-calculator/example/');
 const multiple=[...routes,{id:'paint-cost',kind:'calculator',name:'Paint Cost',path:'/paint-cost/',parent_id:'paint-calculators',state:'live'}];
 assert.equal(selectDestination(multiple,{slug:'example'}).calculatorId,'');
 assert.equal(selectDestination(multiple,{slug:'example',calculatorId:'paint-cost'}).calculatorId,'paint-cost');
 const image=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(image);image.writeUInt32BE(1600,16);image.writeUInt32BE(900,20);
 const upload=await fetch(origin+'/api/editorial/media',{method:'POST',headers:{Origin:origin,'Content-Type':'image/png','X-File-Name':'ci-cover.png'},body:image});assert.equal(upload.status,201);const media=await upload.json();
 const payload={title:'CI Paint Guide',slug:'ci-paint-guide',excerpt:'Measure the room before calculating paint.',body:'## Measure the room\n\nUse the [Paint Calculator](/paint-calculator/) to estimate paint.',author:'Metricpedia Editorial',authorType:'Organization',language:'en-US',tags:[],category:'Home & Garden',categoryId:'home-garden',subcategoryId:'paint-calculators',calculatorId:'paint-calculator',coverId:media.id,coverAlt:'Paint calculator example',seoTitle:'Paint Guide',description:'How to estimate room paint.',sources:[],relatedIds:[]};
 await req('/api/editorial/articles','POST',{...payload,subcategoryId:'home-garden'},400);
 const created=(await req('/api/editorial/articles','POST',payload,201)).json();const id=created.id;
 const saved=(await req('/api/editorial/articles/'+id)).json();assert.equal(saved.snapshot.destination.calculator.name,'Paint Calculator');assert.equal(saved.digest,createHash('sha256').update(JSON.stringify(saved.snapshot)).digest('hex'));
 assert.match((await req('/admin/preview/'+id)).raw,/Home &amp; Garden/);
 const path='/home-garden/paint-calculators/paint-calculator/ci-paint-guide/';
 await req(path,'GET',undefined,404);
 await req('/api/editorial/articles/'+id+'/schedule','POST',{version:1,runAt:new Date(Date.now()+3600000).toISOString()},409);
 for(const action of ['submit-review','approve'])await req('/api/editorial/articles/'+id+'/'+action,'POST',{version:1,actor:'Escritor',notes:'CI external Grok approval reference'});
 await req('/api/editorial/articles/'+id+'/schedule','POST',{version:1,runAt:new Date(Date.now()+3600000).toISOString()});
 await req('/api/editorial/articles/'+id+'/cancel-schedule','POST');assert.equal((await req('/api/editorial/schedules')).json()[0].status,'cancelled');
 await req('/api/editorial/articles/'+id+'/schedule','POST',{version:1,runAt:new Date(Date.now()+7200000).toISOString()});
 cmd(['d1','execute','metricpedia-cms-local-db','--local','--command',`UPDATE schedules SET run_at='2000-01-01T00:00:00.000Z' WHERE article_id='${id}' AND status='queued'`]);
 const scheduled=await fetch(origin+'/__scheduled?cron=*+*+*+*+*');assert.equal(scheduled.status,200);
 const published=await req(path);assert.match(published.raw,new RegExp(origin+path));assert.match(published.raw,/Paint Calculator/);assert.match(published.raw,/canonical/);assert.match((await req('/blog/')).raw,new RegExp(path));assert.match((await req('/sitemap-blog.xml')).raw,new RegExp(path));assert.match((await req(path+'.md')).raw,new RegExp(path));
 assert.equal((await req('/api/editorial/schedules')).json().filter(s=>s.status==='published').length,1);
 await req('/api/editorial/articles/'+id,'PUT',{...saved.snapshot,title:'CI updated guide',version:1});assert.equal((await req('/api/editorial/articles/'+id+'/versions')).json().length,2);
 assert.equal((await req(path)).raw,published.raw);
 await req('/api/editorial/articles/'+id+'/unpublish','POST');await req(path,'GET',undefined,404);
 console.log('PASS Ublong clone: no login, destinations, image, draft, hash, review, scheduling, cancellation, cron, correct public hierarchy, version isolation and withdrawal.');
}finally{server.kill('SIGTERM');try{unlinkSync(config);}catch{}}
