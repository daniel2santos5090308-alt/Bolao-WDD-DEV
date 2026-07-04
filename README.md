# Bolao WDD - Supabase DEV

Sistema de bolao migrado para Supabase no ambiente `BolaoWDDDEV`.

## Estrutura

- `public/index.html`: login.
- `public/admin.html`: painel administrativo.
- `public/user.html`: painel do usuario.
- `public/assets/js/supabase-init.js`: configuracao publica do Supabase.
- `public/assets/js/storage-supabase.js`: camada de dados Supabase.
- `supabase_import_data.sql`: script historico usado na migracao inicial do backup.
- `supabase_rls_hardening.sql`: policies RLS para reforcar permissoes no Supabase Free.

## Ambiente atual

- Banco: Supabase Free / DEV.
- Autenticacao: Supabase Auth com usuarios `@bolao.local`.
- Dados migrados: 4 usuarios, 17 rodadas, 167 jogos, 497 apostas e 20 linhas de classificacao.
- Firebase: removido da superficie ativa desta pasta.

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

A suite cobre regras criticas de ranking, apostas mascaradas, bloqueio por horario, escape HTML e mapeamento de dados Supabase.

## Seguranca

- A pasta publicada deve ser somente `public/`.
- Nao publicar arquivos SQL, backups, `package.json` ou documentos internos.
- Nunca colocar chave `service_role` do Supabase no front-end.
- Usar apenas `Project URL` e `anon public key` em `supabase-init.js`.
- Rodar `supabase_rls_hardening.sql` no SQL Editor para reforcar regras de leitura/escrita.
