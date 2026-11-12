// Authorized UI-only Pages Direct Upload. Cloudflare API calls below are GET only.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const token=process.env.CLOUDFLARE_API_TOKEN,cms=process.env.HI_PREPARED_CMS;
assert.ok(token&&cms);
const base='https://api.cloudflare.com/client/v4/accounts/b81896777d206a2239625d9cf2e8a40b';
const report={at:new Date().toISOString(),run:process.env.GITHUB_RUN_ID,commit:process.env.GITHUB_SHA};
async function api(path){const r=await fetch(base+path,{headers:{Authorization:'Bearer '+token}}),d=await r.json();assert.ok(r.ok&&d.success,'Cloudflare read '+path);return d.result;}
async function state(){return {sourcePages:(await api('/pages/projects/wedocalc')).canonical_deployment.id,sourceWorker:(await api('/workers/scripts/metricpedia-editorial-lab/deployments')).deployments[0],targetWorker:(await api('/workers/scripts/homeimprovement-editorial/deployments')).deployments[0],targetCron:await api('/workers/scripts/homeimprovement-editorial/schedules')};}
try{
 const before=await state();assert.deepEqual(before.targetCron.schedules.map(s=>s.cron),['* * * * *']);
 const p=await api('/pages/projects/homeimprovement-tools');assert.ok(!p.source);assert.ok([
  'b0d624d33a9cadacbf23dffadcb428ce10a0e47a',
 ].includes(p.canonical_deployment.deployment_trigger.metadata.commit_hash),'Unexpected current deployment: '+p.canonical_deployment.deployment_trigger.metadata.commit_hash);
 const cfg=p.deployment_configs.production;assert.equal(cfg.d1_databases.DB.id,'4674c99c-cb26-47af-a557-19f097678ec6');assert.equal(cfg.r2_buckets.MEDIA.name,'homeimprovement-editorial-media');for(const k of ['HI_EDITORIAL_CRON','HI_EDITORIAL_WRITES'])assert.equal(cfg.env_vars[k].value,'enabled');
 report.previousPagesDeployment=p.canonical_deployment.id;report.before=before;
 writeFileSync('paint-project-publication.json',JSON.stringify(report,null,2));
 const r=spawnSync(process.execPath,[cms+'/node_modules/wrangler/bin/wrangler.js','pages','deploy','dist','--project-name','homeimprovement-tools','--branch','main','--commit-hash',process.env.GITHUB_SHA,'--commit-dirty=true'],{cwd:cms,encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
 if(r.status!==0){console.error((r.stdout+r.stderr).split(token).join('[REDACTED]'));throw Error('Pages deployment failed');}
 const origin='https://homeimprovement.tools';
 const home=await fetch(origin+'/');assert.equal(home.status,200);
 const html=await home.text();
 assert.doesNotMatch(html, /class="tools-showcase"/);
 assert.match(html, /id="categories"/);
 for(const path of ['/paint-calculators/','/paint-calculators','/home-garden/paint-calculators/']){
  const res=await fetch(origin+path+'?source=old-link',{redirect:'manual'});
  assert.equal(res.status,308,path);
  assert.equal(new URL(res.headers.get('location'),origin).href,origin+'/paint-calculator/?source=old-link',path);
 }
 const header=await fetch(origin+'/assets/shared-header.js?v=brand-2');assert.equal(header.status,200);
 const headerScript=await header.text();
 for(const theme of ['light','dark'])assert.ok(headerScript.includes('/assets/header-logo-'+theme+'.webp'),theme);
 for(const path of ['/blog/','/home-garden/','/paint-calculator/']){
  const page=await fetch(origin+path);assert.equal(page.status,200,path);
  const markup=await page.text();
  assert.match(markup, /id="shared-header"/,path);
  assert.match(markup, /id="shared-footer"/,path);
  assert.match(markup, /teste2\/footer\.js\?v=2/,path);
  assert.match(markup, /blog-footer\.css\?v=4/,path);
  assert.match(markup, /shared-header\.js\?v=brand-2/,path);
 }
 for(const theme of ['light','dark']){
  const path='/assets/header-logo-'+theme+'.webp';
  const asset=await fetch(origin+path);assert.equal(asset.status,200,path);
  assert.match(asset.headers.get('content-type')||'',/^image\/webp/,path);
  await asset.body.cancel();
 }
 for(const theme of ['light','dark']){
  const path='/teste2/assets/homeimprovement-logo-'+theme+'.webp';
  assert.ok(html.includes(path),path);
  const asset=await fetch(origin+path);assert.equal(asset.status,200,path);
  assert.match(asset.headers.get('content-type')||'',/^image\/webp/,path);
  await asset.body.cancel();
 }
 const footerCss=await fetch(origin+'/assets/blog-footer.css?v=4');assert.equal(footerCss.status,200);
 const blogPage=await fetch(origin+'/blog/');const blogMarkup=await blogPage.text();
 assert.match(blogMarkup,/id="shared-footer"/);assert.match(blogMarkup,/blog-footer\.css\?v=4/);
 assert.doesNotMatch(blogMarkup,/<footer>HomeImprovement · Powered by/);
 const footer=await fetch(origin+'/teste2/footer.js?v=2');assert.equal(footer.status,200);
 assert.match(await footer.text(),/homeimprovement-logo-dark\.webp/);

 for(const path of ['/about/','/our-mission/','/contact/','/privacy-policy/','/terms-of-service/']){
  const res=await fetch(origin+path);assert.equal(res.status,200,path);const body=await res.text();
  assert.match(body,/data-hi-shared-footer/);assert.match(body,/noindex,nofollow/);
  assert.doesNotMatch(body,/Draft for review|review-note|PENDENTE/);
  if(path==='/contact/'){
   const emails=[...body.matchAll(/data-cfemail="([0-9a-f]+)"/g)].map(m=>{const b=Buffer.from(m[1],'hex');return [...b.subarray(1)].map(c=>String.fromCharCode(c^b[0])).join('');});
   assert.ok(body.includes('mailto:alex@avantybrands.com')||emails.includes('alex@avantybrands.com'),'Contact email missing');
  }
 }
 const institutionalFooter=await (await fetch(origin+'/teste2/footer.js?v=2')).text();
 for(const slug of ['about','our-mission','contact','privacy-policy','terms-of-service'])assert.ok(institutionalFooter.includes('/'+slug+'/'));
 for(const label of ['Privacy Policy','Terms of Use'])assert.ok(institutionalFooter.includes(label));
 for(const path of ['/paint-calculator/','/admin','/api/editorial/articles','/api/editorial/schedules','/robots.txt']){
  const res=await fetch(origin+path);assert.equal(res.status,200,path);assert.match(res.headers.get('x-robots-tag')||'',/noindex/,path);const body=await res.text();
  if(path==='/paint-calculator/'){for(const text of ['quickChoice','advancedChoice','How Paint Calculation Works','Explore More Paint Calculators','data-planner-step','Coming Soon','Popular Paint Guides'])assert.ok(body.includes(text),text);assert.ok(!body.includes('CALCULATOR-TOP-01'));assert.ok(body.includes('https://homeimprovement.tools/paint-calculator/'));}
  if(path==='/robots.txt')assert.match(body,/Disallow:\s*\//);
 }
 for(const file of ['math.mjs','materials.mjs','budget.mjs','export.mjs','commercial.mjs','planner.mjs','page-shell.mjs','planner.css','page-shell.css']){const res=await fetch(origin+'/paint-calculator/project/'+file);assert.equal(res.status,200,file);await res.body.cancel();}
 const map=await fetch(origin+'/sitemap.xml');assert.equal(map.status,200);assert.match(map.headers.get('content-type')||'',/application\/xml/);const xml=await map.text();assert.match(xml,/<urlset/);assert.ok(xml.includes(origin+'/paint-calculator/'));assert.ok(!xml.includes('<loc>'+origin+'/paint-calculators/</loc>'));assert.doesNotMatch(xml,/privacy-policy|terms-of-service|\/admin|\/teste2/);
 const missing=await fetch(origin+'/__launch_check_missing_page__');assert.equal(missing.status,404);assert.match(await missing.text(),/Page not found/);assert.match(missing.headers.get('x-robots-tag')||'',/noindex/);
 for(const path of ['/','/home-garden/']){const res=await fetch(origin+path);const body=await res.text();assert.match(body,/rel="canonical"/);assert.doesNotMatch(body,/<title>[^<]*Visual Preview/);assert.match(res.headers.get('x-robots-tag')||'',/noindex/);}
 assert.equal((html.match(/href="\/home-garden\/"/g)||[]).length,1,'Only real category hub navigation remains');
 assert.deepEqual(await state(),before,'Production Worker/cron/source changed');const after=await api('/pages/projects/homeimprovement-tools');assert.deepEqual(after.deployment_configs.production,cfg,'Production bindings/settings changed');report.pagesDeployment=after.canonical_deployment.id;assert.notEqual(report.pagesDeployment,report.previousPagesDeployment);report.success=true;report.noindex=true;report.editorialUnchanged=true;
}catch(e){report.error=e.message;process.exitCode=1;}finally{writeFileSync('paint-project-publication.json',JSON.stringify(report,null,2));console.log('PAINT_PROJECT_PUBLICATION '+JSON.stringify(report));}
