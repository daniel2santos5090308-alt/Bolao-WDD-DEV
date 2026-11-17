# Release Notes

## v3.9.0-dev - 2026-11-17

Fase 10: WDD Coins contínuas e itens permanentes (decisão de 16/11). Primeira fase do Bloco B, que prepara os desafios entre participantes. Somente DEV; produção recebe na janela de 23–24/01/2027.

### WDD Coins não zeram mais

- Ao ativar uma temporada, o saldo disponível de cada participante passa para ela. O extrato da temporada anterior mostra "Saldo levado para a temporada X" e o da nova, "Saldo trazido da temporada Y".
- O antigo "saldo inicial" virou **bônus de boas-vindas**, pago uma única vez, na primeira carteira do participante. Quem já recebeu não recebe de novo nas temporadas seguintes.
- Ativar a temporada anterior por engano e depois a nova de novo leva o saldo de volta, sem duplicar nem perder Coins.

### Itens permanentes

- Item comprado é do participante para sempre: a loja mostra **Adquirido** mesmo para itens comprados em outra temporada, e a compra recusa um item que ele já tem ("Você já tem este item").
- O participante continua enxergando os itens que possui mesmo depois que saem da loja.
- Mensagens da compra e da carteira com acento.

### Banco de dados

- `20261120100000_coins_continuous.sql` (pendente no DEV): tipos de lançamento `season_carry_out`/`season_carry_in`, bônus de boas-vindas único, transporte de saldo em `activate_season`, compra sem repetir item, leitura dos itens possuídos.
- Teste `supabase/tests/fase10_check.sql` (13 verificações): bônus uma vez, transporte, ida e volta sem duplicar, item permanente, permissões.

### Testes

- Banco do zero (local, Docker): 18 migrations e 65 testes SQL (Fases 0, 1, 2, 5, 7 e 10).
- E2E: 42 testes (novo: item comprado em outra temporada aparece como adquirido). 28 testes unitários.

## v3.8.0-dev - 2026-11-16

Fase 8: app instalável (PWA). Somente DEV; sem migration. Fecha o Bloco A de desenvolvimento antes da publicação (Fase 9).

### Instalar no celular

- Ícone WDD na tela inicial, abre em tela cheia, com a cor do app na barra do sistema.
- Android (Chrome): Perfil → **App no celular** → **Instalar app**. iPhone: o mesmo cartão mostra o caminho no Safari (Compartilhar → Adicionar à Tela de Início). Com o app instalado, o cartão confirma "Você está usando o app instalado".
- Ícones 192, 512 e "maskable" (recorte do Android) e ícone do iPhone, gerados por `scripts/generate-icons.mjs` a partir da marca do topo.

### Rápido e sem internet

- Service worker: a página vem da rede quando há conexão e, sem conexão, da última cópia; arquivos do app (com hash no nome) vêm do cache. Sem internet, o app abre e mostra os últimos dados carregados.
- Nunca guarda dados: Supabase, fontes, `runtime-config.js` e `version.json` sempre vão para a rede. Cada deploy tem seu cache; o anterior é apagado.

### Nova versão

- Cada build gera um identificador (`/version.json`). O app confere ao abrir, a cada 10 minutos e ao voltar para a tela; se houver deploy novo, mostra **"Nova versão do Bolão WDD disponível"** com o botão **Atualizar o app**. A verificação é um arquivo de poucos bytes no Netlify, não consome o Supabase.
- `netlify.toml`: `sw.js`, `version.json`, manifesto e `runtime-config.js` sem cache; `/assets` com cache de 1 ano (nomes com hash).

### Testes

- `scripts/test-pwa.mjs` (13 verificações no build de produção): manifesto e ícones, critério de instalação do Chrome, service worker no controle, abertura sem internet, nada do Supabase no cache e o aviso de nova versão. Roda também no CI (job E2E).
- E2E: 36 testes; 26 testes unitários (novo: regras de versão e de iPhone).
- Checklist de homologação ganhou os passos das Fases 5 a 8, incluindo instalar num Android e num iPhone de verdade.

## v3.7.0-dev - 2026-11-16

Fase 7: participantes gerenciados pelo app, sem entrar no painel do Supabase. Somente DEV; produção recebe na janela de 23–24/01/2027.

### Participantes (admin)

- Nova aba **Participantes**: lista todos (ativos primeiro), cria participante, gera nova senha e desativa/reativa.
- Criar: nome, usuário (sugerido a partir do nome, ex.: "Ana Paula" → `ana.paula`) e senha provisória gerada (8 caracteres, sem letras parecidas). A mensagem final mostra usuário e senha para passar ao participante; ele troca a senha depois em Perfil. A carteira de WDD Coins da temporada ativa é preparada na hora.
- Nova senha: gera uma senha provisória; a antiga deixa de valer.
- Desativar bloqueia o login e mantém palpites, ranking e WDD Coins no histórico. Reativar devolve o acesso com o mesmo usuário e senha. Admins não podem ser desativados nem ter a senha trocada por aqui.
- Login de conta desativada mostra "Conta desativada. Fale com o administrador do bolão." em vez de "Usuário ou senha incorretos".

### Banco de dados e Supabase

- `20261119100000_participants.sql` (pendente no DEV): coluna `profiles.active`.
- Edge Function `admin-users` (pendente no DEV): cria login + perfil, troca senha e bloqueia/libera o login. Usa a chave de serviço do próprio Supabase; só admin chama. Publicação pelo painel em `supabase/README.md`.
- Teste `supabase/tests/fase7_check.sql` (6 verificações) e `scripts/test-admin-users.mjs` (18 verificações da Edge Function contra o Supabase local).

### Testes

- Edge Function testada de ponta a ponta num Supabase local completo (Docker): 18/18, incluindo bloqueio de login (`user_banned`), recusa para participante (403) e sem login (401).
- Banco do zero: 17 migrations e 52 testes SQL (Fases 0, 1, 2, 5 e 7).
- E2E: 18 fluxos × desktop e celular (36 testes). Novos: criar participante, nova senha e desativar, login de conta desativada.
- 25 testes unitários (novo: regras de participante).

## v3.6.0-dev - 2026-11-16

Fase 6: importação da tabela de jogos e rodada atual com jogos adiados. Somente DEV; sem migration nova.

### Importar jogos (admin)

- Nova aba **Importar jogos**: a tabela da CBF entra por CSV (`rodada;data;hora;mandante;visitante`), colada ou carregada de arquivo. Aceita `;`, `,` ou tab, datas dd/mm/aaaa ou aaaa-mm-dd e horas 19:00 ou 19h30.
- Prévia antes de gravar: rodadas novas, jogos novos, remarcações (data antiga → nova) e jogos sem mudança. Erros por linha bloqueiam; avisos (time em dois jogos da mesma rodada, rodada sem 10 jogos, time fora da lista oficial) não bloqueiam.
- Reimportar o mesmo CSV com datas novas remarca os jogos. Resultados nunca mudam e nada é apagado.
- Gravação em 2 chamadas (rodadas e jogos), na temporada ativa.

### Nomes dos times

- Os nomes são padronizados na gravação: "Vasco da Gama" e "Vasco", "Atletico Mineiro" e "Atlético-MG" viram o mesmo time. Vale para a importação, o cadastro manual de jogo e a classificação (manual e CSV).

### Rodada atual com jogos adiados

- Jogo marcado mais de 4 dias depois da data típica da rodada conta como adiado. Ele não puxa mais a "rodada atual" para trás: antes, um jogo adiado da Rodada 21 sem resultado fazia o app abrir na Rodada 21 em vez da 35.
- Jogos adiados ganham a etiqueta **Adiado** e não esticam o período no cabeçalho da rodada.

### Testes

- E2E: 15 fluxos × desktop e celular (30 testes). Novo: importação com prévia, remarcação e rodada nova.
- 24 testes unitários (novos: rodada atual com adiados, leitura do CSV, plano de importação, apelidos de times).

## v3.5.0-dev - 2026-11-16

Fase 5: temporadas sem ano fixo no código. Somente DEV; produção recebe na janela de 23–24/01/2027, já como instalação limpa da temporada 2027.

### Temporadas

- Nova aba **Temporadas** no admin: lista as temporadas (ativa, período), cria a do próximo ano e ativa.
- Criar copia as premiações de WDD Coins e o catálogo da loja da temporada ativa; saldos e itens comprados não são copiados. A temporada nasce desativada.
- Ativar encerra a anterior com a data de hoje, prepara as carteiras dos participantes e recarrega o app; todos passam a ver a nova temporada em Jogos, Ranking, Tabela e WDD Coins.
- WDD Coins (saldo do topo, loja, extrato e premiações do admin) e o nome no topo agora seguem a temporada ativa. Não há mais `2027` fixo no app.

### Banco de dados

- `20261118100000_season_admin.sql` (pendente no DEV): funções `create_season` e `activate_season`, só para admin.
- Teste `supabase/tests/fase5_check.sql` (15 verificações, não grava nada).
- `fase1_check.sql` corrigido: desde a Fase 4 a mensagem de recusa tem acento ("à temporada") e o teste só aceitava a versão sem acento.
- Primeira instalação completa do zero: as 16 migrations aplicam sem erro num banco vazio e os 46 testes SQL passam (Fases 0, 1, 2 e 5).

### CI

- Novo job **Banco do zero**: sobe um Supabase local vazio, aplica todas as migrations em ordem e roda os testes SQL das Fases 0, 1, 2 e 5. Qualquer migration quebrada ou teste com FALHOU reprova o PR.

### Testes

- E2E: 14 fluxos × desktop e celular (28 testes). Novos: criar e ativar a temporada seguinte; ano repetido não chega ao banco; nome da temporada no topo.
- 18 testes unitários (novo: regras de temporada).

## v3.4.0-dev - 2026-11-15

Fase 4 (UX), segunda parte: telas do participante (Jogos, Ranking, Tabela e Login). Somente DEV; produção recebe na janela de 23–24/01/2027. Sem migration nova.

### Palpites

- Palpite digitado numa rodada continua na barra "Salvar palpites" ao trocar de rodada e é salvo junto ("2 palpites não salvos (1 em outra rodada)"). Antes ele sumia da barra.
- Trocar de tela, usar o Voltar do navegador ou sair com palpite não salvo pede confirmação. Fechar a aba mostra o aviso do navegador.

### Carregamento

- Ranking, Tabela e os rankings laterais mostram "Carregando…" enquanto os dados chegam, em vez de "Sem pontuação ainda" ou "Classificação ainda não cadastrada".

### Acessibilidade

- O saldo de WDD Coins no topo é lido pelo leitor de tela ("Saldo de WDD Coins: 1.000"). Antes ele lia só "Saldo WDD Coins".
- O extrato de um participante trava a rolagem do fundo e, ao fechar, devolve o foco a quem o abriu.
- Cada tela tem seu título na aba do navegador ("Ranking · Bolão WDD").

### Login

- Botão para mostrar ou ocultar a senha.

### Testes

- E2E: 12 fluxos × desktop e celular (24 testes). Os novos cobrem palpite em outra rodada, confirmação ao trocar de tela e mostrar senha.
- 17 testes unitários (novo: aviso de palpite não salvo).

## v3.3.0-dev - 2026-11-15

Fase 4 (UX), primeira parte: textos, Coins, Admin e testes de ponta a ponta. Somente DEV; produção recebe na janela de 23–24/01/2027.

### Textos

- Acentos em todos os textos visíveis de Admin, WDD Coins e Perfil ("Não foi possível", "Classificação", "Pontuação", "bônus", "lançamentos"...).
- Tipo e raridade dos itens da loja em português ("Selo de perfil · Raro").
- Sem jargão técnico na tela ("novo modelo React", "perfil Supabase").

### WDD Coins

- Loja e extrato carregam ao abrir a tela (antes: botões "Carregar").
- Saldo disponível, bloqueado e total numa linha só no celular.
- Removido "Voltar aos jogos" (a barra inferior já leva aos jogos).

### Admin

- "Jogos cadastrados" abre na rodada atual, não na temporada inteira (no celular a página caiu de ~12.500 px para ~3.800 px de altura).
- Formulários não esticam mais para acompanhar o painel vizinho; datas em dd/mm/aaaa; "1º/2º/3º lugar".
- Admin não tem carteira: sem saldo no topo e sem consulta de carteira.

### Acessibilidade

- Botão "Sair" com nome acessível no celular (antes era só um ícone para leitores de tela).

### Banco de dados

- `20261117100000_coin_texts_accents.sql` (aplicada no DEV em 2026-11-15): mensagens e descrições do extrato de WDD Coins com acento; nome do item "Card Bônus Iluminado". Mesma lógica de prêmios.

### Testes

- E2E refeito: 9 fluxos × desktop e celular (18 testes) contra um Supabase simulado. Não precisa de senha nem toca no DEV.
- 16 testes unitários (novos: rodada atual e rótulos de Coins).

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
