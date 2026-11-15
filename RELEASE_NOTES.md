# Release Notes

## v3.2.0-dev - 2026-11-15

Fase 3: fim do JavaScript legado. O app inteiro agora é React + TypeScript, sem scripts globais. Somente DEV; produção recebe na janela de 23–24/01/2027.

### Código

- Camada de dados, login, pontuação, times e utilitários portados para módulos TypeScript tipados em `src/services/` (antes: `storage-supabase.js`, `auth.js`, `ranking.js`, `teams.js`, `utils.js`, `supabase-init.js`).
- Removidos ~3.500 linhas de JS legado, incluindo `admin.js` e `user.js`, que já não eram carregados por nenhuma página.
- SDK do Supabase via npm com versão fixa (2.118.0), em vez do CDN sem versão fixa (`@2`).
- Escudos dos times renderizados por componente React (sem `dangerouslySetInnerHTML`).
- O ranking (somas e desempate) existe só no banco (`get_ranking`); o front calcula apenas os pontos de cada palpite para exibição.

### Telas

- Login novo em React, no visual "noite de jogo". `login.html`, `admin.html` e `user.html` só redirecionam endereços antigos.
- Sessão expirada volta para o login sem recarregar a página.
- Página 404 própria em português (antes: página padrão do Firebase, em inglês).

### Correções

- Bloqueio de palpite no front usa o horário de Brasília (-03:00), igual ao banco. Antes usava o fuso do aparelho.

### Build e segurança

- Vite 8.2.4 e `source-map-js` 1.2.2 (corrigem falhas de severidade alta do `npm audit`).
- Bibliotecas em chunk separado (`vendor`), que fica no cache do navegador entre deploys.

### Validações

- `tsc`, 14 testes unitários (agora em TypeScript), build Vite e `npm audit` (0 vulnerabilidades) verdes.
- Login testado no navegador contra o DEV (celular e desktop): erro de senha em português, sem erros no console.
- Pendente: teste E2E (`tests/e2e/`) ainda usa as telas antigas e precisa ser refeito.

## v3.1.0-dev - 2026-11-16

Base da temporada 2027: correções de segurança dos palpites, temporadas, ranking calculado no banco, controle de consumo do Supabase Free e visual novo. Somente DEV; produção recebe na janela de 23–24/01/2027.

### Segurança (Fase 0)

- Palpites dos outros liberados só no horário de início do jogo **em Brasília** (antes vazavam 3h antes por causa do UTC do banco).
- `get_visible_bets` e a policy de leitura direta de `bets` corrigidas; chave anon não lê mais apostas.
- `is_admin()` como `security definer` em todos os ambientes.

### Temporadas, ranking e Coins (Fase 1)

- Tabela `seasons` (2026 encerrada, 2027 ativa); `rounds` e `standings` com `season_key`.
- `get_ranking`: ranking no banco, 1 linha por participante (resolve o limite de 1000 linhas da API).
- Desempate oficial: pontos → cravadas → na trave → jogos apostados; persistindo, posição compartilhada (1, 1, 3).
- Prêmios de Coins por temporada, com prêmio integral para empatados; saldo só muda pelas RPCs auditadas.

### Consumo do Supabase Free (Fase 2)

- `get_app_snapshot`: 1 chamada com a temporada ativa; cache local com carimbo `app_meta.version`.
- Ranking e extrato sob demanda; admin sem recarga completa após cada ação; gravações em lote.
- Keepalive cobre DEV e PROD (PROD opcional via secrets).

### Visual novo

- Identidade "noite de jogo", navegação inferior no celular.
- Jogos: rodada inteira por dia, placar com +/−, status e contagem regressiva, "Salvar palpites" em lote.
- Ranking: pódio, movimento ▲▼, últimas rodadas e gráfico "Corrida pelo título" (`get_ranking_history`).
- Tabela do campeonato com zonas.

### Banco de dados

- Migrations versionadas em `supabase/migrations/` (ordem e status por ambiente em `supabase/README.md`).
- Scripts de verificação em `supabase/tests/` (não gravam dados).

### Validações

- `tsc`, 14 testes unitários, build Vite e `npm audit` verdes.
- Testes SQL das Fases 0, 1 e 2 verdes no Supabase DEV (6/6, 12/12, 13/13).
- Homologação manual no DEV (desktop e celular): jogos, palpites, bônus, ranking, extrato, setas e gráfico.

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
