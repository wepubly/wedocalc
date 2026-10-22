# Metricpedia — contrato da integração editorial V1

Base: origem de homologação informada pelo workflow. Artigos en-US; painel pt-BR. Todas as chamadas de agente usam `Authorization: Bearer <credencial>` sobre HTTPS. A credencial é criada pelo proprietário no painel e transmitida no cofre do agente; nunca em URL, arquivo do repositório ou chat. Não usar credencial Cloudflare para chamar o CMS.

## Escopos

| Escopo | Operação |
|---|---|
| submit | Envio de pacote e mídia |
| status | Consulta de versão/hash/status (escritor só consulta seus trabalhos) |
| authorize | Confirmação do Supervisor para uma versão/hash exatos |
| schedule | Agendamento de versão já autorizada |
| publish | Publicação imediata de versão já autorizada |

A credencial que tem submit não pode acumular authorize/schedule/publish. Credenciais de agente não dão acesso a `/api/editorial/*`, rotas de administração nem cadastro de briefings/rotas. O proprietário pode revogá-las.

## 1. Imagem

`POST /api/integration/media` com corpo binário original, Content-Type `image/png`, `image/jpeg` ou `image/webp`, máximo 5 MB.

Headers obrigatórios: `X-File-Name` (encodeURIComponent), `X-Image-Source` (referência da origem), `X-Image-License` (licença/permissão/declaração de autoria). `X-Image-Alt` descreve a imagem. Para cabeçalhos use texto compatível HTTP; envie alt text completo também no pacote.

Resposta 201: `{ "id": "uuid", "name": "cover.png", "alt": "...", "width": 1200, "height": 675 }`. Esse ID entra no coverId do pacote. Não há download automático de URLs arbitrárias. A biblioteca registra tamanho, dimensões, origem/licença e artigos que usam cada imagem.

## 2. Pacote

`POST /api/integration/packages`, Content-Type application/json, escopo submit.

```json
{
  "externalId": "grok-paint-c1-article-01",
  "briefId": "paint-circuit-1-approved-brief",
  "title": "TEST ONLY – Paint Planning Guide",
  "slug": "test-only-paint-planning",
  "primaryKeyword": "approved primary keyword",
  "secondaryKeywords": ["approved secondary keyword"],
  "category": "Home & Garden",
  "subcategoryId": "paint-calculators",
  "calculatorId": "paint-calculator",
  "articleType": "pillar",
  "circuit": 1,
  "seoTitle": "TEST ONLY – Paint Planning Guide",
  "description": "A clearly identified test package for the Metricpedia staging workflow.",
  "excerpt": "TEST ONLY – staging validation, not a real editorial article.",
  "body": "## TEST ONLY\n\nMarkdown content approved outside the CMS.\n\n[Paint Calculator](https://metricpedia.com/paint-calculator/)",
  "author": "Metricpedia Editorial",
  "authorType": "Organization",
  "language": "en-US",
  "tags": [],
  "coverId": "UUID_FROM_MEDIA_UPLOAD",
  "coverAlt": "Paint materials arranged for a test illustration",
  "sources": [{"title": "Official source title", "url": "https://example.org/real-source"}],
  "requiresSources": true,
  "isPillar": true,
  "pillarId": "",
  "relatedIds": [],
  "finalVersion": "final-1",
  "approvalReference": "Grok group / Supervisor final decision message ID",
  "intendedRunAt": "2026-11-01T08:00:00.000Z"
}
```

Este exemplo é de teste. Substituir as referências por fontes efetivamente usadas; não publicar example.org. O briefing precisa estar previamente registrado pelo proprietário. Palavras-chave (inclusive ordem das secundárias), hierarquia e circuito devem coincidir. O escritor não pode registrar/alterar briefings.

Resposta 201: `{ "id": "uuid", "version": 1, "digest": "sha256", "publicationAuthorized": false }`.

Reenvio idêntico de externalId + finalVersion: 200 e `idempotent:true`, mesma versão, sem duplicação. Mesmo identificador com conteúdo divergente: 409. Para corrigir envie novo finalVersion; gera snapshot novo, cancela agendamento pendente e mantém o snapshot público anterior intacto. Um trabalho não muda de agente ou briefing silenciosamente. Slug após primeira publicação é permanente.

`intendedRunAt` e `approvalReference` são intenções/informações do pacote: NÃO agendam nem autorizam automaticamente.

## 3. Consulta

`GET /api/integration/articles/{id}`, escopo status. Retorna draft_version, published_version, published_slug, snapshot atual, digest SHA-256 normalizado e externalApproval ou null. O hash normalizado é devolvido pelo servidor; não calcule a partir do JSON bruto do cliente, pois campos e ordem são normalizados.

## 4. Confirmação final externa

`POST /api/integration/articles/{id}/authorize`, escopo authorize de uma credencial independente do Supervisor:

```json
{"version":1,"digest":"HASH_DEVOLVIDO_PELO_CMS","evidence":"ID verificável da decisão final do Supervisor no grupo Grok"}
```

O proprietário também pode confirmar a aprovação externa no painel, sem nova revisão de redação. A confirmação fica vinculada à versão, digest, principal autenticado e timestamp. Nova versão exige confirmação nova. Status declared approved, nomes de revisores ou approvalReference no pacote não concedem autorização.

Antes de entregar ao Supervisor sua credencial authorize, validar com o proprietário que ele é quem pode atestar a decisão final do grupo. O CMS não lê nem verifica mensagens Grok por conta própria. Não existe dependência de Slack.

## 5. Agendamento/publicação

`POST /api/integration/articles/{id}/schedule`, escopo schedule:

```json
{"version":1,"runAt":"2026-11-01T08:00:00.000Z"}
```

Exige data futura ISO com Z ou offset. Armazena UTC; painel exibe America/Sao_Paulo. Produzir sete artigos de uma calculadora não implica publicá-los no mesmo dia. Datas são individuais.

`POST /api/integration/articles/{id}/publish`, escopo publish, corpo `{"version":1}`. Só publica a versão atual autorizada, com metadados/referências válidos. Repetir publicação da versão já pública não duplica evento. Em homologação a publicação permanece noindex/nofollow.

Cancelamento e alteração de data pelo proprietário no painel. Falha do cron registra last_error e pausa a entrada; cancelar/reagendar após corrigir. O cron não gera conteúdo nem aprova versões.

## Respostas de erro

| HTTP | Significado |
|---|---|
| 400 | Campo, briefing, idioma, hierarquia ou data inválidos |
| 401 | Credencial/sessão inválida, expirada ou ausente |
| 403 | Escopo ausente, trabalho de outro agente ou Origin inválida |
| 404 | Artigo/mídia/rota inexistente |
| 409 | Versão/hash mudou, autorização ausente, slug ou idempotência em conflito |
| 413 | Upload/pacote excedeu limite |
| 415 | MIME/assinatura/dimensões não aceitos |
| 429 | Limite de tentativas de login |
| 503 | Configuração de ambiente/setup ainda bloqueada |

Erros respondem `{"error":"mensagem"}`. Não repetir 400/403/409 sem corrigir a causa; em falhas transitórias consultar status antes de reenviar usando o mesmo identificador idempotente.

## URLs e SEO

`/blog/`, `/blog/{slug}/`, `/media/{id}`, `/sitemap.xml`, `/feed.xml`, `/robots.txt`. Artigos são SSR com SEO title, description, canonical de staging, OG/Twitter, BlogPosting/BreadcrumbList, data de publicação/atualização, autoria, alt text e links a conteúdo publicado/rotas reais. Admin/previews nunca entram em sitemap. Nenhuma URL staging deve ser submetida ao Google.
