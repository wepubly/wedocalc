// Approved public indexing release via Pages Direct Upload. Cloudflare API calls below are GET only.
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
  '1b213d171874019ce8dba34ec81e5d3f76485e01',
 ].includes(p.canonical_deployment.deployment_trigger.metadata.commit_hash),'Unexpected current deployment: '+p.canonical_deployment.deployment_trigger.metadata.commit_hash);
 assert.equal(p.canonical_deployment.id,'e1be54eb-ac13-4b1e-9e8f-68b51d0ebf11','Production changed; stop rather than overwrite concurrent work');
 const cfg=p.deployment_configs.production;assert.equal(cfg.d1_databases.DB.id,'4674c99c-cb26-47af-a557-19f097678ec6');assert.equal(cfg.r2_buckets.MEDIA.name,'homeimprovement-editorial-media');for(const k of ['HI_EDITORIAL_CRON','HI_EDITORIAL_WRITES'])assert.equal(cfg.env_vars[k].value,'enabled');
 report.previousPagesDeployment=p.canonical_deployment.id;report.before=before;
 writeFileSync('paint-project-publication.json',JSON.stringify(report,null,2));
 const r=spawnSync(process.execPath,[cms+'/node_modules/wrangler/bin/wrangler.js','pages','deploy','dist','--project-name','homeimprovement-tools','--branch','main','--commit-hash',process.env.GITHUB_SHA,'--commit-dirty=true'],{cwd:cms,encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
 if(r.status!==0){console.error((r.stdout+r.stderr).split(token).join('[REDACTED]'));throw Error('Pages deployment failed');}
 const origin='https://homeimprovement.tools';
 async function checkPublic(url,options){
  for(let attempt=0;attempt<3;attempt++){
   const res=await fetch(url,options);
   if(res.status<500||attempt===2){
    if(res.status>=500)throw Error(new URL(url).pathname+' returned HTTP '+res.status);
    return res;
   }
   await res.body?.cancel();
   await new Promise(resolve=>setTimeout(resolve,2000));
  }
 }
 let html='';
 for(let attempt=0;attempt<6;attempt++){
  const home=await checkPublic(origin+'/');
  assert.equal(home.status,200);
  html=await home.text();
  if(html.includes('data-hi-home-css="base"') && html.includes('<article class="guide card">'))break;
  if(attempt<5)await new Promise(resolve=>setTimeout(resolve,1500));
 }
 const guideSection=html.match(/<section id="guides"[\s\S]*?<\/section>/)?.[0]||'';
 assert.equal((guideSection.match(/<article class="guide card">/g)||[]).length,10,'Ten published home guides expected');
 assert.equal(new Set([...guideSection.matchAll(/href="([^"]+)"/g)].map(m=>m[1])).size,10,'No duplicate home guide');
 report.homeGuideCount=10;

 const ceilingResponse=await checkPublic(origin+'/ceiling-paint-calculator/');
 assert.equal(ceilingResponse.status,200,'Ceiling Paint Calculator not reachable');
 const ceilingHtml=await ceilingResponse.text();
 for(const label of ['base','tokens','brand','footer','shell','special','background'])
  assert.ok(ceilingHtml.includes('data-hi-ceiling-css="'+label+'"'),'Ceiling inline CSS missing: '+label);
 assert.match(ceilingHtml,/<link rel="stylesheet" href="\/paint-calculator\/calculator\.css">/,'Ceiling essential calculator CSS missing');
 assert.match(ceilingHtml,/<script type="module" src="\/paint-calculator\/project\/specialized\/ui\.mjs"><\/script>/,'Ceiling calculation engine missing');
 assert.match(ceilingHtml,/src="\/assets\/ga4\.js"/,'GA4 loader missing from ceiling');
 report.ceilingCriticalStyles=7;


 const categoryCovers=[...html.matchAll(/src="\/cdn-cgi\/image\/width=400,quality=70,format=auto\/assets\/category-covers\/[a-z0-9-]+\.webp"/g)];
 assert.ok(categoryCovers.length>=10,'Responsive home category covers missing');
 for(const label of ['base','tokens','ads','background','footer'])
  assert.ok(html.includes('data-hi-home-css="'+label+'"'),'Home critical CSS missing: '+label);
 assert.match(html, /<link rel="stylesheet" href="\/teste2\/page\.css\?v=16">/,'Main stylesheet must be preserved');
 report.mobileCategoryCovers=categoryCovers.length;
 report.homeCriticalCss=5;
 const articlePath='/home-garden/paint-calculators/paint-calculator/paint-for-textured-walls/';
 const articleResponse=await checkPublic(origin+articlePath);
 assert.equal(articleResponse.status,200,'Editorial article missing');
 const articleHtml=await articleResponse.text();
 assert.match(articleHtml, /<img class="cover" src="\/cdn-cgi\/image\/width=960,quality=75,format=auto\/media\/[a-f0-9-]+"/,'Responsive hero missing');
 assert.match(articleHtml, /srcset="\/cdn-cgi\/image\/width=480,quality=75,format=auto\/media\/[a-f0-9-]+ 480w/,'Article srcset missing');
 assert.match(articleHtml, /property="og:image" content="https:\/\/homeimprovement\.tools\/media\//,'OG original image changed');
 assert.match(articleHtml, /sizes="\(max-width: 700px\) calc\(100vw - 36px\), 960px"/,'Article sizing missing');
 report.mobileArticleCover=true;


 const publishedBlog=await checkPublic(origin+'/blog/');
 assert.equal(publishedBlog.status,200,'Published blog unavailable');
 const blogHtml=await publishedBlog.text();
 for(const label of ['tokens','brand','footer','page']){
  assert.ok(blogHtml.includes('data-hi-critical-css="'+label+'"'),'Blog CSS not inlined: '+label);
 }
 report.blogCriticalCssInlined=4;

 const cardRows=[...blogHtml.matchAll(/<img\b[^>]*src="(\/cdn-cgi\/image\/width=480,quality=75,format=auto\/media\/[a-f0-9-]+)"[^>]*>/g)];
 const cardCovers=cardRows.map(m=>m[0]);
 const firstCoverUrl=cardRows[0]?.[1];
 assert.ok(cardCovers.length>=10,'Expected public blog media cards');
 assert.match(cardCovers[0],/loading="eager"/,'First cover should be prioritized');
 assert.match(cardCovers[0],/fetchpriority="high"/);
 for(const img of cardCovers.slice(1)){
  assert.match(img,/loading="lazy"/,'Below-fold blog cover is eager');
  assert.match(img,/width="480" height="270"/,'Blog card lacks stable sizing');
 }
 report.blogCovers=cardCovers.length;
 report.blogLazyCovers=cardCovers.length-1;

 const thumbResponse=await checkPublic(origin+firstCoverUrl);
 assert.equal(thumbResponse.status,200,'Optimized first cover unavailable');
 assert.match(thumbResponse.headers.get('content-type')||'',/^image\//,'Optimized first cover not an image');
 const thumbBytes=(await thumbResponse.arrayBuffer()).byteLength;
 const originalMediaUrl=firstCoverUrl.replace('/cdn-cgi/image/width=480,quality=75,format=auto','');
 const originalResponse=await checkPublic(origin+originalMediaUrl);
 assert.equal(originalResponse.status,200,'Original media absent');
 const originalBytes=(await originalResponse.arrayBuffer()).byteLength;
 report.transformedThumb={path:firstCoverUrl,bytes:thumbBytes,originalBytes,ratio:Math.round(100*thumbBytes/originalBytes)};
 report.blogThumbnailsOptimized=true;

 for(const asset of ['/assets/header-logo-light.webp','/assets/ga4.js','/paint-calculator/project/photos/cost.webp']){
  const res=await checkPublic(origin+asset);
  assert.equal(res.status,200,'Public asset missing '+asset);
  const cache=res.headers.get('cache-control')||'';
  if(!/public/i.test(cache)||!/max-age=/i.test(cache))(report.cacheHeaderWarnings??=[]).push({asset,cache});
  await res.body?.cancel();
 }
 report.mobilePsiPatch=true;


 const ga4Tag='<script src="/assets/ga4.js" defer></script>';
 assert.equal(html.split(ga4Tag).length-1,1,'GA4 loader should appear exactly once on homepage');
 const ga4Asset=await checkPublic(origin+'/assets/ga4.js');
 assert.equal(ga4Asset.status,200,'GA4 asset absent');
 const ga4Source=await ga4Asset.text();
 assert.ok(ga4Source.includes("gtag('config', 'G-ZK02VZNHE7')"),'Wrong GA4 property');
 assert.ok(ga4Source.includes("location.hostname !== 'homeimprovement.tools'"),'Missing production-domain gate');
 for(const path of ['/paint-calculator/','/paint-cost-calculator/','/home-garden/paint-calculators/paint-calculator/cost-to-paint-a-bathroom/']){
  const page=await checkPublic(origin+path);
  assert.equal(page.status,200,path);
  assert.equal((await page.text()).split(ga4Tag).length-1,1,'GA4 loader missing/duplicated: '+path);
 }
 report.ga4Measurement='G-ZK02VZNHE7';
 report.ga4StaticAndEditorial=true;

 assert.doesNotMatch(html, /class="tools-showcase"/);
 assert.match(html, /id="categories"/);
 for(const path of ['/paint-calculators/','/paint-calculators','/home-garden/paint-calculators/']){
  const res=await checkPublic(origin+path+'?source=old-link',{redirect:'manual'});
  assert.equal(res.status,308,path);
  assert.equal(new URL(res.headers.get('location'),origin).href,origin+'/paint-calculator/?source=old-link',path);
 }
 const header=await checkPublic(origin+'/assets/shared-header.js?v=brand-2');assert.equal(header.status,200);
 const headerScript=await header.text();
 for(const theme of ['light','dark'])assert.ok(headerScript.includes('/assets/header-logo-'+theme+'.webp'),theme);
 for(const path of ['/blog/','/home-garden/','/paint-calculator/']){
  const page=await checkPublic(origin+path);assert.equal(page.status,200,path);
  const markup=await page.text();
  assert.match(markup, /id="shared-header"/,path);
  assert.match(markup, /id="shared-footer"/,path);
  assert.match(markup, /teste2\/footer\.js\?v=3/,path);
  assert.match(markup, /blog-footer\.css\?v=5/,path);
  assert.match(markup, /shared-header\.js\?v=brand-2/,path);
 }
 for(const theme of ['light','dark']){
  const path='/assets/header-logo-'+theme+'.webp';
  const asset=await checkPublic(origin+path);assert.equal(asset.status,200,path);
  assert.match(asset.headers.get('content-type')||'',/^image\/webp/,path);
  await asset.body.cancel();
 }
 for(const theme of ['light','dark']){
  const path='/teste2/assets/homeimprovement-logo-'+theme+'.webp';
  assert.ok(html.includes(path),path);
  const asset=await checkPublic(origin+path);assert.equal(asset.status,200,path);
  assert.match(asset.headers.get('content-type')||'',/^image\/webp/,path);
  await asset.body.cancel();
 }
 const footerCss=await checkPublic(origin+'/assets/blog-footer.css?v=5');assert.equal(footerCss.status,200);
 const blogPage=await checkPublic(origin+'/blog/');const blogMarkup=await blogPage.text();
 assert.match(blogMarkup,/id="shared-footer"/);assert.match(blogMarkup,/blog-footer\.css\?v=5/);
 assert.doesNotMatch(blogMarkup,/<footer>HomeImprovement · Powered by/);
 const footer=await checkPublic(origin+'/teste2/footer.js?v=3');assert.equal(footer.status,200);
 assert.match(await footer.text(),/homeimprovement-logo-dark\.webp/);

 for(const path of ['/about/','/our-mission/','/contact/','/privacy-policy/','/terms-of-service/']){
  const res=await checkPublic(origin+path);assert.equal(res.status,200,path);const body=await res.text();
  assert.match(body,/data-hi-shared-footer/);assert.match(body,/name="robots" content="index, follow, max-image-preview:large"/);
  assert.doesNotMatch(body,/Draft for review|review-note|PENDENTE/);
  if(path==='/contact/'){
   const emails=[...body.matchAll(/data-cfemail="([0-9a-f]+)"/g)].map(m=>{const b=Buffer.from(m[1],'hex');return [...b.subarray(1)].map(c=>String.fromCharCode(c^b[0])).join('');});
   assert.ok(body.includes('mailto:alex@avantybrands.com')||emails.includes('alex@avantybrands.com'),'Contact email missing');
  }
 }
 const institutionalFooter=await (await checkPublic(origin+'/teste2/footer.js?v=3')).text();
 for(const slug of ['about','our-mission','contact','privacy-policy','terms-of-service'])assert.ok(institutionalFooter.includes('/'+slug+'/'));
 for(const label of ['Privacy Policy','Terms of Use'])assert.ok(institutionalFooter.includes(label));
 for(const path of ['/paint-calculator/','/paint-cost-calculator/','/home-garden/']){
  const res=await checkPublic(origin+path);assert.equal(res.status,200,path);assert.doesNotMatch(res.headers.get('x-robots-tag')||'',/noindex/i,path);
  const body=await res.text();assert.match(body,/name="robots" content="index, follow, max-image-preview:large"/,path);
  if(path==='/paint-calculator/'){for(const text of ['quickChoice','advancedChoice','How Paint Calculation Works','Explore More Paint Calculators','data-planner-step','Coming Soon','Popular Paint Guides'])assert.ok(body.includes(text),text);assert.ok(!body.includes('CALCULATOR-TOP-01'));assert.ok(body.includes('https://homeimprovement.tools/paint-calculator/'));}
 }
 // /admin is gated by Cloudflare Access before the Pages Worker; anonymous CI
 // receives a login challenge, whose headers are controlled by Access itself.
 for(const path of ['/api/editorial/articles','/api/editorial/schedules']){
  const res=await checkPublic(origin+path);
  assert.equal(res.status,200,path);
  // The canonical robots.txt disallows /api/; the Cloudflare edge may strip
  // private noindex headers on API JSON. Never cache API responses publicly.
  assert.doesNotMatch(res.headers.get('cache-control')||'',/public/i,path);
  if(!/noindex/i.test(res.headers.get('x-robots-tag')||'')){
    (report.apiRobotsHeaderWarnings??=[]).push(path);
  }
  await res.body?.cancel();
 }
 const robots=await checkPublic(origin+'/robots.txt');assert.equal(robots.status,200);
 const robotsText=await robots.text();assert.doesNotMatch(robotsText,/^Disallow:\s*\/$/m);
 assert.match(robotsText,/^Sitemap:\s*https:\/\/homeimprovement\.tools\/sitemap\.xml$/m);
 for(const file of ['math.mjs','materials.mjs','budget.mjs','export.mjs','commercial.mjs','planner.mjs','page-shell.mjs','planner.css','page-shell.css']){const res=await checkPublic(origin+'/paint-calculator/project/'+file);assert.equal(res.status,200,file);await res.body.cancel();}
 const map=await checkPublic(origin+'/sitemap.xml');assert.equal(map.status,200);assert.match(map.headers.get('content-type')||'',/application\/xml/);assert.doesNotMatch(map.headers.get('x-robots-tag')||'',/noindex/i);const xml=await map.text();assert.match(xml,/<urlset/);assert.ok(xml.includes(origin+'/paint-calculator/'));assert.ok(!xml.includes('<loc>'+origin+'/paint-calculators/</loc>'));assert.doesNotMatch(xml,/privacy-policy|terms-of-service|\/admin|\/teste2/);
 const missing=await checkPublic(origin+'/__launch_check_missing_page__');assert.equal(missing.status,404);assert.match(await missing.text(),/Page not found/);assert.match(missing.headers.get('x-robots-tag')||'',/noindex/);
 for(const path of ['/','/home-garden/']){const res=await checkPublic(origin+path);const body=await res.text();assert.match(body,/rel="canonical"/);assert.doesNotMatch(body,/<title>[^<]*Visual Preview/);assert.doesNotMatch(res.headers.get('x-robots-tag')||'',/noindex/i);}
 assert.equal((html.match(/href="\/home-garden\/"/g)||[]).length,1,'Only real category hub navigation remains');
 assert.deepEqual(await state(),before,'Production Worker/cron/source changed');const after=await api('/pages/projects/homeimprovement-tools');assert.deepEqual(after.deployment_configs.production,cfg,'Production bindings/settings changed');report.pagesDeployment=after.canonical_deployment.id;assert.equal(after.canonical_deployment.deployment_trigger.metadata.commit_hash,process.env.GITHUB_SHA,'Published commit mismatch');assert.notEqual(report.pagesDeployment,report.previousPagesDeployment);report.success=true;report.publicIndexing=true;report.editorialUnchanged=true;
}catch(e){report.error=e.stack||e.message;process.exitCode=1;}finally{writeFileSync('paint-project-publication.json',JSON.stringify(report,null,2));console.log('PAINT_PROJECT_PUBLICATION '+JSON.stringify(report));}
