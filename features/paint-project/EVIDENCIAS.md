## Evidências finais

- Código validado: `3a1736f9a8dfffad82212506b816c8eb9ebb45cb`.
- Execução aprovada: https://github.com/wepubly/wedocalc/actions/runs/41749155322.
- Capturas desktop/celular, PDFs e resultados: https://github.com/wepubly/wedocalc/actions/runs/41749155322/artifacts/13285630966.
- Demonstração estática para baixar: https://github.com/wepubly/wedocalc/actions/runs/41749155322/artifacts/13285256713.
- Captura desktop persistente: [evidence/planner-desktop.png](evidence/planner-desktop.png).
- Na captura, os valores de USD 1 foram digitados pelo teste para exercitar o orçamento; não representam preços de produtos ou fornecedores. Os campos reais iniciam vazios.
- Snapshot de produção em 2026-11-04T00:45:40.694Z: Pages a5f8ef83-55ec-456a-9841-0750f662501c; Worker 8e5b8b79-711b-4f56-99ab-e15d93c078e1; cron * * * * *. O novo planejador não está na produção.

Incidentes de verificação resolvidos: o runner ubuntu-latest passou a usar Ubuntu26.04, incompatível com a versão fixada do Playwright; a execução foi fixada em Ubuntu24.04. O bloqueio de rede identificou a foto Pexels já existente; o teste passou a registrar essa dependência anterior, mantendo bloqueadas as chamadas externas. Não houve deploy ou alteração de produção para contornar testes.
