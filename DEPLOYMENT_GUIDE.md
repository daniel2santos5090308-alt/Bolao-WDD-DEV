# Guia de Publicação - Bolão WDD

Este guia organiza os passos para publicar o Bolão WDD com Supabase sem expor arquivos internos.

## Antes de Publicar

- Confirmar backup recente do ambiente atual.
- Rodar `npm run validate`.
- Rodar `npm run test:e2e`.
- Rodar `npm run test:e2e:headed` quando quiser acompanhar visualmente.
- Conferir `HOMOLOGATION_CHECKLIST.md`.
- Confirmar que o Supabase usado é o ambiente correto.

## Pasta Publicável

Publicar somente a pasta:

```text
public/
```

Não publicar:

- `.env.e2e`
- `.env.e2e.example`
- `package.json`
- `package-lock.json`
- `node_modules/`
- `tests/`
- `playwright.config.js`
- `supabase_import_data.sql`
- `supabase_rls_hardening.sql`
- backups `.json`
- `README.md`
- `RELEASE_NOTES.md`
- `HOMOLOGATION_CHECKLIST.md`
- `DEPLOYMENT_GUIDE.md`

## Configuração Esperada no Front-end

O arquivo `public/assets/js/supabase-init.js` deve conter apenas:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

A chave `service_role` nunca deve aparecer no front-end.

## Validação Pós-Publicação

Depois de publicar, abrir a URL final e validar:

- login admin;
- login usuário;
- visualização da última rodada;
- filtro por rodada;
- filtro por time;
- criação de rodada/jogo em ambiente controlado;
- aposta;
- finalização de placar;
- ranking geral;
- ranking da rodada;
- logout.

## Rollback

Se a publicação apresentar falha crítica:

- remover ou desativar a publicação nova;
- restaurar o apontamento anterior;
- manter o Firebase de produção como referência externa enquanto a migração não for promovida oficialmente;
- não rodar scripts destrutivos no Supabase durante rollback.

## Critério Para Promover

Promover somente quando:

- `npm run validate` estiver verde;
- `npm run test:e2e` estiver verde;
- checklist manual estiver concluído;
- backup recente estiver confirmado;
- não houver exposição de arquivos internos na hospedagem.
