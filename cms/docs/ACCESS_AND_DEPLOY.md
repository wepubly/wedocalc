# Acesso e conclusão do deploy

## Secrets e permissões

GitHub → `wepubly/wedocalc` → Settings → Secrets and variables → Actions → Repository secrets.

1. Atualizar `CLOUDFLARE_API_TOKEN` (não criar outro de mesmo nome) se as chamadas D1/R2 retornarem erro 10000. No Cloudflare → My Profile → API Tokens → token utilizado → Edit: conta `b81896777d206a2239625d9cf2e8a40b`, permissões Account / Workers Scripts / Edit, D1 / Edit, Workers R2 Storage / Edit; manter Cloudflare Pages / Edit para os workflows já existentes. Não restringir a IP incompatível com GitHub runners.
2. Criar `METRICPEDIA_SETUP_TOKEN`: chave temporária escolhida por você, 24+ caracteres, usada só para abrir o primeiro cadastro. Não é a sua senha administrativa. Não envie pelo chat.
3. Account ID já está no workflow. `PUBLIC_ORIGIN`, `ENVIRONMENT` e IDs D1/R2 são gerados após consulta real; não precisam de secrets de frontend.

Após atualizar secrets, em Actions → Metricpedia CMS staging → execução da branch → Re-run failed jobs. Se verify já passou, ele é reaproveitado. O workflow só cria recursos com os nomes específicos de homologação. O relatório final mostra o endereço real.

## Cadastrar sua própria senha

Abra o endereço de staging devolvido pela execução, `/admin/setup`. Informe a chave temporária `METRICPEDIA_SETUP_TOKEN`, escolha um usuário e sua senha de 12+ caracteres. Em seguida entre em `/admin/login`. Depois do primeiro cadastro o endpoint inicial fica fechado, mesmo que o segredo continue configurado. Remova o secret temporário do GitHub quando terminar; isso não remove o proprietário nem sua senha. Em Acesso e agentes é possível alterar a senha, encerrando as sessões existentes.

Sem SETUP_TOKEN, o Worker pode estar implantado, mas o cadastro fica bloqueado. Não há uma senha padrão nem administrador público de primeiro acesso.

## Primeiros passos

1. Cadastre o briefing aprovado (ID, palavras-chave, circuito e calculadora).
2. Crie uma credencial de escritor com `submit` e `status`, entregue no cofre seguro do agente.
3. Envie um pacote de homologação conforme GROK_API.md.
4. Confira a versão recebida. Confirme a aprovação já feita no Grok usando o hash/evidência, ou valide uma credencial independente do Supervisor.
5. Agende usando horário Brasília. O armazenamento e a API usam ISO UTC/com offset.
6. Confira blog, logs, noindex e publicação. Testes devem ter título TEST ONLY.

Não há recuperação automática de senha por e-mail nesta versão. Não publicar em produção nem remover bloqueios de indexação por este workflow.
