import assert from 'node:assert/strict';
const origin='https://metricpedia.com';
for(const p of ['/admin','/admin/','/api/editorial/session','/api/editorial/articles','/api/editorial/media','/api/editorial/routes','/api/editorial/schedules','/blog/','/sitemap-blog.xml']){
 const r=await fetch(origin+p);const body=await r.text();assert.equal(r.status,200,p+': '+body.slice(0,100));
 if(p==='/admin'||p==='/admin/'){assert.match(body,/id="root"/);assert.match(body,/Metricpedia/);assert.match(r.headers.get('x-robots-tag')||'',/noindex/);}
 if(p.startsWith('/api/'))assert.match(r.headers.get('content-type')||'',/application\/json/,p+' must return JSON, not the static home');
 if(p==='/admin'||p==='/admin/'){
  assert.ok(!body.includes('http-equiv="refresh"')&&!body.includes('location.replace'),'No legacy redirect shell');
  const assets=[...body.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m=>m[1]);assert.ok(assets.some(a=>a.endsWith('.js')),'CMS script referenced');
  for(const asset of assets){const resource=await fetch(origin+asset);assert.equal(resource.status,200,asset);assert.ok(!resource.headers.get('content-type')?.includes('text/html'),asset+' is a real asset');}
 }
 if(p==='/api/editorial/session')assert.equal(JSON.parse(body).mode,'production');
}
for(const p of ['/','/paint-calculator/','/home-garden/','/paint-calculators/']){const r=await fetch(origin+p);assert.equal(r.status,200,'Existing site route '+p);}
const legacy=await fetch('https://metricpedia-editorial-lab.alex-b81.workers.dev/admin',{redirect:'manual'});assert.equal(legacy.status,308);assert.equal(legacy.headers.get('location'),origin+'/admin');
if(process.env.CLOUDFLARE_API_TOKEN){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/wedocalc`,{headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN}});const d=await r.json();assert.ok(d.success);assert.ok(!d.result.source||d.result.source.config.production_deployments_enabled===false,'Static auto-deploy disabled');if(process.env.GITHUB_SHA)assert.equal(d.result.canonical_deployment.deployment_trigger.metadata.commit_hash,process.env.GITHUB_SHA,'Production alias belongs to this verified CMS deployment');}
console.log('PASS official production CMS, public blog, original site routes and old URL redirect.');

for(const [path,target] of [['/home-garden/paint-calculators/','/paint-calculators/'],['/home-garden/paint-calculators/paint-calculator/','/paint-calculator/']]){
 const redirect=await fetch(origin+path,{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),origin+target);
 const result=await fetch(origin+path);assert.equal(result.status,200);const body=await result.text();assert.match(body,/<title>Paint Calculator/);assert.ok(!/<title>Metricpedia — Smart Calculators/.test(body));
}
console.log('PASS article calculator links reach the existing calculator rather than the home.');
