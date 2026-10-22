import { Env, Snapshot, HttpError, now } from "./types";
import { hash, jsonBody, randomToken, readBody } from "./security";
import { article, version, snapshot, publish, upload } from "./index";
import { requireQuality } from "./editorial";
const json = (v: unknown, status = 200) =>
  Response.json(v, { status, headers: { "Cache-Control": "no-store" } });
const fail = (m: string): never => {
  throw new HttpError(400, m);
};
const txt = (v: unknown, max = 200) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max
    ? v.trim()
    : fail("Campo editorial obrigatório inválido.");
const strings = (v: unknown, max = 30) =>
  Array.isArray(v) &&
  v.length <= max &&
  v.every((x) => typeof x === "string" && x.length < 200)
    ? (v as string[])
    : fail("Lista inválida.");
export function normalizeEditorial(d: Record<string, unknown>) {
  return {
    externalId: txt(d.externalId),
    briefId: txt(d.briefId),
    primaryKeyword: txt(d.primaryKeyword),
    secondaryKeywords: strings(d.secondaryKeywords || []),
    subcategoryId: txt(d.subcategoryId),
    calculatorId: txt(d.calculatorId),
    articleType: ["pillar", "cluster"].includes(String(d.articleType))
      ? (d.articleType as "pillar" | "cluster")
      : fail("Tipo deve ser pillar ou cluster."),
    circuit: [1, 2].includes(Number(d.circuit))
      ? Number(d.circuit)
      : fail("Circuito inválido."),
    finalVersion: txt(d.finalVersion),
    approvalReference:
      typeof d.approvalReference === "string"
        ? d.approvalReference.slice(0, 1000)
        : "",
    intendedRunAt: typeof d.intendedRunAt === "string" ? d.intendedRunAt : "",
  };
}
export async function validateEditorial(e: Env, s: Snapshot) {
  const b = await e.DB.prepare("SELECT * FROM briefs WHERE id=? AND active=1")
    .bind(s.briefId || "")
    .first<any>();
  if (!b) fail("Briefing aprovado não cadastrado ou inativo.");
  const route = await e.DB.prepare("SELECT name FROM routes WHERE id=?")
    .bind(b.category_id)
    .first<{ name: string }>();
  if (
    s.primaryKeyword !== b.primary_keyword ||
    s.subcategoryId !== b.subcategory_id ||
    s.calculatorId !== b.calculator_id ||
    s.category !== route?.name ||
    s.circuit !== b.circuit ||
    JSON.stringify(s.secondaryKeywords) !== b.secondary_keywords
  )
    fail("Pacote diverge do briefing aprovado.");
}
type Principal = { id: string; name: string; scopes: string[] };
async function principal(r: Request, e: Env) {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(
    r.headers.get("authorization") || "",
  );
  if (!match) throw new HttpError(401, "Credencial de agente necessária.");
  const row = await e.DB.prepare(
    "SELECT * FROM agents WHERE token_hash=? AND active=1",
  )
    .bind(await hash(match[1]))
    .first<any>();
  if (!row) throw new HttpError(401, "Credencial inválida.");
  return {
    id: row.id,
    name: row.name,
    scopes: JSON.parse(row.scopes),
  } as Principal;
}
function scope(p: Principal, s: string) {
  if (!p.scopes.includes(s))
    throw new HttpError(403, "Permissão necessária: " + s);
}
async function event(e: Env, action: string, actor: string, detail: unknown) {
  await e.DB.prepare(
    "INSERT INTO system_events(action,actor,detail,created_at) VALUES(?,?,?,?)",
  )
    .bind(action, actor, JSON.stringify(detail), now())
    .run();
}
export async function authorize(
  e: Env,
  id: string,
  d: Record<string, unknown>,
  actor: string,
) {
  const a = await article(e, id);
  if (d.version !== a.draft_version)
    throw new HttpError(409, "Versão alterada.");
  const v = await version(e, id, a.draft_version),
    digest = await hash(JSON.stringify(v.data));
  if (d.digest !== digest)
    throw new HttpError(409, "Hash da versão divergente.");
  const evidence = txt(d.evidence, 2000);
  await requireQuality(e, v.data, id);
  await validateEditorial(e, v.data);
  await e.DB.batch([
    e.DB.prepare(
      `INSERT INTO external_approvals SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM articles WHERE id=? AND draft_version=?) ON CONFLICT(article_id,version) DO UPDATE SET digest=excluded.digest,evidence=excluded.evidence,approved_by=excluded.approved_by,approved_at=excluded.approved_at`,
    ).bind(
      id,
      a.draft_version,
      digest,
      evidence,
      actor,
      now(),
      id,
      a.draft_version,
    ),
    e.DB.prepare(
      `INSERT INTO editorial_reviews SELECT ?,?,'approved',?,?,? WHERE EXISTS(SELECT 1 FROM articles WHERE id=? AND draft_version=?) ON CONFLICT(article_id,version) DO UPDATE SET status='approved',reviewer=excluded.reviewer,notes=excluded.notes,updated_at=excluded.updated_at`,
    ).bind(id, a.draft_version, actor, evidence, now(), id, a.draft_version),
    e.DB.prepare(
      "INSERT INTO editorial_events(article_id,version,action,actor,notes,created_at) VALUES(?,?,?,?,?,?)",
    ).bind(id, a.draft_version, "external-approval", actor, evidence, now()),
  ]);
  return json({ ok: true, digest });
}
async function details(e: Env, id: string) {
  const a = await article(e, id),
    v = await version(e, id, a.draft_version);
  const approval = await e.DB.prepare(
    "SELECT * FROM external_approvals WHERE article_id=? AND version=?",
  )
    .bind(id, a.draft_version)
    .first();
  return {
    ...a,
    snapshot: v.data,
    digest: await hash(JSON.stringify(v.data)),
    externalApproval: approval,
  };
}
export async function integration(r: Request, e: Env, path: string) {
  const p = await principal(r, e);
  if (path === "/api/integration/packages" && r.method === "POST") {
    scope(p, "submit");
    const d = await jsonBody(r),
      s = snapshot(d);
    await validateEditorial(e, s);
    const digest = await hash(JSON.stringify(s));
    const existing = await e.DB.prepare(
      "SELECT * FROM submissions WHERE external_id=?",
    )
      .bind(s.externalId)
      .first<any>();
    if (existing && existing.submitted_by !== p.id)
      throw new HttpError(403, "Trabalho pertence a outro agente.");
    const duplicate = await e.DB.prepare(
      "SELECT * FROM submission_versions WHERE external_id=? AND final_version=?",
    )
      .bind(s.externalId, s.finalVersion)
      .first<any>();
    if (duplicate) {
      if (duplicate.payload_hash !== digest)
        throw new HttpError(
          409,
          "Identificador de versão já usado com outro conteúdo.",
        );
      return json({
        id: existing.article_id,
        version: duplicate.article_version,
        digest,
        idempotent: true,
      });
    }
    const id = existing?.article_id || crypto.randomUUID(),
      a = existing ? await article(e, id) : null,
      v = (a?.draft_version || 0) + 1;
    if (a?.published_slug && a.published_slug !== s.slug)
      throw new HttpError(409, "Slug publicado é permanente.");
    if (existing?.brief_id && existing.brief_id !== s.briefId)
      throw new HttpError(409, "Briefing do trabalho não pode mudar.");
    if (
      s.coverId &&
      !(await e.DB.prepare("SELECT id FROM media WHERE id=?")
        .bind(s.coverId)
        .first())
    )
      fail("Imagem não cadastrada.");
    const time = now();
    await e.DB.batch([
      ...(!existing
        ? [
            e.DB.prepare(
              "INSERT INTO articles(id,draft_version,created_at,updated_at) VALUES(?,0,?,?)",
            ).bind(id, time, time),
            e.DB.prepare("INSERT INTO submissions VALUES(?,?,?,?)").bind(
              s.externalId,
              id,
              s.briefId,
              p.id,
            ),
          ]
        : []),
      e.DB.prepare("INSERT INTO article_versions VALUES(?,?,?,?)").bind(
        id,
        v,
        JSON.stringify(s),
        time,
      ),
      e.DB.prepare(
        "UPDATE articles SET draft_version=?,updated_at=? WHERE id=? AND draft_version=?",
      ).bind(v, time, id, v - 1),
      e.DB.prepare("INSERT INTO submission_versions VALUES(?,?,?,?)").bind(
        s.externalId,
        s.finalVersion,
        digest,
        v,
      ),
      e.DB.prepare(
        "UPDATE schedules SET status='cancelled' WHERE article_id=? AND status='queued'",
      ).bind(id),
      e.DB.prepare(
        "INSERT INTO editorial_events(article_id,version,action,actor,notes,created_at) VALUES(?,?,?,?,?,?)",
      ).bind(id, v, "receive-package", p.id, s.finalVersion, time),
    ]);
    await event(e, "receive-package", p.id, { id, version: v });
    return json({ id, version: v, digest, publicationAuthorized: false }, 201);
  }
  if (path === "/api/integration/media" && r.method === "POST") {
    scope(p, "submit");
    return upload(r, e);
  }
  const m =
    /^\/api\/integration\/articles\/([a-f0-9-]+)(?:\/(authorize|schedule|publish))?$/.exec(
      path,
    );
  if (m) {
    const id = m[1];
    if (!m[2] && r.method === "GET") {
      scope(p, "status");
      const own = await e.DB.prepare(
        "SELECT submitted_by FROM submissions WHERE article_id=?",
      )
        .bind(id)
        .first<any>();
      if (p.scopes.includes("submit") && own?.submitted_by !== p.id)
        throw new HttpError(403, "Trabalho de outro agente.");
      return json(await details(e, id));
    }
    if (r.method === "POST" && m[2]) {
      scope(p, m[2]);
      const d = await jsonBody(r);
      if (m[2] === "authorize") return authorize(e, id, d, "agent:" + p.id);
      const a = await article(e, id);
      if (d.version !== a.draft_version)
        throw new HttpError(409, "Versão alterada.");
      if (m[2] === "publish") {
        await publish(e, a, a.draft_version);
        return json({ ok: true });
      }
      return schedule(e, id, d, "agent:" + p.id);
    }
  }
  throw new HttpError(404, "Endpoint de integração não encontrado.");
}
async function schedule(
  e: Env,
  id: string,
  d: Record<string, unknown>,
  actor: string,
) {
  const a = await article(e, id);
  if (d.version !== a.draft_version)
    throw new HttpError(409, "Versão alterada.");
  if (
    typeof d.runAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(d.runAt) ||
    !Number.isFinite(Date.parse(d.runAt)) ||
    Date.parse(d.runAt) <= Date.now()
  )
    fail("Agendamento exige data futura com fuso horário.");
  const { reviewed } = await import("./editorial");
  await reviewed(e, a, a.draft_version);
  await requireQuality(e, (await version(e, id, a.draft_version)).data, id);
  const runAt = new Date(d.runAt as string).toISOString();
  const result = await e.DB.batch([
    e.DB.prepare(
      "UPDATE schedules SET status='cancelled' WHERE article_id=? AND status='queued'",
    ).bind(id),
    e.DB.prepare(
      "INSERT INTO schedules(id,article_id,version,run_at,status,created_at) SELECT ?,?,?,?,'queued',? WHERE EXISTS(SELECT 1 FROM articles a JOIN editorial_reviews r ON r.article_id=a.id AND r.version=a.draft_version WHERE a.id=? AND a.draft_version=? AND r.status='approved')",
    ).bind(
      crypto.randomUUID(),
      id,
      a.draft_version,
      runAt,
      now(),
      id,
      a.draft_version,
    ),
    e.DB.prepare(
      "INSERT INTO editorial_events(article_id,version,action,actor,notes,created_at) VALUES(?,?,?,?,?,?)",
    ).bind(id, a.draft_version, "schedule", actor, runAt, now()),
  ]);
  if (!result[1].meta.changes) throw new HttpError(409, "Aprovação alterada.");
  return json({ ok: true, runAt });
}
export async function extraAdmin(r: Request, e: Env, path: string) {
  if (path === "/api/editorial/routes" && r.method === "GET")
    return json((await e.DB.prepare("SELECT * FROM routes").all()).results);
  if (path === "/api/editorial/briefs") {
    if (r.method === "GET")
      return json(
        (
          await e.DB.prepare(
            "SELECT * FROM briefs ORDER BY created_at DESC",
          ).all()
        ).results,
      );
    if (r.method === "POST") {
      const d = await jsonBody(r);
      const route = await e.DB.prepare(
        "SELECT c.id FROM routes c JOIN routes s ON c.parent_id=s.id JOIN routes t ON s.parent_id=t.id WHERE c.id=? AND c.kind='calculator' AND s.id=? AND s.kind='subcategory' AND t.id=? AND t.kind='category'",
      )
        .bind(d.calculatorId, d.subcategoryId, d.categoryId)
        .first();
      if (!route) fail("Hierarquia inválida.");
      if (![1, 2].includes(Number(d.circuit))) fail("Circuito inválido.");
      await e.DB.prepare("INSERT INTO briefs VALUES(?,?,?,?,?,?,?,?,1,?)")
        .bind(
          txt(d.id),
          txt(d.title),
          d.categoryId,
          d.subcategoryId,
          d.calculatorId,
          txt(d.primaryKeyword),
          JSON.stringify(strings(d.secondaryKeywords || [])),
          Number(d.circuit),
          now(),
        )
        .run();
      await event(e, "create-approved-brief", "owner", { id: d.id });
      return json({ ok: true }, 201);
    }
  }
  if (path === "/api/editorial/routes" && r.method === "POST") {
    const d = await jsonBody(r);
    if (
      !["category", "subcategory", "calculator"].includes(String(d.kind)) ||
      !["live", "planned"].includes(String(d.state)) ||
      typeof d.path !== "string" ||
      !/^\/[a-z0-9\/-]*\/$/.test(d.path)
    )
      fail("Rota inválida.");
    if (d.kind !== "category") {
      const parent = await e.DB.prepare("SELECT kind FROM routes WHERE id=?")
        .bind(d.parentId)
        .first<any>();
      if (
        parent?.kind !== (d.kind === "subcategory" ? "category" : "subcategory")
      )
        fail("Rota pai inválida.");
    }
    await e.DB.prepare("INSERT INTO routes VALUES(?,?,?,?,?,?)")
      .bind(
        txt(d.id),
        d.kind,
        txt(d.name),
        d.path,
        d.kind === "category" ? null : d.parentId,
        d.state,
      )
      .run();
    if (d.kind === "category")
      await e.DB.prepare("INSERT INTO terms VALUES(?,'category',?,?)")
        .bind(d.id, d.name, d.id)
        .run();
    return json({ ok: true });
  }
  if (path === "/api/editorial/agents") {
    if (r.method === "GET")
      return json(
        (
          await e.DB.prepare(
            "SELECT id,name,scopes,active,created_at FROM agents",
          ).all()
        ).results,
      );
    if (r.method === "POST") {
      const d = await jsonBody(r),
        scopes = strings(d.scopes, 5);
      if (
        !scopes.length ||
        scopes.some(
          (s) =>
            !["submit", "status", "authorize", "schedule", "publish"].includes(
              s,
            ),
        ) ||
        (scopes.includes("submit") &&
          scopes.some((s) => ["authorize", "schedule", "publish"].includes(s)))
      )
        fail("Separe a credencial do escritor da credencial do Supervisor.");
      const token = randomToken(),
        id = crypto.randomUUID();
      await e.DB.prepare("INSERT INTO agents VALUES(?,?,?,?,1,?)")
        .bind(id, txt(d.name), await hash(token), JSON.stringify(scopes), now())
        .run();
      await event(e, "create-agent", "owner", { id, scopes });
      return json({ id, token, scopes }, 201);
    }
  }
  const revoke = /^\/api\/editorial\/agents\/([a-f0-9-]+)\/revoke$/.exec(path);
  if (revoke && r.method === "POST") {
    await e.DB.prepare("UPDATE agents SET active=0 WHERE id=?")
      .bind(revoke[1])
      .run();
    await event(e, "revoke-agent", "owner", { id: revoke[1] });
    return json({ ok: true });
  }
  const detail =
    /^\/api\/editorial\/articles\/([a-f0-9-]+)\/(details|authorize)$/.exec(
      path,
    );
  if (detail) {
    if (r.method === "GET" && detail[2] === "details")
      return json(await details(e, detail[1]));
    if (r.method === "POST" && detail[2] === "authorize")
      return authorize(e, detail[1], await jsonBody(r), "owner");
  }
  if (path === "/api/editorial/logs" && r.method === "GET")
    return json(
      (
        await e.DB.prepare(
          "SELECT id,action,actor,detail,created_at FROM system_events UNION ALL SELECT id,action,actor,notes AS detail,created_at FROM editorial_events ORDER BY created_at DESC LIMIT 200",
        ).all()
      ).results,
    );
  return null;
}
