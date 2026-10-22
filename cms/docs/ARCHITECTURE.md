# Responsabilidades editoriais — adendo vigente

Somente o **Escritor** opera o CMS e suas APIs. Auditor e Supervisor atuam exclusivamente no grupo Grok. A aprovação é uma decisão externa: o Escritor registra sua referência, versão e hash; o CMS verifica esses dados antes de agendar ou publicar. Não há painel independente de aprovação nem login novo nesta fase.

O Auditor revisa os artigos e testa a calculadora no Grok. O Supervisor verifica a operação uma vez por dia por meio dos relatórios compartilhados nesse grupo, sem credencial de CMS. Este sistema não envia mensagens ao grupo nem cria uma integração para esses agentes.

## Credencial do Escritor

Gerar no painel uma credencial com `submit`, `status`, `authorize` e `schedule`. O escopo `authorize` registra a aprovação recebida; não substitui a decisão editorial externa. Credenciais antigas sem `submit` são desativadas pela migração. O token é apresentado uma única vez e enviado em `Authorization: Bearer TOKEN`. Não é necessário login interativo no ambiente editorial de produção existente.

## API operacional do Escritor

| Método e rota | Uso |
| --- | --- |
| `POST /api/integration/packages` | Cadastrar ou atualizar uma versão imutável, SEO e links internos; manter o contrato de pacote existente e a chave de idempotência. |
| `POST /api/integration/media` | Enviar imagem binária com nome, texto alternativo, origem e licença nos cabeçalhos existentes. |
| `GET /api/integration/articles/:id` | Consultar versão, hash, aprovação e situação do artigo. |
| `POST /api/integration/articles/:id/authorize` | Registrar `{version, digest, evidence}` da aprovação recebida no Grok. |
| `POST /api/integration/articles/:id/submit-review` | Registrar envio da versão para revisão externa. |
| `POST /api/integration/articles/:id/request-changes` | Registrar correções solicitadas no Grok. |
| `POST /api/integration/articles/:id/schedule` | Agendar `{version, runAt}`; data ISO com fuso explícito. |
| `POST /api/integration/articles/:id/reschedule` | Alterar a data com `{version, runAt}`; cancela o agendamento anterior e revalida a aprovação. |
| `POST /api/integration/articles/:id/cancel` | Cancelar o agendamento da `{version}` atual. |
| `GET /api/integration/schedules` | Consultar fila, datas e status para relatórios. |
| `GET /api/integration/briefs` | Consultar briefings autorizados. |
| `GET /api/integration/routes` | Consultar categorias e calculadoras existentes. |
| `POST /api/integration/calculator-audits` | Registrar a auditoria externa da calculadora. |
| `GET /api/integration/campaigns?calculatorId=ID` | Consultar elegibilidade e histórico da campanha. |
| `POST /api/integration/campaigns/activate` | Ativar a fila com `{calculatorId, startDate}`. |
| `POST /api/integration/campaigns/cancel` | Cancelar a campanha `{id}` e os itens ainda na fila. |

O registro da auditoria exige `calculatorId`, `formulaChecked`, `testInputs`, `expectedResult`, `observedResult`, `auditor`, `verdict` (`passed`/`failed`) e `approvalReference` (referência da mensagem no Grok); `notes` é opcional. A referência identifica a evidência externa, sem alegar verificação automática do grupo.

## Controles preservados

A aprovação corresponde à versão e ao hash exatos. Uma edição cria outra versão e cancela os agendamentos anteriores. A campanha exige exatamente sete artigos aprovados de cada circuito, quatorze no total, e a última auditoria aprovada com referência no Grok. Auditorias legadas continuam preservadas, mas precisam de novo registro com referência antes de ativar outra campanha. Agendamentos existentes não são apagados pela migração.

A Central de Publicações mantém a consulta de artigos agendados e publicados pelo proprietário e a gestão de agendamentos pelo Escritor. A supervisão usa relatórios compartilhados no Grok. Não foram criados endpoints operacionais para Auditor ou Supervisor.

## Deploy

Usar o fluxo de produção editorial existente `.github/workflows/cms-production-lab.yml`, acionado pela branch `work/metricpedia-cms-blog-v1`. O nome histórico do Worker contém `lab`, mas este é o ambiente editorial já publicado, sem criação de staging ou infraestrutura adicional nesta mudança. A configuração sem login e as proteções contra indexação existentes são preservadas. Não mudar o site estático, o domínio ou o roteamento de publicação sem necessidade desta missão.
