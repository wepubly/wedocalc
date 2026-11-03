# Procedimento preparado: backup e recuperação

Nenhum comando de exportação, importação ou restauração foi executado remotamente nesta fase.

## Estado registrado

Inspeção 03/11/2026 18:15:54 Brasília. D1 origem 1c9862e9-9824-4dbb-9d42-0c2a52ed1ae5. Bookmark obtido por GET:

`0000036c-00000000-00005118-aeb7a81f66dde719778f6f5ddc36ca29`

Esse bookmark é temporário e sujeito à retenção do plano. Antes da cópia, registrar outro bookmark e gerar backup independente. Não usar este identificador como garantia de recuperação indefinida. Snapshot, manifestos e hashes de arquivos não são um dump do D1.

## Exportação consistente proposta, exige autorização

A documentação oficial informa que uma exportação em andamento bloqueia outras requisições do banco. Portanto, não a executar sem autorização específica para o bloqueio temporário, uma janela combinada e procedimento de retomada dos bots. Não prometer interrupção zero ao utilizar esse método.

Fonte: https://developers.cloudflare.com/d1/best-practices/import-export-data/#known-limitations-1

Com aprovação posterior, usar a versão de Wrangler validada e configuração contendo exclusivamente o D1 de origem para esta exportação:

```sh
npx wrangler d1 export metricpedia-editorial-lab-db --remote --config source-read-export.json --output metricpedia-source.sql
sha256sum metricpedia-source.sql
```

Apenas procedimento, não executado. O arquivo source-read-export.json ainda deve ser preparado e revisado com account_id e database_id exatos; nunca reutilizar o configurador de produção para isso. Alternativa REST oficial: POST /accounts/{account}/d1/database/{db}/export, receber at_bookmark, consultar progresso e baixar signed_url. Não registrar signed_url nos logs; ele é um acesso temporário ao backup. Não testar permissões de exportação iniciando export sem aprovação.

Guardar SQL e manifesto em destino privado, com acesso limitado, nunca no repositório público nem em logs de Actions. O banco contém tabelas de agentes, sessões e proprietário. Não alterar ou ampliar credenciais para copiar. Definir o destino privado do backup antes da exportação.

## Verificação anterior a qualquer importação remota

1. Confirmar que o export foi concluído e preservar seu at_bookmark, horário e SHA-256.
2. Restaurar uma cópia em SQLite/local D1 temporário e exclusivo, sem rede de produção. Comparar estrutura, todas as tabelas de aplicação e contagens. O motor _cf_KV é reservado; não reconstruí-lo manualmente.
3. Conferir article_versions.snapshot byte a byte e também o SHA-256 de JSON.stringify(JSON.parse(snapshot)), que corresponde à normalização usada pelo endpoint editorial. Não editar versões aprovadas, histórico ou hashes para trocar domínio.
4. Comparar referências publicadas/rascunhos, editorial_reviews por article_id/version, submission_versions, external_approvals, eventos, rotas, campanhas, termos, pautas e agendamentos. Inspeção atual: external_approvals tem zero linhas. As 9 aprovações atuais estão em editorial_reviews, por versão. Não interpretar zero hashes externos como auditoria criptográfica de aprovações concluída.
5. Comparar os 22 objetos R2 por chave, tamanho e SHA-256; preservar HTTP/custom metadata em manifesto atualizado antes da cópia. Os 7 objetos fora de media são backups auxiliares, não lixo.
6. Confirmar zero missing references e executar foreign_key_check. A checagem remota atual encontrou zero violações.
7. Obter manifesto atualizado imediatamente antes da cópia. Os SELECTs de inventário foram consultas separadas; não representam uma transação única congelada. Considerar mudanças dos bots após o backup e planejar reconciliação por IDs/versões, sem sobrescrever a origem.

## Importação e recuperação futura

Importar apenas em homeimprovement-editorial-db com UUID novo e verificado, nunca no D1 da Metricpedia. Não aplicar migrações de schema sobre um dump completo sem avaliar d1_migrations e o schema real. O destino continuará sem cron, com bloqueio de gravação no runtime e sem bots.

Se a cópia falhar, manter a origem operando e descartar apenas a tentativa de destino depois de autorização, ou repetir em recurso novo após conferir duplicações. Não restaurar nem reverter a Metricpedia para corrigir um problema da cópia.

Uma eventual recuperação da origem com Time Travel é uma operação separada, invasiva, que exige autorização expressa e bookmark de retorno. Não executá-la como parte da migração. Para recuperar o destino, usar exclusivamente o SQL privado validado e os objetos do manifesto, em banco/bucket de destino separados.
