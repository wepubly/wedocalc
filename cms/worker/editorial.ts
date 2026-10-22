import type { Article, Env, Snapshot } from "./types";
import { HttpError, now } from "./types";
import { hash } from "./security";
import { markdownLinks, safeUrl } from "./markdown";
export interface Review {
  status: "review" | "changes" | "approved";
  reviewer: string;
  notes: string;
  updated_at: string;
}
export async function review(
  env: Env,
  a: Pick<Article, "id" | "draft_version">,
): Promise<Review | null> {
  return env.DB.prepare(
    "SELECT status,reviewer,notes,updated_at FROM editorial_reviews WHERE article_id=? AND version=?",
  )
    .bind(a.id, a.draft_version)
    .first<Review>();
}
export async function reviewed(env: Env, a: Article, v: number) {
  const saved = await env.DB.prepare(
    "SELECT snapshot FROM article_versions WHERE article_id=? AND version=?",
  )
    .bind(a.id, v)
    .first<{ snapshot: string }>();
  const approval = await env.DB.prepare(
    "SELECT digest,approved_by FROM external_approvals WHERE article_id=? AND version=?",
  )
    .bind(a.id, v)
    .first<{ digest: string; approved_by: string }>();
  if (!saved || !approval || approval.digest !== (await hash(saved.snapshot)))
    throw new HttpError(409, "Confirmação externa desta versão ausente.");
  if (v !== a.draft_version || (await review(env, a))?.status !== "approved")
    throw new HttpError(409, "A versão atual precisa da aprovação do Auditor.");
  if(env.ENVIRONMENT==="production-lab" && !approval?.approved_by?.startsWith("Auditor: "))
    throw new HttpError(409,"Aprovação antiga registrada sem credencial: revalide esta versão com um Auditor credenciado.");
}
export function safeSource(url: string) {
  return !!safeUrl(url) && /^https?:\/\//.test(url);
}
export async function publicationIssues(
  env: Env,
  s: Snapshot,
  id: string,
): Promise<string[]> {
  const issues: string[] = [];
  if (!s.title) issues.push("Título ausente.");
  if (!s.body.trim()) issues.push("Conteúdo vazio.");
  if (!s.excerpt) issues.push("Resumo ausente.");
  if (!s.author) issues.push("Autor ausente.");
  if (s.coverId) {
    const m = await env.DB.prepare(
      "SELECT license,source FROM media WHERE id=?",
    )
      .bind(s.coverId)
      .first<{ license: string; source: string }>();
    if (!m?.license || !m.source)
      issues.push("Direitos de imagem não documentados.");
  }
  if (s.coverId && !s.coverAlt) issues.push("Imagem sem alt text.");
  if (s.requiresSources && !s.sources?.length)
    issues.push("Este conteúdo exige fontes.");
  const collision = await env.DB.prepare(
    "SELECT id FROM articles WHERE published_slug=? AND id<>?",
  )
    .bind(s.slug, id)
    .first();
  if (collision) issues.push("URL já utilizada por outro artigo.");
  const origin = new URL(env.PUBLIC_ORIGIN).origin;
  for (const link of markdownLinks(s.body)) {
    const safe = safeUrl(link);
    if (!safe) {
      issues.push("Link inseguro: " + link);
      continue;
    }
    const url = new URL(safe, origin);
    if (url.origin !== origin) continue;
    if (["/", "/music", "/blog", "/blog/"].includes(url.pathname)) continue;
    const post = /^\/blog\/([a-z0-9-]+)\/?$/.exec(url.pathname);
    if (post && post[1] === s.slug) continue;
    if (!post) {
      const route = await env.DB.prepare(
        "SELECT id FROM routes WHERE path=? AND state='live'",
      )
        .bind(url.pathname)
        .first();
      if (route) continue;
    }
    if (
      !post ||
      !(await env.DB.prepare(
        "SELECT id FROM articles WHERE published_slug=? AND published_version IS NOT NULL",
      )
        .bind(post[1])
        .first())
    )
      issues.push("Link interno não publicado: " + url.pathname);
  }
  for (const target of [s.pillarId, ...(s.relatedIds || [])].filter(Boolean)) {
    if (target === id) {
      issues.push("Um artigo não pode relacionar-se a si mesmo.");
      continue;
    }
    if (
      !(await env.DB.prepare(
        "SELECT id FROM articles WHERE id=? AND published_version IS NOT NULL",
      )
        .bind(target)
        .first())
    )
      issues.push("Artigo relacionado ainda não publicado.");
  }
  return [...new Set(issues)];
}
export async function requireQuality(env: Env, s: Snapshot, id: string) {
  const issues = await publicationIssues(env, s, id);
  if (issues.length)
    throw new HttpError(
      issues.includes("URL já utilizada por outro artigo.") ? 409 : 400,
      issues.join(" "),
    );
}
export function editorialEvent(
  env: Env,
  a: Pick<Article, "id" | "draft_version">,
  action: string,
  actor = "Responsável autenticado",
  notes = "",
) {
  return env.DB.prepare(
    "INSERT INTO editorial_events(article_id,version,action,actor,notes,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM articles WHERE id=? AND draft_version=?)",
  ).bind(
    a.id,
    a.draft_version,
    action,
    actor,
    notes,
    now(),
    a.id,
    a.draft_version,
  );
}
export async function transition(
  env: Env,
  a: Pick<Article, "id" | "draft_version">,
  action: string,
  actor: string,
  notes: string,
) {
  const current = await review(env, a);
  if (action === "submit-review" && current?.status === "approved")
    throw new HttpError(
      409,
      "Edite para iniciar uma nova revisão ou solicite correções.",
    );
  if (
    ["approve", "request-changes"].includes(action) &&
    !["review", "approved"].includes(current?.status || "")
  )
    throw new HttpError(409, "Envie esta versão para revisão primeiro.");
  const status =
    action === "approve"
      ? "approved"
      : action === "request-changes"
        ? "changes"
        : "review";
  const result = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO editorial_reviews(article_id,version,status,reviewer,notes,updated_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM articles WHERE id=? AND draft_version=?) ON CONFLICT(article_id,version) DO UPDATE SET status=excluded.status,reviewer=excluded.reviewer,notes=excluded.notes,updated_at=excluded.updated_at`,
    ).bind(
      a.id,
      a.draft_version,
      status,
      actor,
      notes,
      now(),
      a.id,
      a.draft_version,
    ),
    editorialEvent(env, a, action, actor, notes),
    env.DB.prepare(
      "UPDATE schedules SET status='cancelled' WHERE article_id=? AND status='queued' AND ?<>'approved'",
    ).bind(a.id, status),
  ]);
  if (!result[0].meta.changes)
    throw new HttpError(409, "A versão mudou; reabra o artigo.");
}
