import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { brasiliaDisplay, brasiliaToUtc } from "./editorial-time";
import "./admin.css";
const base = "/api/editorial";
const encodeMetadata = (value: string) => "utf8-b64:" + btoa(Array.from(new TextEncoder().encode(value), b => String.fromCharCode(b)).join(""));
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch(base + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const d: any = await r.json();
  if (!r.ok) throw Error(d.error || "Falha na operação");
  return d;
}
const blank = () => ({
  externalId: "",
  briefId: "",
  title: "",
  slug: "",
  primaryKeyword: "",
  secondaryKeywords: [],
  category: "",
  subcategoryId: "",
  calculatorId: "",
  articleType: "cluster",
  circuit: 1,
  finalVersion: "1",
  approvalReference: "",
  intendedRunAt: "",
  seoTitle: "",
  description: "",
  excerpt: "",
  body: "",
  author: "Metricpedia Editorial",
  authorType: "Organization",
  language: "en-US",
  tags: [],
  coverId: "",
  coverAlt: "",
  sources: [],
  faq: [],
  relatedIds: [],
  pillarId: "",
  isPillar: false,
  requiresSources: false,
});
const tabs = [
  ["dashboard", "Visão geral"],
  ["articles", "Artigos"],
  ["schedules", "Agendamentos"],
  ["campaigns", "Campanhas de 14 dias"],
  ["media", "Biblioteca de mídia"],
  ["briefs", "Briefings e rotas"],
  ["logs", "Histórico"],
  ["settings", "Acesso e agentes"],
];
const tabIds = tabs.map(([id]) => id);
const tabFromUrl = () => {
  const part = location.pathname.split("/").filter(Boolean)[1];
  return tabIds.includes(part) ? part : "dashboard";
};
function App() {
  const [auth, setAuth] = useState(false),
    [loading, setLoading] = useState(true),
    [setup, setSetup] = useState(false),
    [tab, setTab] = useState(tabFromUrl),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<any[]>([]),
    [briefs, setBriefs] = useState<any[]>([]),
    [routes, setRoutes] = useState<any[]>([]),
    [media, setMedia] = useState<any[]>([]),
    [schedules, setSchedules] = useState<any[]>([]),
    [logs, setLogs] = useState<any[]>([]),
    [agents, setAgents] = useState<any[]>([]),
    [terms, setTerms] = useState<any[]>([]),
    [pitches, setPitches] = useState<any[]>([]);
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState(""),
    [calcFilter, setCalcFilter] = useState(""),
    [statusFilter, setStatusFilter] = useState(""),
    [current, setCurrent] = useState<any>(null),
    [draft, setDraft] = useState<any>(blank),
    [runAt, setRunAt] = useState(""),
    [evidence, setEvidence] = useState(""),
    [versions, setVersions] = useState<any[]>([]),
    [events, setEvents] = useState<any[]>([]);
  useEffect(() => {
    if (!location.hostname.startsWith("metricpedia-editorial-lab.")) return;
    const url = "/admin/" + tab;
    if (location.pathname !== url) history.replaceState({tab}, "", url);
  }, [tab]);
  useEffect(() => {
    const onPop = () => setTab(tabFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const [credential, setCredential] = useState("");
  const [reviewActor, setReviewActor] = useState("Auditor");
  const [reviewNotes, setReviewNotes] = useState("");
  const [qualityResult, setQualityResult] = useState<any>(null);
  const [agentRole, setAgentRole] = useState("writer");
  const [campaignCalculator, setCampaignCalculator] = useState("paint-calculator");
  const [campaignInfo, setCampaignInfo] = useState<any>(null);
  const [campaignStart, setCampaignStart] = useState("");
  async function refresh() {
    const [a, b, r, m, s, l, g, t, p] = await Promise.all(
      [
        "/articles",
        "/briefs",
        "/routes",
        "/media",
        "/schedules",
        "/logs",
        "/agents",
        "/terms",
        "/pitches",
      ].map((p) => api(p)),
    );
    setRows(a);
    setBriefs(b);
    setRoutes(r);
    setMedia(m);
    setSchedules(s);
    setLogs(l);
    setAgents(g);
    setTerms(t);
    setPitches(p);
  }
  async function loadCampaign(id: string) {
    setCampaignInfo(await api("/campaigns?calculatorId=" + encodeURIComponent(id)));
  }
  useEffect(() => {
    if (auth && tab === "campaigns") {
      void loadCampaign(campaignCalculator).catch((err) => setError(String(err)));
    }
  }, [auth, tab, campaignCalculator]);
  async function work(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    (async () => {
      try {
        const st = await api("/setup-status");
        setSetup(!st.configured);
        await api("/session");
        setAuth(true);
        await refresh();
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  const field = (key: string, value: unknown) =>
    setDraft({ ...draft, [key]: value });
  async function open(id: string) {
    const [d, v, e] = await Promise.all([
      api("/articles/" + id + "/details"),
      api("/articles/" + id + "/versions"),
      api("/articles/" + id + "/events"),
    ]);
    setCurrent(d);
    setDraft(d.snapshot);
    setVersions(v);
    setEvents(e);
    setTab("articles");
    setEvidence("");
    setQualityResult(null);
    setReviewNotes("");
  }
  const categoryName = (id: string) =>
    routes.find((r) => r.id === id)?.name || id;
  function applyBrief(id: string) {
    const b = briefs.find((b) => b.id === id);
    if (!b) return;
    setDraft({
      ...draft,
      briefId: id,
      category: categoryName(b.category_id),
      subcategoryId: b.subcategory_id,
      calculatorId: b.calculator_id,
      primaryKeyword: b.primary_keyword,
      secondaryKeywords: JSON.parse(b.secondary_keywords),
      circuit: b.circuit,
    });
  }
  const status = (r: any) => {
    const queued = schedules.find(
      (s) => s.article_id === r.id && s.status === "queued",
    );
    return queued?.last_error
      ? "Erro"
      : queued
        ? "Agendado"
        : r.published_version === r.draft_version
          ? "Publicado"
          : r.review_status === "approved"
            ? "Autorizado"
            : "Sem autorização";
  };
  const cards = [
    ["Recebidos", rows.length],
    [
      "Prontos para agendar",
      rows.filter(
        (r) =>
          r.review_status === "approved" &&
          !schedules.some(
            (s) => s.article_id === r.id && s.status === "queued",
          ) &&
          r.published_version !== r.draft_version,
      ).length,
    ],
    [
      "Agendados",
      schedules.filter((s) => s.status === "queued" && !s.last_error).length,
    ],
    ["Publicados", rows.filter((r) => r.published_version).length],
    [
      "Erros",
      schedules.filter((s) => s.status === "queued" && s.last_error).length,
    ],
  ];
  const input = (key: string, label: string, type = "text") => (
    <label>
      {label}
      <input
        type={type}
        value={draft[key] || ""}
        onChange={(e) => field(key, e.target.value)}
      />
    </label>
  );
  if (loading)
    return (
      <main className="login">
        <h1>Metricpedia</h1>
        <p>Carregando painel…</p>
      </main>
    );
  return (
    <div className="app">
      <header>
        <strong>
          Metricpedia <span>Editorial Center</span>
        </strong>
        <small>ESTÚDIO EDITORIAL · não indexável</small>
        {auth && (
          <button
            onClick={() =>
              work(async () => {
                await api("/logout", "POST");
                setAuth(false);
                setCredential("");
              })
            }
          >
            Sair
          </button>
        )}
      </header>
      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="message" role="status">
          {notice}
        </p>
      )}
      {!auth ? (
        <main className="login">
          <div className="panel">
            <h1>
              {setup
                ? "Configurar administrador"
                : "Bem-vindo ao estúdio editorial"}
            </h1>
            <p>
              {setup
                ? "Cadastre seu usuário e sua própria senha. A chave inicial é configurada no GitHub; nunca envie sua senha pelo chat."
                : "Gerencie conteúdo, autorizações externas e publicações do Metricpedia."}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void work(async () => {
                  const body = Object.fromEntries(f.entries());
                  await api(setup ? "/setup" : "/login", "POST", body);
                  if (setup) {
                    setSetup(false);
                    setNotice("Administrador criado. Entre com sua senha.");
                  } else {
                    setAuth(true);
                    await refresh();
                  }
                });
              }}
            >
              {setup && (
                <label>
                  Chave de configuração protegida
                  <input
                    name="setupToken"
                    type="password"
                    required
                    autoComplete="off"
                  />
                </label>
              )}
              <label>
                Usuário
                <input
                  name="username"
                  autoComplete="username"
                  required
                  minLength={3}
                />
              </label>
              <label>
                Senha
                <input
                  name="password"
                  type="password"
                  autoComplete={setup ? "new-password" : "current-password"}
                  minLength={12}
                  required
                />
              </label>
              <button className="primary" disabled={busy}>
                {setup ? "Cadastrar administrador" : "Entrar"}
              </button>
            </form>
          </div>
        </main>
      ) : (
        <div className="layout">
          <nav aria-label="Painel editorial">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                className={tab === id ? "active" : ""}
                onClick={() => {
                  if (location.hostname.startsWith("metricpedia-editorial-lab.")) history.pushState({tab:id}, "", "/admin/" + id);
                  setTab(id);
                }}
              >
                {label}
              </button>
            ))}
            <a href="/blog/" target="_blank">
              Ver blog do laboratório ↗
            </a>
            <small>Horários: America/Sao_Paulo</small>
          </nav>
          <main>
            {tab === "dashboard" && (
              <>
                <h1>Visão geral</h1>
                <p>Da entrega aprovada no Grok à publicação programada.</p>
                <div className="metrics">
                  {cards.map(([label, value]) => (
                    <div className="panel" key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <div className="grid">
                  <section className="panel">
                    <h2>Por categoria</h2>
                    {[...new Set(rows.map((r) => r.snapshot.category))].map(
                      (c) => (
                        <p key={c}>
                          {c}
                          <b>
                            {
                              rows.filter((r) => r.snapshot.category === c)
                                .length
                            }
                          </b>
                        </p>
                      ),
                    )}
                  </section>
                  <section className="panel">
                    <h2>Por calculadora</h2>
                    {[...new Set(rows.map((r) => r.snapshot.calculatorId))].map(
                      (c) => (
                        <p key={c}>
                          {categoryName(c)}
                          <b>
                            {
                              rows.filter((r) => r.snapshot.calculatorId === c)
                                .length
                            }
                          </b>
                        </p>
                      ),
                    )}
                  </section>
                </div>
                <h2>Próximas publicações</h2>
                {schedules
                  .filter((s) => s.status === "queued")
                  .sort((a, b) => a.run_at.localeCompare(b.run_at))
                  .map((s) => (
                    <p key={s.id}>
                      {rows.find((r) => r.id === s.article_id)?.snapshot.title}{" "}
                      · {brasiliaDisplay(s.run_at)}{" "}
                      {s.last_error && <em>{s.last_error}</em>}
                    </p>
                  ))}
                {!rows.length && (
                  <div className="empty">
                    Nenhum artigo recebido. Cadastre um briefing aprovado e uma
                    credencial para os agentes.
                  </div>
                )}
              </>
            )}
            {tab === "articles" && (
              <>
                <div className="title">
                  <h1>Artigos</h1>
                  <button
                    onClick={() => {
                      setCurrent(null);
                      setDraft(blank());
                      setVersions([]);
                      setEvents([]);
                    }}
                  >
                    Novo artigo
                  </button>
                </div>
                <div className="filters">
                  <input
                    placeholder="Pesquisar título ou palavra-chave"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="">Todas as categorias</option>
                    {routes
                      .filter((r) => r.kind === "category")
                      .map((r) => (
                        <option key={r.id} value={r.name}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                  <select
                    value={calcFilter}
                    onChange={(e) => setCalcFilter(e.target.value)}
                  >
                    <option value="">Todas as calculadoras</option>
                    {routes
                      .filter((r) => r.kind === "calculator")
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">Todos os status</option>
                    {[
                      "Sem autorização",
                      "Autorizado",
                      "Agendado",
                      "Publicado",
                      "Erro",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                {rows.length === 0 && <section className="panel"><p>Nenhum artigo cadastrado. Crie a primeira matéria usando o editor abaixo.</p></section>}
                <div className="table">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "Título",
                          "Categoria / subcategoria",
                          "Calculadora",
                          "Tipo / circuito",
                          "Status",
                          "Agendamento / publicação",
                          "",
                        ].map((t) => (
                          <th key={t}>{t}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows
                        .filter(
                          (r) =>
                            (!filter || r.snapshot.category === filter) &&
                            (!calcFilter ||
                              r.snapshot.calculatorId === calcFilter) &&
                            (!statusFilter || status(r) === statusFilter) &&
                            (r.snapshot.title + " " + r.snapshot.primaryKeyword)
                              .toLowerCase()
                              .includes(query.toLowerCase()),
                        )
                        .map((r) => (
                          <tr key={r.id}>
                            <td>
                              {r.snapshot.title}
                              <small>
                                v{r.draft_version}
                                {r.published_version &&
                                r.draft_version !== r.published_version
                                  ? " · alteração pendente"
                                  : ""}
                              </small>
                            </td>
                            <td>
                              {r.snapshot.category}
                              <small>
                                {categoryName(r.snapshot.subcategoryId)}
                              </small>
                            </td>
                            <td>{categoryName(r.snapshot.calculatorId)}</td>
                            <td>
                              {r.snapshot.articleType} · {r.snapshot.circuit}
                            </td>
                            <td>
                              <span className="badge">{status(r)}</span>
                            </td>
                            <td>
                              {schedules.find(
                                (s) =>
                                  s.article_id === r.id &&
                                  s.status === "queued",
                              )?.run_at
                                ? brasiliaDisplay(
                                    schedules.find(
                                      (s) =>
                                        s.article_id === r.id &&
                                        s.status === "queued",
                                    ).run_at,
                                  )
                                : r.published_at
                                  ? brasiliaDisplay(r.published_at)
                                  : "—"}
                            </td>
                            <td>
                              <button onClick={() => work(() => open(r.id))}>
                                Abrir
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <section className="panel editor">
                  <h2>
                    {current
                      ? "Versão " + current.draft_version
                      : "Cadastro de artigo"}
                  </h2>
                  <p>
                    Salvar cria uma versão sem autorização; a versão pública
                    permanece intacta.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void work(async () => {
                        const result = await api(
                          current ? "/articles/" + current.id : "/articles",
                          current ? "PUT" : "POST",
                          {
                            ...draft,
                            ...(current
                              ? { version: current.draft_version }
                              : {}),
                          },
                        );
                        await refresh();
                        await open(result.id);
                        setNotice(
                          "Versão salva. Confirme externamente antes de publicar.",
                        );
                      });
                    }}
                  >
                    <label>
                      Briefing aprovado
                      <select
                        required
                        value={draft.briefId}
                        onChange={(e) => applyBrief(e.target.value)}
                      >
                        <option value="">Selecione</option>
                        {briefs
                          .filter((b) => b.active)
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.title} · {b.primary_keyword}
                            </option>
                          ))}
                      </select>
                    </label>
                    <div className="grid">
                      {input("title", "Título")}
                      {input("slug", "Slug")}
                      {input("externalId", "ID externo do trabalho")}
                      {input("finalVersion", "Identificador da versão final")}
                      <label>
                        Tipo
                        <select
                          value={draft.articleType}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              articleType: e.target.value,
                              isPillar: e.target.value === "pillar",
                            })
                          }
                        >
                          <option value="pillar">Pilar</option>
                          <option value="cluster">Cluster</option>
                        </select>
                      </label>
                      {input(
                        "approvalReference",
                        "Referência da aprovação no Grok",
                      )}
                    </div>
                    <label>
                      Resumo
                      <textarea
                        value={draft.excerpt}
                        onChange={(e) => field("excerpt", e.target.value)}
                      />
                    </label>
                    <label>
                      Conteúdo Markdown
                      <textarea
                        className="body"
                        value={draft.body}
                        onChange={(e) => field("body", e.target.value)}
                      />
                    </label>
                    <div className="grid">
                      {input("seoTitle", "SEO title")}
                      {input("description", "Meta description")}
                      <label>
                        Imagem de capa
                        <select
                          value={draft.coverId}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              coverId: e.target.value,
                              coverAlt:
                                media.find((m) => m.id === e.target.value)
                                  ?.alt || "",
                            })
                          }
                        >
                          <option value="">Sem capa</option>
                          {media.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {input("coverAlt", "Alt text")}
                    </div>
                    <label>
                      Artigo pilar
                      <select
                        value={draft.pillarId}
                        onChange={(e) => field("pillarId", e.target.value)}
                      >
                        <option value="">Nenhum</option>
                        {rows
                          .filter((r) => r.id !== current?.id)
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.snapshot.title}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Artigos relacionados
                      <select
                        multiple
                        value={draft.relatedIds}
                        onChange={(e) =>
                          field(
                            "relatedIds",
                            Array.from(
                              e.target.selectedOptions,
                              (o) => o.value,
                            ),
                          )
                        }
                      >
                        {rows
                          .filter((r) => r.id !== current?.id)
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.snapshot.title}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Fontes e referências (JSON)
                      <textarea
                        value={JSON.stringify(draft.sources)}
                        onChange={(e) => {
                          try {
                            field("sources", JSON.parse(e.target.value));
                          } catch {
                            setError("Fontes: use uma lista JSON válida.");
                          }
                        }}
                      />
                    </label>
                    <section className="panel">
                      <h3>FAQ e dados estruturados</h3>
                      <p>Adicione perguntas e respostas úteis. Se houver FAQ, o artigo exibirá as respostas e incluirá schema FAQPage.</p>
                      {(draft.faq || []).map((f:any,i:number) => (
                        <div className="panel" key={i}>
                          <label>Pergunta<input value={f.question||""} onChange={e=>setDraft({...draft,faq:draft.faq.map((v:any,n:number)=>n===i?{...v,question:e.target.value}:v)})} /></label>
                          <label>Resposta<textarea value={f.answer||""} onChange={e=>setDraft({...draft,faq:draft.faq.map((v:any,n:number)=>n===i?{...v,answer:e.target.value}:v)})} /></label>
                          <button type="button" onClick={()=>setDraft({...draft,faq:draft.faq.filter((_:any,n:number)=>n!==i)})}>Remover FAQ</button>
                        </div>
                      ))}
                      <button type="button" disabled={(draft.faq||[]).length>=12} onClick={()=>setDraft({...draft,faq:[...(draft.faq||[]),{question:"",answer:""}]})}>Adicionar pergunta e resposta</button>
                    </section>
                    <button className="primary" disabled={busy}>
                      Salvar versão
                    </button>
                  </form>
                  {current && (
                    <>
                      <hr />
                      <a target="_blank" href={"/admin/preview/" + current.id}>
                        Pré-visualizar versão salva ↗
                      </a>
                      <p>
                        Hash da versão: <code>{current.digest}</code>
                      </p>
                      <p>
                        {current.externalApproval
                          ? "Confirmação externa registrada por " +
                            current.externalApproval.approved_by
                          : "Publicação bloqueada: falta confirmação da aprovação externa."}
                      </p>
                      <label>
                        Referência da aprovação final pelo Auditor
                        <input
                          value={evidence}
                          onChange={(e) => setEvidence(e.target.value)}
                          placeholder="ID/mensagem de aprovação do Auditor no grupo"
                        />
                      </label>
                      <section className="panel">
                        <h3>Revisão editorial · versão {current.draft_version}</h3>
                        <p>Status: <strong>{current.review?.status === "review" ? "Aguardando Auditor" : current.review?.status === "changes" ? "Correções solicitadas" : current.review?.status === "approved" ? "Aprovada pelo Auditor" : "Rascunho"}</strong></p>
                        {current.review?.notes && <p>Notas: {current.review.notes} — {current.review.reviewer}</p>}
                        <label>Responsável
                          <input value={reviewActor} onChange={e => setReviewActor(e.target.value)} placeholder="Escritor ou Auditor" />
                        </label>
                        <label>Notas da revisão
                          <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="Detalhes do envio, revisão ou correções" />
                        </label>
                        <div className="actions">
                          <button disabled={busy || current.review?.status === "approved"} onClick={() => void work(async () => {
                            await api("/articles/" + current.id + "/submit-review","POST",{version:current.draft_version,actor:reviewActor || "Escritor",notes:reviewNotes});
                            await refresh();await open(current.id);setNotice("Versão enviada ao Auditor.");
                          })}>Enviar para revisão</button>
                          <button disabled={busy || !current.review || current.review.status === "changes"} onClick={() => void work(async () => {
                            await api("/articles/" + current.id + "/request-changes","POST",{version:current.draft_version,actor:reviewActor || "Auditor",notes:reviewNotes});
                            await refresh();await open(current.id);setNotice("Correções solicitadas.");
                          })}>Solicitar correções</button>
                          <button disabled={busy} onClick={() => void work(async () => {
                            setQualityResult(await api("/articles/" + current.id + "/quality"));
                          })}>Verificar qualidade</button>
                        </div>
                        {qualityResult && <div className="message">
                          <strong>Verificação de qualidade</strong>
                          {qualityResult.blockers?.length ? <ul>{qualityResult.blockers.map((x:string,i:number)=><li key={i}>{x}</li>)}</ul> : <p>Nenhum bloqueio encontrado.</p>}
                          {qualityResult.warnings?.length > 0 && <ul>{qualityResult.warnings.map((x:string,i:number)=><li key={i}>{x}</li>)}</ul>}
                        </div>}
                      </section>
                      <div className="actions">
                        <button
                          disabled={busy || !evidence}
                          onClick={() =>
                            work(async () => {
                              await api(
                                "/articles/" + current.id + "/authorize",
                                "POST",
                                {
                                  version: current.draft_version,
                                  digest: current.digest,
                                  evidence,
                                },
                              );
                              await refresh();
                              await open(current.id);
                              setNotice(
                                "Aprovação externa confirmada para esta versão exata.",
                              );
                            })
                          }
                        >
                          Auditor: aprovar versão e hash
                        </button>
                        <label>
                          Publicar em (Brasília)
                          <input
                            type="datetime-local"
                            value={runAt}
                            onChange={(e) => setRunAt(e.target.value)}
                          />
                        </label>
                        <button
                          disabled={busy || !current.externalApproval || !runAt}
                          onClick={() =>
                            work(async () => {
                              await api(
                                "/articles/" + current.id + "/schedule",
                                "POST",
                                {
                                  version: current.draft_version,
                                  runAt: brasiliaToUtc(runAt),
                                },
                              );
                              await refresh();
                              setNotice("Publicação agendada.");
                            })
                          }
                        >
                          Agendar
                        </button>
                        <button
                          disabled={busy || !current.externalApproval}
                          onClick={() =>
                            work(async () => {
                              await api(
                                "/articles/" + current.id + "/publish",
                                "POST",
                                { version: current.draft_version },
                              );
                              await refresh();
                              await open(current.id);
                              setNotice("Publicado no blog do laboratório.");
                            })
                          }
                        >
                          Publicar no laboratório
                        </button>
                        <button
                          onClick={() =>
                            work(async () => {
                              await api(
                                "/articles/" + current.id + "/unpublish",
                                "POST",
                                {},
                              );
                              await refresh();
                              await open(current.id);
                            })
                          }
                        >
                          Retirar publicação
                        </button>
                      </div>
                      <details>
                        <summary>Versões e histórico</summary>
                        {versions.map((v) => (
                          <p key={v.version}>
                            <a
                              target="_blank"
                              href={
                                "/admin/preview/" +
                                current.id +
                                "?version=" +
                                v.version
                              }
                            >
                              Versão {v.version}
                            </a>{" "}
                            · {brasiliaDisplay(v.created_at)}
                          </p>
                        ))}
                        {events.map((ev, i) => (
                          <p key={i}>
                            {brasiliaDisplay(ev.created_at)} · v{ev.version} ·{" "}
                            {ev.action} · {ev.actor}
                          </p>
                        ))}
                      </details>
                    </>
                  )}
                </section>
              </>
            )}
            {tab === "schedules" && (
              <>
                <h1>Agendamentos</h1>
                <p>
                  Horários de Brasília. As versões sem autorização não podem ser
                  agendadas.
                </p>
                {schedules.length === 0 && <section className="panel"><p>Nenhuma matéria agendada. Abra um artigo aprovado ou use Campanhas de 14 dias.</p></section>}
              {schedules.map((s) => (
                  <section className="panel" key={s.id}>
                    <h2>
                      {rows.find((r) => r.id === s.article_id)?.snapshot.title}
                    </h2>
                    <p>
                      {brasiliaDisplay(s.run_at)} · v{s.version} · {s.status}
                    </p>
                    {s.last_error && <p className="error">{s.last_error}</p>}
                    {schedules.some(
                      (x) =>
                        x.id !== s.id &&
                        x.status === "queued" &&
                        s.status === "queued" &&
                        x.run_at === s.run_at,
                    ) && (
                      <p>
                        Conflito de horário: há outra publicação neste instante.
                      </p>
                    )}
                    <div className="actions">
                      <button onClick={() => work(() => open(s.article_id))}>
                        Abrir / alterar data
                      </button>
                      {s.status === "queued" && (
                        <button
                          onClick={() =>
                            work(async () => {
                              await api(
                                "/articles/" +
                                  s.article_id +
                                  "/cancel-schedule",
                                "POST",
                                {},
                              );
                              await refresh();
                            })
                          }
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </section>
                ))}
              </>
            )}

            {tab === "campaigns" && (
              <>
                <h1>Campanhas de 14 dias por calculadora</h1>
                <p>Sete artigos em cada circuito. A fila só é ativada quando todas as versões estiverem aprovadas e a calculadora tiver auditoria aprovada.</p>
                <section className="panel">
                  <h2>Selecione a calculadora</h2>
                  <select value={campaignCalculator} onChange={(e) => setCampaignCalculator(e.target.value)}>
                    {routes.filter((r) => r.kind === "calculator").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <div className="metrics">
                    <div><strong>{campaignInfo?.counts?.circuit1 ?? "—"}/7</strong><p>Circuito 1 aprovado</p></div>
                    <div><strong>{campaignInfo?.counts?.circuit2 ?? "—"}/7</strong><p>Circuito 2 aprovado</p></div>
                    <div><strong>{campaignInfo?.audit?.verdict === "passed" ? "Aprovada" : "Pendente"}</strong><p>Auditoria da calculadora</p></div>
                  </div>
                  {campaignInfo?.articles?.map((a: any) => (
                    <p key={a.id}>{a.approved ? "✓" : "○"} Circuito {a.circuit} · {a.title} · versão {a.version} {a.published ? "· já publicado" : ""}</p>
                  ))}
                </section>
                <section className="panel">
                  <h2>Auditoria da calculadora real</h2>
                  <p>Registre a fórmula conferida, os valores de entrada, o resultado esperado e o observado antes de liberar a fila.</p>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
                    void work(async () => {
                      await api("/calculator-audits", "POST", { ...data, calculatorId: campaignCalculator });
                      await loadCampaign(campaignCalculator);
                      setNotice("Auditoria registrada.");
                    });
                  }}>
                    <label>Fórmula conferida<input name="formulaChecked" required maxLength={2000} /></label>
                    <label>Entradas de teste<textarea name="testInputs" required /></label>
                    <label>Resultado esperado<input name="expectedResult" required /></label>
                    <label>Resultado observado<input name="observedResult" required /></label>
                    <label>Nome do Auditor<input name="auditor" required /></label>
                    <label>Conclusão<select name="verdict"><option value="passed">Aprovado — resultados conferem</option><option value="failed">Reprovado — resultados divergentes</option></select></label>
                    <label>Observações<textarea name="notes" /></label>
                    <button disabled={busy}>Registrar auditoria</button>
                  </form>
                </section>
                <section className="panel">
                  <h2>Ativar publicação diária</h2>
                  <p>Distribuição automática: 1 artigo por dia, durante 14 dias, com horários variados de Brasília.</p>
                  <label>Data do primeiro artigo<input type="date" value={campaignStart} onChange={(e) => setCampaignStart(e.target.value)} /></label>
                  <button className="primary" disabled={busy || !campaignInfo?.ready || !campaignStart} onClick={() => void work(async () => {
                    if (!confirm("Agendar os 14 artigos aprovados desta calculadora?")) return;
                    const result = await api("/campaigns/activate", "POST", {calculatorId:campaignCalculator,startDate:campaignStart});
                    setNotice(result.scheduled + " artigos agendados em horários de Brasília.");
                    await loadCampaign(campaignCalculator);
                    await refresh();
                  })}>Ativar fila de 14 dias</button>
                  {!campaignInfo?.ready && <p>Aguardando os 14 artigos aprovados, a auditoria válida ou a conclusão de uma campanha existente.</p>}
                  {(campaignInfo?.campaigns || []).map((c: any) => (
                    <div className="panel" key={c.id}>
                      <strong>Campanha iniciada em {c.start_date}</strong>
                      <p>Status: {c.status}</p>
                      {c.status === "scheduled" && <button disabled={busy} onClick={() => void work(async () => {
                        if (!confirm("Cancelar os agendamentos futuros da campanha?")) return;
                        await api("/campaigns/cancel", "POST", {id:c.id});
                        await loadCampaign(campaignCalculator);
                        await refresh();
                      })}>Cancelar campanha</button>}
                    </div>
                  ))}
                </section>
              </>
            )}
            {tab === "media" && (
              <>
                <h1>Biblioteca de mídia</h1>
                <section className="panel">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget,
                        fd = new FormData(form);
                      void work(async () => {
                        const file = fd.get("file") as File;
                        const r = await fetch(base + "/media", {
                          method: "POST",
                          headers: {
                            "Content-Type": file.type,
                            "X-File-Name": encodeURIComponent(file.name),
                            "X-Image-Alt": encodeMetadata(String(fd.get("alt"))),
                            "X-Image-Source": encodeMetadata(String(fd.get("source"))),
                            "X-Image-License": encodeMetadata(String(fd.get("license"))),
                          },
                          body: file,
                        });
                        const d: any = await r.json();
                        if (!r.ok) throw Error(d.error);
                        await refresh();
                        form.reset();
                        setNotice("Imagem armazenada com origem e licença.");
                      });
                    }}
                  >
                    <label>
                      Arquivo (JPEG, PNG, WebP, até 5 MB)
                      <input
                        name="file"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        required
                      />
                    </label>
                    <label>
                      Descrição alternativa
                      <input name="alt" required />
                    </label>
                    <label>
                      Origem / referência
                      <input name="source" required />
                    </label>
                    <label>
                      Licença ou declaração de direitos
                      <input name="license" required />
                    </label>
                    <button disabled={busy}>Enviar imagem</button>
                  </form>
                </section>
                {media.length === 0 && <section className="panel"><p>A biblioteca ainda não tem imagens. Envie uma capa acima e depois selecione-a em qualquer artigo.</p></section>}
                <div className="media-grid">
                  {media.map((m) => (
                    <article className="panel" key={m.id}>
                      <img src={base + "/media/" + m.id} alt={m.alt} />
                      <h2>{m.name}</h2>
                      <p>
                        {m.width} × {m.height} · {Math.round(m.size / 1024)} KB
                      </p>
                      <p>{m.alt}</p>
                      <small>
                        {m.source} · {m.license}
                      </small>
                      <p>
                        Artigos:{" "}
                        {rows
                          .filter((r) => r.snapshot.coverId === m.id)
                          .map((r) => r.snapshot.title)
                          .join(", ") || "Sem vínculo"}
                      </p>
                    </article>
                  ))}
                </div>
              </>
            )}
            {tab === "briefs" && (
              <>
                <h1>Briefings e rotas</h1>
                <p>
                  O proprietário cadastra o planejamento aprovado. Os agentes
                  não escolhem palavras-chave.
                </p>
                <section className="panel">
                  <h2>Cadastrar briefing aprovado</h2>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = e.currentTarget,
                        d = Object.fromEntries(new FormData(f).entries());
                      void work(async () => {
                        await api("/briefs", "POST", {
                          ...d,
                          circuit: Number(d.circuit),
                          secondaryKeywords: String(d.secondaryKeywords)
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        });
                        await refresh();
                        f.reset();
                        setNotice("Briefing registrado.");
                      });
                    }}
                  >
                    <div className="grid">
                      {[
                        ["id", "ID do briefing"],
                        ["title", "Título do briefing"],
                        ["primaryKeyword", "Palavra-chave principal"],
                        [
                          "secondaryKeywords",
                          "Secundárias separadas por vírgula",
                        ],
                      ].map(([k, l]) => (
                        <label key={k}>
                          {l}
                          <input
                            name={k}
                            required={k !== "secondaryKeywords"}
                          />
                        </label>
                      ))}
                      {[
                        ["categoryId", "Categoria", "category"],
                        ["subcategoryId", "Subcategoria", "subcategory"],
                        ["calculatorId", "Calculadora", "calculator"],
                      ].map(([k, l, kind]) => (
                        <label key={k}>
                          {l}
                          <select name={k}>
                            {routes
                              .filter((r) => r.kind === kind)
                              .map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                          </select>
                        </label>
                      ))}
                      <label>
                        Circuito
                        <select name="circuit">
                          <option>1</option>
                          <option>2</option>
                        </select>
                      </label>
                    </div>
                    <button disabled={busy}>
                      Registrar planejamento aprovado
                    </button>
                  </form>
                </section>
                {briefs.map((b) => (
                  <section className="panel" key={b.id}>
                    <h2>{b.title}</h2>
                    <p>
                      {b.id} · {categoryName(b.calculator_id)} · circuito{" "}
                      {b.circuit}
                    </p>
                    <p>
                      {b.primary_keyword} ·{" "}
                      {JSON.parse(b.secondary_keywords).join(", ")}
                    </p>
                    <small>
                      {rows.filter((r) => r.snapshot.briefId === b.id).length}{" "}
                      artigos recebidos
                    </small>
                  </section>
                ))}
                <section className="panel">
                  <h2>Categorias e tags</h2>
                  <p>Cadastre a categoria antes de usá-la em um artigo. Subcategorias e calculadoras são criadas em “Cadastro de rotas”.</p>
                  <form onSubmit={e=>{
                    e.preventDefault();
                    const node=e.currentTarget;
                    void work(async()=>{
                      const d=Object.fromEntries(new FormData(node).entries());
                      const slug=String(d.name||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
                      if(!slug)throw new Error("Nome inválido.");
                      await api("/terms","POST",{...d,slug});
                      await refresh();node.reset();setNotice("Termo editorial cadastrado.");
                    });
                  }}>
                    <label>Tipo
                      <select name="kind"><option value="tag">Tag</option><option value="category">Categoria</option></select>
                    </label>
                    <label>Nome<input name="name" required maxLength={80} /></label>
                    <button disabled={busy}>Cadastrar categoria ou tag</button>
                  </form>
                  {terms.length===0 ? <p>Nenhuma categoria ou tag cadastrada.</p> : <div className="actions">
                    {terms.map((t:any)=><span className="badge" key={t.id}>{t.kind==="tag" ? "Tag" : "Categoria"}: {t.name}</span>)}
                  </div>}
                </section>
                <section className="panel">
                  <h2>Pautas editoriais</h2>
                  <p>Planejamento feito com pesquisa SEO, antes de enviar os briefings aos bots.</p>
                  <form onSubmit={e=>{
                    e.preventDefault();const node=e.currentTarget;
                    void work(async()=>{await api("/pitches","POST",Object.fromEntries(new FormData(node).entries()));await refresh();node.reset();});
                  }}>
                    <label>Título<input name="title" required /></label>
                    <label>Notas<textarea name="notes" /></label>
                    <button disabled={busy}>Registrar pauta</button>
                  </form>
                  {pitches.map((p:any)=><div key={p.id} className="panel">
                    <strong>{p.title}</strong><p>{p.notes}</p>
                    <small>Status: {p.status}</small>
                    <div className="actions">
                      {["planned","approved","archived"].map(status=><button type="button" key={status} disabled={busy||p.status===status} onClick={()=>void work(async()=>{await api("/pitches/"+p.id,"PUT",{status});await refresh();})}>{status==="approved"?"Aprovar pauta":status==="archived"?"Arquivar":"Planejar"}</button>)}
                    </div>
                  </div>)}
                </section>
                <details className="panel">
                  <summary>Cadastro de rotas reais e previstas</summary>
                  <p>Uma rota marcada como prevista não gera links públicos.</p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = e.currentTarget;
                      void work(async () => {
                        await api(
                          "/routes",
                          "POST",
                          Object.fromEntries(new FormData(f).entries()),
                        );
                        await refresh();
                        f.reset();
                      });
                    }}
                  >
                    <label>
                      ID
                      <input name="id" required />
                    </label>
                    <label>
                      Nome
                      <input name="name" required />
                    </label>
                    <label>
                      Caminho real ou previsto
                      <input
                        name="path"
                        placeholder="/paint-calculator/"
                        required
                      />
                    </label>
                    <label>
                      Tipo
                      <select name="kind">
                        <option value="category">Categoria</option>
                        <option value="subcategory">Subcategoria</option>
                        <option value="calculator">Calculadora</option>
                      </select>
                    </label>
                    <label>
                      Rota pai
                      <select name="parentId">
                        <option value="">Nenhuma</option>
                        {routes.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Estado
                      <select name="state">
                        <option value="planned">Prevista</option>
                        <option value="live">Real, existente</option>
                      </select>
                    </label>
                    <button disabled={busy}>Adicionar rota</button>
                  </form>
                </details>
              </>
            )}
            {tab === "logs" && (
              <>
                <h1>Histórico</h1>
                <p>
                  Registros de integração e administração. O histórico de cada
                  versão fica no artigo.
                </p>
                {logs.length === 0 && <section className="panel"><p>O histórico aparecerá após as primeiras operações editoriais.</p></section>}
                {logs.map((l) => (
                  <section className="panel" key={l.id}>
                    <strong>{l.action}</strong>
                    <p>
                      {brasiliaDisplay(l.created_at)} · {l.actor}
                    </p>
                    <code>{l.detail}</code>
                  </section>
                ))}
              </>
            )}
            {tab === "settings" && (
              <>
                <h1>Acesso e agentes</h1>
                {location.hostname.startsWith("metricpedia-editorial-lab.") ? <section className="panel"><p>Acesso aberto para testes. Nenhuma senha de administrador é necessária neste laboratório.</p></section> : <section className="panel">
                  <h2>Alterar minha senha</h2>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = e.currentTarget;
                      void work(async () => {
                        await api(
                          "/password",
                          "POST",
                          Object.fromEntries(new FormData(f).entries()),
                        );
                        setAuth(false);
                        setNotice("Senha alterada. Entre novamente.");
                      });
                    }}
                  >
                    <label>
                      Senha atual
                      <input
                        name="currentPassword"
                        type="password"
                        autoComplete="current-password"
                        required
                      />
                    </label>
                    <label>
                      Nova senha
                      <input
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        minLength={12}
                        required
                      />
                    </label>
                    <button disabled={busy}>
                      Alterar senha e encerrar sessões
                    </button>
                  </form>
                </section>}
                <section className="panel">
                  <h2>Criar credencial de integração</h2>
                  <p>
                    Escritor: enviar e agendar após a aprovação. Auditor: solicitar correções e autorizar a versão. Supervisor: somente acompanhar. A publicação agendada é executada pelo CMS.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void work(async () => {
                        const d = await api("/agents", "POST", {
                          name: f.get("name"),
                          scopes: f.getAll("scopes"),
                        });
                        setCredential(d.token);
                        await refresh();
                      });
                    }}
                  >
                    <label>
                      Nome do agente
                      <input name="name" required />
                    </label>
                    <label>Papel do bot
                      <select value={agentRole} onChange={e => setAgentRole(e.target.value)}>
                        <option value="writer">Escritor — enviar e agendar</option>
                        <option value="auditor">Auditor — revisar e aprovar</option>
                        <option value="supervisor">Supervisor — acompanhar</option>
                      </select>
                    </label>
                    <div className="actions">
                      {[
                        "submit",
                        "status",
                        "authorize",
                        "schedule",
                      ].map((s) => (
                        <label className="check" key={s}>
                          <input
                            type="checkbox"
                            name="scopes"
                            value={s}
                            checked={(agentRole === "writer" ? ["submit","status","schedule"] : agentRole === "auditor" ? ["status","authorize"] : ["status"]).includes(s)}
                            readOnly
                          />
                          {s}
                        </label>
                      ))}
                    </div>
                    <button disabled={busy}>Gerar credencial</button>
                  </form>
                  {credential && (
                    <div className="message">
                      <p>
                        Copie agora para o cofre do agente. Não será exibida
                        novamente.
                      </p>
                      <code className="token">{credential}</code>
                      <button onClick={() => setCredential("")}>Ocultar</button>
                    </div>
                  )}
                </section>
                {agents.map((a) => (
                  <section className="panel" key={a.id}>
                    <h2>{a.name}</h2>
                    <p>
                      {JSON.parse(a.scopes).join(", ")} ·{" "}
                      {a.active ? "Ativo" : "Revogado"}
                    </p>
                    {a.active === 1 && (
                      <button
                        onClick={() =>
                          work(async () => {
                            await api(
                              "/agents/" + a.id + "/revoke",
                              "POST",
                              {},
                            );
                            await refresh();
                          })
                        }
                      >
                        Revogar
                      </button>
                    )}
                  </section>
                ))}
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
