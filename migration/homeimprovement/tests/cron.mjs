// Exercise real exported scheduled handler with disposable local D1 and R2 bindings.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const cms=resolve(process.argv[2]),require=createRequire(cms+'/package.json');
const {Miniflare,convertV4MiniflareOptions}=require('miniflare'),{build}=require('esbuild');
const code=(await build({entryPoints:[cms+'/worker/homeimprovement-validation.ts'],bundle:true,format:'esm',write:false})).outputFiles[0].text;
const runtime=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;
const origin='https://homeimprovement.tools';
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:code,compatibilityDate:'2026-10-01',bindings:{ENVIRONMENT:'staging',PUBLIC_ORIGIN:origin,HI_EDITORIAL_WRITES:'enabled',HI_EDITORIAL_CRON:'enabled'},d1Databases:{DB:'cron-fixture'},r2Buckets:['MEDIA'],serviceBindings:{ASSETS:()=>new Response('<body>CMS</body>',{headers:{'Content-Type':'text/html'}})}}));
async function req(path,data){const r=await mf.dispatchFetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});assert.ok(r.status===200||r.status===201,await r.clone().text());return r.json();}
try{
 const db=await mf.getD1Database('DB'),media=await mf.getR2Bucket('MEDIA');
 for(const f of readdirSync(cms+'/migrations').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync(cms+'/migrations/'+f,'utf8').replace(/^\s*--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 const env={DB:db,MEDIA:media,ENVIRONMENT:'staging',PUBLIC_ORIGIN:origin,HI_EDITORIAL_CRON:'enabled'};
 async function fixture(slug,approved=true){const payload={title:'Cron fixture '+slug,seoTitle:'Cron '+slug,slug,excerpt:'Local fixture.',body:'## Local guide\nUse [calculator](/paint-calculator/).',language:'en-US',categoryId:'home-garden',subcategoryId:'paint-calculators',calculatorId:'paint-calculator',category:'Home & Garden',tags:[],coverId:'',coverAlt:'',description:'Local cron test.',sources:[],relatedIds:[]};const {id}=await req('/api/editorial/articles',payload);if(approved){for(const action of ['submit-review','approve'])await req('/api/editorial/articles/'+id+'/'+action,{version:1,actor:'Escritor',notes:'External approval fixture.'});await req('/api/editorial/articles/'+id+'/schedule',{version:1,runAt:new Date(Date.now()+86400000).toISOString()});}return id;}
 const due=await fixture('due-fixture'),future=await fixture('future-fixture'),unapproved=await fixture('unapproved-fixture',false);
 await db.prepare("UPDATE schedules SET run_at='2000-01-01T00:00:00.000Z' WHERE article_id=?").bind(due).run();
 await db.prepare("INSERT INTO schedules(id,article_id,version,run_at,status,created_at) VALUES('bad-fixture',?,1,'2000-01-01T00:00:00.000Z','queued','2000-01-01T00:00:00.000Z')").bind(unapproved).run();
 await runtime.scheduled({}, {...env,HI_EDITORIAL_CRON:'disabled'});assert.equal((await db.prepare('SELECT published_version FROM articles WHERE id=?').bind(due).first()).published_version,null);
 await assert.rejects(runtime.scheduled({}, {...env,PUBLIC_ORIGIN:'https://metricpedia.com'}),/Invalid migration/);
 await runtime.scheduled({},env);
 assert.equal((await db.prepare('SELECT published_version FROM articles WHERE id=?').bind(due).first()).published_version,1);
 for(const id of [future,unapproved])assert.equal((await db.prepare('SELECT published_version FROM articles WHERE id=?').bind(id).first()).published_version,null);
 assert.ok((await db.prepare("SELECT last_error FROM schedules WHERE id='bad-fixture'").first()).last_error);
 const events=(await db.prepare("SELECT COUNT(*) n FROM editorial_events WHERE action='scheduled-publication'").first()).n;assert.equal(events,1);
 await runtime.scheduled({},env);assert.equal((await db.prepare("SELECT COUNT(*) n FROM editorial_events WHERE action='scheduled-publication'").first()).n,1);
 const r=await mf.dispatchFetch(origin+'/admin');assert.match(await r.text(),/aprovada e ativada/);assert.match(r.headers.get('x-robots-tag'),/noindex/);
 console.log('PASS actual scheduled export: explicit enable, destination guard, approved due publishes once, future stays queued, unapproved blocked with recorded error, no duplicate on retry, noindex banner.');
}finally{await mf.dispose();}
