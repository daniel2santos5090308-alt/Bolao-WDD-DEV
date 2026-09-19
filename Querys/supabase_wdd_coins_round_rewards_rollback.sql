-- Rollback do processamento manual de recompensas WDD Coins.
-- Use apenas em DEV ou em rollback planejado antes de processar rodadas em producao.

revoke all on function public.process_round_coin_rewards(text, text) from authenticated;
drop function if exists public.process_round_coin_rewards(text, text);

drop index if exists public.uq_coin_transactions_reward_reference;

drop policy if exists "admins insert coin round processes" on public.coin_round_processes;
drop policy if exists "admins read coin round processes" on public.coin_round_processes;
drop table if exists public.coin_round_processes;
