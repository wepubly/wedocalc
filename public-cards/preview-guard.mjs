import assert from 'node:assert/strict';
import {writeFileSync,readFileSync,appendFileSync} from 'node:fs';
const origin='https://metricpedia.com',account=process.env.CLOUDFLARE_ACCOUNT_ID;
async function api(path){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/wedocalc${path}`,{headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN}});const d=await r.json();assert.ok(r.ok&&d.success,JSON.stringify(d.errors));return d.result;}
const project=await api('');assert.equal(project.production_branch,'main');assert.equal(project.subdomain,'wedocalc.pages.dev');
if(process.argv[2]==='before'){
 const blog=await fetch(origin+'/blog/');assert.equal(blog.status,200);
 writeFileSync('.cards-production-before.json',JSON.stringify({deployment:project.canonical_deployment.id,blogStatus:blog.status}));
 console.log('Recorded existing production deployment; no configuration or editorial API calls.');
}else{
 const before=JSON.parse(readFileSync('.cards-production-before.json'));assert.equal(project.canonical_deployment.id,before.deployment,'Production deployment changed during preview');
 const deployments=await api('/deployments');const current=deployments.find(d=>d.environment==='preview'&&d.deployment_trigger?.metadata?.commit_hash===process.env.GITHUB_SHA);assert.ok(current,'Preview deployment identified by exact commit');
 const url=current.url;assert.ok(url.endsWith('.wedocalc.pages.dev'));
 for(const path of ['/','/paint-calculators/','/paint-calculator/','/guides/']){const r=await fetch(url+path);const html=await r.text();assert.equal(r.status,200,path);assert.match(r.headers.get('x-robots-tag')||'',/noindex/);if(path==='/')assert.equal((html.match(/data-ad-slot="HOME-GUIDES-01"/g)||[]).length,1);}
 const cms=await fetch(origin+'/admin/');assert.equal(cms.status,200);assert.match(await cms.text(),/id="root"/);
 console.log('PASS isolated preview, real public source, no CMS deployment, unchanged production deployment. Preview: '+url);
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,`\nPreview: ${url}\nProduction deployment unchanged: ${before.deployment}. Public catalogue read only; no CMS data, cron or configuration writes.\n`);
}
