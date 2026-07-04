# Release Notes

## v3.0.0-dev - 2026-07-04

Tempo de desenvolvimento da sessao: aproximadamente 2 horas.

### Contexto

Esta versao consolida a migracao do Bolao WDD para Supabase no ambiente `BolaoWDDDEV`, mantendo o Firebase de producao como rollback externo.

### Principais Entregas

- Migracao local do front-end para Supabase Auth e Postgres.
- Preservacao do login por usuario curto (`admin`, `weberson`, `danilo`, `daniel`), com conversao interna para `@bolao.local`.
- Importacao e validacao dos dados migrados:
  - 4 usuarios
  - 17 rodadas
  - 167 jogos
  - 497 apostas
  - 20 linhas de classificacao
- Criacao da camada `storage-supabase.js` mantendo compatibilidade com as telas existentes.
- Separacao da pasta publicavel em `public/`.
- Remocao do Firebase da superficie ativa do projeto.
- Remocao do servidor Express legado e dependencias vulneraveis.
- Bloqueio de cadastro publico pelo front-end.
- Desativacao de importacao JSON e reset de sistema pelo client.
- Reforco de sanitizacao de HTML nos principais pontos de exibicao.
- Criacao do script `supabase_rls_hardening.sql` para endurecimento RLS no Supabase Free.
- Ajuste do ranking para suportar apostas mascaradas antes do inicio das partidas.
- Correcao da exibicao dos jogos da ultima rodada no painel do usuario.

### Validacoes Realizadas

- Login admin validado.
- Login usuario validado.
- Cadastro, edicao e exclusao de rodada/jogo validados.
- Aposta validada.
- Finalizacao de jogo validada.
- Ranking geral e ranking por rodada validados.
- Classificacao validada.
- `npm audit` validado com 0 vulnerabilidades.
- Sintaxe dos principais arquivos JavaScript validada.

### Observacoes de Seguranca

- A chave `service_role` do Supabase deve ser rotacionada no painel do Supabase.
- O script `supabase_rls_hardening.sql` deve ser rodado no SQL Editor do Supabase DEV antes de considerar o ambiente endurecido.
- A chave `anon public` permanece no front-end por ser a chave publica esperada para apps Supabase client-side.
- O arquivo `supabase_import_data.sql` contem dados migrados e nao deve ser versionado.
