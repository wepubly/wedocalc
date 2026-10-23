// One-time, narrowly targeted maintenance. Run only after the deployed CMS is validated.
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const cfg=JSON.parse(readFileSync('wrangler.lab.json','utf8'));
assert.equal(cfg.name,'metricpedia-editorial-lab');
assert.equal(cfg.d1_databases[0].database_name,'metricpedia-editorial-lab-db');
assert.equal(cfg.r2_buckets[0].bucket_name,'metricpedia-editorial-lab-media');
const account=cfg.account_id,db=cfg.d1_databases[0].database_id,bucket=cfg.r2_buckets[0].bucket_name;
async function query(sql,params=[]){
 const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${db}/query`,{method:'POST',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({sql,params})});
 const d=await r.json();if(!r.ok||!d.success||d.result.some(x=>!x.success))throw Error('D1 maintenance failed: '+JSON.stringify(d.errors));
 return d.result[0]?.results||[];
}
const articleIds=['b1d1e18a-8f91-4e17-a7b5-5cc3c10a868d','7820c24a-04df-4890-87bf-39bed637ef34'];
const names=['TESTE — How Much Paint Do I Need?','TESTE 2 — Quanto de tinta?'];
const mediaIds=['89e30d9a-023a-4e7a-8a47-4048d7fc0589','f0ea24b3-3800-4e23-a5d4-fa7a6876d1dd','f2546acd-2983-460b-90ae-3aac3d823ea0'];
const tables=(await query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name")).map(x=>x.name);
for(const table of tables)assert.match(table,/^[a-z_]+$/);
const before={};for(const table of tables)before[table]=await query(`SELECT * FROM ${table}`);
for(let i=0;i<articleIds.length;i++){
 const a=before.articles.find(x=>x.id===articleIds[i]);if(!a)continue;
 assert.equal(a.published_version,null);assert.equal(a.published_at,null);
 const snap=JSON.parse(before.article_versions.find(x=>x.article_id===a.id&&x.version===a.draft_version).snapshot);
 assert.equal(snap.title,names[i]);assert.equal(snap.briefId,'TESTE-001');
}
const ids=new Set(articleIds),mids=new Set(mediaIds);
const affected=(table,row)=> table==='articles'?ids.has(row.id):table==='briefs'?row.id==='TESTE-001':table==='media'?mids.has(row.id):table==='submission_versions'?before.submissions.some(x=>ids.has(x.article_id)&&x.external_id===row.external_id):'article_id' in row&&ids.has(row.article_id);
for(const v of before.article_versions){if(ids.has(v.article_id))continue;const s=JSON.parse(v.snapshot);assert.ok(!mids.has(s.coverId));assert.ok(!ids.has(s.pillarId));assert.ok(!(s.relatedIds||[]).some(id=>ids.has(id)));assert.notEqual(s.briefId,'TESTE-001');assert.ok(!/\/blog\/teste-(?:how-much-paint|2-tinta)/.test(s.body||''));}
for(const m of before.media.filter(x=>mids.has(x.id))){assert.match(m.name,/^test-cover(?:-2)?\.jpg$/);assert.match(m.license,/teste/);assert.ok(!m.article_id||ids.has(m.article_id));}
assert.ok(!before.schedules.some(x=>ids.has(x.article_id)&&x.status==='queued'));
if(!before.articles.some(x=>ids.has(x.id))&&!before.media.some(x=>mids.has(x.id))&&!before.briefs.some(x=>x.id==='TESTE-001')){console.log('Named test records already absent; original recovery backup preserved.');process.exit(0);}
const stamp='2026-10-22-cms-finalization',backupKey=`editorial-maintenance-backups/${stamp}/rows.json`;
const backup={};for(const table of tables)backup[table]=before[table].filter(r=>affected(table,r));
writeFileSync('mission-test-backup.json',JSON.stringify(backup,null,2));
function wrangler(args){const r=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args,'--remote','--config','wrangler.lab.json'],{encoding:'utf8'});if(r.status!==0)throw Error('R2 maintenance failed: '+r.stderr);}
wrangler(['r2','object','put',bucket+'/'+backupKey,'--file','mission-test-backup.json']);
for(const m of backup.media){
 wrangler(['r2','object','get',bucket+'/'+m.object_key,'--file','mission-image-backup.bin']);
 wrangler(['r2','object','put',bucket+`/editorial-maintenance-backups/${stamp}/${m.id}`,'--file','mission-image-backup.bin']);
}
// Exact IDs, backed up above. No credentials, routes or operational history is deleted.
for(const table of ['editorial_campaign_items','external_approvals','submission_versions','submissions','schedules','editorial_events','editorial_reviews','article_versions','articles','media','briefs']){
 if(!tables.includes(table))continue;
 for(const row of backup[table]){
  const keys=await query(`PRAGMA table_info(${table})`);const pk=keys.filter(x=>x.pk).map(x=>x.name);assert.ok(pk.length);
  await query(`DELETE FROM ${table} WHERE `+pk.map(k=>`${k}=?`).join(' AND '),pk.map(k=>row[k]));
 }
}
for(const m of backup.media)wrangler(['r2','object','delete',bucket+'/'+m.object_key]);
const normalize=rows=>rows.map(r=>JSON.stringify(r)).sort();
for(const table of tables){const after=await query(`SELECT * FROM ${table}`);assert.deepEqual(normalize(after),normalize(before[table].filter(r=>!affected(table,r))),table+' operational rows changed');}
assert.deepEqual(await query('PRAGMA foreign_key_check'),[]);
const summary=`Removed ${backup.articles.length} named test articles, ${backup.briefs.length} TESTE-001 brief, ${backup.media.length} test-cover images, ${backup.schedules.length} test schedules. All other database rows compared and preserved. Recovery backup retained in existing R2 bucket at ${backupKey}.`;
console.log(summary);if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,'\n'+summary+'\n');
