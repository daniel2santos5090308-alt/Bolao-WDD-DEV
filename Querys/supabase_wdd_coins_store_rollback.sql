-- Rollback da loja e inventario WDD Coins.
-- Use somente se precisar remover esta funcionalidade do ambiente.

revoke all on function public.purchase_coin_store_item(text, uuid) from authenticated;
drop function if exists public.purchase_coin_store_item(text, uuid);

drop policy if exists "users read own inventory" on public.coin_user_items;
drop policy if exists "admins manage user inventory" on public.coin_user_items;
drop policy if exists "authenticated read active store items" on public.coin_store_items;
drop policy if exists "admins manage store items" on public.coin_store_items;

drop table if exists public.coin_user_items;
drop table if exists public.coin_store_items;
