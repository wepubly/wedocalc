// Owner-authorized destination cron activation. No source writes or data migration.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const account='b81896777d206a2239625d9cf2e8a40b',source='1c9862e9-9824-4dbb-9d42-0c2a52ed1ae5',dest='4674c99c-cb26-47af-a557-19f097678ec6';
const base='https://api.cloudflare.com/client/v4/accounts/'+account,token=process.env.CLOUDFLARE_API_TOKEN,cms=process.env.HI_PREPARED_CMS;
assert.ok(token&&cms);assert.equal(process.env.HI_CRON_AUTHORIZED,'2026-11-03');
const report={at:new Date().toISOString(),run:process.env.GITHUB_RUN_ID,mode:'scheduled-editorial-noindex',checks:[]};
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
 await sourceIdentity();
 report.sourceCronBefore=await api('/workers/scripts/metricpedia-editorial-lab/schedules');
 const p=await api('/pages/projects/homeimprovement-tools');bindings(p);report.previousPagesDeployment=p.canonical_deployment.id;
 report.previousWorkerDeployment=(await api('/workers/scripts/homeimprovement-editorial/deployments')).deployments[0];
 const settings=await api('/workers/scripts/homeimprovement-editorial/settings');
 assert.equal(settings.bindings.find(b=>b.name==='DB').id,dest);assert.equal(settings.bindings.find(b=>b.name==='MEDIA').bucket_name,'homeimprovement-editorial-media');
 report.previousCron=await api('/workers/scripts/homeimprovement-editorial/schedules');
 assert.ok(report.previousCron.schedules.every(s=>s.cron==='* * * * *'));
 report.queueBefore=await query(dest,"SELECT s.id,s.article_id,s.version,s.run_at,s.last_error,a.draft_version,r.status review_status FROM schedules s JOIN articles a ON a.id=s.article_id LEFT JOIN editorial_reviews r ON r.article_id=s.article_id AND r.version=s.version WHERE s.status='queued' ORDER BY s.run_at");
 for(const row of report.queueBefore){assert.equal(row.version,row.draft_version,'Queued version is stale');assert.equal(row.review_status,'approved','Queued version lacks approval');assert.equal(row.last_error,null,'Queue contains recorded error');assert.ok(Number.isFinite(Date.parse(row.run_at)));}
 report.countsBefore=await query(dest,"SELECT (SELECT COUNT(*) FROM articles) articles,(SELECT COUNT(*) FROM articles WHERE published_version IS NOT NULL) published,(SELECT COUNT(*) FROM article_versions) versions");
 report.checks.push('Destination bindings and queued versions/approvals verified before activation');
 const cfg=JSON.parse(readFileSync(cms+'/wrangler.template.json','utf8'));assert.equal(cfg.name,'homeimprovement-editorial');assert.equal(cfg.r2_buckets[0].bucket_name,'homeimprovement-editorial-media');cfg.d1_databases[0].database_id=dest;cfg.vars.HI_EDITORIAL_WRITES='enabled';cfg.vars.HI_EDITORIAL_CRON='enabled';cfg.triggers.crons=['* * * * *'];writeFileSync(cms+'/wrangler.homeimprovement.json',JSON.stringify(cfg));
 command(['deploy','--config','wrangler.homeimprovement.json','--dry-run']);
 command(['deploy','--config','wrangler.homeimprovement.json']);
 report.workerDeployed=true;
 report.activeCron=await api('/workers/scripts/homeimprovement-editorial/schedules');assert.deepEqual(report.activeCron.schedules.map(s=>s.cron),['* * * * *']);
 await api('/pages/projects/homeimprovement-tools','PATCH',{deployment_configs:{production:{env_vars:{...p.deployment_configs.production.env_vars,HI_EDITORIAL_CRON:{type:'plain_text',value:'enabled'}}}}});
 command(['pages','deploy','dist','--project-name','homeimprovement-tools','--branch','main','--commit-hash',process.env.GITHUB_SHA,'--commit-dirty=true']);
 const finalPage=await api('/pages/projects/homeimprovement-tools');bindings(finalPage);report.pagesDeployment=finalPage.canonical_deployment.id;
 const origin='https://homeimprovement.tools';
 for(const path of ['/admin','/api/editorial/articles','/api/editorial/schedules','/','/blog/','/paint-calculator/','/robots.txt']){const r=await fetch(origin+path);assert.equal(r.status,200,path);assert.match(r.headers.get('x-robots-tag')||'',/noindex/);const text=await r.text();if(path==='/admin')assert.ok(text.includes('aprovada e ativada'));if(path==='/robots.txt')assert.equal(text,'User-agent: *\nDisallow: /\n');}
 const finalSettings=await api('/workers/scripts/homeimprovement-editorial/settings');assert.equal(finalSettings.bindings.find(b=>b.name==='DB').id,dest);assert.equal(finalSettings.bindings.find(b=>b.name==='MEDIA').bucket_name,'homeimprovement-editorial-media');assert.equal(finalSettings.bindings.find(b=>b.name==='HI_EDITORIAL_CRON').text,'enabled');
 await sourceIdentity();report.sourceCronAfter=await api('/workers/scripts/metricpedia-editorial-lab/schedules');assert.deepEqual(report.sourceCronAfter.schedules.map(s=>s.cron),report.sourceCronBefore.schedules.map(s=>s.cron));report.sourceUnchanged=true;
 report.queueAfter=await query(dest,"SELECT status,COUNT(*) count FROM schedules GROUP BY status");report.checks.push('One-minute cron active on destination Worker, noindex retained, source deployment and cron unchanged; no artificial remote article created');report.success=true;
}catch(e){report.error=e.message;process.exitCode=1;}finally{writeFileSync('cron-activation.json',JSON.stringify(report,null,2));console.log('CRON_ACTIVATION '+JSON.stringify(report));}
