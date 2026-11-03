// Authorized read-only inspection. Never print response bodies containing secrets.
import {writeFileSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const token=process.env.CLOUDFLARE_API_TOKEN;
const account='b81896777d206a2239625d9cf2e8a40b';
const report={at:new Date().toISOString(),secretConfigured:Boolean(token),checks:{}};
async function api(label,path,body){
 if(!token){report.checks[label]={ok:false,error:'secret missing'};return null;}
 if(body && (!path.endsWith('/query') || !/^SELECT\s/i.test(body.sql)))throw Error('Read-only guard');
 const res=await fetch('https://api.cloudflare.com/client/v4'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const data=await res.json().catch(()=>({}));
 report.checks[label]={ok:res.ok&&data.success===true,http:res.status,pagination:data.result_info,codes:(data.errors||[]).map(e=>e.code)};
 return report.checks[label].ok?data.result:null;
}
const base='/accounts/'+account;
const verified=await api('token','/user/tokens/verify');
if(verified)report.token={status:verified.status,expires_on:verified.expires_on};
const pages=await api('pages',base+'/pages/projects/wedocalc');
if(pages)report.pages={name:pages.name,domains:pages.domains,production_branch:pages.production_branch,gitAutomaticProduction:pages.source?.config?.production_deployments_enabled,latest:pickDeployment(pages.latest_deployment),canonical:pickDeployment(pages.canonical_deployment),bindings:Object.fromEntries(['production','preview'].map(k=>[k,{d1:pages.deployment_configs?.[k]?.d1_databases,r2:pages.deployment_configs?.[k]?.r2_buckets}]))};
function pickDeployment(d){return d?{id:d.id,url:d.url,created_on:d.created_on,environment:d.environment,stage:d.latest_stage,trigger:d.deployment_trigger}:null;}
const workers=await api('workers',base+'/workers/scripts');
report.workers=workers?.map(w=>({id:w.id,modified_on:w.modified_on}));
const settings=await api('workerSettings',base+'/workers/scripts/metricpedia-editorial-lab/settings');
if(settings)report.worker={bindings:settings.bindings?.filter(b=>['d1','r2_bucket','service'].includes(b.type)).map(b=>({name:b.name,type:b.type,id:b.id,bucket_name:b.bucket_name,service:b.service})),vars:settings.bindings?.filter(b=>b.type==='plain_text'&&['ENVIRONMENT','PUBLIC_ORIGIN'].includes(b.name)).map(b=>({name:b.name,text:b.text}))};
report.crons=await api('crons',base+'/workers/scripts/metricpedia-editorial-lab/schedules');
report.workerDeployments=await api('workerDeployments',base+'/workers/scripts/metricpedia-editorial-lab/deployments');
const dbs=await api('d1',base+'/d1/database?per_page=100');
report.databases=dbs?.map(d=>({name:d.name,uuid:d.uuid,created_at:d.created_at}));
const db=dbs?.find(d=>d.name==='metricpedia-editorial-lab-db');
if(db){
 report.databaseInfo=await api('databaseInfo',base+'/d1/database/'+db.uuid);
 const queries={tables:"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",articles:"SELECT COUNT(*) total,SUM(published_version IS NOT NULL) published FROM articles",reviews:"SELECT COALESCE(r.status,'draft') status,COUNT(*) count FROM articles a LEFT JOIN editorial_reviews r ON r.article_id=a.id AND r.version=a.draft_version GROUP BY COALESCE(r.status,'draft')",schedules:"SELECT status,COUNT(*) count,MIN(run_at) earliest,MAX(run_at) latest,SUM(last_error IS NOT NULL) errors FROM schedules GROUP BY status",media:"SELECT COUNT(*) files,COALESCE(SUM(size),0) bytes FROM media",versions:"SELECT COUNT(*) count,MAX(created_at) latest FROM article_versions",routes:"SELECT id,kind,name,path,parent_id,state FROM routes ORDER BY kind,id",history:"SELECT COUNT(*) count,MAX(created_at) latest FROM editorial_events",integrity:"SELECT COUNT(*) missing_published_versions FROM articles a WHERE a.published_version IS NOT NULL AND NOT EXISTS(SELECT 1 FROM article_versions v WHERE v.article_id=a.id AND v.version=a.published_version)",mediaKeys:"SELECT object_key,size,mime FROM media ORDER BY object_key"};
 report.data={};for(const [key,sql] of Object.entries(queries)){const r=await api(key,base+'/d1/database/'+db.uuid+'/query',{sql});report.data[key]=r?.map(q=>q.results);}
}
const buckets=await api('r2',base+'/r2/buckets');
report.buckets=(buckets?.buckets||buckets)?.map(b=>({name:b.name,creation_date:b.creation_date}));
report.bucketInfo=await api('bucketInfo',base+'/r2/buckets/metricpedia-editorial-lab-media');
const zones=await api('destinationZone','/zones?name=homeimprovement.tools');
const zone=zones?.find(z=>z.name==='homeimprovement.tools');
if(zone){report.zone={id:zone.id,name:zone.name,status:zone.status,name_servers:zone.name_servers,accountMatches:zone.account?.id===account};const dns=await api('dns','/zones/'+zone.id+'/dns_records?per_page=100');report.dns=dns?.map(d=>({type:d.type,name:d.name,content:d.content,proxied:d.proxied}));report.ssl=await api('ssl','/zones/'+zone.id+'/ssl/verification');report.sslSetting=await api('sslSetting','/zones/'+zone.id+'/settings/ssl');}

report.gitIntegration=pages?.source?{type:pages.source.type,owner:pages.source.config?.owner,repo:pages.source.config?.repo_name,production:pages.source.config?.production_deployments_enabled,preview:pages.source.config?.preview_deployment_setting,include:pages.source.config?.preview_branch_includes,exclude:pages.source.config?.preview_branch_excludes}:null;
report.destination={workerExists:workers?.some(w=>w.id==='homeimprovement-editorial')??null,databaseExists:dbs?.some(d=>d.name==='homeimprovement-editorial-db')??null,bucketExists:(buckets?.buckets||buckets)?.some(b=>b.name==='homeimprovement-editorial-media')??null};
const destinationPages=await api('destinationPages',base+'/pages/projects/homeimprovement-tools');
report.destination.pagesExists=destinationPages?true:report.checks.destinationPages.http===404?false:null;
if(db){
 report.bookmark=await api('bookmark',base+'/d1/database/'+db.uuid+'/time_travel/bookmark');
 report.foreignKeys=await api('foreignKeys',base+'/d1/database/'+db.uuid+'/query',{sql:'SELECT * FROM pragma_foreign_key_check'});
 const approvals=await api('approvalAudit',base+'/d1/database/'+db.uuid+'/query',{sql:'SELECT a.digest,v.snapshot FROM external_approvals a JOIN article_versions v ON v.article_id=a.article_id AND v.version=a.version'});
 if(approvals){const rows=approvals.flatMap(q=>q.results);report.approvalAudit={count:rows.length,mismatches:rows.filter(r=>createHash('sha256').update(JSON.stringify(JSON.parse(r.snapshot))).digest('hex')!==r.digest).length};}
}
const objectBase=base+'/r2/buckets/metricpedia-editorial-lab-media/objects';
let all=[],cursor='',complete=false;
for(let page=0;page<100;page++){
 const label='r2Objects'+page;
 const result=await api(label,objectBase+'?limit=1000'+(cursor?'&cursor='+encodeURIComponent(cursor):''));
 if(!result)break;
 const rows=Array.isArray(result)?result:result.objects;
 if(!Array.isArray(rows))break;
 all.push(...rows);
 const next=report.checks[label].pagination?.cursor||result.cursor;
 if(!next){complete=true;break;}if(next===cursor)throw Error('Repeated R2 cursor');cursor=next;
}
const catalogue=report.data?.mediaKeys?.flat()||[];
const keys=[...new Set([...all.map(o=>o.key),...catalogue.map(m=>m.object_key)])];
const manifest=[];
for(const key of keys){
 const r=await fetch('https://api.cloudflare.com/client/v4'+objectBase+'/'+key.split('/').map(encodeURIComponent).join('/'),{headers:{Authorization:'Bearer '+token}});
 const item={key,http:r.status,catalogue:catalogue.some(m=>m.object_key===key)};
 if(r.ok){const bytes=Buffer.from(await r.arrayBuffer());item.bytes=bytes.length;item.sha256=createHash('sha256').update(bytes).digest('hex');item.etag=r.headers.get('etag');const expected=catalogue.find(m=>m.object_key===key);item.sizeMatches=expected?expected.size===bytes.length:null;item.magic=bytes.subarray(0,12).toString('hex');}else await r.body?.cancel();
 manifest.push(item);
}
report.r2Physical={listComplete:complete,listedObjects:all.length,listedBytes:all.reduce((n,o)=>n+Number(o.size||0),0),orphans:complete?all.filter(o=>!catalogue.some(m=>m.object_key===o.key)).map(o=>o.key):null,missingCatalogueObjects:complete?catalogue.filter(m=>!all.some(o=>o.key===m.object_key)).map(m=>m.object_key):null,manifest};
writeFileSync('r2-copy-manifest.json',JSON.stringify(report.r2Physical,null,2));
const after=await api('pagesAfter',base+'/pages/projects/wedocalc');
report.productionUnchangedDuringInspection=after?.canonical_deployment?.id===pages?.canonical_deployment?.id;
report.productionMatchesPriorInventory=after?.canonical_deployment?.id==='08983672-ebdc-47a3-b4b7-f246cb9d22be';
report.noNewPreviewDuringInspection=after?.latest_deployment?.id===pages?.latest_deployment?.id;

writeFileSync('inventory.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,'Read-only inventory completed. No source data or Cloudflare settings changed. See inventory.json artifact.\n');
