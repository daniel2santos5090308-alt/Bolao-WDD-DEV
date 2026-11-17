# Banco de dados - Bolão WDD

Fonte oficial do schema a partir de 2026-11. A pasta `Querys/` fica só como histórico.

## Regras

- Rodar as migrations **em ordem**, no SQL Editor do Supabase, uma por vez.
- Toda migration nova ganha um nome `AAAAMMDDHHMMSS_descricao.sql` posterior à última.
- Nunca editar uma migration já aplicada: crie uma nova.
- **PRODUÇÃO não recebe nada em 2026.** Janela de aplicação: 23–24/01/2027.

## Ordem e status

| Migration | O que faz | DEV | PROD |
|---|---|---|---|
| `20261101000000_baseline.sql` | Tabelas principais, `is_admin`, RLS | já existia | jan/2027 (reinstalação) |
| `20261101000100_coins_schema.sql` | Carteira, extrato, configurações de Coins | já existia | jan/2027 |
| `20261101000200_coins_wallet_init.sql` | Inicialização de carteiras | já existia | jan/2027 |
| `20261101000300_coins_admin_adjustment.sql` | Ajuste manual auditado | já existia | jan/2027 |
| `20261101000400_coins_round_rewards.sql` | Prêmios por rodada (versão antiga) | já existia | jan/2027 |
| `20261101000500_coins_store.sql` | Loja e inventário | já existia | jan/2027 |
| `20261114120000_fix_get_visible_bets.sql` | Fase 0: fuso horário + bloqueio anon | ✅ 2026-11-14 | jan/2027 |
| `20261115100000_fix_bets_rls_is_admin.sql` | Fase 1: remove leitura direta de bets em UTC, `is_admin` definer, índices | ✅ 2026-11-15 | jan/2027 |
| `20261115110000_seasons.sql` | Fase 1: temporadas; dados atuais = 2026, ativa = 2027 | ✅ 2026-11-15 | jan/2027 |
| `20261115120000_get_ranking.sql` | Fase 1: ranking no banco com regra de desempate | ✅ 2026-11-15 | jan/2027 |
| `20261115130000_coins_season_ties.sql` | Fase 1: Coins por temporada, empate, admin só leitura | ✅ 2026-11-15 | jan/2027 |
| `20261116100000_app_snapshot.sql` | Fase 2: carimbo de versão, snapshot da temporada, extrato filtrado | ✅ 2026-11-16 | jan/2027 |
| `20261116110000_ranking_history.sql` | Visual novo: histórico do ranking (setas, últimas rodadas, corrida pelo título) | ✅ 2026-11-16 | jan/2027 |
| `20261116120000_season_names.sql` | Nome das temporadas com acento | ✅ 2026-11-16 | jan/2027 |
| `20261117100000_coin_texts_accents.sql` | Fase 4: textos de WDD Coins com acento (extrato, erros, item da loja) | ✅ 2026-11-15 | jan/2027 |
| `20261118100000_season_admin.sql` | Fase 5: admin cria e ativa temporadas (`create_season`, `activate_season`) | pendente | jan/2027 |

Banco novo do zero: rode todas na ordem acima. É assim que a produção será instalada em jan/2027 (instalação limpa, sem o histórico de 2026). O CI confere isso em todo PR: o job **Banco do zero** sobe um Supabase local vazio, aplica todas as migrations e roda os testes abaixo.

> A partir da Fase 2, o front depende de `get_app_snapshot`, `get_ranking`, `get_season_bets` e `app_meta`. Publicar o front novo **só depois** de aplicar as migrations no mesmo ambiente.

## Testes (somente DEV, não gravam nada)

| Script | Quando rodar |
|---|---|
| `tests/fase0_get_visible_bets_check.sql` | Depois da Fase 0 |
| `tests/fase1_check.sql` | Depois das 4 migrations da Fase 1 |
| `tests/fase2_check.sql` | Depois da migration da Fase 2 |
| `tests/fase5_check.sql` | Depois da migration da Fase 5 |

`tests/ci_seed.sql` é só do CI (cria 2 participantes fictícios num banco vazio). Nunca rode no DEV nem no PROD.

### Rodar o banco do zero na sua máquina (opcional, precisa do Docker)

O mesmo teste do job **Banco do zero** do CI, sem tocar no DEV nem no PROD:

```bash
npx supabase@3.2.0 db start          # sobe um Postgres local vazio (porta 54322)
npx supabase@3.2.0 migration up      # aplica todas as migrations em ordem
PSQL_CONTAINER=supabase_db_bolao-wdd bash scripts/ci-db-check.sh   # testes SQL
npx supabase@3.2.0 stop --no-backup  # desliga e apaga o banco local
```

Na primeira vez o Docker baixa as imagens do Supabase (alguns minutos).

## Consumo (Supabase Free)

| Ação no app | Antes da Fase 2 | Depois |
|---|---|---|
| Abrir o app / trocar de tela | 6 consultas, todas as apostas de todas as temporadas | 1 consulta de poucos bytes (carimbo); snapshot só se algo mudou |
| Ranking geral / rodada | Calculado no navegador com todas as apostas | `get_ranking`: 1 linha por participante, cacheado por versão |
| Extrato de um participante | Já vinha junto (todas as apostas) | Sob demanda, só daquele participante |
| Admin salva placar/bônus/jogo | Recarregava a base inteira a cada ação | Nenhuma recarga; sincroniza pelo carimbo |
| Admin salva CSV da classificação | ~20 a 40 chamadas | 2 chamadas |
| Admin exclui rodada | 1 chamada por jogo + 1 | 1 chamada (cascata no banco) |

## Scripts de leitura

- `scripts/fase1_inspect_schema.sql`: exporta a estrutura atual em JSON (não altera nada).

## Regras de negócio no banco

- **Desempate:** pontos → cravadas → na trave → jogos apostados. Persistindo, posição compartilhada (1, 1, 3) e cada empatado recebe o prêmio integral de Coins.
- **Ranking:** por temporada (zera todo ano). Histórico/Hall da Fama será derivado de `season_key`.
- **Palpites dos outros:** só via RPC (`get_visible_bets`, `get_ranking`), liberados no horário de Brasília do jogo.
- **Saldo de Coins:** só muda pelas RPCs; todo movimento fica no extrato.
