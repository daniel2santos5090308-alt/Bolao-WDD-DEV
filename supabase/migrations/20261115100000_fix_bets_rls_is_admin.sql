-- Bolao WDD 2027 - Fase 1.0: completa a correcao da Fase 0 (somente DEV)
--
-- 1. Remove a policy "authenticated read visible bets": ela permitia ler a tabela
--    bets diretamente com a mesma comparacao em UTC (palpites 3h antes do jogo).
--    Apostas dos outros passam a ser lidas SOMENTE via RPC (get_visible_bets / get_ranking).
-- 2. is_admin() volta a ser SECURITY DEFINER (no DEV estava como invoker).
-- 3. Indices para as consultas por rodada / jogo.

begin;

drop policy if exists "authenticated read visible bets" on public.bets;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

create index if not exists idx_matches_round on public.matches (round_id);
create index if not exists idx_bets_match on public.bets (match_id);

commit;
