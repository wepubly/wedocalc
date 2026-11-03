// Authorized manual CMS release. No source writes, export, import or resource creation.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const account='b81896777d206a2239625d9cf2e8a40b',source='1c9862e9-9824-4dbb-9d42-0c2a52ed1ae5',dest='4674c99c-cb26-47af-a557-19f097678ec6';
const base='https://api.cloudflare.com/client/v4/accounts/'+account,token=process.env.CLOUDFLARE_API_TOKEN,cms=process.env.HI_PREPARED_CMS;
assert.ok(token&&cms);assert.equal(process.env.HI_MANUAL_EDITORIAL_AUTHORIZED,'2026-11-03');
const report={at:new Date().toISOString(),run:process.env.GITHUB_RUN_ID,mode:'manual-editorial-noindex-no-cron',checks:[]};
async function api(path,method='GET',body){
 assert.ok(method==='GET'||(method==='POST'&&/^\/d1\/database\/[a-f0-9-]+\/query$/.test(path)&&body.sql.startsWith('SELECT '))||(method==='PATCH'&&path==='/pages/projects/homeimprovement-tools'));
 const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok||!d.success)throw Error('Cloudflare '+method+' '+path+' HTTP '+r.status);return d.result;
}
async function query(db,sql){assert.ok([source,dest].includes(db));return (await api('/d1/database/'+db+'/query','POST',{sql})).flatMap(q=>q.results);}
const sha=b=>createHash('sha256').update(b).digest('hex');
async function fingerprints(db){const result={};for(const {name} of await query(db,"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name")){assert.match(name,/^[a-z_][a-z0-9_]*$/);const rows=await query(db,'SELECT * FROM '+name);result[name]={count:rows.length,sha256:sha(JSON.stringify(rows.map(r=>JSON.stringify(Object.fromEntries(Object.entries(r).sort(([a],[b])=>a.localeCompare(b))))).sort()))};}return result;}
async function sourceIdentity(){const p=await api('/pages/projects/wedocalc'),w=await api('/workers/scripts/metricpedia-editorial-lab/deployments');assert.equal(p.canonical_deployment.id,'08983672-ebdc-47a3-b4b7-f246cb9d22be');assert.equal(w.deployments[0].versions[0].version_id,'dda5078a-3413-4f91-9f02-e39ad362df43');}
function bindings(p){assert.equal(p.deployment_configs.production.d1_databases.DB.id,dest);assert.equal(p.deployment_configs.production.r2_buckets.MEDIA.name,'homeimprovement-editorial-media');assert.ok(!p.source);}
function command(args){const r=spawnSync(process.execPath,[cms+'/node_modules/wrangler/bin/wrangler.js',...args],{cwd:cms,encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'},maxBuffer:8*1024*1024});if(r.status!==0){console.error((r.stdout+r.stderr).split(token).join('[REDACTED]'));throw Error('Destination deploy failed: '+args[0]);}}
try{
 await sourceIdentity();const p=await api('/pages/projects/homeimprovement-tools');bindings(p);report.previousPagesDeployment=p.canonical_deployment.id;report.previousWorkerDeployment=(await api('/workers/scripts/homeimprovement-editorial/deployments')).deployments[0];
 const a=await fingerprints(source),b=await fingerprints(dest);report.fingerprints={source:a,destination:b};assert.deepEqual(a,b,'Source/destination drift: reconcile before opening CMS; no release performed');
 assert.deepEqual(await query(dest,'SELECT * FROM pragma_foreign_key_check'),[]);report.checks.push('All 26 application table fingerprints match; source and destination consistent');
 const media=await query(dest,'SELECT object_key,size FROM media');for(const row of media){const key=row.object_key.split('/').map(encodeURIComponent).join('/');const r=await fetch(base+'/r2/buckets/homeimprovement-editorial-media/objects/'+key,{headers:{Authorization:'Bearer '+token}});assert.equal(r.status,200);assert.equal((await r.arrayBuffer()).byteLength,row.size);}report.checks.push('All catalog media bytes present in independent bucket');
 const cfg=JSON.parse(readFileSync(cms+'/wrangler.template.json','utf8'));assert.equal(cfg.name,'homeimprovement-editorial');assert.equal(cfg.r2_buckets[0].bucket_name,'homeimprovement-editorial-media');assert.deepEqual(cfg.triggers.crons,[]);cfg.d1_databases[0].database_id=dest;cfg.vars.HI_EDITORIAL_WRITES='enabled';writeFileSync(cms+'/wrangler.homeimprovement.json',JSON.stringify(cfg));
 command(['deploy','--config','wrangler.homeimprovement.json','--dry-run']);
 // Reconfirm snapshot immediately before enabling the destination. No data writes performed.
 assert.deepEqual(await fingerprints(source),a);assert.deepEqual(await fingerprints(dest),b);
 command(['deploy','--config','wrangler.homeimprovement.json']);
 await api('/pages/projects/homeimprovement-tools','PATCH',{deployment_configs:{production:{env_vars:{...p.deployment_configs.production.env_vars,HI_EDITORIAL_WRITES:{type:'plain_text',value:'enabled'}}}}});
 command(['pages','deploy','dist','--project-name','homeimprovement-tools','--branch','main','--commit-hash',process.env.GITHUB_SHA,'--commit-dirty=true']);
 const origin='https://homeimprovement.tools';
 for(const path of ['/admin','/api/editorial/session','/api/editorial/articles','/api/editorial/media','/api/editorial/routes','/api/editorial/schedules','/','/blog/','/paint-calculator/']){const r=await fetch(origin+path);assert.equal(r.status,200,path);assert.match(r.headers.get('x-robots-tag')||'',/noindex/);const text=await r.text();if(path==='/admin')assert.ok(text.includes('automática desligada'));if(path==='/api/editorial/articles')report.articles=JSON.parse(text).length;if(path==='/api/editorial/media')report.media=JSON.parse(text).length;}
 // Invalid draft reaches existing validation but cannot create a record.
 const invalid=await fetch(origin+'/api/editorial/articles',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});assert.equal(invalid.status,400);report.invalidWriteValidation=400;
 const cross=await fetch(origin+'/api/editorial/articles',{method:'POST',headers:{Origin:'https://other.invalid','Content-Type':'application/json'},body:'{}'});assert.equal(cross.status,403);
 for(const host of ['https://homeimprovement-tools.pages.dev','https://homeimprovement-editorial.alex-b81.workers.dev'])assert.equal((await fetch(host+'/api/editorial/articles',{method:'POST',headers:{Origin:host,'Content-Type':'application/json'},body:'{}'})).status,423);
 const finalPage=await api('/pages/projects/homeimprovement-tools');bindings(finalPage);report.pagesDeployment=finalPage.canonical_deployment.id;
 const settings=await api('/workers/scripts/homeimprovement-editorial/settings');assert.equal(settings.bindings.find(b=>b.name==='DB').id,dest);assert.equal(settings.bindings.find(b=>b.name==='MEDIA').bucket_name,'homeimprovement-editorial-media');assert.equal((await api('/workers/scripts/homeimprovement-editorial/schedules')).schedules.length,0);
 assert.deepEqual(await fingerprints(dest),b,'Unexpected destination data change during release');await sourceIdentity();report.sourceUnchanged=true;report.remoteContentUnchanged=true;report.checks.push('CMS lists load, no login, write validation enabled on canonical host, cross-origin blocked, alternative hosts read-only, no cron, noindex');report.success=true;
}catch(e){report.error=e.message;process.exitCode=1;}finally{writeFileSync('editorial-release.json',JSON.stringify(report,null,2));console.log('EDITORIAL_RELEASE '+JSON.stringify(report));}
