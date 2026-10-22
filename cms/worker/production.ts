import { Article, Env, HttpError, Snapshot, now, slugPattern } from "./types";
import {checkOrigin,jsonBody,readBody,hash} from "./security";
import {articlePath} from "../src/destination";
import { articleHtml, articleMarkdown, modifiedDate, escape, page } from "./production-render";
import { markdownLinks } from "./markdown";
import { imageDimensions } from "./images";
import { review, reviewed, transition, publicationIssues, requireQuality, editorialEvent, safeSource } from "./production-editorial";
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
function text(data: unknown, name: string, max: number, required = false) {
  if (
    typeof data !== "string" ||
    data.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(data) ||
    (required && !data.trim())
  )
    throw new HttpError(400, `${name} inválido.`);
  return data.trim();
}
export function snapshot(data: Record<string, unknown>): Snapshot {
  const slug = text(data.slug, "URL", 120, true);
  if (!slugPattern.test(slug))
    throw new HttpError(
      400,
      "URL deve usar letras minúsculas, números e hífens.",
    );
  if (
    !Array.isArray(data.tags) ||
    data.tags.length > 20 ||
    data.tags.some((t) => typeof t !== "string" || t.length > 80)
  )
    throw new HttpError(400, "Tags inválidas.");
  if (data.language !== "en-US")
    throw new HttpError(400, "Idioma deve ser en-US.");
  const sources = data.sources ?? [];
  if (!Array.isArray(sources) || sources.length > 30 || sources.some(s => !s || typeof s !== 'object' || typeof s.title !== 'string' || s.title.length > 250 || typeof s.url !== 'string' || s.url.length > 2000 || !safeSource(s.url)))
    throw new HttpError(400, 'Fontes inválidas; use URLs HTTP/HTTPS.');
  const relatedIds = data.relatedIds ?? [];
  if (!Array.isArray(relatedIds) || relatedIds.length > 12 || relatedIds.some(id => typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)))
    throw new HttpError(400, 'Artigos relacionados inválidos.');
  if (data.authorType && !['Person','Organization'].includes(String(data.authorType))) throw new HttpError(400, 'Tipo de autor inválido.');
  const pillarId = text(data.pillarId ?? '', 'Matéria raiz', 60);
  if (pillarId && !/^[a-f0-9-]{36}$/.test(pillarId)) throw new HttpError(400, 'Matéria raiz inválida.');
  return {
    categoryId: text(data.categoryId,"Categoria de destino",100,true),
    subcategoryId: text(data.subcategoryId,"Tipo de calculadora",100,true),
    calculatorId: text(data.calculatorId,"Calculadora",100,true),
    destination: data.destination as Snapshot["destination"],
    authorType: data.authorType === 'Person' ? 'Person' : 'Organization',
    sources: sources.map(s => ({title: s.title.trim(), url: s.url.trim()})),
    requiresSources: data.requiresSources === true,
    isPillar: data.isPillar === true,
    pillarId,
    relatedIds: [...new Set(relatedIds as string[])],
    title: text(data.title, "Título", 180, true),
    slug,
    body: text(data.body, "Texto", 100000),
    excerpt: text(data.excerpt, "Resumo", 500),
    seoTitle: text(data.seoTitle, "Título SEO", 180),
    description: text(data.description, "Descrição", 320),
    author: text(data.author, "Autor", 100),
    language: "en-US",
    category: text(data.category, "Categoria", 80),
    tags: [...new Set(data.tags as string[])],
    coverId: text(data.coverId, "Imagem", 60),
    coverAlt: text(data.coverAlt, "Descrição da imagem", 250),
  };
}
async function destinationData(env:Env,data:Record<string,unknown>) {
 const routes=(await env.DB.prepare("SELECT id,kind,name,path,parent_id,state FROM routes WHERE state='live'").all<{id:string;kind:string;name:string;path:string;parent_id:string|null}>()).results;
 const category=routes.find(r=>r.kind==='category'&&r.id===data.categoryId),subcategory=routes.find(r=>r.kind==='subcategory'&&r.id===data.subcategoryId),calculator=routes.find(r=>r.kind==='calculator'&&r.id===data.calculatorId);
 if(!category||!subcategory||!calculator||subcategory.parent_id!==category.id||calculator.parent_id!==subcategory.id)throw new HttpError(400,'Selecione categoria, tipo de calculadora e calculadora correspondentes.');
 return {...data,category:category.name,destination:{category,subcategory,calculator}};
}
async function article(env: Env, id: string) {
  const row = await env.DB.prepare("SELECT * FROM articles WHERE id=?")
    .bind(id)
    .first<Article>();
  if (!row) throw new HttpError(404, "Artigo não encontrado.");
  return row;
}
async function version(env: Env, id: string, v: number) {
  const row = await env.DB.prepare(
    "SELECT snapshot,created_at FROM article_versions WHERE article_id=? AND version=?",
  )
    .bind(id, v)
    .first<{ snapshot: string; created_at: string }>();
  if (!row) throw new HttpError(404, "Versão não encontrada.");
  return { ...row, data: JSON.parse(row.snapshot) as Snapshot };
}
async function validateReferences(env: Env, s: Snapshot) {
  const terms = (
    await env.DB.prepare("SELECT kind,name FROM terms").all<{
      kind: string;
      name: string;
    }>()
  ).results;
  if (
    s.category &&
    !terms.some((t) => t.kind === "category" && t.name === s.category)
  )
    throw new HttpError(400, "Categoria não encontrada.");
  if (
    s.tags.some((tag) => !terms.some((t) => t.kind === "tag" && t.name === tag))
  )
    throw new HttpError(400, "Tag não encontrada.");
  if (
    s.coverId &&
    !(await env.DB.prepare("SELECT id FROM media WHERE id=?")
      .bind(s.coverId)
      .first())
  )
    throw new HttpError(400, "Imagem não encontrada.");
}
function ready(s: Snapshot) {
  if (!s.body || !s.excerpt || !s.author)
    throw new HttpError(
      400,
      "Preencha texto, resumo e autor antes de publicar.",
    );
  if (s.coverId && !s.coverAlt)
    throw new HttpError(400, "Descreva a imagem antes de publicar.");
}
async function publish(env: Env, a: Article, v: number, scheduleId?: string) {
  if(a.published_version===v&&!scheduleId)return [];
  const s = (await version(env, a.id, v)).data;
  ready(s);
  await reviewed(env, a, v);
  await requireQuality(env, s, a.id);
  await validateReferences(env, s);
  if (a.published_slug && a.published_slug !== s.slug)
    throw new HttpError(409, "A URL publicada deve permanecer estável.");
  const time = now();
  const result = await env.DB.batch([
    env.DB.prepare(
      "UPDATE articles SET published_version=?,published_slug=?,published_at=COALESCE(published_at,?),updated_at=? WHERE id=? AND draft_version=? AND EXISTS(SELECT 1 FROM editorial_reviews WHERE article_id=articles.id AND version=? AND status='approved') AND (?='' OR (draft_version=? AND EXISTS(SELECT 1 FROM schedules WHERE id=? AND status='queued' AND last_error IS NULL AND run_at<=?)))",
    ).bind(v, s.slug, time, time, a.id, v, v, scheduleId || "", v, scheduleId || "", time),
    // D1 batch is transactional: SQLite changes() belongs to the immediately
    // preceding statement. Emit history and consume the schedule only if this
    // invocation actually published, including when cron invocations overlap.
    env.DB.prepare("INSERT INTO editorial_events(article_id,version,action,actor,notes,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1").bind(a.id,v,scheduleId?'scheduled-publication':'publish',scheduleId?'Executor automático':'Responsável autenticado','',time),
    env.DB.prepare(
      "UPDATE schedules SET status=CASE WHEN id=? THEN 'published' ELSE 'cancelled' END WHERE article_id=? AND status='queued' AND changes()=1",
    ).bind(scheduleId || "",a.id),
  ]);
  if (!result[0].meta.changes && !scheduleId) throw new HttpError(409, 'Aprovação ou versão mudou; publicação interrompida.');
  return result;
}
async function mediaResponse(env: Env, id: string, privateFile: boolean) {
  const row = await env.DB.prepare("SELECT * FROM media WHERE id=?")
    .bind(id)
    .first<{ object_key: string; mime: string }>();
  if (!row) throw new HttpError(404, "Arquivo não encontrado.");
  if (!privateFile) {
    const used = await env.DB.prepare(
      `SELECT a.id FROM articles a JOIN article_versions v ON v.article_id=a.id AND v.version=a.published_version WHERE json_extract(v.snapshot,'$.coverId')=? LIMIT 1`,
    )
      .bind(id)
      .first();
    if (!used) throw new HttpError(404, "Arquivo não encontrado.");
  }
  const object = await env.MEDIA.get(row.object_key);
  if (!object) throw new HttpError(404, "Arquivo não encontrado.");
  return new Response(object.body, {
    headers: {
      "Content-Type": row.mime,
      "Cache-Control": privateFile
        ? "no-store"
        : "public, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
async function upload(request: Request, env: Env) {
  const data = await readBody(request, 5 * 1024 * 1024);
  const mime = request.headers.get("content-type") || "";
  const ok =
    (mime === "image/png" &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((x, i) => data[i] === x)) ||
    (mime === "image/jpeg" &&
      data[0] === 255 &&
      data[1] === 216 &&
      data[2] === 255) ||
    (mime === "image/webp" &&
      new TextDecoder().decode(data.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(data.slice(8, 12)) === "WEBP");
  if (!ok)
    throw new HttpError(415, "Envie PNG, JPEG ou WebP válido (até 5 MB).");
  const dimensions = imageDimensions(data, mime);
  if (!dimensions) throw new HttpError(415, 'Imagem inválida ou dimensões ilegíveis.');
  let fileName = request.headers.get("x-file-name") || "image";
  try {
    fileName = decodeURIComponent(fileName);
  } catch {
    throw new HttpError(400, "Nome de arquivo inválido.");
  }
  const name = text(fileName, "Nome", 200, true),
    alt = text(request.headers.get("x-image-alt") || "", "Descrição", 250);
  const id = crypto.randomUUID(),
    key = "editorial/" + id;
  await env.MEDIA.put(key, data, { httpMetadata: { contentType: mime } });
  try {
    await env.DB.prepare("INSERT INTO media(id,object_key,name,mime,size,alt,created_at,width,height) VALUES(?,?,?,?,?,?,?,?,?)")
      .bind(id, key, name, mime, data.length, alt, now(), dimensions.width, dimensions.height)
      .run();
  } catch (e) {
    await env.MEDIA.delete(key);
    throw e;
  }
  return json({ id, name, alt, ...dimensions }, 201);
}
async function api(request: Request, env: Env, path: string) {
  if (!["GET", "HEAD"].includes(request.method)) checkOrigin(request);
  if(path==="/api/editorial/session"&&request.method==="GET")return json({authenticated:true,mode:"production"});
  if(path==="/api/editorial/routes"&&request.method==="GET")return json((await env.DB.prepare("SELECT * FROM routes ORDER BY kind,name").all()).results);
  if (path === "/api/editorial/terms") {
    if (request.method === "GET")
      return json(
        (await env.DB.prepare("SELECT * FROM terms ORDER BY kind,name").all())
          .results,
      );
    if (request.method === "POST") {
      const d = await jsonBody(request);
      if (!["category", "tag"].includes(String(d.kind)))
        throw new HttpError(400, "Tipo inválido.");
      const name = text(d.name, "Nome", 80, true),
        slug = text(d.slug, "URL", 100, true);
      if (!slugPattern.test(slug)) throw new HttpError(400, "URL inválida.");
      const id = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO terms VALUES(?,?,?,?)")
        .bind(id, d.kind, name, slug)
        .run();
      return json({ id }, 201);
    }
  }
  if (path === "/api/editorial/pitches") {
    if (request.method === "GET")
      return json(
        (
          await env.DB.prepare(
            "SELECT * FROM pitches ORDER BY created_at DESC",
          ).all()
        ).results,
      );
    if (request.method === "POST") {
      const d = await jsonBody(request),
        id = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO pitches VALUES(?,?,?,?,?)")
        .bind(
          id,
          text(d.title, "Título", 180, true),
          text(d.notes, "Notas", 5000),
          "planned",
          now(),
        )
        .run();
      return json({ id }, 201);
    }
  }
  const pitch = /^\/api\/editorial\/pitches\/([a-f0-9-]+)$/.exec(path);
  if (pitch && request.method === "PUT") {
    const d = await jsonBody(request);
    if (!["planned", "approved", "archived"].includes(String(d.status)))
      throw new HttpError(400, "Status inválido.");
    const r = await env.DB.prepare("UPDATE pitches SET status=? WHERE id=?")
      .bind(d.status, pitch[1])
      .run();
    if (!r.meta.changes) throw new HttpError(404, "Pauta não encontrada.");
    return json({ ok: true });
  }
  if (path === "/api/editorial/media") {
    if (request.method === "GET")
      return json(
        (
          await env.DB.prepare(
            "SELECT id,name,mime,size,alt,created_at,width,height FROM media ORDER BY created_at DESC",
          ).all()
        ).results,
      );
    if (request.method === "POST") return upload(request, env);
  }
  const file = /^\/api\/editorial\/media\/([a-f0-9-]+)$/.exec(path);
  if (file && request.method === "GET")
    return mediaResponse(env, file[1], true);
  if (path === "/api/editorial/articles") {
    if (request.method === "GET")
      return json(
        (
          await env.DB.prepare(
            `SELECT a.*,r.status AS review_status,r.reviewer,r.notes AS review_notes,v.snapshot FROM articles a LEFT JOIN editorial_reviews r ON r.article_id=a.id AND r.version=a.draft_version JOIN article_versions v ON v.article_id=a.id AND v.version=a.draft_version ORDER BY a.updated_at DESC`,
          ).all()
        ).results.map((r) => ({
          ...r,
          snapshot: JSON.parse(r.snapshot as string),
        })),
      );
    if (request.method === "POST") {
      const d = await jsonBody(request),
        s = snapshot(await destinationData(env,d));
      await validateReferences(env, s);
      const id = crypto.randomUUID(),
        time = now();
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO articles(id,draft_version,created_at,updated_at) VALUES(?,1,?,?)",
        ).bind(id, time, time),
        env.DB.prepare("INSERT INTO article_versions VALUES(?,?,?,?)").bind(
          id,
          1,
          JSON.stringify(s),
          time,
        ),
      ]);
      await editorialEvent(env,{id,draft_version:1},'create-draft').run();
      return json({ id, version: 1 }, 201);
    }
  }
  const route =
    /^\/api\/editorial\/articles\/([a-f0-9-]+)(?:\/(versions|publish|unpublish|schedule|cancel-schedule|submit-review|approve|request-changes|quality|events))?$/.exec(
      path,
    );
  if (route) {
    const a = await article(env, route[1]),
      action = route[2];
    if (!action && request.method === "GET")
      return json({
        ...a,
        snapshot: (await version(env, a.id, a.draft_version)).data,
        review: await review(env,a),
        review_status: (await review(env,a))?.status ?? null,
        digest:await hash(JSON.stringify((await version(env,a.id,a.draft_version)).data)),
      });
    if (action === 'quality' && request.method === 'GET') {
      const s = (await version(env,a.id,a.draft_version)).data;
      const blockers = await publicationIssues(env,s,a.id);
      const warnings = [...(!s.description ? ['Meta description ausente; o resumo será usado.'] : []), ...(!s.sources?.length && !s.requiresSources ? ['Confira se este conteúdo necessita de fontes.'] : [])];
      if ((await review(env,a))?.status !== 'approved') blockers.push('Aprovação da versão atual pendente.');
      return json({ blockers, warnings });
    }
    if (action === 'events' && request.method === 'GET') return json((await env.DB.prepare('SELECT version,action,actor,notes,created_at FROM editorial_events WHERE article_id=? ORDER BY id DESC').bind(a.id).all()).results);
    if (!action && request.method === "PUT") {
      const d = await jsonBody(request);
      if (d.version !== a.draft_version)
        throw new HttpError(
          409,
          "Outra versão foi salva. Reabra o artigo antes de editar.",
        );
      const s = snapshot(await destinationData(env,d));
      if (a.published_slug && a.published_slug !== s.slug)
        throw new HttpError(409, "A URL publicada deve permanecer estável.");
      await validateReferences(env, s);
      const previous = (await version(env,a.id,a.draft_version)).data;
      if(a.published_version && articlePath((await version(env,a.id,a.published_version)).data)!==articlePath(s))throw new HttpError(409,'O destino de uma matéria publicada deve permanecer estável.');
      // Re-saving identical public/editorial content does not advance dates or approvals.
      if (JSON.stringify(snapshot(previous as unknown as Record<string,unknown>)) === JSON.stringify(s)) return json({id:a.id,version:a.draft_version});
      const next = a.draft_version + 1,
        time = now();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO article_versions VALUES(?,?,?,?)").bind(
          a.id,
          next,
          JSON.stringify(s),
          time,
        ),
        env.DB.prepare(
          "UPDATE articles SET draft_version=?,updated_at=? WHERE id=? AND draft_version=?",
        ).bind(next, time, a.id, a.draft_version),
        env.DB.prepare(
          "UPDATE schedules SET status='cancelled' WHERE article_id=? AND status='queued'",
        ).bind(a.id),
        editorialEvent(env,{id:a.id,draft_version:next},'save-draft'),
      ]);
      return json({ id: a.id, version: next });
    }
    if (action === "versions" && request.method === "GET")
      return json(
        (
          await env.DB.prepare(
            "SELECT version,snapshot,created_at FROM article_versions WHERE article_id=? ORDER BY version DESC",
          )
            .bind(a.id)
            .all()
        ).results.map((v) => ({
          ...v,
          snapshot: JSON.parse(v.snapshot as string),
        })),
      );
    if (action && request.method === "POST") {
      if (['submit-review','approve','request-changes'].includes(action)) {
        const d = await jsonBody(request);
        if (d.version !== a.draft_version) throw new HttpError(409,'Reabra a versão atual antes de revisar.');
        const actor = text(d.actor, 'Responsável pela revisão', 100, true);
        const notes = text(d.notes ?? '', 'Notas da revisão', 5000);
        if (action === 'approve') {
          const s = (await version(env,a.id,a.draft_version)).data;
          await requireQuality(env,s,a.id); await validateReferences(env,s);
        }
        await transition(env,a,action,actor,notes);
        return json({ok:true});
      }
      if (action === "publish") {
        const d = await jsonBody(request);
        if (d.version !== a.draft_version)
          throw new HttpError(409, "Reabra a versão atual antes de publicar.");
        await publish(env, a, a.draft_version);
        return json({
          ok: true,
          url: articlePath((await version(env, a.id, a.draft_version)).data),
        });
      }
      if (action === "unpublish") {
        const origin = new URL(env.PUBLIC_ORIGIN).origin;
        const publishedForLinks=await publicArticles(env);
        const linked = publishedForLinks.some(r=>r.id!==a.id && (r.data.pillarId===a.id || r.data.relatedIds?.includes(a.id) || markdownLinks(r.data.body).some(link=> {try{return new URL(link,origin).pathname.replace(/\/$/,'') === articlePath((publishedForLinks.find(p=>p.id===a.id)?.data)||{slug:a.published_slug||''}).replace(/\/$/,'');}catch{return false;}})));
        if(linked)throw new HttpError(409,'Outro artigo publicado aponta para este conteúdo. Atualize os links antes de retirar.');
        await env.DB.batch([
          env.DB.prepare(
            "UPDATE articles SET published_version=NULL,updated_at=? WHERE id=?",
          ).bind(now(), a.id),
          env.DB.prepare(
            "UPDATE schedules SET status='cancelled' WHERE article_id=? AND status='queued'",
          ).bind(a.id),
        ]);
        await editorialEvent(env,a,'unpublish').run();
        return json({ ok: true });
      }
      if (action === "cancel-schedule") {
        await env.DB.prepare(
          "UPDATE schedules SET status='cancelled' WHERE article_id=? AND status='queued'",
        )
          .bind(a.id)
          .run();
        await editorialEvent(env,a,'cancel-schedule').run();
        return json({ ok: true });
      }
      if (action === "schedule") {
        const d = await jsonBody(request);
        if (d.version !== a.draft_version)
          throw new HttpError(409, "Reabra a versão atual antes de agendar.");
        if (
          typeof d.runAt !== "string" ||
          !Number.isFinite(Date.parse(d.runAt)) ||
          Date.parse(d.runAt) <= Date.now()
        )
          throw new HttpError(400, "Escolha uma data futura.");
        const v = await version(env, a.id, a.draft_version);
        ready(v.data);
        await reviewed(env,a,a.draft_version);
        await requireQuality(env,v.data,a.id);
        await validateReferences(env,v.data);
        const runAt = new Date(d.runAt).toISOString();
        const scheduling = await env.DB.batch([
          env.DB.prepare(
            "UPDATE schedules SET status='cancelled' WHERE article_id=? AND status='queued'",
          ).bind(a.id),
          env.DB.prepare(
            "INSERT INTO schedules(id,article_id,version,run_at,status,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM articles a JOIN editorial_reviews r ON r.article_id=a.id AND r.version=a.draft_version WHERE a.id=? AND a.draft_version=? AND r.status='approved')",
          ).bind(
            crypto.randomUUID(),
            a.id,
            a.draft_version,
            runAt,
            "queued",
            now(),
            a.id, a.draft_version,
          ),
          editorialEvent(env,a,"schedule"),
        ]);
        if(!scheduling[1].meta.changes)throw new HttpError(409,'Aprovação mudou; reabra o artigo.');
        return json({ ok: true });
      }
    }
  }
  if (path === "/api/editorial/schedules" && request.method === "GET")
    return json(
      (
        await env.DB.prepare(
          "SELECT * FROM schedules ORDER BY run_at DESC",
        ).all()
      ).results,
    );
  throw new HttpError(404, "Rota não encontrada.");
}
async function publicArticles(env: Env) {
  return (
    await env.DB.prepare(
      `SELECT a.id,a.published_at,v.created_at,v.snapshot FROM articles a JOIN article_versions v ON v.article_id=a.id AND v.version=a.published_version ORDER BY a.published_at DESC`,
    ).all<{
      id: string;
      published_at: string;
      created_at: string;
      snapshot: string;
    }>()
  ).results.map((r) => ({ ...r, data: JSON.parse(r.snapshot) as Snapshot }));
}
function html(value: string, status = 200, privatePage = false) {
  return new Response(value, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": privatePage
        ? "no-store"
        : "public, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: https://i.ytimg.com https://img.youtube.com; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      "X-Robots-Tag": privatePage ? "noindex, nofollow" : "max-image-preview:large",
    },
  });
}
async function handle(request:Request,env:Env):Promise<Response> {
 const url=new URL(request.url),path=url.pathname;
 if(!env.DB||!env.MEDIA)throw new HttpError(503,'CMS não configurado.');
 if(env.ENVIRONMENT==='production'&&url.hostname.endsWith('.workers.dev'))return Response.redirect('https://metricpedia.com'+path+url.search,308);
 if(path.startsWith('/api/')){
  if(path==='/api/public/latest-articles'&&request.method==='GET')return json({articles:(await publicArticles(env)).slice(0,6).map(r=>({title:r.data.title,category:r.data.category,calculatorId:r.data.calculatorId,description:r.data.excerpt,href:articlePath(r.data),image:r.data.coverId?'/media/'+r.data.coverId:null,alt:r.data.coverAlt,publishedAt:r.published_at}))});
  return api(request,env,path);
 }
 if(path.startsWith('/admin-assets/'))return env.ASSETS.fetch(request);
 if(path==='/admin'||path==='/admin/'||path==='/cms'||path==='/cms/'||/^\/admin\/(?:articles|media|schedules)$/.test(path)){
  const shell=await env.ASSETS.fetch(new Request(new URL('/admin-assets/',url)));
  return new Response(shell.body,{status:shell.status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex,nofollow'}});
 }
 const preview=/^\/admin\/preview\/([a-f0-9-]+)$/.exec(path);
 if(preview){const a=await article(env,preview[1]);const n=url.searchParams.get('version');if(n&&(!Number.isSafeInteger(Number(n))||Number(n)<1))throw new HttpError(400,'Versão inválida.');const v=await version(env,a.id,n?Number(n):a.draft_version);return html(articleHtml(v.data,env.PUBLIC_ORIGIN,a.published_at||now(),v.created_at,true),200,true);}
 if(!['GET','HEAD'].includes(request.method))throw new HttpError(405,'Método não permitido.');
 const media=/^\/media\/([a-f0-9-]+)$/.exec(path);if(media)return mediaResponse(env,media[1],false);
 const origin=env.PUBLIC_ORIGIN;const list=await publicArticles(env);
 if(path==='/blog'||path==='/blog/')return html(page('Metricpedia Blog','Practical guides for everyday calculations.',origin+'/blog/',`<h1>Metricpedia Blog</h1><p>Practical guides for everyday calculations.</p><div class="blog-grid">${list.map(r=>`<a class="blog-card" href="${escape(articlePath(r.data))}">${r.data.coverId?`<div class="blog-card-cover"><img src="/media/${r.data.coverId}" alt="${escape(r.data.coverAlt)}"></div>`:''}<div class="blog-card-body"><p class="blog-card-category">${escape(r.data.category)} · ${escape(r.data.destination?.calculator.name||'')}</p><h2>${escape(r.data.title)}</h2><p>${escape(r.data.excerpt)}</p></div></a>`).join('')}</div>`));
 if(path==='/sitemap-blog.xml'||path==='/feed.xml'){
  const xml=path==='/sitemap-blog.xml'?`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escape(origin+'/blog/')}</loc></url>${list.map(r=>`<url><loc>${escape(origin+articlePath(r.data))}</loc><lastmod>${modifiedDate(r.published_at,r.created_at)}</lastmod></url>`).join('')}</urlset>`:`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Metricpedia Blog</title><link>${origin}/blog/</link><description>Practical calculation guides.</description>${list.map(r=>`<item><title>${escape(r.data.title)}</title><link>${escape(origin+articlePath(r.data))}</link><guid>${r.id}</guid></item>`).join('')}</channel></rss>`;
  return new Response(xml,{headers:{'Content-Type':path==='/feed.xml'?'application/rss+xml; charset=utf-8':'application/xml; charset=utf-8'}});
 }
 const markdown=path.endsWith('.md');const wanted=markdown?path.slice(0,-3):path;
 const row=list.find(r=>articlePath(r.data).replace(/\/$/,'')===wanted.replace(/\/$/,''));
 if(row){const related=list.filter(r=>(row.data.relatedIds||[]).includes(r.id)||r.id===row.data.pillarId).map(r=>({title:r.data.title,slug:r.data.slug,path:articlePath(r.data)}));if(markdown)return new Response(articleMarkdown(row.data,origin,row.published_at,row.created_at,related),{headers:{'Content-Type':'text/markdown; charset=utf-8','X-Robots-Tag':'noindex,follow'}});if(path!==articlePath(row.data))return Response.redirect(origin+articlePath(row.data),308);return html(articleHtml(row.data,origin,row.published_at,row.created_at,false,{related}));}
 throw new HttpError(404,'Página não encontrada.');
}
export async function scheduled(env: Env) {
  const due = (
    await env.DB.prepare(
      "SELECT * FROM schedules WHERE status='queued' AND last_error IS NULL AND run_at<=? ORDER BY run_at LIMIT 20",
    )
      .bind(now())
      .all<{ id: string; article_id: string; version: number }>()
  ).results;
  for (const item of due) {
    try {
      const a = await article(env, item.article_id);
      if (a.draft_version !== item.version) {
        await env.DB.prepare(
          "UPDATE schedules SET status='cancelled' WHERE id=? AND status='queued'",
        )
          .bind(item.id)
          .run();
        continue;
      }
      await publish(env, a, item.version, item.id);
    } catch (error) {
      const message =
        error instanceof HttpError
          ? error.message
          : "Falha ao publicar. Verifique a URL e reagende a versão aprovada.";
      await env.DB.prepare(
        "UPDATE schedules SET last_error=? WHERE id=? AND status='queued'",
      )
        .bind(message, item.id)
        .run();
    }
  }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await fetchResponse(request, env);
    if (env.ENVIRONMENT === "staging") {
      const headers = new Headers(response.headers);
      headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      headers.set("Cache-Control", "no-store");
      headers.set("Referrer-Policy", "no-referrer");
      return new Response(response.body, { status: response.status, headers });
    }
    return response;
  },
  async scheduled(_event: ScheduledController, env: Env) {
    await scheduled(env);
  },
};
async function fetchResponse(request: Request, env: Env): Promise<Response> {
  try {
    const response = await handle(request, env);
    if (request.method === "HEAD")
      return new Response(null, {
        status: response.status,
        headers: response.headers,
      });
    return response;
  } catch (error) {
    if (error instanceof HttpError) {
      if (new URL(request.url).pathname.startsWith("/api/"))
        return json({ error: error.message }, error.status);
      return html(
        page(
          error.status === 404 ? "Page not found" : "Request unavailable",
          error.message,
          "",
          `<h1>${error.status === 404 ? "Page not found" : "Request unavailable"}</h1><p>${escape(error.message)}</p><a href="/">Return home</a>`,
          "",
          true,
        ),
        error.status,
        true,
      );
    }
    if (error instanceof Error && /UNIQUE constraint/i.test(error.message))
      return json(
        { error: "URL ou versão já existente. Reabra o registro." },
        409,
      );
    console.error(
      "Editorial request failed",
      error instanceof Error ? error.name : "unknown",
    );
    return json({ error: "Não foi possível concluir. Tente novamente." }, 500);
  }
}



