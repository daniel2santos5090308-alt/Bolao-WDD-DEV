-- Bolao WDD 2027 - seed DEV via SQL Editor para carteiras WDD Coins
-- Use no SQL Editor do Supabase DEV quando auth.uid() nao estiver disponivel.
-- Nao substitui as RPCs seguras usadas pela aplicacao.

insert into public.coin_wallets (
    season_key,
    user_id,
    available_balance,
    locked_balance
)
select
    '2027' as season_key,
    p.id as user_id,
    0 as available_balance,
    0 as locked_balance
from public.profiles p
where coalesce(p.role, 'user') <> 'admin'
on conflict (season_key, user_id) do nothing
returning id, season_key, user_id, available_balance, locked_balance;

select 'coin_wallets' as table_name, count(*) from public.coin_wallets
union all
select 'coin_transactions', count(*) from public.coin_transactions;
