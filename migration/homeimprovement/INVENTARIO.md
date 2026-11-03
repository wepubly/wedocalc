# HomeImprovement.tools: inventário e preparação isolada

Inspeção em 03/11/2026, 18:03 (Brasília). Autorização: leitura e preparação, sem criar infraestrutura ou publicar o destino.

## Evidências confirmadas

- GitHub: wepubly/wedocalc. Main 3ba04d587568812621ead97287d0d1d98f5693f1; CMS 7225ec0545cc4602ffec5ca3de30e8ae12ddca82; cards 2c252b7e8d0234ca8df571a866ad97cff1cc4986.
- Pages wedocalc: produção canônica 08983672-ebdc-47a3-b4b7-f246cb9d22be, criada em 23/10/2026. Seu hash é o do CMS, porque o workflow combina front-end da main e CMS de outra branch; não se deve tratar esse SHA como uma árvore única idêntica ao site montado. Domínios: metricpedia.com, wedocalc.com, www.wedocalc.com e wedocalc.pages.dev.
- Worker metricpedia-editorial-lab: versão ativa dda5078a-3413-4f91-9f02-e39ad362df43, deployment cd6e1ab4-3246-40f4-980c-c96d63265fe4 de 23/10/2026. Bindings DB e MEDIA coincidem com Pages produção.
- D1 metricpedia-editorial-lab-db: 1c9862e9-9824-4dbb-9d42-0c2a52ed1ae5, 757.760 bytes, ENAM.
- R2 metricpedia-editorial-lab-media: ENAM, Standard.
- PUBLIC_ORIGIN da origem: https://metricpedia.com; ENVIRONMENT production.
- Cron ativo: * * * * *. Rotina publica versões aprovadas e agendas vencidas, cancela agenda de versão desatualizada e registra falhas.
- 15 artigos; 7 publicados; 42 versões; 121 eventos editoriais. Zero referências publicadas sem versão correspondente na checagem realizada.
- Revisão da versão atual: 9 approved, 6 sem revisão (draft), zero review/changes. Essas contagens se sobrepõem aos publicados; não somar como estados mutuamente exclusivos.
- Agendas: zero queued, 7 published e 1 cancelled, nenhuma com last_error. Não há fila pendente a transferir nesse instante.
- 15 imagens cadastradas em media, 3.676.193 bytes. Isto é o catálogo D1, não uma contagem física completa do bucket. Relação de chaves no snapshot.
- Rotas live: Home & Garden > Paint Calculators > Paint Calculator. Caminhos originais preservados na cópia.
- Cards: branch de preview independente, com leitura do blog público da Metricpedia. Não consta integrada à main; sua implantação no destino exige substituir a dependência da origem por leitura do novo ambiente.

## Token existente e pendências

CLOUDFLARE_API_TOKEN existe e está ativo. Consultas bem-sucedidas: Pages, Workers/scripts/settings/deployments/crons, D1/listagem/metadados/SELECT, R2/listagem e metadados, Zone da homeimprovement.tools. Não foram testadas permissões de escrita criando ou alterando recursos. Sucesso de leitura não comprova autorização de criação.

homeimprovement.tools: zona ativa 073f0a447d0b8f87ca17fe20ceed2eb0, mesma conta b81896777d206a2239625d9cf2e8a40b, nameservers asa.ns.cloudflare.com e josh.ns.cloudflare.com.

Consultas negadas: DNS records HTTP 403/código 10000; SSL verification e SSL setting HTTP 403/código 9109. Para concluir a leitura, o escopo necessário corresponde a DNS Read, SSL and Certificates Read e Zone Settings Read na zona homeimprovement.tools. A política completa do token não foi recuperada, portanto as negações também podem refletir restrição de recursos. Não foi solicitado nem criado token novo.

Ainda pendente: inventário físico R2 (objetos órfãos, arquivos auxiliares, checksums e leitura binária), bookmark de recuperação D1/export consistente, verificação dos hashes de aprovação e todas as referências, conteúdo efetivo do Worker versus código candidato. O snapshot registra IDs/versões de recuperação, mas não substitui backup. A cópia deve revalidar o estado, pois os bots continuam operando.

## Incidente de preview automático

A criação da branch work/homeimprovement-copy-prep-20261103, usada apenas para executar a inspeção read-only no Actions, disparou uma implantação preview automática pela integração Git do Pages existente. Identificador observado f729b21a-0673-4b21-94b6-830c3ac0c874, URL https://f729b21a.wedocalc.pages.dev. No instante do inventário, o deploy preview estava ativo; a produção canônica seguia no deploy anterior. Não foi executado cms-production-lab.yml, não houve merge, alteração de bindings ou escrita no D1/R2 por nossa rotina. O preview tem bindings vazios segundo a configuração consultada. Não houve solicitação de exclusão nem mudança de configuração para suprimi-lo.

Novas atualizações dessa branch estão suspensas. Os arquivos adicionais foram preparados localmente; sua preservação em um commit sem atualizar refs evita outro gatilho de branch. Antes de qualquer push futuro, é necessário excluir a branch da implantação automática ou escolher outro repositório isolado, mediante autorização para a configuração correspondente.

## Alvos propostos, nenhum criado

| Recurso | Nome/endereço |
| --- | --- |
| Pages | homeimprovement-tools |
| Worker | homeimprovement-editorial |
| D1 | homeimprovement-editorial-db, novo UUID obrigatório |
| R2 | homeimprovement-editorial-media |
| Site | https://homeimprovement.tools |
| CMS | https://homeimprovement.tools/admin |
| Cron de destino | nenhum |
| Indexação | noindex, nofollow, noarchive |

Não modificar wedocalc, metricpedia-editorial-lab, DB/bucket da origem ou endpoints/credenciais dos bots. Conferir colisões de nomes e disponibilidade antes de provisionar.

## Preparação técnica local

prepare.py monta site da main fixada e CMS fixado em diretório novo, remove scripts de operação da origem da cópia e não altera o checkout ou faz rede. validation.ts envolve o runtime existente, aplica noindex a todas as respostas e bloqueia métodos de gravação. Não exporta scheduled. Canonicals, sitemap e referências textuais públicas à origem são normalizados apenas na renderização para preservar snapshots e hashes. O CMS abre para leitura durante a validação; gravação e publicação deverão ser testadas posteriormente com autorização em recursos independentes.

wrangler.template.json contém nomes de destino e UUID deliberadamente inválido até provisionamento. configure-isolated.mjs rejeita UUID do D1 original e nomes divergentes; produz configuração local apenas. build-local.mjs compila CMS e combina seus assets com o front-end, sem deploy.

Esta preparação não é um pacote pronto para produção: faltam cópia D1/R2, bindings remotos novos, configuração do novo Pages, adaptação dos cards, acabamento da marca (inclusive logos raster), validação completa de links e políticas de canonical do conteúdo legado. Não executar scripts configure-production, provision-production-lab ou workflows existentes para migrar.

## Próxima fase após completar inspeção e obter aprovação

1. Confirmar DNS/SSL, leitura física R2 e estado atualizado da origem; registrar backup/bookmark consistente e manifestos com hashes.
2. Aprovar exclusivamente os alvos acima e o método sem gatilhos do Pages de origem.
3. Criar D1/R2 independentes; copiar preservando IDs, snapshots, versões e histórico. Não reescrever snapshots aprovados; referências públicas devem ser normalizadas na saída ou passar por nova versão/revisão.
4. Comparar tabelas, contagens, relacionamentos, aprovações e bytes/checksums dos objetos; copiar arquivos auxiliares além de media se existirem.
5. Publicar o destino noindex sem cron; validar CMS, calculadora, impressão, imagens, rotas e cards usando somente os novos bindings.
6. Transferência dos bots, publicação automática, indexação e redirecionamentos exigem aprovação expressa posterior. Não importar uma agenda vencida e ativar cron sem reconciliação.

## Verificações executadas

- Sintaxe Node dos scripts: passou.
- Montagem local por SHAs fixos: passou.
- TypeScript CMS incluindo wrapper: passou.
- Build Vite e bundle esbuild do wrapper: passaram.
- Teste existente author-profile.mjs: passou, incluindo snapshot legado imutável.
- Configurador isolado: rejeitou ID do D1 da origem e gerou configuração sem cron para ID fictício de teste.
- Teste existente production.mjs: bloqueado antes de iniciar pelo erro local do Wrangler uv_interface_addresses; não houve validação funcional de CMS/calculadora em runtime nem deploy de teste no destino. Não interpretar build aprovado como validação da migração.


Continuidade: consultar FASE-1B.md para inventário físico R2, correção dos testes, PDF Letter/A4 aprovado em CI isolada e demais evidências posteriores. Este documento preserva o registro da primeira inspeção.
