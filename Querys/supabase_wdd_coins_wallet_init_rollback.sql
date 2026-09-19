-- Bolao WDD 2027 - rollback das rotinas de inicializacao de carteiras

drop function if exists public.initialize_coin_wallet(text, uuid);
drop function if exists public.initialize_coin_wallets_for_season(text, boolean);
