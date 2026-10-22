# Metricpedia Editorial Center — homologação

Implementação isolada baseada no CMS de blog do Ublong. Não altera o site estático nem instala rotas no domínio oficial.

- [Arquitetura e isolamento](docs/ARCHITECTURE.md)
- [Acesso e deploy](docs/ACCESS_AND_DEPLOY.md)
- [Contrato para o Supervisor Grok](docs/GROK_API.md)

```sh
cd cms
npm ci
npm run check
npm run build
npm test
```

O teste usa D1/R2 locais em `.wrangler/test-state`, credenciais aleatórias apenas de teste e apaga `.dev.vars` de teste ao terminar. Não execute com um `.dev.vars` de desenvolvimento existente. Para desenvolvimento, use outro estado (`npx wrangler dev --config wrangler.local.json`) e configure SETUP_TOKEN no arquivo ignorado `.dev.vars`. O setup exige a chave e a senha escolhida por você; não há senha padrão.

O workflow da branch verifica código e integração, inspeciona permissões e provisiona apenas os recursos de staging Metricpedia. Publicação de produção é excluída desta configuração. Todos os retornos de staging bloqueiam indexação.
