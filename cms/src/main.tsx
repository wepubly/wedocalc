import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { brasiliaDisplay, brasiliaToUtc } from "./editorial-time";
import "./admin.css";
const base = "/api/editorial";
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
  relatedIds: [],
  pillarId: "",
  isPillar: false,
  requiresSources: false,
});
const tabs = [
  ["dashboard", "Visão geral"],
  ["articles", "Artigos"],
  ["schedules", "Agendamentos"],
  ["media", "Biblioteca de mídia"],
  ["briefs", "Briefings e rotas"],
  ["logs", "Histórico"],
  ["settings", "Acesso e agentes"],
];
function App() {
  const [auth, setAuth] = useState(false),
    [loading, setLoading] = useState(true),
    [setup, setSetup] = useState(false),
    [tab, setTab] = useState("dashboard"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<any[]>([]),
    [briefs, setBriefs] = useState<any[]>([]),
    [routes, setRoutes] = useState<any[]>([]),
    [media, setMedia] = useState<any[]>([]),
    [schedules, setSchedules] = useState<any[]>([]),
    [logs, setLogs] = useState<any[]>([]),
    [agents, setAgents] = useState<any[]>([]);
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
  const [credential, setCredential] = useState("");
  async function refresh() {
    const [a, b, r, m, s, l, g] = await Promise.all(
      [
        "/articles",
        "/briefs",
        "/routes",
        "/media",
        "/schedules",
        "/logs",
        "/agents",
      ].map((p) => api(p)),
    );
    setRows(a);
    setBriefs(b);
    setRoutes(r);
    setMedia(m);
    setSchedules(s);
    setLogs(l);
    setAgents(g);
  }
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
        <small>HOMOLOGAÇÃO · não indexável</small>
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
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
            <a href="/blog/" target="_blank">
              Ver blog de homologação ↗
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
                        Referência verificável da aprovação final
                        <input
                          value={evidence}
                          onChange={(e) => setEvidence(e.target.value)}
                          placeholder="ID/mensagem final do Supervisor no grupo"
                        />
                      </label>
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
                          Confirmar aprovação externa
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
                              setNotice("Publicado no blog de homologação.");
                            })
                          }
                        >
                          Publicar na homologação
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
                            "X-Image-Alt": String(fd.get("alt")),
                            "X-Image-Source": String(fd.get("source")),
                            "X-Image-License": String(fd.get("license")),
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
                <section className="panel">
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
                </section>
                <section className="panel">
                  <h2>Criar credencial de integração</h2>
                  <p>
                    Escritor: envio e status. Supervisor: confirmação externa,
                    agendamento e publicação. Essas credenciais não dão acesso
                    administrativo.
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
                    <div className="actions">
                      {[
                        "submit",
                        "status",
                        "authorize",
                        "schedule",
                        "publish",
                      ].map((s) => (
                        <label className="check" key={s}>
                          <input
                            type="checkbox"
                            name="scopes"
                            value={s}
                            defaultChecked={["submit", "status"].includes(s)}
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
