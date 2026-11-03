// Owner-authorized isolated copy. Source is immutable except the explicitly authorized export task.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const account='b81896777d206a2239625d9cf2e8a40b',sourceDB='1c9862e9-9824-4dbb-9d42-0c2a52ed1ae5';
const target={pages:'homeimprovement-tools',worker:'homeimprovement-editorial',database:'homeimprovement-editorial-db',bucket:'homeimprovement-editorial-media'};
const sourceBucket='metricpedia-editorial-lab-media',base='https://api.cloudflare.com/client/v4/accounts/'+account;
const token=process.env.CLOUDFLARE_API_TOKEN,cms=process.env.HI_PREPARED_CMS;
assert.ok(token);assert.ok(cms);assert.equal(process.env.HI_MIGRATION_AUTHORIZED,'2026-11-03');
const report={at:new Date().toISOString(),run:process.env.GITHUB_RUN_ID,target,steps:[],failures:[]};
const save=()=>{writeFileSync('migration-result.json',JSON.stringify(report,null,2));console.log('Checkpoint: '+(report.steps.at(-1)||'initializing'));};
const sha=b=>createHash('sha256').update(b).digest('hex');
const pathForKey=key=>key.split('/').map(encodeURIComponent).join('/');
function allowed(path,method,body){
 if(method==='GET')return;
 if(method==='POST'&&path==='/d1/database'&&body.name===target.database)return;
 if(method==='POST'&&path==='/r2/buckets'&&body.name===target.bucket)return;
 if(method==='POST'&&path==='/pages/projects'&&body.name===target.pages)return;
 if(method==='POST'&&path===`/d1/database/${sourceDB}/export`)return;
 if(method==='POST'&&/^\/d1\/database\/[a-f0-9-]+\/query$/.test(path)&&/^SELECT /i.test(body.sql))return;
 if(method==='PATCH'&&path==='/pages/projects/'+target.pages)return;
 if(method==='POST'&&path==='/pages/projects/'+target.pages+'/domains'&&body.name==='homeimprovement.tools')return;
 if(method==='PUT'&&path.startsWith('/r2/buckets/'+target.bucket+'/objects/'))return;
 throw Error('Write allowlist rejected '+method+' '+path);
}
async function api(path,method='GET',body,optional404=false){
 allowed(path,method,body);
 const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const d=await r.json().catch(()=>({}));
 if(optional404&&r.status===404)return null;
 if(!r.ok||!d.success)throw Error('Cloudflare '+method+' '+path+' HTTP '+r.status+' codes '+(d.errors||[]).map(e=>e.code).join(','));
 return {result:d.result,pagination:d.result_info};
}
async function list(path){const all=[];for(let page=1;page<=100;page++){const d=await api(path+(path.includes('?')?'&':'?')+'per_page=100&page='+page);const rows=Array.isArray(d.result)?d.result:d.result.buckets;assert.ok(Array.isArray(rows));all.push(...rows);if(!d.pagination?.total_pages||page>=d.pagination.total_pages)return all;}throw Error('List pagination limit');}
async function objects(bucket){const all=[];let cursor='';do{const d=await api('/r2/buckets/'+bucket+'/objects?limit=1000'+(cursor?'&cursor='+encodeURIComponent(cursor):''));all.push(...(Array.isArray(d.result)?d.result:d.result.objects));const n=d.pagination?.cursor||d.result.cursor||'';if(n&&n===cursor)throw Error('Repeated cursor');cursor=n;}while(cursor);return all;}
async function bytes(bucket,key){const r=await fetch(base+'/r2/buckets/'+bucket+'/objects/'+pathForKey(key),{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw Error('Object read HTTP '+r.status);return {body:Buffer.from(await r.arrayBuffer()),headers:r.headers};}
async function put(key,body,metadata={}){
 const path='/r2/buckets/'+target.bucket+'/objects/'+pathForKey(key);allowed(path,'PUT');
 const headers={Authorization:'Bearer '+token};if(metadata.contentType)headers['Content-Type']=metadata.contentType;
 for(const [k,v] of Object.entries(metadata.headers||{}))headers[k]=v;
 const r=await fetch(base+path,{method:'PUT',headers,body});if(!r.ok)throw Error('Destination object write HTTP '+r.status);await r.body?.cancel();
}
async function query(db,sql){assert.ok(db===sourceDB||db===report.database_id);return (await api('/d1/database/'+db+'/query','POST',{sql})).result.flatMap(q=>q.results);}
const tables=async db=>(await query(db,"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name")).map(x=>x.name);
async function fingerprints(db){const result={};for(const table of await tables(db)){assert.match(table,/^[a-z_][a-z0-9_]*$/);const rows=await query(db,'SELECT * FROM '+table);const serial=rows.map(row=>JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))))).sort();result[table]={count:rows.length,sha256:sha(JSON.stringify(serial))};}return result;}
function command(args,dir=cms){const r=spawnSync(process.execPath,[cms+'/node_modules/wrangler/bin/wrangler.js',...args],{cwd:dir,encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'},maxBuffer:16*1024*1024});if(r.status!==0){if(args[0]!=='d1')console.error((r.stdout+r.stderr).split(token).join('[REDACTED]'));throw Error('Wrangler operation failed: '+args.slice(0,3).join(' ')+'; details suppressed to protect data');}return r.stdout;}
try{
 const sourcePages=(await api('/pages/projects/wedocalc')).result;
 report.sourceProduction=sourcePages.canonical_deployment?.id;
 assert.equal(report.sourceProduction,'08983672-ebdc-47a3-b4b7-f246cb9d22be');
 let db;
 if(process.env.HI_RESUME_RUN==='41728113194'){
  const dbs=await list('/d1/database'),buckets=await list('/r2/buckets');
  db=dbs.find(d=>d.name===target.database);assert.ok(db&&db.uuid!==sourceDB);report.database_id=db.uuid;
  assert.ok(buckets.some(b=>b.name===target.bucket));
  const marker=JSON.parse((await bytes(target.bucket,'_migration/resource-manifest.json')).body.toString());
  assert.equal(marker.createdByRun,'41728113194');assert.equal(marker.database_id,db.uuid);assert.equal(marker.bucket,target.bucket);assert.equal(marker.account_id,account);
  const managed=(await api('/r2/buckets/'+target.bucket+'/domains/managed')).result;const custom=(await api('/r2/buckets/'+target.bucket+'/domains/custom')).result;assert.equal(managed.enabled,false);assert.equal(custom.domains.length,0);
  const backup=await bytes(target.bucket,'_migration/source-backup.sql');writeFileSync(cms+'/source-backup.sql',backup.body,{mode:0o600});report.sql={bytes:backup.body.length,sha256:sha(backup.body),privateBackupKey:'_migration/source-backup.sql'};
  report.resumedFrom='41728113194';report.privateBucketConfirmed=true;
  report.localRestore={articles:(await query(db.uuid,'SELECT COUNT(*) count FROM articles'))[0].count,versions:(await query(db.uuid,'SELECT COUNT(*) count FROM article_versions'))[0].count};
  const cfg=JSON.parse(readFileSync(cms+'/wrangler.template.json','utf8'));cfg.d1_databases[0].database_id=db.uuid;assert.equal(cfg.name,target.worker);assert.equal(cfg.r2_buckets[0].bucket_name,target.bucket);assert.equal(cfg.triggers.crons.length,0);writeFileSync(cms+'/wrangler.homeimprovement.json',JSON.stringify(cfg,null,2));
  report.steps.push('Existing resources and private backup verified; resume without new export or D1 import');save();
 }else{
 const workers=await list('/workers/scripts'),dbs=await list('/d1/database'),buckets=await list('/r2/buckets');
 const existingPage=await api('/pages/projects/'+target.pages,'GET',undefined,true);
 assert.ok(!existingPage&&!workers.some(w=>w.id===target.worker)&&!dbs.some(d=>d.name===target.database)&&!buckets.some(b=>b.name===target.bucket),'Destination collision: inspect before adopting existing resources');
 report.steps.push('Source identity and absent destinations confirmed');save();
 db=(await api('/d1/database','POST',{name:target.database})).result;
 assert.ok(db.uuid&&db.uuid!==sourceDB);report.database_id=db.uuid;save();
 await api('/r2/buckets','POST',{name:target.bucket});report.steps.push('Independent D1 and R2 created');save();
 const managed=(await api('/r2/buckets/'+target.bucket+'/domains/managed')).result;
 const custom=(await api('/r2/buckets/'+target.bucket+'/domains/custom')).result;
 assert.equal(managed.enabled,false,'Backup bucket must not have public r2.dev access');assert.equal(custom.domains.length,0);
 report.privateBucketConfirmed=true;save();
 const marker={account_id:account,...target,database_id:db.uuid,createdByRun:process.env.GITHUB_RUN_ID};
 await put('_migration/resource-manifest.json',Buffer.from(JSON.stringify(marker)),{contentType:'application/json'});
 const bookmark=(await api('/d1/database/'+sourceDB+'/time_travel/bookmark')).result;
 report.sourceBookmarkBefore=bookmark.bookmark;save();
 let exported,bookmarkCurrent;
 for(let i=0;i<100;i++){
  exported=(await api('/d1/database/'+sourceDB+'/export','POST',{output_format:'polling',dump_options:{no_schema:false,no_data:false,tables:[]},...(bookmarkCurrent?{current_bookmark:bookmarkCurrent}:{})})).result;
  if(exported.status==='complete')break;if(exported.status==='error')throw Error('D1 export task failed');bookmarkCurrent=exported.at_bookmark;
  await new Promise(r=>setTimeout(r,500));
 }
 assert.equal(exported.status,'complete');report.exportBookmark=exported.at_bookmark;
 const sqlResponse=await fetch(exported.result.signed_url);assert.ok(sqlResponse.ok);const sql=Buffer.from(await sqlResponse.arrayBuffer());assert.ok(sql.length>1000);
 report.sql={bytes:sql.length,sha256:sha(sql),privateBackupKey:'_migration/source-backup.sql'};
 writeFileSync(cms+'/source-backup.sql',sql,{mode:0o600});
 // Validate the full export locally before importing into the destination.
 const local=spawnSync('python',['-c',`import sqlite3,json,pathlib\ns=sqlite3.connect(':memory:')\ns.executescript(pathlib.Path('source-backup.sql').read_text())\nassert not s.execute('PRAGMA foreign_key_check').fetchall()\nprint(json.dumps({'articles':s.execute('SELECT COUNT(*) FROM articles').fetchone()[0],'versions':s.execute('SELECT COUNT(*) FROM article_versions').fetchone()[0]}))`],{cwd:cms,encoding:'utf8'});
 if(local.status!==0)throw Error('Local backup restore failed; details suppressed');report.localRestore=JSON.parse(local.stdout);
 await put(report.sql.privateBackupKey,sql,{contentType:'application/sql'});const backup=await bytes(target.bucket,report.sql.privateBackupKey);assert.equal(sha(backup.body),report.sql.sha256);
 report.steps.push('Consistent SQL exported, restored locally and backed up to private destination R2');save();
 const cfg=JSON.parse(readFileSync(cms+'/wrangler.template.json','utf8'));cfg.d1_databases[0].database_id=db.uuid;assert.equal(cfg.r2_buckets[0].bucket_name,target.bucket);assert.equal(cfg.name,target.worker);assert.equal(cfg.triggers.crons.length,0);
 writeFileSync(cms+'/wrangler.homeimprovement.json',JSON.stringify(cfg,null,2));
 command(['d1','execute',target.database,'--remote','--config','wrangler.homeimprovement.json','--file','source-backup.sql','--yes']);

 }
 const sourceFingerprint=await fingerprints(sourceDB),destinationFingerprint=await fingerprints(db.uuid);
 report.tableFingerprints={source:sourceFingerprint,destination:destinationFingerprint};assert.deepEqual(destinationFingerprint,sourceFingerprint,'Database drift or copy mismatch; do not deploy');
 assert.deepEqual(await query(db.uuid,'SELECT * FROM pragma_foreign_key_check'),[]);
 report.steps.push('D1 copied; all application table counts and fingerprints match');save();
 if(process.env.HI_DEPLOY_ONLY==='true'){
  const prior=JSON.parse((await bytes(target.bucket,'_migration/copy-manifest.json')).body.toString());
  assert.equal(prior.database_id,db.uuid);assert.equal(prior.sql.sha256,report.sql.sha256);assert.ok(prior.r2&&prior.r2.sourceObjects===prior.r2.matchedObjects);
  const sourceList=await objects(sourceBucket),targetList=await objects(target.bucket);
  assert.equal(sourceList.length,prior.r2.sourceObjects);
  for(const item of prior.r2.manifest){const a=sourceList.find(o=>o.key===item.key),b=targetList.find(o=>o.key===item.key);assert.ok(a&&b);assert.equal(a.size,item.bytes);assert.equal(b.size,item.bytes);assert.deepEqual(b.http_metadata||{},a.http_metadata||{});assert.deepEqual(b.custom_metadata||{},a.custom_metadata||{});}
  report.r2=prior.r2;report.priorDataVerificationRun='41728615571';report.steps.push('Validated copy manifest reused; no new export, D1 import or R2 copy');save();
 }else{
 const media=await query(db.uuid,'SELECT object_key,size FROM media'),sourceObjects=await objects(sourceBucket),manifest=[],existingObjects=await objects(target.bucket);
 for(const object of sourceObjects){
  const item=await bytes(sourceBucket,object.key);assert.equal(item.body.length,object.size);
  const expected=media.find(m=>m.object_key===object.key);if(expected)assert.equal(item.body.length,expected.size);
  const headers={};const fields={cacheControl:'Cache-Control',contentDisposition:'Content-Disposition',contentEncoding:'Content-Encoding',contentLanguage:'Content-Language',cacheExpiry:'Expires'};
  for(const [key,header] of Object.entries(fields))if(object.http_metadata?.[key])headers[header]=object.http_metadata[key];
  for(const [key,value] of Object.entries(object.custom_metadata||{}))headers['x-amz-meta-'+key]=String(value);
  const existing=existingObjects.find(o=>o.key===object.key);
  if(existing){const prior=await bytes(target.bucket,object.key);assert.equal(sha(prior.body),sha(item.body),'Existing target bytes differ; stop for review');}
  if(!existing||JSON.stringify(existing.http_metadata||{})!==JSON.stringify(object.http_metadata||{})||JSON.stringify(existing.custom_metadata||{})!==JSON.stringify(object.custom_metadata||{}))await put(object.key,item.body,{contentType:object.http_metadata?.contentType,headers});
  const copied=await bytes(target.bucket,object.key);assert.equal(copied.body.length,item.body.length);assert.equal(sha(copied.body),sha(item.body));
  manifest.push({key:object.key,bytes:item.body.length,sha256:sha(item.body),http_metadata:object.http_metadata,custom_metadata_sha256:sha(JSON.stringify(object.custom_metadata||{}))});
 }
 assert.ok(media.every(m=>manifest.some(o=>o.key===m.object_key)));
 const copiedObjects=await objects(target.bucket);
 for(const original of sourceObjects){const copy=copiedObjects.find(o=>o.key===original.key);assert.ok(copy);assert.deepEqual(copy.http_metadata||{},original.http_metadata||{});assert.deepEqual(copy.custom_metadata||{},original.custom_metadata||{});}
 report.r2={sourceObjects:sourceObjects.length,sourceBytes:manifest.reduce((n,o)=>n+o.bytes,0),matchedObjects:manifest.length,manifest};
 await put('_migration/copy-manifest.json',Buffer.from(JSON.stringify(report)),{contentType:'application/json'});
 report.steps.push('All source R2 objects copied with matching SHA-256, including maintenance backups');save();

 }
 // Source must still match the copied snapshot before any destination deploy.
 assert.deepEqual(await fingerprints(sourceDB),sourceFingerprint,'Source changed after snapshot; reconcile before deploy');
 const pagesCfg=JSON.parse(readFileSync(cms+'/pages.target.template.json','utf8'));pagesCfg.deployment_configs.production.d1_databases.DB.id=db.uuid;
 pagesCfg.deployment_configs.production.fail_open=false;pagesCfg.deployment_configs.preview.fail_open=false;
 let page=(await api('/pages/projects/'+target.pages,'GET',undefined,true))?.result;
 if(page){assert.equal(page.deployment_configs.production.d1_databases.DB.id,db.uuid);assert.ok(!page.source);}else page=(await api('/pages/projects','POST',pagesCfg)).result;
 assert.equal(page.name,target.pages);report.pagesSubdomain=page.subdomain;save();
 command(['deploy','--config','wrangler.homeimprovement.json']);report.steps.push('Independent Worker deployed without cron');save();
 command(['pages','deploy','dist','--project-name',target.pages,'--branch','main','--commit-hash',process.env.GITHUB_SHA||'','--commit-dirty=true']);
 report.steps.push('Independent Pages deployed noindex');save();
 const workerConfig=(await api('/workers/scripts/'+target.worker+'/settings')).result;
 const binding=workerConfig.bindings.find(b=>b.name==='DB');assert.equal(binding.id,db.uuid);assert.equal(workerConfig.bindings.find(b=>b.name==='MEDIA').bucket_name,target.bucket);
 const crons=(await api('/workers/scripts/'+target.worker+'/schedules')).result;assert.equal(crons.schedules.length,0);
 const domains=(await api('/pages/projects/'+target.pages+'/domains')).result;
 if(!domains.some(d=>d.name==='homeimprovement.tools')){
  try{report.customDomain=(await api('/pages/projects/'+target.pages+'/domains','POST',{name:'homeimprovement.tools'})).result;}catch(e){report.domainPending=String(e.message);}
 }
 const publicBase='https://'+report.pagesSubdomain;
 report.http=[];
 for(const path of ['/','/admin','/blog/','/paint-calculators/','/paint-calculator/','/print/paint-calculator/','/sitemap-blog.xml','/robots.txt']){
  const res=await fetch(publicBase+path);const body=await res.text();assert.equal(res.status,200,path);assert.match(res.headers.get('x-robots-tag')||'',/noindex/i);if(path==='/robots.txt')assert.equal(body,'User-agent: *\nDisallow: /\n');report.http.push({path,status:res.status,noindex:true});
 }
 const blocked=await fetch(publicBase+'/api/editorial/articles',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(blocked.status,423);
 const finalSource=(await api('/pages/projects/wedocalc')).result;assert.equal(finalSource.canonical_deployment.id,report.sourceProduction);
 report.sourceProductionUnchanged=true;report.completed=true;report.completedAt=new Date().toISOString();save();
 console.log(JSON.stringify({completed:true,target,db:db.uuid,articles:report.localRestore.articles,versions:report.localRestore.versions,r2:report.r2.sourceObjects,pages:publicBase,domain:report.customDomain?.status||report.domainPending||'existing',sourceUnchanged:true}));
}catch(error){report.failures.push(error.message);save();console.error(error.message);process.exitCode=1;}finally{console.log('MIGRATION_REPORT '+JSON.stringify(report));}
