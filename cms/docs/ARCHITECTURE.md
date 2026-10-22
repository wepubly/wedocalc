# Metricpedia Editorial Center V1 — homologação

## Limites

Código isolado em `cms/`, workflow `.github/workflows/cms-staging.yml`. A Home, calculadoras, impressão, compartilhamento, `_headers` e workflows públicos não são alterados. Nenhuma rota do domínio oficial é instalada. A branch inicial estava no mesmo commit de main (`c00b578`), sem diferenças de arquivos.

Referência Ublong lida exclusivamente: AdminApp, CmsHome, tipos, segurança, Worker, editorial, render, Markdown, imagens, horários, migrações 0001–0003 e documentação CMS_MVP/CMS_2. Não é uma cópia integral do portal. Reutilizados: esquema de versões imutáveis e agendamento, lógica transacional de publicação, renderização SSR/Markdown, validação binária e dimensões de mídia, conversão IANA de horários. Adaptados: painel React em português, identidade Metricpedia, senha escolhida/alterável, bootstrap protegido, D1/R2 isolados, vínculos a briefings e rotas e integração autenticada com Grok. Não se reutilizam banco, bucket, segredos ou módulos de música/jornadas.

## Dados

`articles` aponta separadamente para `draft_version` e `published_version`. `article_versions` contém snapshots imutáveis. Alterar o artigo gera versão nova, não autorizada, e cancela o agendamento anterior. O conteúdo público e suas datas usam só o snapshot publicado. Slugs publicados são permanentes, inclusive após retirada. Um artigo referenciado por outro publicado não pode ser retirado antes de corrigir o dependente.

`routes` registra categoria → subcategoria → calculadora, com estado `live`/`planned`. Só rotas reais produzem links relacionados. As três rotas iniciais foram verificadas no checkout: `/home-garden/`, `/paint-calculators/`, `/paint-calculator/`. O link da calculadora usa a URL pública real do Metricpedia; a origem de homologação não inventa essas páginas. O cadastro de novas rotas é responsabilidade autenticada do proprietário.

`briefs` contém o planejamento escolhido pelo proprietário/ChatGPT (palavras-chave, hierarquia, circuito). A API recusa desvios. Circuitos 1 e 2 não obrigam cadastrar 14 artigos simultaneamente nem publicar sete em um dia. IDs dos artigos relacionados e do pilar são estruturados e validados antes de autorizar/publicar.

`submissions` e `submission_versions` garantem idempotência por trabalho externo + versão final. Reutilizar versão com outro conteúdo retorna 409. Snapshot normalizado gera SHA-256. `external_approvals` associa evidência externa, principal autenticado, versão, digest e data. `editorial_events`/`system_events` registram operações sem segredos.

## Autorização externa

O texto `approvalReference` enviado pelo escritor é apenas contexto. Não aprova nada. O proprietário pode confirmar uma decisão já tomada no Grok, sem refazer revisão no painel, informando a referência da mensagem e confirmando o digest. Alternativamente, uma credencial independente de Supervisor com `authorize` confirma a versão pelo endpoint documentado. A credencial do escritor nunca pode acumular `authorize`, `schedule` ou `publish`. Conceder credencial de Supervisor é uma decisão do proprietário, depois de validar o fluxo com o Supervisor real. Até lá, as entregas ficam bloqueadas. Não há integração automática com o chat Grok nem verificação criptográfica de mensagens Grok: a confirmação autenticada do proprietário/Supervisor é a atestação confiável.

## Segurança

Único proprietário com usuário, salt aleatório, PBKDF2-SHA256 de 100.000 iterações (limite WebCrypto Workers), senha de 12–256 caracteres. Hash, salt e custo ficam no D1; senha nunca no frontend, código ou logs. Setup requer segredo de servidor de 24+ caracteres e só existe enquanto não há proprietário. Sessões opacas de 256 bits armazenadas por hash, sete dias, cookies Secure/HttpOnly/SameSite=Strict em staging. Alteração de senha incrementa epoch e invalida todas as sessões. Throttle D1 de dez tentativas/15 minutos. Sem OTP, e-mail ou MFA nesta fase. Perda de senha exige procedimento administrativo futuro, não existe reset público.

Admin APIs exigem sessão e Origin igual ao host nas mutações. API de agentes usa Bearer de 256 bits, armazenado por hash, escopos e revogação. Não recebe cookie como substituto. Credenciais são mostradas uma vez ao proprietário na criação. Markdown escapa HTML e remove esquemas perigosos. Upload aceita PNG/JPEG/WebP até 5 MB, valida assinatura/dimensões, registra origem/licença. A declaração de direitos exige confirmação humana; o software não comprova licença de terceiros. Mídia pública só é entregue se referenciada por versão publicada.

Todos os retornos de staging, incluindo erros, XML, assets e APIs, carregam X-Robots-Tag noindex,nofollow,noarchive e no-store. Robots disallow /. Artigos também têm meta noindex/nofollow. Admin não entra no sitemap. Não há alteração do noindex do site público.

## Deploy e recursos

`verify` instala dependências travadas, verifica TypeScript, compila e executa integração local com Wrangler/D1/R2 reais. `staging` só executa na branch `work/metricpedia-cms-blog-v1`, inspeciona recursos via API, exige identidade Pages existente e cria/reutiliza apenas:

- Worker `metricpedia-cms-staging`.
- D1 `metricpedia-cms-staging-db`.
- R2 privado `metricpedia-cms-staging-assets`.

O script gera `wrangler.staging.json` e o relatório de IDs sem segredos. Não há IDs fictícios para deploy. As migrações são executadas com nome/bindings de staging conferidos e `--remote`. O Worker não recebe rotas de domínio; usa só workers.dev. Cron minutely processa exclusivamente versões autorizadas/agendadas. Falhas ficam em last_error, pausadas até cancelar/reagendar; lote continua para outros artigos. Agendamentos simultâneos consomem a entrada e registram evento na mesma transação.

Inventário inicial via GitHub Actions: Pages `wedocalc`, produção `main`; listagem Workers vazia para o token; D1 401/código 10000 e R2 403/código 10000. Recursos editoriais remotos não podem ser confirmados até corrigir as permissões. Nenhum recurso do Ublong foi alterado.

## Integração futura

Após aprovação, um plano separado instala rotas `/admin*`, `/api/editorial/*`, `/api/integration/*`, `/blog*`, `/media/*`, sitemap/feed no domínio oficial, preservando o Pages atual e as demais URLs. Exige D1/R2 próprios de produção, migração validada, backups, origin/canonical corretos e autorização explícita de indexação. Esta branch recusa ENVIRONMENT=production e hostname de produção. Não basta mudar o DNS para promover esta configuração.
