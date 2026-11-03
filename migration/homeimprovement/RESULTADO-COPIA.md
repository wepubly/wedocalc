# HomeImprovement.tools: infraestrutura e cópia publicadas

Autorização do proprietário: mensagem “autorizados”, após a conclusão da Fase 1B em 03/11/2026.

Estado: infraestrutura independente criada; backup e cópia dos dados concluídos; Worker e Pages publicados em modo de validação. Domínio principal respondendo com HTTP 200 e certificado HTTPS válido, verificado em 03/11/2026 às 22:26 UTC. A API Pages ainda informa associação pending; a verificação funcional do domínio foi concluída.

## Recursos existentes do destino

| Recurso | Identificação |
| --- | --- |
| Pages | homeimprovement-tools |
| Deploy Pages validado | c0cfcec1-78dd-4402-9e2d-d97de29a2f57 |
| Endereço temporário | https://homeimprovement-tools.pages.dev |
| CMS temporário | https://homeimprovement-tools.pages.dev/admin |
| Worker | homeimprovement-editorial |
| Endereço Worker | https://homeimprovement-editorial.alex-b81.workers.dev |
| D1 | homeimprovement-editorial-db |
| UUID D1 novo | 4674c99c-cb26-47af-a557-19f097678ec6 |
| R2 privado | homeimprovement-editorial-media |
| Domínio associado ao Pages | homeimprovement.tools; HTTP 200/HTTPS válido, API ainda pending |

Os bindings reais do Pages e Worker foram consultados e apontam exclusivamente ao novo D1 e ao novo bucket. Pages foi criado sem integração Git, por Direct Upload. O novo Worker não possui cron.

## Conteúdo preservado e validado

- 15 artigos cadastrados e 42 versões; 7 artigos publicados validados por HTTP no destino.
- Todas as 26 tabelas de aplicação tiveram contagens e fingerprints integrais comparados entre origem e destino, com correspondência. IDs, snapshots, revisões, eventos, referências e metadados editoriais foram preservados, sem recriar artigos.
- 22 objetos do R2 copiados, total de 3.907.174 bytes. Incluem as 15 imagens do catálogo e 7 arquivos auxiliares de backup de manutenção.
- Bytes dos 22 objetos conferidos por SHA-256; HTTP metadata e custom metadata comparados. Os arquivos sem Content-Type explícito na origem conservaram essa ausência no destino.
- As 7 imagens dos artigos publicados também foram baixadas pelos endpoints públicos do novo CMS e comparadas ao manifesto de cópia.
- Home, Paint Calculators e Paint Calculator usam o catálogo do novo ambiente. Não há consulta operacional à Metricpedia para preencher os cards.
- Canonicals e referências públicas usam https://homeimprovement.tools; os snapshots editoriais originais permanecem imutáveis.

## Backup e recuperação

Exportação consistente do D1 executada uma única vez, após autorização. O SQL foi restaurado localmente e validado antes da importação. Não houve restauração nem alteração de tabelas da origem.

Backup SQL privado:

- Bucket: homeimprovement-editorial-media.
- Chave: _migration/source-backup.sql.
- Tamanho: 472.540 bytes.
- SHA-256: cb1545a389e613d528d5a4d029be8175cd38ac770eff7ebdc08d81c8e2773c52.
- Bookmark do export: 0000036d-00000000-00005118-8a21463b90b9c72c13d22d83e175e8e3.
- Manifesto de recursos: _migration/resource-manifest.json.
- Manifesto privado da cópia: _migration/copy-manifest.json.

r2.dev está desativado no bucket e não há domínios públicos associados a ele. O SQL e os conteúdos das tabelas de agentes não foram colocados em repositório público ou logs. Os snapshots JSON deste diretório contêm apenas resultados, IDs, contagens e hashes, sem dump de conteúdos privados.

A recuperação deverá usar esse SQL e o manifesto exclusivamente em recursos do destino. Não reverter a Metricpedia para corrigir problemas do novo ambiente. Bookmarks possuem retenção limitada; o SQL privado validado é a cópia independente de recuperação.

## Publicação e proteção

- noindex, nofollow, noarchive no runtime de validação.
- robots.txt retorna duas linhas corretas: User-agent: * e Disallow: /.
- Gravações editoriais POST/PUT/PATCH/DELETE bloqueadas; POST foi verificado remotamente com resposta 423 nos dois runtimes.
- Sem cron e sem publicação automática no destino.
- Bots não transferidos; endpoints e credenciais originais preservados.
- Sem indexação liberada e sem redirecionamentos da Metricpedia.
- Sem mudança das opções de SSL/TLS da zona: os estados observados na Fase 1B permanecem como referência.

O pacote Workers Assets é separado do pacote Pages. O arquivo _worker.js necessário ao Pages não é enviado como arquivo público do Worker. A simulação local de deploy confirmou a separação antes da publicação.

## Evidência de produção da origem

Na verificação final de 03/11/2026, 19:26 Brasília:

- Pages wedocalc permanece no deployment 08983672-ebdc-47a3-b4b7-f246cb9d22be.
- Worker metricpedia-editorial-lab permanece na versão dda5078a-3413-4f91-9f02-e39ad362df43.
- Não houve merge na main nem execução dos workflows de produção da Metricpedia.
- Não foram alterados banco, bucket, cron ou credenciais editoriais da origem. A exportação autorizada foi a única operação de backup no banco de origem e pode bloquear consultas brevemente durante sua execução.

## DNS e HTTPS validados

O proprietário salvou CNAME @ → homeimprovement-tools.pages.dev, proxy ativo e TTL Auto. DNS público passou a responder A e AAAA. Em 03/11/2026 às 22:26 UTC, a verificação externa confirmou:

- https://homeimprovement.tools responde HTTP 200 com noindex, nofollow, noarchive.
- Certificado autorizado pela validação padrão de hostname e cadeia; TLS 1.3, emissor Let's Encrypt, validade de 03/11/2026 a 01/02/2027, cobrindo raiz e wildcard.
- Os sete artigos publicados, canonicals e bytes das sete capas passaram também no domínio principal.
- Gravações permanecem bloqueadas com 423; bindings independentes e ausência de cron confirmados.
- Produção original permanece nos mesmos deployments.

A API Pages ainda retorna status pending, verification_data.status active e validation_data.status pending. Essa pendência administrativa não impediu a resposta HTTPS validada; acompanhar sua convergência sem novo deploy. O www permanece sem configuração. Não foram alteradas opções SSL/TLS, criados redirecionamentos ou transferidos bots.

Evidência: domain-verification.snapshot.json e execução https://github.com/wepubly/wedocalc/actions/runs/41730786951.

## Execuções e incidentes contidos

1. Execução 41728113194: criou D1/R2, exportou/validou backup, importou o D1 e copiou os bytes R2. Parou antes do deploy ao detectar Content-Type implícito em arquivos que não tinham metadata explícita na origem.
2. Execução 41728615571: retomou os recursos existentes, sem repetir export/import, corrigiu metadata R2 e validou os 22 objetos. Criou Pages e parou porque o Wrangler recusou _worker.js dentro da pasta pública de Workers Assets. Não houve exposição desse arquivo: a proteção interrompeu a publicação.
3. Execução 41729206951: reutilizou dados e manifesto, separou os pacotes, publicou o Worker e o Pages e verificou oito rotas 200/noindex e bloqueio de gravação. Concluída com sucesso.
4. Execução 41729835358: verificação independente, somente leitura da infraestrutura e do conteúdo copiado; verificou todos os artigos, imagens, bindings, CMS e estado preservado da produção original. Identificou a pendência de CNAME posteriormente resolvida pelo proprietário. Concluída com sucesso.

Links:

- https://github.com/wepubly/wedocalc/actions/runs/41729206951
- https://github.com/wepubly/wedocalc/actions/runs/41729835358

## Próxima decisão operacional

DNS e HTTPS principal validados; ambiente pronto para avaliação do proprietário. A ativação das gravações editoriais, transferência do Escritor, cron/publicação automática, indexação e redirecionamentos continuam aguardando autorização específica. Como os bots seguem na origem, qualquer conteúdo novo criado depois desta cópia deverá ser reconciliado por IDs e versões antes da transferência operacional.
