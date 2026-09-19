-- Bolao WDD 2027 - rollback do schema inicial de WDD Coins
-- Use somente em DEV ou antes de existir movimentacao real de Coins.

drop view if exists public.coin_wallet_summary;

drop policy if exists "authenticated read coin settings" on public.coin_settings;
drop policy if exists "admins manage coin settings" on public.coin_settings;
drop policy if exists "users read own coin wallets" on public.coin_wallets;
drop policy if exists "admins manage coin wallets" on public.coin_wallets;
drop policy if exists "users read own coin transactions" on public.coin_transactions;
drop policy if exists "admins read all coin transactions" on public.coin_transactions;
drop policy if exists "admins insert coin transactions" on public.coin_transactions;

drop table if exists public.coin_transactions;
drop table if exists public.coin_wallets;
drop table if exists public.coin_settings;
