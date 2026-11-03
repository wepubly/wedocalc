import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const token=process.env.CLOUDFLARE_API_TOKEN,base='https://api.cloudflare.com/client/v4/accounts/b81896777d206a2239625d9cf2e8a40b';
const sha=v=>createHash('sha256').update(v).digest('hex');
async function get(path){const r=await fetch(base+path,{headers:{Authorization:'Bearer '+token}});const d=await r.json();if(!r.ok||!d.success)throw Error('Read failed: '+r.status);return d;}
const out={at:new Date().toISOString(),objects:[],versions:[]};let cursor='';
do{const d=await get('/r2/buckets/metricpedia-editorial-lab-media/objects?limit=1000'+(cursor?'&cursor='+encodeURIComponent(cursor):''));const rows=Array.isArray(d.result)?d.result:d.result.objects;for(const o of rows)out.objects.push({key:o.key,size:o.size,etag:o.etag,uploaded:o.uploaded,http_metadata:o.http_metadata,custom_metadata_sha256:sha(JSON.stringify(o.custom_metadata||{}))});const next=d.result_info?.cursor||d.result.cursor||'';if(next&&next===cursor)throw Error('Cursor repeated');cursor=next;}while(cursor);
const path='/d1/database/1c9862e9-9824-4dbb-9d42-0c2a52ed1ae5/query';
async function query(sql){if(!sql.startsWith('SELECT '))throw Error('SELECT only');const r=await fetch(base+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({sql})});const d=await r.json();if(!r.ok||!d.success)throw Error('Read failed: '+r.status);return d.result.flatMap(q=>q.results);}
for(const v of await query('SELECT article_id,version,snapshot,created_at FROM article_versions ORDER BY article_id,version'))out.versions.push({article_id:v.article_id,version:v.version,created_at:v.created_at,snapshot_raw_sha256:sha(v.snapshot),snapshot_canonical_sha256:sha(JSON.stringify(JSON.parse(v.snapshot)))});
const schema=await query("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name");out.schema_sha256=sha(JSON.stringify(schema));out.tables=[];
for(const t of schema){if(!/^[a-z_]+$/.test(t.name))throw Error('Unexpected table name');const rows=await query('SELECT COUNT(*) count FROM '+t.name);out.tables.push({name:t.name,count:rows[0].count});}
writeFileSync('inventory.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
