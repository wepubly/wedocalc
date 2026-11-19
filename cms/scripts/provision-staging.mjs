// Only the Metricpedia staging names below may be created or modified.
import { writeFileSync } from "node:fs";
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (account !== "b81896777d206a2239625d9cf2e8a40b" || !token)
  throw Error("Cloudflare account/token missing or unexpected.");
const names = {
  worker: "metricpedia-cms-staging",
  database: "metricpedia-cms-staging-db",
  bucket: "metricpedia-cms-staging-assets",
};
async function api(path, method = "GET", body) {
  const r = await fetch(
    "https://api.cloudflare.com/client/v4/accounts/" + account + path,
    {
      method,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  const d = await r.json();
  if (!r.ok || !d.success)
    throw Error(
      `Cloudflare ${method} ${path} failed (${r.status}); codes ${(d.errors || []).map((e) => e.code).join(",")}. Check Workers Scripts Edit, D1 Edit and Workers R2 Storage Edit for this account.`,
    );
  return d.result;
}
// All read probes finish before creating resources. Never infer permission from a missing resource.
const [databases, buckets, workers, subdomain, project] = await Promise.all([
  api("/d1/database?per_page=100"),
  api("/r2/buckets"),
  api("/workers/scripts"),
  api("/workers/subdomain"),
  api("/pages/projects/wedocalc"),
]);
if (project.name !== "wedocalc" || project.production_branch !== "main")
  throw Error("Existing Pages identity changed. Stopped.");
const existing = workers.find((w) => w.id === names.worker);
if (existing) console.log("Reusing existing Metricpedia staging Worker.");
let db = databases.find((d) => d.name === names.database);
if (!db) db = await api("/d1/database", "POST", { name: names.database });
if (!(buckets.buckets || buckets).some((b) => b.name === names.bucket))
  await api("/r2/buckets", "POST", { name: names.bucket });
if (!db.uuid || !subdomain.subdomain)
  throw Error("Cloudflare returned incomplete resource identifiers.");
const origin = `https://${names.worker}.${subdomain.subdomain}.workers.dev`;
const config = {
  name: names.worker,
  main: "worker/index.ts",
  compatibility_date: "2026-10-01",
  account_id: account,
  workers_dev: true,
  preview_urls: false,
  assets: { directory: "./dist", binding: "ASSETS", run_worker_first: true },
  d1_databases: [
    {
      binding: "DB",
      database_name: names.database,
      database_id: db.uuid,
      migrations_dir: "migrations",
    },
  ],
  r2_buckets: [{ binding: "MEDIA", bucket_name: names.bucket }],
  vars: { ENVIRONMENT: "staging", PUBLIC_ORIGIN: origin },
  triggers: { crons: ["* * * * *"] },
  observability: { enabled: false },
};
writeFileSync("wrangler.staging.json", JSON.stringify(config, null, 2));
writeFileSync(
  "staging-resources.json",
  JSON.stringify(
    {
      worker: names.worker,
      d1: db.uuid,
      database: names.database,
      bucket: names.bucket,
      origin,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    worker: names.worker,
    database: names.database,
    bucket: names.bucket,
    origin,
  }),
);
