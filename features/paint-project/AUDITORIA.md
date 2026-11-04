# Paint Project Planner — Etapa A: auditoria e seleção

Escopo autorizado: auditoria e desenvolvimento isolado. Produção, CMS, cron, bots, banco, bucket e DNS não serão modificados. Nenhum código de fornecedor ou preço comercial será integrado.

## Estado de partida

Repositório: wepubly/wedocalc. O site novo é Direct Upload: não há branch Git que publique automaticamente no HomeImprovement.tools. `main` é a origem do frontend da Metricpedia, não o mecanismo de deploy do novo domínio. A montagem do HomeImprovement está em `migration/homeimprovement/prepare.py`, na branch `work/homeimprovement-copy-prep-20261103`, base desta tarefa `64257dd70531a26461e22564cba72b7de49b53d5`.

Frontend público montado do SHA 3ba04d587568812621ead97287d0d1d98f5693f1; CMS do SHA 7225ec0545cc4602ffec5ca3de30e8ae12ddca82. Última evidência anterior: Pages a5f8ef83-55ec-456a-9841-0750f662501c. A validação desta tarefa faz GET à API Cloudflare e guarda novo snapshot, sem alterar o ambiente.

Recursos independentes existentes: Pages homeimprovement-tools; Worker homeimprovement-editorial; D1 homeimprovement-editorial-db, UUID 4674c99c-cb26-47af-a557-19f097678ec6; R2 homeimprovement-editorial-media. O Worker possui cron * * * * *, preservado. CMS e cards usam esses bindings. A calculadora estática não depende do CMS para fazer contas ou exportar.

| Já existe | Precisa ser desenvolvido |
| --- | --- |
| Paint Needed por área ou quatro paredes retangulares | Portas/janelas por contagem e medidas |
| Paint Coverage e Paint Cost | Teto e primer separados, com cobertura/demãos próprias |
| Unidades ft/m, sq ft/m², US gal/L | Inventário editável e regras de acessórios |
| Margem configurável, validação de números negativos e limites | Lista de compras excluindo itens possuídos |
| URL reproduzível e relatório de impressão | Orçamento por item, custos extras e contingência |
| Print Preview e Save as PDF pelo diálogo do navegador | Downloads diretos Letter/A4, multipágina |
| Design, tema, cards e URL /paint-calculator/ | Seção comercial vazia e desativada |

Não havia download PDF nativo: os botões atuais abrem o diálogo de impressão. Não há motivo para substituir os três modos nem seu relatório operacional. A nova extensão comunica-se com o resultado Paint Needed por evento local; não usa APIs editoriais.

## Repositórios examinados

As árvores e fontes foram lidas pela API GitHub. `research.snapshot.json` guarda árvores, arquivos de licença e ausência de testes no checkout examinado. Ausência de arquivos de teste não equivale a ausência de testes privados.

| Projeto | Licença e dependências declaradas | Implementação e qualidade observadas | Decisão |
| --- | --- | --- | --- |
| [BuildVision](https://github.com/buildvisionai/construction-calculators) | package.json declara MIT; texto MIT em python/LICENSE. Sem dependências runtime no pacote TS; build usa tsup e TypeScript. Não há LICENSE raiz para o pacote TS no snapshot. | Funções TS/Python de perímetro, áreas, primer. Portas/janelas com áreas fixas; preços 25/50 e tempo fixados. No modo métrico, cálculo gera litros mas os campos se chamam gallonsNeeded/primerGallons, e quartsNeeded multiplica litros por quatro. Sem testes no snapshot e sem validação robusta de NaN/negativos. | Não incorporar código. Conversão e preços incompatíveis com a missão; manter módulos próprios com testes. |
| [EstimatorSuite](https://github.com/estimatorsuite/construction-calculators) | MIT com LICENSE completo na raiz. React/React DOM como peers; clsx, lucide-react e tailwind-merge runtime; TypeScript/tsup no build. | Funções puras separadas da UI. Paint inclui custos materiais/mão de obra fixos e primer obrigatório. Limita desconto de aberturas a 50% sem razão geométrica. Campo wallLengthFt corresponde à extensão linear de parede; teto calculado com esse mesmo valor pode confundir se recebido como perímetro. Sem testes no snapshot; typecheck/build não comprovam precisão. | Bom exemplo de separação de dados/UI, mas não reutilizar cálculos, custos ou React na página estática atual. |
| [Home Renovation Planner Java](https://github.com/alstc/home-renovation-planner-java) | MIT com LICENSE completo. Java21/Spring Boot3.2, Web/JPA/Validation, H2, Lombok, starter-test. | CRUD de materiais, quantity/unit/unitPrice e projetos. Serviços usam Double e valores padrão 0.0 para preço. DTO de criação não impõe valor positivo nos campos numéricos. Não é motor de pintura. Não há src/test no snapshot. | Reaproveitar apenas o conceito de modelo, sem copiar código. Java/JPA/H2 exigiriam infraestrutura desnecessária e não rodam diretamente no Worker atual. |
| [RetailerAPI MCP](https://github.com/retailerapi/mcp) | package.json declara MIT, mas não há arquivo LICENSE no snapshot. Depende de MCP SDK e zod; Node20+. | Servidor stdio e cliente HTTP com chave para API comercial externa. Tratamento de HTTP401/429/5xx. Não é banco gratuito de preços nem motor independente. Não há testes no snapshot. | Referência arquitetural somente. Sem instalação, chamadas, credenciais ou integração comercial. |

Reutilização comercial: os projetos com texto MIT completo autorizam uso mediante preservação do aviso e demais condições da licença. Declaração no package.json sem licença distribuída merece confirmação antes de copiar. Esta tarefa não copia nenhum desses códigos; portanto não introduz seus frameworks nem dependências transitivas. A árvore completa de licenças transitivas não foi certificada: seria necessária apenas numa futura adoção, que não está sendo feita. Não confundir licença do cliente MCP com direito de acesso aos dados do serviço externo.

Os módulos novos são originais, sem dependência runtime adicional. Playwright é dependência somente de teste no runner, não embarcada no site. PDF usa um escritor próprio com Helvetica padrão, sem biblioteca ou fonte externa.

## Arquitetura selecionada

1. `math.mjs`: geometria, normalização para sq ft/US gal, validação e volumes separados.
2. `materials.mjs`: recomendações determinísticas, preservação de edições e seleção da compra.
3. `budget.mjs`: subtotais arredondados a centavos; valores ausentes distintos de zero; extras e contingência.
4. `export.mjs`: relatório independente e PDF paginado Letter/A4, com impressão Unicode pelo navegador como alternativa.
5. `planner.mjs` + HTML/CSS: interface acessível e responsiva, sem servidor ou armazenamento remoto.
6. `commercial.mjs`: coleção vazia e validador para futuras recomendações revisadas, disclosure e sponsored. Seção invisível enquanto vazia.
7. `assemble.py`: aplica apenas overlay à cópia do frontend. Não altera Worker, schema ou fluxos editoriais. A demonstração é somente estática, sem bindings.

## Precisão e metodologia

Área paredes=2(L+W)H. Aberturas=contagem×largura×altura; rejeitar desconto >= área bruta. Teto=L×W separado. Volume de cada revestimento=área×demãos/cobertura×(1+desperdício/100). Primer tem cobertura e demãos próprias. Cada tinta é arredondada separadamente para a embalagem escolhida, pois acabamentos podem ser diferentes.

Conversões exatas: 1 ft=0,3048 m; 1 US gal=3,785411784 L. Não usar o arredondamento de compra nos resultados de consumo. Acessórios são sugestões explícitas editáveis, não fórmulas de consumo universais.

Referências técnicas primárias: [Sherwin-Williams](https://www.sherwin-williams.com/en-us/color/color-tools/paint-calculator) e [Behr](https://www.behr.com/how-to/interior/determine-how-much-interior-paint-to-buy) mostram variação de cobertura conforme o produto e a superfície. Por isso a cobertura é configurável e o rótulo do produto tem precedência. Não importar preços ou recomendações comerciais dessas páginas.

## Riscos e limites

- Irregularidades, várias paredes de alturas diferentes e fachadas com frontões: usar o modo por área líquida medida. Modelo detalhado cobre quatro paredes retangulares, não uma casa completa.
- Quantidades de fita, proteção e ferramentas são planejamento aproximado. Não sugerir indiscriminadamente reparos; estes dependem de opção explícita.
- Sem preços preenchidos, exibir Not quoted, nunca orçamento total como se fosse zero. Orçamento parcial é identificado.
- Não persistir o plano automaticamente nem adicionar dados privados à URL. Recarregar descarta as edições do planejador; o relatório pode ser baixado antes.
- PDF direto suporta caracteres latinos/WinAnsi; para outros alfabetos, a interface orienta Print/Save as PDF do navegador. Não substituir caracteres silenciosamente.
- Cron e bots podem criar conteúdo durante a tarefa. Nenhum conteúdo editorial é lido/escrito pela nova ferramenta.
- Produção permanece noindex. A tarefa não autoriza indexação, anúncios, APIs Amazon nem publicação.

## Esforço estimado na seleção

A extensão incremental evita reconstruir o site: aproximadamente 2–3 sessões de desenvolvimento e validação, mais uma revisão visual do proprietário. Integrações comerciais e layouts geométricos irregulares são trabalhos separados. O estágio entregue e os resultados reais estão em ENTREGA.md, sem tratar estimativas como garantia de prazo.

Etapa A concluída; Etapa B iniciada no worktree/branch work/homeimprovement-paint-planner-20261103. Deploy em produção não autorizado.
