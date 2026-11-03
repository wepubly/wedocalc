// Authorized read-only inspection. Never print response bodies containing secrets.
import {writeFileSync,appendFileSync} from 'node:fs';
const token=process.env.CLOUDFLARE_API_TOKEN;
const account='b81896777d206a2239625d9cf2e8a40b';
const report={at:new Date().toISOString(),secretConfigured:Boolean(token),checks:{}};
async function api(label,path,body){
 if(!token){report.checks[label]={ok:false,error:'secret missing'};return null;}
 if(body && (!path.endsWith('/query') || !/^SELECT\s/i.test(body.sql)))throw Error('Read-only guard');
 const res=await fetch('https://api.cloudflare.com/client/v4'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const data=await res.json().catch(()=>({}));
 report.checks[label]={ok:res.ok&&data.success===true,http:res.status,codes:(data.errors||[]).map(e=>e.code)};
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
writeFileSync('inventory.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,'Read-only inventory completed. No source data or Cloudflare settings changed. See inventory.json artifact.\n');
