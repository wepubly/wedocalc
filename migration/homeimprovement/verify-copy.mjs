import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const account='b81896777d206a2239625d9cf2e8a40b',db='4674c99c-cb26-47af-a557-19f097678ec6',base='https://api.cloudflare.com/client/v4/accounts/'+account;
const token=process.env.CLOUDFLARE_API_TOKEN;assert.ok(token);
const report={at:new Date().toISOString(),checks:[],domain:null};
async function api(path){const r=await fetch(base+path,{headers:{Authorization:'Bearer '+token}});const d=await r.json();if(!r.ok||!d.success)throw Error('Read failed '+path+' HTTP '+r.status);return d.result;}
async function query(sql){assert.ok(sql.startsWith('SELECT '));const r=await fetch(base+'/d1/database/'+db+'/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({sql})});const d=await r.json();assert.ok(r.ok&&d.success);return d.result.flatMap(x=>x.results);}
const publicBase='https://homeimprovement-tools.pages.dev';
async function publicPage(path,origin=publicBase){const r=await fetch(origin+path);assert.equal(r.status,200,path);assert.match(r.headers.get('x-robots-tag')||'',/noindex/);return {r,body:await r.text()};}
try{
 const page=await api('/pages/projects/homeimprovement-tools');assert.equal(page.deployment_configs.production.d1_databases.DB.id,db);assert.equal(page.deployment_configs.production.r2_buckets.MEDIA.name,'homeimprovement-editorial-media');assert.ok(!page.source);report.pagesDeployment=page.canonical_deployment.id;report.checks.push('Pages independent bindings and direct-upload configuration');
 const settings=await api('/workers/scripts/homeimprovement-editorial/settings');assert.equal(settings.bindings.find(b=>b.name==='DB').id,db);assert.equal(settings.bindings.find(b=>b.name==='MEDIA').bucket_name,'homeimprovement-editorial-media');assert.equal((await api('/workers/scripts/homeimprovement-editorial/schedules')).schedules.length,0);report.checks.push('Worker independent bindings; no cron');
 const articles=await query("SELECT v.snapshot,m.object_key,m.size FROM articles a JOIN article_versions v ON v.article_id=a.id AND v.version=a.published_version LEFT JOIN media m ON m.id=json_extract(v.snapshot,'$.coverId')");
 const blog=(await publicPage('/blog/')).body;assert.equal((blog.match(/class="blog-card"/g)||[]).length,articles.length);
 const privateResponse=await fetch(base+'/r2/buckets/homeimprovement-editorial-media/objects/_migration/copy-manifest.json',{headers:{Authorization:'Bearer '+token}});assert.ok(privateResponse.ok);const saved=await privateResponse.json();
 report.articles=[];
 for(const row of articles){const s=JSON.parse(row.snapshot);const path='/'+[s.destination.category.path,s.destination.subcategory.path,s.destination.calculator.path,s.slug].map(p=>p.replace(/^\/+|\/+$/g,'')).join('/')+'/';const html=(await publicPage(path)).body;assert.ok(html.includes('https://homeimprovement.tools'+path));assert.ok(!html.includes('https://metricpedia.com'));
  if(s.coverId){const r=await fetch(publicBase+'/media/'+s.coverId);assert.equal(r.status,200);const body=Buffer.from(await r.arrayBuffer());assert.equal(body.length,row.size);assert.equal(createHash('sha256').update(body).digest('hex'),saved.r2.manifest.find(o=>o.key===row.object_key).sha256);}
  report.articles.push({path,media:!!s.coverId,ok:true});
 }
 report.checks.push('All published articles, canonical URLs and cover image bytes verified');
 for(const path of ['/','/paint-calculators/','/paint-calculator/']){const html=(await publicPage(path)).body;assert.ok(!html.includes('https://metricpedia.com'));assert.ok(html.includes('data-hi-cards='));}
 const sub=(await api('/workers/subdomain')).subdomain;report.workerUrl='https://homeimprovement-editorial.'+sub+'.workers.dev';await publicPage('/admin',report.workerUrl);
 for(const origin of [publicBase,report.workerUrl])assert.equal((await fetch(origin+'/api/editorial/articles',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,423);report.checks.push('CMS read access and blocked writes on Pages and Worker');
 report.domain=await api('/pages/projects/homeimprovement-tools/domains/homeimprovement.tools');
 try{const root=await fetch('https://homeimprovement.tools/',{signal:AbortSignal.timeout(10000)});report.apex={status:root.status,noindex:root.headers.get('x-robots-tag')};}catch{report.apex={reachable:false};}
 const source=await api('/pages/projects/wedocalc');assert.equal(source.canonical_deployment.id,'08983672-ebdc-47a3-b4b7-f246cb9d22be');const sourceDeployments=await api('/workers/scripts/metricpedia-editorial-lab/deployments');assert.equal(sourceDeployments.deployments[0].versions[0].version_id,'dda5078a-3413-4f91-9f02-e39ad362df43');report.sourceUnchanged=true;report.success=true;
}catch(e){report.error=e.message;process.exitCode=1;}finally{writeFileSync('copy-verification.json',JSON.stringify(report,null,2));console.log('COPY_VERIFICATION '+JSON.stringify(report));}
