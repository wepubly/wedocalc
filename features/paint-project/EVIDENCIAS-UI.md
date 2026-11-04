# Evidências — interface final

Branch: `work/homeimprovement-paint-planner-20261103`.

Código validado: `039e02920d1b0dbc80aaf7e5ed941472d078509b`. Commit desta entrega acrescenta somente documentação e evidências.

- [Execução final aprovada](https://github.com/wepubly/wedocalc/actions/runs/41757181004).
- [Capturas, PDFs e resultados para download](https://github.com/wepubly/wedocalc/actions/runs/41757181004/artifacts/13288399066).
- [Pacote estático completo](https://github.com/wepubly/wedocalc/actions/runs/41757181004/artifacts/13288843075).
- [Quick — desktop](evidence/ui-quick-desktop.png).
- [Quick — mobile](evidence/ui-quick-mobile.png).
- [Planner — desktop](evidence/ui-planner-desktop.png).
- [Planner — mobile](evidence/ui-planner-mobile.png).
- [HTML único interativo](evidence/paint-calculator-interactive-demo.html): baixar o arquivo e abri-lo no navegador. Não requer instalação, conta, chave de API ou servidor. O pacote estático completo também pode ser servido localmente por HTTP.

## Resultado

24 testes unitários e 17 grupos de verificações de navegador aprovados; zero erros JavaScript e zero chamadas externas no demo. Prints e downloads PDF Letter/A4 verificados. O HTML único passou por alternância e PDF no navegador; a execução anterior 41756903537 também verificou a abertura por file://. A execução final valida o mesmo pacote por HTTP isolado.

Cores calculadas no navegador: fundo rgb(241,247,255), botão de cálculo rgb(21,91,212). Quick selecionado inicialmente. Dados dos dois modos permanecem após alternância; preços do modo Cost e medidas avançadas conferidos.

Quatro guias reais conferidos por HTTP200, título e canonical. Os cinco links Related Calculators preservados respondem 200 e levam ao diretório existente, conforme detalhado em UI-FINAL.md. As capturas do Planner contêm preços de USD 1 digitados pelo teste; não são cotações comerciais nem valores pré-preenchidos.

## Produção preservada

Snapshot 2026-11-04T01:54:45.476Z:

- Pages: `a5f8ef83-55ec-456a-9841-0750f662501c` (inalterado).
- Worker: `8e5b8b79-711b-4f56-99ab-e15d93c078e1` (inalterado).
- Cron: `* * * * *` (inalterado).
- Banco e bucket: mesmos bindings exclusivos do HomeImprovement.tools.
- Página pública responde 200, continua noindex e não contém o planejador novo.

Nenhum deploy, alteração de DNS, migração, escrita editorial, edição de artigos ou mudança de cron ocorreu. A aprovação visual e a autorização de publicação continuam pendentes.

