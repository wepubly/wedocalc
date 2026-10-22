import {writeFileSync} from "node:fs";
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(account!=="b81896777d206a2239625d9cf2e8a40b"||!token)throw Error("Invalid deployment account");
const name="metricpedia-editorial-lab",dbName="metricpedia-editorial-lab-db",bucket="metricpedia-editorial-lab-media";
async function api(path,method="GET",body){const r=await fetch("https://api.cloudflare.com/client/v4/accounts/"+account+path,{method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok||!data.success)throw Error("Cloudflare "+method+" "+path+" failed: "+(data.errors||[]).map(x=>x.code).join(","));return data.result}
const [pages,dbs,buckets,sub]=await Promise.all([api("/pages/projects/wedocalc"),api("/d1/database?per_page=100"),api("/r2/buckets"),api("/workers/subdomain")]);
if(pages.name!=="wedocalc"||pages.production_branch!=="main"||!sub.subdomain)throw Error("Pages identity mismatch");
let db=dbs.find(x=>x.name===dbName);if(!db)db=await api("/d1/database","POST",{name:dbName});
if(!(buckets.buckets||buckets).some(x=>x.name===bucket))await api("/r2/buckets","POST",{name:bucket});
const origin="https://"+name+"."+sub.subdomain+".workers.dev";
writeFileSync("wrangler.lab.json",JSON.stringify({name,main:"worker/public-lab.ts",compatibility_date:"2026-10-01",account_id:account,workers_dev:true,preview_urls:false,assets:{directory:"./dist",binding:"ASSETS",run_worker_first:true},d1_databases:[{binding:"DB",database_name:dbName,database_id:db.uuid,migrations_dir:"lab-migrations"}],r2_buckets:[{binding:"MEDIA",bucket_name:bucket}],vars:{ENVIRONMENT:"production-lab",PUBLIC_ORIGIN:origin},observability:{enabled:false}},null,2));
console.log("Metricpedia production lab: "+origin+"/admin");
writeFileSync("lab-origin.txt",origin+"\n");
