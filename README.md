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
- `HOMOLOGATION_CHECKLIST.md`: checklist de validação antes de publicação.
- `DEPLOYMENT_GUIDE.md`: guia para publicar somente a pasta correta.

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

## Testes E2E

Os testes E2E abrem a aplicação no navegador e executam o fluxo real contra o Supabase DEV:

- login admin;
- criação de rodada;
- criação e edição de jogo;
- login de usuário;
- aposta;
- finalização de placar;
- exclusão do jogo e da rodada de teste.

Antes da primeira execução, instale o navegador do Playwright:

```bash
npx playwright install chromium
```

Crie um arquivo local `.env.e2e` na raiz do projeto. Esse arquivo é ignorado pelo Git:

```text
E2E_ADMIN_USER=admin
E2E_ADMIN_PASSWORD=sua_senha_admin
E2E_BETTOR_USER=daniel
E2E_BETTOR_PASSWORD=sua_senha_usuario
```

Depois rode:

```bash
npm run test:e2e
```

Para acompanhar o navegador:

```bash
npm run test:e2e:headed
```

Sem as senhas configuradas, o teste E2E fica marcado como `skipped` e não altera dados.

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
