# Bolão WDD - Supabase DEV

Sistema de bolão migrado para Supabase no ambiente `BolaoWDDDEV`.

## Estrutura

- `public/index.html`: login.
- `public/admin.html`: painel administrativo.
- `public/user.html`: painel do usuário.
- `public/assets/js/supabase-init.js`: configuração pública do Supabase.
- `public/assets/js/storage-supabase.js`: camada de dados Supabase.
- `supabase_import_data.sql`: script histórico usado na migração inicial do backup.
- `supabase_rls_hardening.sql`: policies RLS para reforçar permissões no Supabase Free.

## Ambiente atual

- Banco: Supabase Free / DEV.
- Autenticação: Supabase Auth com usuários `@bolao.local`.
- Cadastro público removido do front-end; usuários são criados manualmente no Supabase Auth e vinculados em `profiles`.
- Dados migrados: 4 usuários, 17 rodadas, 167 jogos, 497 apostas e 20 linhas de classificação.
- Firebase: removido da superfície ativa desta pasta.

## Rodar localmente

```bash
npm start
```

Depois acesse:

```text
http://localhost:4173/index.html
```

## Testes automatizados

```bash
npm test
```

A suite cobre regras críticas de ranking, apostas mascaradas, bloqueio por horário, escape HTML e mapeamento de dados Supabase.

## Validação antes de alterações

Antes e depois de qualquer ajuste, rode:

```bash
npm run validate
```

Esse comando executa a suite automatizada e o `npm audit`.

## Segurança

- A pasta publicada deve ser somente `public/`.
- Não publicar arquivos SQL, backups, `package.json` ou documentos internos.
- Nunca colocar chave `service_role` do Supabase no front-end.
- Usar apenas `Project URL` e `anon public key` em `supabase-init.js`.
- Rodar `supabase_rls_hardening.sql` no SQL Editor para reforçar regras de leitura/escrita.
