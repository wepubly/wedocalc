import { useEffect, useState } from "react";
import type { Snapshot } from "./editorial-types";
import "./admin.css";
import { brasiliaDisplay, brasiliaToUtc, nextBrasiliaFive } from "./editorial-time";
import {articlePath,selectDestination} from "./destination";

type Row = {
  id: string;
  draft_version: number;
  published_version: number | null;
  published_slug: string | null;
  snapshot: Snapshot;
  review_status?: string | null;
  review?: {status:string;reviewer:string;notes:string;updated_at:string} | null;
};
type Term = { id: string; kind: string; name: string; slug: string };
type Media = { id: string; name: string; alt: string; size: number; width?: number; height?: number };
type Pitch = { id: string; title: string; notes: string; status: string };
type Schedule = {
  last_error: string | null;
  id: string;
  article_id: string;
  version: number;
  run_at: string;
  status: string;
};
const empty = (): Snapshot => ({
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  seoTitle: "",
  description: "",
  author: "Metricpedia Editorial",
  categoryId:"", subcategoryId:"", calculatorId:"",
  language: "en-US",
  category: "",
  tags: [],
  coverId: "",
  coverAlt: "",
  authorType: "Organization",
  sources: [],
  relatedIds: [],
  pillarId: "",
  isPillar: false,
  requiresSources: false,
});
const slug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch("/api/editorial" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data:any = await response.json();
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir.");
  return data;
}
export default function AdminApp() {
  const [loading, setLoading] = useState(true);
  const [routes,setRoutes] = useState<{id:string;kind:string;name:string;path:string;parent_id:string|null;state:string}[]>([]);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("articles");
  const [rows, setRows] = useState<Row[]>([]),
    [terms, setTerms] = useState<Term[]>([]),
    [media, setMedia] = useState<Media[]>([]),
    [pitches, setPitches] = useState<Pitch[]>([]),
    [schedules, setSchedules] = useState<Schedule[]>([]);
  const [current, setCurrent] = useState<Row | null>(null),
    [draft, setDraft] = useState<Snapshot>(empty),
    [dirty, setDirty] = useState(false),
    [versions, setVersions] = useState<
      { version: number; created_at: string; snapshot: Snapshot }[]
    >([]);
  const [termName, setTermName] = useState(""),
    [termKind, setTermKind] = useState("category"),
    [pitchTitle, setPitchTitle] = useState(""),
    [pitchNotes, setPitchNotes] = useState(""),
    [runAt, setRunAt] = useState("");
  const [reviewer, setReviewer] = useState("Escritor — aprovação recebida no Grok"), [reviewNotes,setReviewNotes] = useState("");
  const [quality,setQuality] = useState<{blockers:string[];warnings:string[]} | null>(null);
  const [events,setEvents] = useState<{version:number;action:string;actor:string;notes:string;created_at:string}[]>([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [dark, setDark] = useState(
    () => localStorage.getItem("metricpedia-theme") === "dark",
  );
  async function refresh() {
    const [a, t, m, p, s] = await Promise.all([
      api("/articles"),
      api("/terms"),
      api("/media"),
      api("/pitches"),
      api("/schedules"),
    ]);
    setRows(a);
    setTerms(t);
    setMedia(m);
    setPitches(p);
    setSchedules(s);
  }
  useEffect(() => {
    Promise.all([refresh(),api("/routes").then((r)=>{setRoutes(r);setDraft(d=>selectDestination(r,d));})]).catch(e=>setError(e.message)).finally(()=>setLoading(false));
  }, []);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }
  function change<K extends keyof Snapshot>(key: K, value: Snapshot[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }
  function open(row: Row | null) {
    if (dirty && !confirm("Descartar alterações ainda não salvas?")) return;
    setCurrent(row);
    setSlugTouched(!!row);
    setDraft(selectDestination(routes,row ? { ...empty(), ...row.snapshot } : empty()));
    setDirty(false);
    setVersions([]);
    setQuality(null);setEvents([]);setReviewNotes("");
    setNotice("");
    setError("");
    setRunAt("");
  }
  async function reviewAction(action:string) {
    if(!current)return;
    await api('/articles/'+current.id+'/'+action,'POST',{version:current.draft_version,actor:reviewer,notes:reviewNotes});
    setCurrent(await api('/articles/'+current.id));await refresh();
    setNotice(action==='approve'?'Versão aprovada. Alterações futuras precisarão de nova aprovação.':action==='request-changes'?'Correções solicitadas.':'Versão enviada para revisão.');
    setQuality(await api('/articles/'+current.id+'/quality'));
    setEvents(await api('/articles/'+current.id+'/events'));
  }
  async function save() {
    const r = await api(
      current ? "/articles/" + current.id : "/articles",
      current ? "PUT" : "POST",
      { ...draft, ...(current ? { version: current.draft_version } : {}) },
    );
    const updated = await api("/articles/" + r.id);
    setCurrent(updated);
    setDraft(updated.snapshot);
    setDirty(false);
    await refresh();
    setNotice("Rascunho salvo. A versão pública permanece como estava.");
    return updated as Row;
  }
  function theme() {
    setDark(!dark);
    localStorage.setItem("metricpedia-theme", dark ? "light" : "dark");
  }
  if (loading)
    return (
      <main className="cms">
        <p>Carregando painel…</p>
      </main>
    );
  return (
    <div className={`cms ${dark ? "cms-dark" : ""}`}>
      <header>
        <a href="/" aria-label="Metricpedia home">
          <strong style={{fontSize:24}}>Metricpedia</strong>
        </a>
        <span>Estúdio editorial</span>
        <button onClick={theme}>Tema {dark ? "claro" : "escuro"}</button>
      </header>
      {error && (
        <p role="alert" className="cms-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="cms-notice">
          {notice}
        </p>
      )}
      <>
          <nav aria-label="Painel editorial">
            {[
              ["articles", "Artigos"],
              ["terms", "Categorias e tags"],
              ["pitches", "Pautas"],
              ["media", "Biblioteca de mídia"],
              ["schedules", "Agendamentos"],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
            <a href="/blog" target="_blank" rel="noreferrer">
              Ver blog
            </a>
          </nav>
          {tab === "articles" && (
            <main className="cms-workspace">
              <aside>
                <h1>Artigos</h1>
                <button onClick={() => open(null)}>Novo artigo</button>
                {rows.map((r) => (
                  <button
                    className="cms-row"
                    key={r.id}
                    onClick={() => open(r)}
                  >
                    <strong>{r.snapshot.title}</strong>
                    <small>
                      {r.review_status === "approved" ? "Aprovado" : r.review_status === "review" ? "Em revisão" : r.review_status === "changes" ? "Correções solicitadas" : "Rascunho"}{r.published_version ? " · publicação ativa" : ""} · versão{" "}
                      {r.draft_version}
                      {r.published_version &&
                      r.published_version !== r.draft_version
                        ? " · alterações pendentes"
                        : ""}
                    </small>
                  </button>
                ))}
              </aside>
              <section>
                <h2>{current ? "Editar artigo" : "Criar artigo"}</h2>
                <p>
                  Conteúdo em inglês americano. Markdown: ## e ### para subtítulos,
                  **negrito**, *itálico*, [texto](URL), listas, citações (&gt;) e tabelas.
                  HTML é exibido como texto; o título principal vem do campo Título.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void perform(async () => {
                      await save();
                    });
                  }}
                >
                  <fieldset disabled={busy}>
                    <label>
                      Título
                      <input
                        value={draft.title}
                        maxLength={180}
                        required
                        onChange={(e) => {
                          change("title", e.target.value);
                          if (!current && !slugTouched)
                            change("slug", slug(e.target.value));
                        }}
                      />
                    </label>
                    <label>
                      URL amigável
                      <input
                        value={draft.slug}
                        required
                        pattern="[a-z0-9]+(-[a-z0-9]+)*"
                        disabled={!!current?.published_slug}
                        onChange={(e) => {
                          setSlugTouched(true);
                          change("slug", e.target.value);
                        }}
                      />
                    </label>
                    <fieldset><legend>Destino final da matéria</legend><div className="destination-grid">
                      <label>Categoria<select required value={draft.categoryId||""} onChange={e=>{setDraft(d=>selectDestination(routes,{...d,categoryId:e.target.value,subcategoryId:"",calculatorId:""}));setDirty(true);}}><option value="">Selecione a categoria</option>{routes.filter(r=>r.kind==="category"&&r.state==="live").map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
                      <label>Tipo de calculadora<select required disabled={!draft.categoryId} value={draft.subcategoryId||""} onChange={e=>{setDraft(d=>selectDestination(routes,{...d,subcategoryId:e.target.value,calculatorId:""}));setDirty(true);}}><option value="">Selecione o tipo</option>{routes.filter(r=>r.kind==="subcategory"&&r.parent_id===draft.categoryId&&r.state==="live").map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
                      <label>Calculadora<select required disabled={!draft.subcategoryId} value={draft.calculatorId||""} onChange={e=>{setDraft(d=>selectDestination(routes,{...d,calculatorId:e.target.value}));setDirty(true);}}><option value="">Selecione a calculadora</option>{routes.filter(r=>r.kind==="calculator"&&r.parent_id===draft.subcategoryId&&r.state==="live").map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
                    </div><p className="destination-preview">URL final: <strong>{draft.destination ? "https://metricpedia.com"+articlePath({...draft,slug:draft.slug||"nome-do-artigo"}) : "Selecione categoria, tipo e calculadora."}</strong></p></fieldset>
                    <label>
                      Resumo
                      <textarea
                        value={draft.excerpt}
                        maxLength={500}
                        rows={3}
                        onChange={(e) => change("excerpt", e.target.value)}
                      />
                    </label>
                    <label>
                      Texto do artigo
                      <textarea
                        className="cms-editor"
                        value={draft.body}
                        rows={15}
                        onChange={(e) => change("body", e.target.value)}
                      />
                    </label>
                    <div className="cms-grid">
                      <label>
                        Autor
                        <input
                          value={draft.author}
                          maxLength={100}
                          onChange={(e) => change("author", e.target.value)}
                        />
                      </label>
                      <label>Tipo de autoria
                        <select value={draft.authorType || "Organization"} onChange={e=>change("authorType",e.target.value as "Person"|"Organization")}>
                          <option value="Organization">Organização / equipe editorial</option><option value="Person">Pessoa real</option>
                        </select>
                      </label>
                    </div>
                    <fieldset>
                      <legend>Tags</legend>
                      {terms
                        .filter((t) => t.kind === "tag")
                        .map((t) => (
                          <label className="cms-checkbox" key={t.id}>
                            <input
                              type="checkbox"
                              checked={draft.tags.includes(t.name)}
                              onChange={(e) =>
                                change(
                                  "tags",
                                  e.target.checked
                                    ? [...draft.tags, t.name]
                                    : draft.tags.filter((x) => x !== t.name),
                                )
                              }
                            />
                            {t.name}
                          </label>
                        ))}
                    </fieldset>
                    <label>
                      Imagem de capa
                      <select
                        value={draft.coverId}
                        onChange={(e) => {
                          change("coverId", e.target.value);
                          change(
                            "coverAlt",
                            media.find((m) => m.id === e.target.value)?.alt ||
                              "",
                          );
                        }}
                      >
                        <option value="">Sem imagem</option>
                        {media.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {draft.coverId && (
                      <img
                        className="cms-cover"
                        src={"/api/editorial/media/" + draft.coverId}
                        alt={draft.coverAlt}
                      />
                    )}
                    <label>
                      Descrição da imagem
                      <input
                        value={draft.coverAlt}
                        maxLength={250}
                        onChange={(e) => change("coverAlt", e.target.value)}
                      />
                    </label>
                    <details>
                      <summary>Fontes e referências</summary>
                      <label className="cms-checkbox"><input type="checkbox" checked={draft.requiresSources || false} onChange={e=>change("requiresSources",e.target.checked)}/>Este conteúdo exige comprovação por fontes</label>
                      {(draft.sources || []).map((source,i)=><div className="cms-grid" key={i}>
                        <label>Fonte {i+1}<input value={source.title} onChange={e=>change("sources",(draft.sources || []).map((r,n)=>n===i?{...r,title:e.target.value}:r))}/></label>
                        <label>URL da fonte {i+1}<input type="url" value={source.url} onChange={e=>change("sources",(draft.sources || []).map((r,n)=>n===i?{...r,url:e.target.value}:r))}/></label>
                        <button type="button" onClick={()=>change("sources",(draft.sources || []).filter((_,n)=>n!==i))}>Remover fonte {i+1}</button>
                      </div>)}
                      <button type="button" onClick={()=>change("sources",[...(draft.sources || []),{title:"",url:""}])}>Adicionar fonte</button>
                    </details>
                    <details>
                      <summary>Clusters e links relacionados</summary>
                      <label className="cms-checkbox"><input type="checkbox" checked={draft.isPillar || false} onChange={e=>change("isPillar",e.target.checked)}/>Conteúdo principal / matéria raiz</label>
                      <label>Matéria raiz<select value={draft.pillarId || ""} onChange={e=>change("pillarId",e.target.value)}><option value="">Nenhuma</option>{rows.filter(r=>r.published_version && r.id!==current?.id).map(r=><option key={r.id} value={r.id}>{r.snapshot.title}</option>)}</select></label>
                      {rows.filter(r=>r.published_version && r.id!==current?.id).map(r=><label className="cms-checkbox" key={r.id}><input type="checkbox" checked={(draft.relatedIds || []).includes(r.id)} onChange={e=>change("relatedIds",e.target.checked?[...(draft.relatedIds || []),r.id]:(draft.relatedIds || []).filter(id=>id!==r.id))}/>{r.snapshot.title}</label>)}
                      <p>Links contextuais: use [âncora descritiva](URL). Destino da calculadora: <code>{draft.destination?.calculator.path || "Selecione o destino acima"}</code>.</p>
                      {rows.filter(r=>r.published_version).map(r=><p key={r.id}><a href={articlePath({...r.snapshot,slug:r.published_slug||r.snapshot.slug})} target="_blank" rel="noreferrer">{r.snapshot.title}</a> · <code>{articlePath({...r.snapshot,slug:r.published_slug||r.snapshot.slug})}</code></p>)}
                    </details>
                    <details>
                      <summary>Configurações SEO</summary>
                      <label>
                        Título SEO
                        <input
                          value={draft.seoTitle}
                          maxLength={180}
                          onChange={(e) => change("seoTitle", e.target.value)}
                        />
                      </label>
                      <label>
                        Descrição SEO
                        <textarea
                          value={draft.description}
                          maxLength={320}
                          onChange={(e) =>
                            change("description", e.target.value)
                          }
                        />
                      </label>
                    </details>
                    <aside className="cms-search-preview" aria-label="Prévia de pesquisa">
                      <small>metricpedia.com · {articlePath({...draft,slug:draft.slug || "url-do-artigo"})}</small>
                      <h3>{draft.seoTitle || draft.title || "Título da matéria"}</h3><p>{draft.description || draft.excerpt || "Descrição do resultado de pesquisa"}</p>
                      <small>Prévia ilustrativa. O Google pode modificar título e descrição.</small>
                    </aside>
                    <div className="cms-quality"><h3>Qualidade editorial</h3>
                      {!draft.title && <p>Título ausente.</p>}{!draft.body.trim() && <p>Conteúdo vazio.</p>}{!draft.description && <p>Meta description ausente; será usado o resumo.</p>}{draft.coverId && !draft.coverAlt && <p>Imagem sem alt text.</p>}{draft.requiresSources && !draft.sources?.length && <p>Adicione fontes para este conteúdo.</p>}
                      {draft.coverId && !!media.find(m=>m.id===draft.coverId)?.width && media.find(m=>m.id===draft.coverId)!.width! < 1200 && <p>Recomendação para Discover: capa com pelo menos 1200 px de largura. Capas menores são permitidas.</p>}
                      {quality && <>{quality.blockers.map(m=><p key={m}>{m}</p>)}{quality.warnings.map(m=><p key={m}>{m}</p>)}</>}
                    </div>
                    {current && <details open><summary>Revisão da versão {current.draft_version}</summary>
                      <p>Somente o Escritor opera este CMS. Registre abaixo a aprovação recebida do Auditor no grupo Grok. A referência não verifica a identidade do Auditor.</p><p>Status: {current.review_status === "approved"?"Aprovado":current.review_status === "review"?"Em revisão":current.review_status === "changes"?"Correções solicitadas":"Rascunho"}. Publicação exige aprovação desta versão.</p>
                      {current.review && <p>{current.review.reviewer} · {brasiliaDisplay(current.review.updated_at)} · {current.review.notes}</p>}
                      <label>Registro feito pelo Escritor<input value={reviewer} onChange={e=>setReviewer(e.target.value)}/></label>
                      <label>Referência da aprovação / correções no Grok<textarea value={reviewNotes} onChange={e=>setReviewNotes(e.target.value)}/></label>
                      <div className="cms-actions">
                        <button type="button" disabled={dirty || current.review_status==='approved'} onClick={()=>perform(()=>reviewAction('submit-review'))}>Enviar para revisão</button>
                        <button type="button" disabled={dirty || current.review_status!=='review'} onClick={()=>perform(()=>reviewAction('approve'))}>Registrar aprovação recebida</button>
                        <button type="button" disabled={dirty || !['review','approved'].includes(current.review_status || '')} onClick={()=>perform(()=>reviewAction('request-changes'))}>Registrar correções recebidas</button>
                        <button type="button" disabled={dirty} onClick={()=>perform(async()=>{setQuality(await api('/articles/'+current.id+'/quality'));setEvents(await api('/articles/'+current.id+'/events'));})}>Verificar qualidade e auditoria</button>
                      </div>
                      {events.map((e,i)=><p key={i}>v{e.version} · {e.action} · {e.actor} · {brasiliaDisplay(e.created_at)} · {e.notes}</p>)}
                    </details>}
                    <div className="cms-actions">
                      <button type="submit">Salvar rascunho</button>
                      {current && !dirty && (
                        <a
                          href={"/admin/preview/" + current.id}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Pré-visualizar versão salva
                        </a>
                      )}
                      {current && (
                        <button
                          type="button"
                          disabled={dirty || current.review_status !== "approved"}
                          onClick={() =>
                            perform(async () => {
                              if (!confirm("Publicar esta versão no blog?"))
                                return;
                              await api(
                                "/articles/" + current.id + "/publish",
                                "POST",
                                { version: current.draft_version },
                              );
                              setCurrent(await api("/articles/" + current.id));
                              await refresh();
                              setNotice("Artigo publicado.");
                            })
                          }
                        >
                          Publicar versão salva
                        </button>
                      )}
                      {current?.published_version && (
                        <button
                          type="button"
                          onClick={() =>
                            perform(async () => {
                              if (!confirm("Retirar este artigo do blog?"))
                                return;
                              await api(
                                "/articles/" + current.id + "/unpublish",
                                "POST",
                              );
                              setCurrent(await api("/articles/" + current.id));
                              await refresh();
                              setNotice("Artigo retirado do blog.");
                            })
                          }
                        >
                          Retirar publicação
                        </button>
                      )}
                    </div>
                    {dirty && (
                      <p>
                        Alterações não salvas. Salve antes de pré-visualizar ou
                        publicar.
                      </p>
                    )}
                    {current && (
                      <>
                        <details>
                          <summary>Agendar versão salva</summary>
                          <p>
                            Horário de Brasília (UTC−03:00). Editar e salvar invalida a
                            aprovação e cancela o agendamento anterior.
                          </p>
                          <button type="button" onClick={()=>setRunAt(nextBrasiliaFive())}>Próximo horário às 5h de São Paulo</button>
                          <label>
                            Data e hora
                            <input
                              type="datetime-local"
                              value={runAt}
                              onChange={(e) => setRunAt(e.target.value)}
                            />
                          </label>
                          <button
                            type="button"
                            disabled={dirty || !runAt || current.review_status !== "approved"}
                            onClick={() =>
                              perform(async () => {
                                if (
                                  !confirm(
                                    "Agendar a versão já aprovada no horário escolhido?",
                                  )
                                )
                                  return;
                                await api(
                                  "/articles/" + current.id + "/schedule",
                                  "POST",
                                  {
                                    version: current.draft_version,
                                    runAt: brasiliaToUtc(runAt),
                                  },
                                );
                                await refresh();
                                setNotice(
                                  "Agendamento salvo. O executor automático verifica a fila a cada minuto em produção.",
                                );
                              })
                            }
                          >
                            Agendar versão aprovada
                          </button>
                        </details>
                        <button
                          type="button"
                          onClick={() =>
                            perform(async () =>
                              setVersions(
                                await api(
                                  "/articles/" + current.id + "/versions",
                                ),
                              ),
                            )
                          }
                        >
                          Ver histórico de versões
                        </button>
                        {versions.map((v) => (
                          <p key={v.version}>
                            Versão {v.version} ·{" "}
                            {brasiliaDisplay(v.created_at)} (Brasília) ·{" "}
                            <a
                              target="_blank"
                              rel="noreferrer"
                              href={
                                "/admin/preview/" +
                                current.id +
                                "?version=" +
                                v.version
                              }
                            >
                              Pré-visualizar
                            </a>{" "}
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  dirty &&
                                  !confirm("Substituir alterações não salvas?")
                                )
                                  return;
                                setDraft(v.snapshot);
                                setDirty(true);
                              }}
                            >
                              Usar como rascunho
                            </button>
                          </p>
                        ))}
                      </>
                    )}
                  </fieldset>
                </form>
              </section>
            </main>
          )}
          {tab === "terms" && (
            <main>
              <h1>Categorias e tags</h1>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void perform(async () => {
                    await api("/terms", "POST", {
                      kind: termKind,
                      name: termName,
                      slug: slug(termName),
                    });
                    setTermName("");
                    await refresh();
                  });
                }}
              >
                <label>
                  Tipo
                  <select
                    value={termKind}
                    onChange={(e) => setTermKind(e.target.value)}
                  >
                    <option value="category">Categoria</option>
                    <option value="tag">Tag</option>
                  </select>
                </label>
                <label>
                  Nome
                  <input
                    required
                    value={termName}
                    onChange={(e) => setTermName(e.target.value)}
                  />
                </label>
                <button disabled={busy}>Adicionar</button>
              </form>
              {terms.map((t) => (
                <p key={t.id}>
                  {t.kind === "category" ? "Categoria" : "Tag"}: {t.name} ·{" "}
                  {t.slug}
                </p>
              ))}
            </main>
          )}
          {tab === "pitches" && (
            <main>
              <h1>Pautas</h1>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void perform(async () => {
                    await api("/pitches", "POST", {
                      title: pitchTitle,
                      notes: pitchNotes,
                    });
                    setPitchTitle("");
                    setPitchNotes("");
                    await refresh();
                  });
                }}
              >
                <label>
                  Título da pauta
                  <input
                    required
                    value={pitchTitle}
                    onChange={(e) => setPitchTitle(e.target.value)}
                  />
                </label>
                <label>
                  Notas e fontes
                  <textarea
                    value={pitchNotes}
                    onChange={(e) => setPitchNotes(e.target.value)}
                  />
                </label>
                <button disabled={busy}>Criar pauta</button>
              </form>
              {pitches.map((p) => (
                <article key={p.id}>
                  <h2>{p.title}</h2>
                  <p>{p.notes}</p>
                  <label>
                    Status
                    <select
                      value={p.status}
                      disabled={busy}
                      onChange={(e) =>
                        perform(async () => {
                          await api("/pitches/" + p.id, "PUT", {
                            status: e.target.value,
                          });
                          await refresh();
                        })
                      }
                    >
                      <option value="planned">Planejada</option>
                      <option value="approved">Aprovada</option>
                      <option value="archived">Arquivada</option>
                    </select>
                  </label>
                </article>
              ))}
            </main>
          )}
          {tab === "media" && (
            <main>
              <h1>Biblioteca de mídia</h1>
              <p>
                PNG, JPEG ou WebP, até 5 MB. Imagens ficam privadas até serem
                usadas em um artigo publicado.
              </p>
              <label>
                Enviar imagem
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void perform(async () => {
                      const response = await fetch("/api/editorial/media", {
                        method: "POST",
                        headers: {
                          "Content-Type": file.type,
                          "X-File-Name": encodeURIComponent(file.name),
                        },
                        body: file,
                      });
                      const result:any = await response.json();
                      if (!response.ok) throw new Error(result.error);
                      await refresh();
                      setNotice("Imagem enviada.");
                    });
                    e.target.value = "";
                  }}
                />
              </label>
              <div className="cms-media">
                {media.map((m) => (
                  <figure key={m.id}>
                    <img
                      src={"/api/editorial/media/" + m.id}
                      alt={m.alt || m.name}
                    />
                    <figcaption>
                      {m.name} · {Math.round(m.size / 1024)} KB{m.width && m.height ? ` · ${m.width} × ${m.height} px` : ""}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </main>
          )}
          {tab === "schedules" && (
            <main>
              <h1>Agendamentos</h1>
              <p>
                Artigos aprovados são publicados em produção no destino selecionado,
                após o horário agendado, com verificação a cada minuto. Horários de Brasília.
              </p>
              {schedules.map((s) => (
                <article key={s.id}>
                  <h2>
                    {rows.find((r) => r.id === s.article_id)?.snapshot.title ||
                      s.article_id}
                  </h2>
                  <p>
                    Versão {s.version} ·{" "}
                    {brasiliaDisplay(s.run_at)} (Brasília) ·{" "}
                    {s.status === "queued"
                      ? "Agendado"
                      : s.status === "published"
                        ? "Publicado"
                        : "Cancelado"}
                  </p>
                  {s.last_error && (
                    <p role="alert">
                      {s.last_error} Cancele e reagende após corrigir.
                    </p>
                  )}
                  {s.status === "queued" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        perform(async () => {
                          await api(
                            "/articles/" + s.article_id + "/cancel-schedule",
                            "POST",
                          );
                          await refresh();
                        })
                      }
                    >
                      Cancelar agendamento
                    </button>
                  )}
                </article>
              ))}
            </main>
          )}
      </>
    </div>
  );
}

