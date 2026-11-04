# Paint Calculator — ajuste final ao protótipo aprovado

Entrega exclusivamente na branch `work/homeimprovement-paint-planner-20261103`. Nenhum deploy em produção. Esta etapa continua o planejador anterior e substitui sua apresentação visual; não recria os motores.

## Aparência e organização

- Retirado o banner CALCULATOR-TOP-01 e as regras locais antigas de fundo cinza/botão amarelo.
- Introdução curta, fundo azul suave, cards brancos, destaques azuis, bordas arredondadas e espaçamento conforme `reference-approved.html`, arquivo original enviado pelo proprietário.
- Dois cards: Quick Calculator — Simple & Fast e Project Planner — Advanced. Quick selecionado inicialmente; aria-pressed/aria-controls e painéis ocultados pelo atributo hidden.
- Quick preserva Paint Needed, Paint Coverage, Paint Cost, formulários e ações antigas de compartilhamento/Print Preview. Results ao lado no desktop e abaixo no celular.
- Project Planner utiliza os módulos existentes de geometria, recomendações, compras, orçamento, relatório e PDFs. Medidas e Results lado a lado no desktop; checklist e compras/orçamento em dois painéis inferiores.
- Trocar de modo não recria formulários nem reinicializa campos, cotações ou materiais. O planejador pode usar o último resultado válido Paint Needed, inclusive após visualizar Coverage/Cost. Uma entrada inválida em Paint Needed invalida essa transferência, sem usar um cálculo antigo silenciosamente.
- Mantido o tema escuro quando selecionado pelo visitante, com o claro como aparência inicial aprovada.

## Seções inferiores e links

Grid de três colunas no desktop: How Paint Calculation Works; Related Calculators; Popular Paint Guides. Dicas foram resumidas na primeira coluna, sem manter a antiga seção duplicada. FAQ original com três perguntas/respostas, elementos expansíveis e largura completa abaixo do grid. Header/footer existentes preservados; nenhuma seção institucional da Home foi adicionada.

Related Calculators conserva os cinco links existentes, que levam ao diretório /paint-calculators/ (HTTP200). Não foram inventadas páginas dedicadas de calculadoras que ainda não existem; essa é uma limitação anterior preservada, não um link novo quebrado.

Popular Paint Guides mantém exatamente o seletor `data-hi-cards="calculator"`, usado pelo runtime atual. Não houve edição no runtime/Worker ou no CMS. Para tornar a demonstração realista, o helper `demo-guides.mjs` consulta somente /blog/ e artigos/imagens já públicos, seleciona os quatro guias relacionados pelo catálogo existente, verifica HTTP200, título e canonical e copia as capas para o pacote da demonstração. Essa população acontece somente na cópia `demo`; os arquivos `site` mantêm a integração dinâmica de produção. Não são lidas APIs editoriais nem dados privados.

## Arquivos desta etapa

- Alterados: `assemble.py`, `planner.html`, `planner.mjs`, `tests/browser.mjs`.
- Adicionados: `mode-selection.html`, `page-shell.css`, `page-shell.mjs`, `reference-approved.html`, `demo-guides.mjs`, `standalone.py`.
- Atualizado somente o workflow de testes isolados `.github/workflows/homeimprovement-paint-project.yml`.
- Evidências: `ui-validation.snapshot.json`, capturas em `evidence/`, demonstração interativa em HTML único.

`math.mjs`, `materials.mjs`, `budget.mjs` e `export.mjs` permanecem sem alteração nesta missão. Sem mudança em outras calculadoras, URLs, redirects, banco ou bucket. Nenhuma migração, novo sistema de acesso ou integração comercial.

## Verificação

Os 24 testes matemáticos anteriores permanecem. O teste Chromium cobre Quick inicial, seleção dos dois modos, três modos simples, preservação dos preços e medidas ao alternar, geometria avançada, teto/primer, inventário, posse, orçamento, impressão, PDFs Letter/A4, compartilhamento/Print Preview antigo, grid inferior, FAQ, foco/rótulos, canonical único, noindex e desktop/celular sem overflow. Inclui verificação das cores calculadas pelo navegador para o azul aprovado.

O protótipo original simplificava fórmulas e usava alertas para PDF. Nenhum desses cálculos ou alertas demonstrativos foi adotado: os resultados e downloads continuam reais.

Limites anteriores do modelo retangular, quantidades aproximadas de acessórios e PDF direto com caracteres latinos continuam descritos em ENTREGA.md. As capturas usam valores digitados pelo teste para exercitar o orçamento; não representam preços comerciais. Não há preço pré-preenchido no produto.

## Demonstração interativa

O pacote estático completo é testado por HTTP no runner. Também é gerado um HTML único, com CSS/JS/imagens embutidos, para baixar e abrir diretamente no navegador sem instalação ou servidor. O HTML de demonstração não possui CMS, credenciais, bindings ou chamadas de rede. Os links externos abrem as páginas públicas correspondentes. Nesse arquivo portátil, o Print rápido usa a opção de impressão em página já existente na biblioteca compartilhada; no pacote de publicação, permanece o Print Preview original.

Nenhum endereço de preview remoto foi criado ou publicado. A demonstração para baixar e as capturas permitem a aprovação visual sem tocar na produção. A publicação continua condicionada a nova autorização expressa.

## Publicação e reversão futuras

Após aprovação, montar com `assemble.py`, executar o build existente e Direct Upload somente no Pages homeimprovement-tools, preservando variáveis e bindings. Não publicar o Worker nem alterar cron. Guardar o deployment Pages atual; em caso de falha, reativá-lo sem restaurar dados. O procedimento detalhado anterior está em ENTREGA.md. Nada disso foi executado nesta etapa.

Evidências finais, código validado e arquivos para revisão: [EVIDENCIAS-UI.md](EVIDENCIAS-UI.md).
