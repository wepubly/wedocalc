// Local-only, fail-closed configuration. IDs must be supplied after provisioning approval.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const m=JSON.parse(readFileSync(process.argv[2],'utf8'));
assert.equal(m.account_id,'b81896777d206a2239625d9cf2e8a40b');
assert.equal(m.pages,'homeimprovement-tools');
assert.equal(m.worker,'homeimprovement-editorial');
assert.equal(m.database_name,'homeimprovement-editorial-db');
assert.equal(m.bucket,'homeimprovement-editorial-media');
assert.match(m.database_id,/^[a-f0-9-]{36}$/);
assert.notEqual(m.database_id,'1c9862e9-9824-4dbb-9d42-0c2a52ed1ae5');
const config=JSON.parse(readFileSync(new URL('./wrangler.template.json',import.meta.url),'utf8'));
config.d1_databases[0].database_id=m.database_id;
writeFileSync(process.argv[3],JSON.stringify(config,null,2)+'\n',{flag:'wx'});
