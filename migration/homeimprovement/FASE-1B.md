# Fase 1B: resultado da preparação

Estado: Fase 1B concluída para inventário e preparação. A pendência DNS/SSL foi resolvida por evidências do painel fornecidas pelo proprietário em 03/11/2026. Isso não autoriza exportação remota, provisionamento, cópia ou deploy. Nenhum recurso de destino criado, nenhuma cópia D1/R2 de destino e nenhum deploy de destino realizado.

## 1. Produção da Metricpedia

Inspeção 03/11/2026 18:15:54 Brasília, execução https://github.com/wepubly/wedocalc/actions/runs/41720168056.

Produção Pages permanece no deployment 08983672-ebdc-47a3-b4b7-f246cb9d22be. Worker ativo mantém versão dda5078a-3413-4f91-9f02-e39ad362df43. DB e bucket continuam nos bindings originais. A rotina apenas consultou dados; não houve execução de workflows de produção, merge, gravação D1/R2, alteração de cron ou de credenciais editoriais.

Os números permanecem: 15 artigos, 7 publicados, 42 versões, 121 eventos, 9 versões atuais aprovadas, 6 rascunhos sem revisão, zero em revisão/correções e zero agendamentos pendentes. Há 7 agendas publicadas e 1 cancelada no histórico. Cron original: a cada minuto. Nenhuma violação retornada por foreign_key_check; nenhuma publicação com versão ausente.

## 2. R2 físico

| Medida | Resultado |
| --- | --- |
| Objetos físicos | 22 |
| Bytes físicos totais | 3.907.174 |
| Imagens vinculadas ao catálogo D1 | 15 / 3.676.193 bytes |
| Objetos ausentes do catálogo físico | 0 |
| Objetos fora do catálogo D1 | 7 / 230.981 bytes |
| Arquivos fora do catálogo | 5 imagens de backup e 2 rows.json de manutenção |
| Leituras binárias | 22 respostas HTTP 200 |
| Tamanhos de imagens versus D1 | 15 correspondências |
| SHA-256 | calculado para cada um dos 22 objetos |

Os 7 objetos fora do catálogo estão em editorial-maintenance-backups/2026-10-22-cms-finalization e editorial-maintenance-backups/2026-10-22-grok-corrections. São arquivos auxiliares de recuperação; preservar, não excluir como lixo. Imagens apresentam assinatura JPEG. SHA-256 permite verificar igualdade após a cópia; não é um certificado de ausência de corrupção anterior, e não foi executada decodificação visual integral das imagens. Exportação binária é viável com o token existente. Nenhuma imagem foi gravada em destino remoto nesta fase. Manifesto em r2-copy-manifest.json, incluindo HTTP metadata e fingerprint de custom metadata. O suplemento metadata-1b.snapshot.json contém hashes das 42 versões e contagens de todas as 26 tabelas de aplicação.

## 3. D1 e recuperação

Bookmark de leitura obtido e registrado em BACKUP-RECOVERY.md. Procedimento oficial de export SQL e verificação local preparado, incluindo preservação de snapshots, versões, revisões, eventos, tabelas editoriais, referências e hashes.

A exportação não foi executada: segundo a documentação oficial, ela bloqueia outras requisições do D1 enquanto roda. Isso conflita com manter os bots operando sem interrupção. Exige aprovação específica de uma janela de bloqueio antes de executar, mesmo sem alterar tabelas. Manifesto suplementar registrou hashes dos 42 snapshots e contagens das 26 tabelas de aplicação, além de fingerprints de metadata dos 22 objetos. Há 31 revisões no histórico, além das 9 aprovações atuais. O bookmark tem retenção limitada; não substitui um backup SQL privado validado.

A tabela external_approvals tem zero linhas; as 9 aprovações atuais pertencem a editorial_reviews e são por versão. Não houve validação de hashes externos inexistentes. O endpoint de leitura calcula digest do snapshot e os testes locais confirmaram essa correspondência. A cópia deve comparar os snapshots originais sem reescrevê-los.

## 4. Permissões e DNS/SSL

Token ativo; leitura Pages/Workers/D1/R2 e dos bytes R2 confirmada. Os quatro recursos de destino foram consultados. Não foi criado token nem alterado escopo.

Consultas da zona negadas: DNS records 403/10000; SSL verification e SSL setting 403/9109. O painel Cloudflare abriu em tela de login, sem sessão autenticada disponível; não houve tentativa de alterar credenciais ou autenticação.

Alternativa pública consultada sem token: NS publicados são asa.ns.cloudflare.com e josh.ns.cloudflare.com; consultas A, AAAA e CNAME do apex não retornaram respostas. A tentativa HTTPS retornou 503 neste ambiente; isso não confirma emissão de certificado, modo SSL nem indisponibilidade para todos os clientes.

Conclusão posterior por prints do painel enviados pelo proprietário em 03/11/2026:

| Configuração | Estado observado |
| --- | --- |
| Registros DNS da zona | 0 registros; raiz e www sem registros |
| Universal SSL | Ativo para homeimprovement.tools e *.homeimprovement.tools |
| Certificado backup | Emitido |
| Validade exibida dos certificados | 01/02/2027 |
| Modo SSL/TLS | Completo (Full) |
| Sempre usar HTTPS | Desativado |
| TLS mínimo | TLS 1.0 (padrão) |
| TLS 1.3 | Ativado |
| HSTS | Não habilitado, conforme botão Habilitar HSTS exibido |

Essas são evidências visuais fornecidas pelo proprietário, e não resultados obtidos com o token. Elas concluem a pendência do inventário sem ampliar permissões. Nenhuma configuração foi alterada. Certificado ativo no painel não equivale a teste HTTPS do futuro site publicado; esse teste será necessário após conexão do domínio ao ambiente novo.

## 5. Preview: causa e mecanismo escolhido

Confirmado ao vivo: Pages source.type=github, owner=wepubly, repo=wedocalc; production_deployments_enabled=false; preview_deployment_setting=all; preview_branch_includes=['*']; exclusões vazias. A integração Git nativa do Cloudflare Pages acionou o preview anterior. Não foi o workflow de produção do CMS.

No GitHub, produção do site recebe push na main e o CMS recebe push em work/metricpedia-cms-blog-v1. A rotina criada para esta missão recebe apenas alterações específicas em work/homeimprovement-copy-prep-20261103. Outros workflows antigos são de preview específico ou acionamento manual. Nenhum workflow de produção foi executado durante esta missão.

Método aplicado: commits da preparação recebem prefixo oficial [CF-Pages-Skip], que impede o build do Pages sem alterar as configurações do projeto e permite executar o diagnóstico do Actions. Na execução principal desta fase, noNewPreviewDuringInspection=true e a produção permaneceu inalterada. Essa comparação cobre somente o intervalo da inspeção; o Pages pode criar registros de preview em estado idle mesmo quando o build é omitido. A auditoria final das 18:28:50 confirmou os 5 registros de commits com [CF-Pages-Skip] em queued/idle, todos com initialize/build/deploy sem started_on. Portanto, foram criados registros, mas nenhum build/deploy novo foi iniciado por eles. O único preview concluído desta missão continua sendo o incidente anterior f729b21a. Evidência: pages-deployments-1b.snapshot.json e execução 41722133946. Não interpretar esse booleano como ausência absoluta de registros novos. O preview anterior não foi excluído.

Implicação: todo commit futuro nessa branch deve preservar o prefixo; isso é proteção por commit, não exclusão permanente da branch. O destino definitivo deve preferir repositório independente sem integração a wedocalc, ou publicação Direct Upload explicitamente autorizada em projeto novo. Não criamos outro repositório nem alteramos acessos. Não abrir PR ou fazer push sem rever possíveis gatilhos.

Fontes: https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/#skipping-a-build-via-a-commit-message e https://developers.cloudflare.com/pages/configuration/git-integration/.

## 6. Testes locais

| Verificação | Resultado |
| --- | --- |
| Causa uv_interface_addresses | reproduzida diretamente em os.networkInterfaces() |
| Ajuste local | preload dos testes usa somente loopback se ocorrer exatamente esse erro; não entra no deploy |
| Teste funcional production.mjs | passou: upload, destino, versão, hash, revisão, agenda, cancelamento, cron local, publicação, isolamento de versão e retirada |
| TypeScript / Vite / bundle adaptado | passaram |
| Runtime do destino com D1/R2 locais | passou, com 12 artigos fictícios em 3 calculadoras |
| CMS e leitura de artigos | passaram localmente |
| Rotas | home, admin, blog, Paint Calculators, Paint Calculator, impressão, sitemap e artigo passaram; rota inexistente retornou 404 |
| Bloqueio de gravação | POST/PUT/PATCH/DELETE retornaram 423; contagens locais permaneceram intactas |
| Noindex | cabeçalhos nas rotas testadas; robots.txt Disallow: / |
| Cards | home diversificada; Paint Calculators com alternância entre calculadoras; calculadora filtrada para paint-calculator |
| Aritmética | 1.000 sq ft / 400, duas demãos, 10% = 5,5 galões |
| Entrada inválida | área negativa rejeitada |
| Impressão | resultado entregue ao preview; Print e Save as PDF invocam window.print(), verificados em DOM simulado |
| PDF nativo | passou no runner isolado GitHub Actions: geração Letter e A4, com o resultado da calculadora |

O download local do Chromium falhou; a alternativa segura foi executá-lo no runner efêmero do GitHub Actions, sem token Cloudflare e sem deploy. O teste de navegador nativo passou, incluindo aritmética, entrada inválida, navegação para impressão e geração de PDFs Letter/A4. Evidência: https://github.com/wepubly/wedocalc/actions/runs/41721961113/job/126216775585. Não foi feita inspeção visual humana do PDF.

## 7. Recursos independentes

Disponibilidade confirmada no inventário:

| Tipo | Nome | Estado |
| --- | --- | --- |
| Pages | homeimprovement-tools | inexistente (404 específico do projeto) |
| Worker | homeimprovement-editorial | ausente na listagem |
| D1 | homeimprovement-editorial-db | ausente na listagem |
| R2 | homeimprovement-editorial-media | ausente na listagem |

Templates Worker/Pages usam apenas nomes de destino e um placeholder de UUID não implantável. Configurador rejeita UUID do banco original e nomes divergentes. Ambiente staging, noindex, sem cron, sem scheduled exportado, sem endpoints de gravação habilitados e sem bots conectados. O template Pages não tem integração Git/source; nenhum binding de dados em preview foi proposto.

## 8. Cards preparados

Reutilizado catálogo da branch work/metricpedia-public-article-cards. Novo catálogo fixa PUBLIC_ORIGIN=https://homeimprovement.tools. A leitura do blog é uma chamada interna ao runtime com os bindings de destino; não busca metricpedia.com, não usa serviço de origem, não compartilha cache de catálogo entre projetos.

Home e Paint Calculators preservam seleção pseudoaleatória com rotação diária e balanceamento. A página da calculadora filtra categoria/subcategoria/calculadora. Como a main atual não contém a seção guides da branch antiga, o preparador adiciona o espaço de artigos apenas na cópia local e substitui somente os espaços de artigos das duas páginas de pintura. Related Calculators permanece preservado. As alterações não foram implantadas na Metricpedia nem no destino.

## 9. Operações exatas para a próxima fase

Ainda não autorizadas automaticamente:

1. Revalidar o código final, gatilhos e estado atualizado dos recursos antes da próxima fase autorizada. A leitura DNS/SSL está concluída por evidências do painel; alterações futuras nesses ajustes exigem escopo próprio.
2. Aprovar uma janela para export consistente do D1 e definir armazenamento privado do SQL. Não publicar dados de agentes/sessões/proprietário no GitHub público. Registrar novo bookmark e manifestos no horário da cópia.
3. Criar somente Pages, Worker, D1 e R2 com os quatro nomes acima, após reconfirmar inexistência; registrar o UUID novo. Sem bindings da origem.
4. Exportar SQL, validar restauração local, copiar schema/dados uma única vez no D1 novo; não aplicar schema inicial em cima de dump completo sem conferir d1_migrations.
5. Copiar os 22 objetos por chave e metadata para o bucket novo; comparar tamanho/SHA-256 e manifesto, incluindo backups auxiliares.
6. Conferir tabelas, versões, IDs, snapshots, revisões, relações e agendamentos. Reconciliar alterações ocorridas na origem após o snapshot, preservando a origem e evitando duplicações.
7. Configurar somente bindings de destino, compilar/publicar noindex sem cron e conectar domínio após validação DNS/SSL. Validar CMS, cards, calculadora, mídias, links, canonicals, sitemap e impressão no ambiente novo.
8. Entregar relatório de integridade ao proprietário e aguardar aprovação posterior para bots, gravações editoriais, cron, indexação e redirecionamentos. Não ativar nada disso durante a cópia inicial.

## 10. Riscos e recuperação

- Mudanças dos bots entre inventário e cópia: atualizar manifestos e reconciliar por IDs/versões; não tratar os números desta inspeção como snapshot final.
- Export D1 bloqueia requisições: exige janela autorizada; não contornar usando produção como teste.
- Backup contém dados sensíveis de operação: SQL privado, sem logs e sem repositório público.
- Prefixo de skip omitido: novo preview possível; para longo prazo separar repositório/Direct Upload do destino.
- UUID errado: configurador rejeita banco de origem; conferir bindings reais antes de deploy, não confiar apenas no template.
- Agenda importada + cron: pode publicar conteúdo vencido; manter cron ausente e bloqueio de escrita até aprovação/reconciliação.
- Falha de cópia: recuperar ou refazer apenas o destino sob autorização, usando SQL e manifesto verificados; não restaurar/reverter a Metricpedia para reparar o destino.
- Fotos com SHA válido: certifica igualdade, não qualidade visual prévia; revisar imagens relevantes no destino.

Fase 1B encerrada para inventário e preparação, com a pendência DNS/SSL resolvida pelos prints do painel. Fase 2 não iniciada. Exportação remota permanece como procedimento preparado, a ser autorizada devido ao bloqueio temporário descrito. Criação dos quatro recursos, cópia D1/R2 e deploys continuam aguardando autorização posterior. Indexação, redirecionamentos e transferência dos bots permanecem fora desta aprovação.
