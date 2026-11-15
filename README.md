# Bolão WDD - Supabase DEV

Sistema de bolão migrado para Supabase no ambiente `BolaoWDDDEV`.

## Estrutura

- `index.html` + `src/`: app React + TypeScript (Vite). Login, jogos, ranking, tabela, Coins, perfil e admin.
  - `src/services/`: cliente Supabase (`supabase.ts`), dados e cache (`storage.ts`), login (`auth.ts`), pontuação de um palpite (`scoring.ts`), times e escudos (`teams.ts`).
  - `src/pages/`, `src/components/`, `src/hooks/`: telas e componentes.
- `public/assets/js/runtime-config.js`: URL e chave anon do Supabase, gerado por `npm run write-env` a partir de `SUPABASE_URL` / `SUPABASE_ANON_KEY` (nunca commitar com valores).
- `public/login.html`, `public/admin.html`, `public/user.html`: só redirecionam endereços antigos para o app.
- `supabase/migrations/`: banco versionado (status por ambiente em `supabase/README.md`).
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

Com `SUPABASE_URL` e `SUPABASE_ANON_KEY` do DEV em `.env.local` (ignorado pelo Git):

```bash
npm start
```

Depois acesse:

```text
http://127.0.0.1:5173/
```

## Testes automatizados

```bash
npm test
```

Roda os módulos TypeScript direto no Node 22 (`--experimental-strip-types`). Cobre pontuação de palpite, bloqueio por horário de Brasília, nomes e escudos dos times, mapeamento das linhas do Supabase, cache por versão do snapshot e as páginas HTML. A soma do ranking e o desempate são do banco (`get_ranking`) e ficam cobertos pelos scripts em `supabase/tests/`.

## Testes E2E

Os testes E2E (`tests/e2e/app.spec.js`) abrem o app no Chromium, em tamanho de desktop e de celular, contra um **Supabase simulado** (`tests/e2e/support/mockSupabase.js`). Não precisam de senha e não leem nem gravam nada no Supabase DEV ou PROD.

Cobrem:

- login (senha errada, participante, admin) e endereços antigos (`login.html`);
- salvar palpites em lote;
- ranking vindo do banco;
- WDD Coins carregando loja e extrato ao abrir;
- sair;
- admin abrindo a lista de jogos na rodada atual.

Antes da primeira execução, instale o navegador do Playwright:

```bash
npx playwright install chromium
```

Depois rode (o Vite sobe sozinho na porta 4173):

```bash
npm run test:e2e
```

Para acompanhar o navegador:

```bash
npm run test:e2e:headed
```

## Validação antes de alterações

Antes e depois de qualquer ajuste, rode:

```bash
npm run validate
```

Esse comando executa a suite automatizada e o `npm audit`.

## Segurança

- A pasta publicada é somente `dist/` (saída do `npm run build:react`).
- Não publicar arquivos SQL, backups, `package.json` ou documentos internos.
- Nunca colocar chave `service_role` do Supabase no front-end.
- Usar apenas `Project URL` e `anon public key` (variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY` no Netlify).
- Rodar `supabase_rls_hardening.sql` no SQL Editor para reforçar regras de leitura/escrita.
