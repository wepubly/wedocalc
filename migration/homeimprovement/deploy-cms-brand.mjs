// UI-only Pages deployment. No D1/R2 mutations, Worker deployment or cron change.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const token=process.env.CLOUDFLARE_API_TOKEN,cms=process.env.HI_PREPARED_CMS,base='https://api.cloudflare.com/client/v4/accounts/b81896777d206a2239625d9cf2e8a40b';assert.ok(token&&cms);
const report={at:new Date().toISOString(),run:process.env.GITHUB_RUN_ID};
async function api(path){const r=await fetch(base+path,{headers:{Authorization:'Bearer '+token}}),d=await r.json();assert.ok(r.ok&&d.success,'Cloudflare read '+path);return d.result;}
const hash=b=>createHash('sha256').update(b).digest('hex');
async function state(){return {sourcePages:(await api('/pages/projects/wedocalc')).canonical_deployment.id,sourceWorker:(await api('/workers/scripts/metricpedia-editorial-lab/deployments')).deployments[0],targetWorker:(await api('/workers/scripts/homeimprovement-editorial/deployments')).deployments[0],targetCron:await api('/workers/scripts/homeimprovement-editorial/schedules')};}
try{
 const before=await state();assert.deepEqual(before.targetCron.schedules.map(s=>s.cron),['* * * * *']);
 const p=await api('/pages/projects/homeimprovement-tools');assert.ok(!p.source);const cfg=p.deployment_configs.production;assert.equal(cfg.d1_databases.DB.id,'4674c99c-cb26-47af-a557-19f097678ec6');assert.equal(cfg.r2_buckets.MEDIA.name,'homeimprovement-editorial-media');assert.equal(cfg.env_vars.HI_EDITORIAL_CRON.value,'enabled');assert.equal(cfg.env_vars.HI_EDITORIAL_WRITES.value,'enabled');report.previousPagesDeployment=p.canonical_deployment.id;
 const png=readFileSync(cms+'/dist/admin-assets/homeimprovement-logo.png');report.logoSha256=hash(png);assert.equal(report.logoSha256,hash(readFileSync('migration/homeimprovement/assets/homeimprovement-logo.png')));
 const r=spawnSync(process.execPath,[cms+'/node_modules/wrangler/bin/wrangler.js','pages','deploy','dist','--project-name','homeimprovement-tools','--branch','main','--commit-hash',process.env.GITHUB_SHA,'--commit-dirty=true'],{cwd:cms,encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});if(r.status!==0){console.error((r.stdout+r.stderr).split(token).join('[REDACTED]'));throw Error('Pages brand deploy failed');}
 const origin='https://homeimprovement.tools',admin=await fetch(origin+'/admin');assert.equal(admin.status,200);assert.match(admin.headers.get('x-robots-tag')||'',/noindex/);const html=await admin.text();assert.ok(html.includes('aprovada e ativada'));
 const script=html.match(/src="(\/admin-assets\/assets\/[^\"]+\.js)"/)[1];const js=await fetch(origin+script);assert.equal(js.status,200);const code=await js.text();assert.ok(code.includes('/admin-assets/homeimprovement-logo.png'));assert.ok(code.includes('HomeImprovement home'));assert.ok(!code.includes('Autor fixo da Metricpedia'));
 const image=await fetch(origin+'/admin-assets/homeimprovement-logo.png');assert.equal(image.status,200);assert.equal(hash(Buffer.from(await image.arrayBuffer())),report.logoSha256);
 for(const path of ['/api/editorial/articles','/api/editorial/schedules']){const r=await fetch(origin+path);assert.equal(r.status,200);await r.body.cancel();}
 assert.deepEqual(await state(),before,'Worker, cron or original production changed');report.pagesDeployment=(await api('/pages/projects/homeimprovement-tools')).canonical_deployment.id;report.cronUnchanged=true;report.sourceUnchanged=true;report.success=true;
}catch(e){report.error=e.message;process.exitCode=1;}finally{writeFileSync('cms-brand-result.json',JSON.stringify(report,null,2));console.log('CMS_BRAND '+JSON.stringify(report));}
