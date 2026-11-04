# Paint Project Planner — entrega isolada

Atualização visual final ao protótipo aprovado: [UI-FINAL.md](UI-FINAL.md), com [evidências atualizadas](EVIDENCIAS-UI.md). A apresentação anterior abaixo foi substituída pela interface Quick/Planner, preservando os motores.

Status: desenvolvimento isolado concluído; produção não publicada. O proprietário deve aprovar a interface e autorizar o deploy separadamente.

Branch: `work/homeimprovement-paint-planner-20261103` (repo `wepubly/wedocalc`). A referência exata do código validado está em validation.snapshot.json e na execução final do Actions vinculada abaixo. Não foi feito merge em main.

## Alterações

Preservados os três modos existentes (Paint Needed, Paint Coverage, Paint Cost), seus campos, fórmula base, link compartilhável e Print Preview. O modo Paint Cost deixa de iniciar com 38/25 dólares preenchidos: os campos passam a iniciar vazios para respeitar a missão. Seus cálculos continuam disponíveis ao preencher os preços.

Adicionado planejador na mesma URL, com duas fontes: resultado de Paint Needed ou quatro paredes retangulares detalhadas. Portas e janelas possuem contagem, largura e altura; teto e primer têm cobertura/demãos próprias. Unidades imperiais por padrão, métricas conversíveis, percentual de desperdício e tamanho de embalagem editáveis. Não tratar a embalagem inteira como consumo exato.

Inventário determinístico em consumíveis, ferramentas reutilizáveis e opcionais: edição de quantidades/preços, posse, seleção, remoção e materiais novos. Reparos só aparecem quando escolhidos. A lista de compras exclui itens possuídos, salvo opção de visualização explícita; mesmo exibidos, esses itens não geram cobrança no orçamento.

Preços inicialmente vazios, orçamento parcial identificado, subtotais em centavos, adicionais e contingência. Não há preços de fornecedores, mão de obra automática, IA, APIs comerciais ou cadastro. Toda a nova lógica funciona no navegador.

Relatório completo com nome do projeto, data, medidas, premissas, volumes separados, inventário, compras, preços e orçamento. Print preserva texto Unicode; downloads PDF diretos Letter/A4 são paginados e independentes de APIs/fontes externas. PDFs não são páginas indexáveis.

Seção comercial reservada e invisível. Nenhum produto, anúncio, review ou link comercial fictício. Módulo futuro exige revisão/disclosure e prepara rel=sponsored. As regras Amazon devem ser revalidadas quando houver integração real: nenhuma chave ou API foi adicionada agora.

## Arquivos

Todos os arquivos novos ficam em `features/paint-project/`:

- `math.mjs`, `materials.mjs`, `budget.mjs`: módulos reutilizáveis sem dependências.
- `export.mjs`: relatório, impressão e escritor PDF.
- `planner.mjs`, `planner.html`, `planner.css`: interface e estado de sessão em memória.
- `commercial.mjs`: estrutura comercial desativada.
- `assemble.py`: overlay local; não altera arquivos existentes do repositório.
- `inspect-production.mjs`: somente GET de metadados Cloudflare e página pública.
- `tests/engine.test.mjs`, `tests/browser.mjs`: testes de matemática e navegador.
- `AUDITORIA.md`, `research.snapshot.json`, `validation.snapshot.json`: seleção e evidências.
- `evidence/`: capturas da interface de teste, quando disponíveis.

Workflow novo: `.github/workflows/homeimprovement-paint-project.yml`, limitado à branch e aos arquivos desta tarefa; somente testes e inspeção GET. Não contém deploy, migração, exportação D1 ou escrita R2. Commits usam [CF-Pages-Skip] para evitar build preview no Pages antigo.

## Licenças

Nenhum código dos quatro repositórios pesquisados foi incorporado. Não há dependência runtime nova; os módulos são originais. Licenças e limitações dos candidatos estão em AUDITORIA.md. Playwright é ferramenta de teste somente no runner, ausente do pacote público. Nenhum serviço comercial foi contratado.

## Testes e demonstração

24 testes unitários passaram: cálculo documentado de área, teto/primer, equivalência métrica, entradas inválidas, aberturas sem limite arbitrário, arredondamento separado por embalagem, sugestões, preservação de edições, posse, preços ausentes/zero, centavos, extras/contingência e estrutura PDF.

Testes reais em Chromium: três modos anteriores, erro de entrada, ligação do novo planejador ao resultado antigo, materiais possuídos, inclusão/remoção e proteção contra HTML de usuário, dimensões detalhadas, conversão ida/volta, orçamento completo, downloads diretos Letter/A4, impressão, desktop1440/celular390 sem overflow, campos novos rotulados, ordem de foco, canonical único e noindex. Nenhum erro JavaScript.

O teste bloqueia rede externa. Somente a foto de cabeçalho Pexels já existente tentou carregar; os módulos novos não acessam fornecedores ou IA. Não é uma integração comercial nova. O relatório de rede está no snapshot.

Os PDFs unitários foram abertos pelo extrator pdftotext localmente: áreas, volumes, preços ausentes e orçamento presentes. Os PDFs de navegador, capturas desktop/celular e JSON dos testes estão no artifact `paint-project-evidence`. O artifact `paint-project-offline-demo` contém o site estático de demonstração, sem CMS funcional, DB/R2 ou bindings.

Para rodar a demonstração: extrair o ZIP, executar `python -m http.server 8080` na pasta extraída e abrir `http://localhost:8080/paint-calculator/`. Abrir por file:// não carrega os módulos ES. Não foi criado domínio ou preview remoto no projeto de produção.

## Limitações explícitas

- Modelo detalhado retangular, contagens com dimensões compartilhadas; para aberturas de tamanhos diferentes/áreas irregulares usar a área líquida medida no cálculo existente.
- Acessórios são planejamento editável, não consumo universal. Uma equipe maior precisa ajustar ferramentas e materiais.
- Não há persistência automática. Recarregar perde o plano; exportar antes de sair.
- Preços são por unidade de compra exibida. Ao mudar tamanho/unidade de embalagem, cotações incompatíveis são limpas e precisam ser preenchidas novamente.
- Download PDF direto suporta caracteres latinos/WinAnsi. Outros alfabetos recebem orientação para Print/Save as PDF, sem substituir texto silenciosamente.
- Verificação de acessibilidade cobriu rótulos e teclado nos campos novos; não substitui auditoria WCAG completa ou uso com leitores de tela.
- Falta a aprovação visual do proprietário e o deploy autorizado. Nenhuma pendência funcional conhecida nos casos testados.

## Procedimento futuro de publicação — NÃO EXECUTADO

1. Reconfirmar a versão aprovada da branch, deployment atual Pages e bindings exclusivos. Reconsultar Worker/cron, sem modificá-los.
2. Guardar ID do deployment Pages atual para rollback. Referência observada nesta tarefa: a5f8ef83-55ec-456a-9841-0750f662501c.
3. Montar com `python features/paint-project/assemble.py /tmp/paint-project-approved`.
4. No CMS montado, instalar dependências existentes e executar `node build-local.mjs`. Revalidar o pacote e noindex. O script incorpora o frontend com overlay e o runtime já aprovado; não exige deploy do Worker nem mudança de banco.
5. Somente após autorização: Direct Upload de `dist` para Pages `homeimprovement-tools`, branch de produção `main` do Pages (não é merge na branch main do GitHub). Preservar todas as variáveis/bindings, inclusive HI_EDITORIAL_WRITES e HI_EDITORIAL_CRON. Não executar workflows de migração/produção da Metricpedia.
6. Validar calculadora, PDFs, CMS HTTP200, cron ainda * * * * *, noindex e cards. O deployment Worker e o cron devem permanecer idênticos.

Rollback: reativar o deployment Pages guardado, sem tocar Worker, cron, D1, R2, artigos ou agendamentos. Como a feature não grava dados no servidor, não há migração/recuperação de banco. O plano aberto no navegador pode ser exportado antes do reload.

A produção é Direct Upload; commits desta branch não publicam o novo site. Não liberar indexação ou adicionar anúncios como consequência desta entrega.
