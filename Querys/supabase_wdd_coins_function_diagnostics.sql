-- Bolao WDD 2027 - diagnostico das funcoes WDD Coins
-- Execute no Supabase DEV se o processamento de recompensas continuar com erro.

select
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    p.proargnames as argument_names,
    p.prosrc as function_body
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'initialize_coin_wallet',
    'initialize_coin_wallets_for_season',
    'process_round_coin_rewards'
  )
order by p.proname, arguments;

select
    'coin_round_processes' as table_name,
    count(*) as processed_rounds
from public.coin_round_processes
union all
select
    'coin_wallets',
    count(*)
from public.coin_wallets
union all
select
    'coin_transactions',
    count(*)
from public.coin_transactions;
