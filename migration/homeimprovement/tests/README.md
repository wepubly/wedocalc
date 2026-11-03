# Testes locais da preparação

Executar a partir de um clone com os commits de origem disponíveis. Nenhum teste usa recursos Cloudflare remotos. Não definir CLOUDFLARE_API_TOKEN para os testes.

1. `python migration/homeimprovement/prepare.py /caminho/isolado`
2. No diretório isolado/cms: `npm ci --ignore-scripts` e `node build-local.mjs`.
3. Instalar dependências de DOM em migration/homeimprovement/tests: `npm install --ignore-scripts`.
4. `node migration/homeimprovement/tests/calculator-dom.mjs /caminho/isolado/site`.
5. `node migration/homeimprovement/tests/validation.mjs /caminho/isolado/cms`.

Somente se Node apresentar exatamente uv_interface_addresses, prefixar o processo de testes com NODE_OPTIONS apontando ao arquivo absoluto tests/local-os-fallback.cjs. Ele não amplia privilégios nem altera o sistema: apenas fornece loopback à descoberta de portas do runner se a enumeração do Node estiver indisponível. Não copiar esse preload para o deploy.

Para navegador nativo, instalar Playwright/Chromium em ambiente local/CI adequado e usar BROWSER_TEST=1. HI_PLAYWRIGHT_PATH pode indicar o módulo instalado. O teste gera PDFs Letter/A4 somente em memória; nenhuma publicação ou upload é realizado. O download local veio truncado, mas essa parte passou no runner isolado do GitHub Actions: execução 41721961113, sem credenciais Cloudflare.

O teste production.mjs do CMS original foi executado com sucesso em diretório separado e D1/R2 locais. Ele exerce gravações apenas em fixtures locais para verificar o fluxo original; o wrapper de validação do destino bloqueia as gravações.
