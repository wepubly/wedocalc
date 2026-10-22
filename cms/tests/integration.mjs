import { spawn, spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { setTimeout as pause } from "node:timers/promises";
const cms = new URL("../", import.meta.url).pathname;
const cli = cms + "node_modules/wrangler/bin/wrangler.js";
const state = ".wrangler/test-state";
function cmd(args) {
  const r = spawnSync(process.execPath, [cli, ...args], {
    cwd: cms,
    encoding: "utf8",
    env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" },
  });
  if (r.status !== 0) throw Error(r.stdout + r.stderr);
  return r.stdout;
}
cmd([
  "d1",
  "migrations",
  "apply",
  "metricpedia-cms-local-db",
  "--local",
  "--config",
  "wrangler.local.json",
  "--persist-to",
  state,
]);
cmd([
  "d1",
  "execute",
  "metricpedia-cms-local-db",
  "--local",
  "--config",
  "wrangler.local.json",
  "--persist-to",
  state,
  "--command",
  "DELETE FROM sessions; DELETE FROM login_limits; DELETE FROM owner; DELETE FROM external_approvals; DELETE FROM submission_versions; DELETE FROM submissions; DELETE FROM schedules; DELETE FROM editorial_events; DELETE FROM editorial_reviews; DELETE FROM article_versions; DELETE FROM articles; DELETE FROM agents; DELETE FROM media; DELETE FROM briefs; DELETE FROM system_events;",
]);
const setup = randomBytes(32).toString("hex"),
  password = randomBytes(24).toString("hex");
if (existsSync(cms + ".dev.vars"))
  throw Error(
    "Refusing to overwrite existing .dev.vars; use a clean test checkout.",
  );
writeFileSync(cms + ".dev.vars", "SETUP_TOKEN=" + setup + "\n");
const server = spawn(
  process.execPath,
  [
    cli,
    "dev",
    "--config",
    "wrangler.local.json",
    "--port",
    "8791",
    "--persist-to",
    state,
    "--test-scheduled",
  ],
  {
    cwd: cms,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
server.stdout.on("data", (d) => (output += d));
server.stderr.on("data", (d) => (output += d));
const origin = "http://127.0.0.1:8791";
let cookie = "";
async function req(path, method = "GET", body, token, expect = 200) {
  const headers = {};
  if (cookie && !token) headers.Cookie = cookie;
  if (method !== "GET") headers.Origin = origin;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = "Bearer " + token;
  const r = await fetch(origin + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const raw = await r.text();
  assert.equal(
    r.status,
    expect,
    `${method} ${path}: ${r.status} ${raw.slice(0, 300)}`,
  );
  assert.match(r.headers.get("x-robots-tag") || "", /noindex/);
  return {
    r,
    raw,
    data: raw.startsWith("{") || raw.startsWith("[") ? JSON.parse(raw) : null,
  };
}
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(origin + "/robots.txt");
      ready = true;
      break;
    } catch {
      if (server.exitCode !== null) break;
      await pause(250);
    }
  }
  if (!ready) throw Error("Local Worker did not start: " + output.slice(-3000));
  await req("/api/editorial/articles", "GET", undefined, undefined, 401);
  await req(
    "/api/editorial/setup",
    "POST",
    { username: "owner-test", password, setupToken: "wrong" },
    undefined,
    403,
  );
  await req("/api/editorial/setup", "POST", {
    username: "owner-test",
    password,
    setupToken: setup,
  });
  await req(
    "/api/editorial/setup",
    "POST",
    { username: "owner-test", password, setupToken: setup },
    undefined,
    409,
  );
  const login = await req("/api/editorial/login", "POST", {
    username: "owner-test",
    password,
  });
  cookie = login.r.headers.get("set-cookie").split(";")[0];
  assert.match(login.r.headers.get("set-cookie"), /HttpOnly.*SameSite=Strict/);
  const forged = await fetch(origin + "/api/editorial/briefs", {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: "https://evil.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(forged.status, 403);
  const brief = {
    id: "test-brief",
    title: "TEST ONLY – Paint briefing",
    categoryId: "home-garden",
    subcategoryId: "paint-calculators",
    calculatorId: "paint-calculator",
    primaryKeyword: "test paint coverage",
    secondaryKeywords: ["test paint planning"],
    circuit: 1,
  };
  await req("/api/editorial/briefs", "POST", brief, undefined, 201);
  const writer = (
    await req(
      "/api/editorial/agents",
      "POST",
      { name: "TEST ONLY Writer", scopes: ["submit", "status"] },
      undefined,
      201,
    )
  ).data;
  const supervisor = (
    await req(
      "/api/editorial/agents",
      "POST",
      {
        name: "TEST ONLY Supervisor",
        scopes: ["status", "authorize", "schedule", "publish"],
      },
      undefined,
      201,
    )
  ).data;
  await req(
    "/api/editorial/agents",
    "POST",
    { name: "bad", scopes: ["submit", "authorize"] },
    undefined,
    400,
  );
  await req("/api/editorial/articles", "GET", undefined, writer.token, 401);
  const image = await import("node:fs").then((fs) =>
    fs.readFileSync(cms + "../assets/icons/category-0.png"),
  );
  const upload = await fetch(origin + "/api/integration/media", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + writer.token,
      "Content-Type": "image/png",
      "X-File-Name": "test-image.png",
      "X-Image-Alt": "Test illustration",
      "X-Image-Source": "Metricpedia test fixture",
      "X-Image-License": "Owner-provided fixture, test only",
    },
    body: image,
  });
  assert.equal(upload.status, 201);
  const media = await upload.json();
  const payload = {
    ...brief,
    externalId: "test-external-1",
    briefId: brief.id,
    title: "TEST ONLY – Paint calculation integration",
    slug: "test-only-paint-integration",
    category: "Home & Garden",
    articleType: "pillar",
    finalVersion: "1",
    approvalReference: "grok-test-message",
    seoTitle: "TEST ONLY integration article",
    description:
      "Test of the editorial infrastructure, not a published editorial guide.",
    excerpt: "TEST ONLY – staging validation article.",
    body: "## TEST ONLY\n\nThis is a clearly identified integration test.\n\n<script>alert(1)</script>",
    author: "Metricpedia Editorial",
    language: "en-US",
    tags: [],
    coverId: media.id,
    coverAlt: "Test illustration",
    sources: [],
    relatedIds: [],
    pillarId: "",
    isPillar: true,
  };
  const unsafePackage = {
    ...payload,
    externalId: "test-unsafe",
    slug: "test-only-unsafe",
    body: "[Unsafe](javascript:alert(1))",
  };
  const unsafe = (
    await req(
      "/api/integration/packages",
      "POST",
      unsafePackage,
      writer.token,
      201,
    )
  ).data;
  await req(
    "/api/integration/articles/" + unsafe.id + "/authorize",
    "POST",
    {
      version: 1,
      digest: unsafe.digest,
      evidence: "TEST ONLY rejected unsafe link",
    },
    supervisor.token,
    400,
  );
  const first = (
      await req("/api/integration/packages", "POST", payload, writer.token, 201)
    ).data,
    id = first.id;
  const duplicate = (
    await req("/api/integration/packages", "POST", payload, writer.token)
  ).data;
  assert.equal(duplicate.version, 1);
  assert.equal(duplicate.id, id);
  await req(
    "/api/integration/packages",
    "POST",
    { ...payload, title: "different" },
    writer.token,
    409,
  );
  await req(
    "/api/integration/articles/" + id + "/publish",
    "POST",
    { version: 1 },
    writer.token,
    403,
  );
  await req(
    "/api/integration/articles/" + id + "/publish",
    "POST",
    { version: 1 },
    supervisor.token,
    409,
  );
  await req(
    "/api/integration/articles/" + id + "/authorize",
    "POST",
    { version: 1, digest: first.digest, evidence: "fake writer approval" },
    writer.token,
    403,
  );
  await req(
    "/api/integration/articles/" + id + "/authorize",
    "POST",
    { version: 1, digest: "wrong", evidence: "test approval" },
    supervisor.token,
    409,
  );
  await req(
    "/api/integration/articles/" + id + "/authorize",
    "POST",
    {
      version: 1,
      digest: first.digest,
      evidence: "TEST ONLY external Supervisor message #1",
    },
    supervisor.token,
  );
  await req(
    "/api/integration/articles/" + id + "/schedule",
    "POST",
    { version: 1, runAt: "bad" },
    supervisor.token,
    400,
  );
  const target = new Date(Date.now() + 10000).toISOString();
  await req(
    "/api/integration/articles/" + id + "/schedule",
    "POST",
    { version: 1, runAt: target },
    supervisor.token,
  );
  await pause(10500);
  const scheduleCall = () => fetch(origin + "/__scheduled?cron=*+*+*+*+*");
  await Promise.all([scheduleCall(), scheduleCall()]);
  let published = (await req("/blog/" + payload.slug + "/")).raw;
  assert.match(published, /TEST ONLY – Paint calculation integration/);
  assert.match(published, /BlogPosting/);
  assert.match(published, /BreadcrumbList/);
  assert.match(published, /name="robots" content="noindex,nofollow"/);
  assert.match(
    published,
    /<link rel="canonical" href="http:\/\/127.0.0.1:8791\/blog\/test-only-paint-integration\/">/,
  );
  assert.ok(!published.includes("<script>alert(1)</script>"));
  assert.ok(!published.includes('href="javascript:'));
  assert.match(published, /https:\/\/metricpedia.com\/paint-calculator\//);
  const events = (await req("/api/editorial/articles/" + id + "/events")).data;
  assert.equal(
    events.filter((x) => x.action === "scheduled-publication").length,
    1,
  );
  assert.match((await req("/sitemap.xml")).raw, /test-only-paint-integration/);
  assert.match((await req("/feed.xml")).raw, /TEST ONLY/);
  const second = (
    await req(
      "/api/integration/packages",
      "POST",
      { ...payload, title: "TEST ONLY – NEW UNAPPROVED", finalVersion: "2" },
      writer.token,
      201,
    )
  ).data;
  assert.equal(second.version, 2);
  assert.equal((await req("/blog/" + payload.slug + "/")).raw, published);
  await req(
    "/api/integration/articles/" + id + "/publish",
    "POST",
    { version: 2 },
    supervisor.token,
    409,
  );
  await req(
    "/api/integration/packages",
    "POST",
    {
      ...payload,
      externalId: "new-wrong-keyword",
      primaryKeyword: "writer changed keyword",
    },
    writer.token,
    400,
  );
  await req(
    "/api/integration/articles/" + id + "/authorize",
    "POST",
    { version: 2, digest: second.digest, evidence: "TEST ONLY version 2" },
    supervisor.token,
  );
  await req(
    "/api/integration/articles/" + id + "/schedule",
    "POST",
    { version: 2, runAt: new Date(Date.now() + 3600000).toISOString() },
    supervisor.token,
  );
  cmd([
    "d1",
    "execute",
    "metricpedia-cms-local-db",
    "--local",
    "--config",
    "wrangler.local.json",
    "--persist-to",
    state,
    "--command",
    `UPDATE external_approvals SET digest='invalidated-test-approval' WHERE article_id='${id}' AND version=2; UPDATE schedules SET run_at='2000-01-01T00:00:00.000Z' WHERE article_id='${id}' AND status='queued';`,
  ]);
  await scheduleCall();
  const failed = (await req("/api/editorial/schedules")).data.find(
    (s) => s.article_id === id && s.status === "queued",
  );
  assert.ok(failed.last_error);
  assert.equal((await req("/blog/" + payload.slug + "/")).raw, published);
  await req("/api/editorial/articles/" + id + "/cancel-schedule", "POST", {});
  const secondPassword = randomBytes(24).toString("hex");
  await req("/api/editorial/password", "POST", {
    currentPassword: password,
    password: secondPassword,
  });
  await req("/api/editorial/session", "GET", undefined, undefined, 401);
  const relogin = await req("/api/editorial/login", "POST", {
    username: "owner-test",
    password: secondPassword,
  });
  cookie = relogin.r.headers.get("set-cookie").split(";")[0];
  await req("/api/editorial/logout", "POST", {});
  await req("/api/editorial/session", "GET", undefined, undefined, 401);
  cmd([
    "d1",
    "execute",
    "metricpedia-cms-local-db",
    "--local",
    "--config",
    "wrangler.local.json",
    "--persist-to",
    state,
    "--command",
    "DELETE FROM login_limits;",
  ]);
  for (let i = 0; i < 10; i++)
    await req(
      "/api/editorial/login",
      "POST",
      { username: "owner-test", password: "wrong" },
      undefined,
      401,
    );
  await req(
    "/api/editorial/login",
    "POST",
    { username: "owner-test", password: "wrong" },
    undefined,
    429,
  );
} finally {
  server.kill("SIGTERM");
  try {
    unlinkSync(cms + ".dev.vars");
  } catch {}
}
console.log(
  "PASS: auth, CSRF, setup, scopes, media, idempotency, external approval, cron concurrency, SSR SEO/noindex, version isolation.",
);
