# Release Notes

## v3.0.0-dev - 2026-07-04

Tempo de desenvolvimento da sessão: aproximadamente 2 horas.

### Contexto

Esta versão consolida a migração do Bolão WDD para Supabase no ambiente `BolaoWDDDEV`, mantendo o Firebase de produção como rollback externo.

### Principais Entregas

- Migração local do front-end para Supabase Auth e Postgres.
- Preservação do login por usuário curto (`admin`, `weberson`, `danilo`, `daniel`), com conversão interna para `@bolao.local`.
- Importação e validação dos dados migrados:
  - 4 usuários
  - 17 rodadas
  - 167 jogos
  - 497 apostas
  - 20 linhas de classificação
- Criação da camada `storage-supabase.js` mantendo compatibilidade com as telas existentes.
- Separação da pasta publicável em `public/`.
- Remoção do Firebase da superfície ativa do projeto.
- Remoção do servidor Express legado e dependências vulneráveis.
- Bloqueio de cadastro público pelo front-end.
- Desativação de importação JSON e reset de sistema pelo client.
- Reforço de sanitização de HTML nos principais pontos de exibição.
- Criação do script `supabase_rls_hardening.sql` para endurecimento RLS no Supabase Free.
- Ajuste do ranking para suportar apostas mascaradas antes do início das partidas.
- Correção da exibição dos jogos da última rodada no painel do usuário.
- Criação de testes automatizados com `node:test`.
- Criação de teste E2E com Playwright cobrindo login, criação/edição/exclusão de rodada/jogo, aposta e finalização de placar.
- Criação de checklist de homologação e guia de publicação.
- Criação de cache em memória no front-end para reduzir leituras repetidas no Supabase Free.
- ### cd6abdd - feat: refresh frontend visual design

- Atualização visual inicial do front-end.
- Remodelagem da tela de login com identidade WDD.
- Ajuste visual das navbars de admin e usuário.
- Padronização de cards, tabelas, botões, formulários e sombras.
- Melhorias responsivas para uso em desktop e mobile.
- Substituição de emojis do ranking por ícones Bootstrap.
- Atualização do cache-bust do CSS para `v=3.2`.
- Validação com `npm run validate` e `npm run test:e2e`.

### Validações Realizadas

- Login admin validado.
- Login usuário validado.
- Cadastro, edição e exclusão de rodada/jogo validados.
- Aposta validada.
- Finalização de jogo validada.
- Ranking geral e ranking por rodada validados.
- Classificação validada.
- E2E real validado contra Supabase DEV com `npm run test:e2e`.
- E2E visual validado com `npm run test:e2e:headed`.
- `npm run validate` validado com 10 testes passando.
- `npm audit` validado com 0 vulnerabilidades.
- Sintaxe dos principais arquivos JavaScript validada.

### Observações de Segurança

- A chave `service_role` do Supabase deve ser rotacionada no painel do Supabase.
- O script `supabase_rls_hardening.sql` deve ser rodado no SQL Editor do Supabase DEV antes de considerar o ambiente endurecido.
- A chave `anon public` permanece no front-end por ser a chave pública esperada para apps Supabase client-side.
- O arquivo `supabase_import_data.sql` contém dados migrados e não deve ser versionado.
- Publicar somente a pasta `public/`.
