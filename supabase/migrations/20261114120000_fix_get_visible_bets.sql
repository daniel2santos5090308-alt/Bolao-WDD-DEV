-- Bolao WDD 2027 - Fase 0: correcao de get_visible_bets
-- AMBIENTE: somente Supabase DEV. Nao aplicar em PRODUCAO em 2026.
--
-- Corrige dois problemas da versao criada em Querys/supabase_score_prediction_model.sql:
--   1. Fuso horario: a comparacao "timestamp <= now()" usava UTC (fuso do banco),
--      revelando os palpites dos outros 3h ANTES do inicio do jogo (horario de Brasilia).
--   2. Permissao: a funcao ficou executavel por PUBLIC/anon (padrao do Postgres) e
--      sem o filtro "auth.uid() is not null"; qualquer um com a anon key lia apostas.
--
-- Mantem exatamente a mesma assinatura e colunas de retorno usadas pelo front.

create or replace function public.get_visible_bets()
returns table (
    user_id uuid,
    legacy_user_id text,
    match_id text,
    pick text,
    score_home integer,
    score_away integer,
    created_at timestamptz,
    updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
    with viewer as (
        select auth.uid() as uid, public.is_admin() as is_admin
    )
    select
        b.user_id,
        b.legacy_user_id,
        b.match_id,
        case when v.is_admin or b.user_id = v.uid or m.result is not null
                  or (m.match_date + m.match_time) <= (now() at time zone 'America/Sao_Paulo')
             then b.pick end as pick,
        case when v.is_admin or b.user_id = v.uid or m.result is not null
                  or (m.match_date + m.match_time) <= (now() at time zone 'America/Sao_Paulo')
             then b.score_home end as score_home,
        case when v.is_admin or b.user_id = v.uid or m.result is not null
                  or (m.match_date + m.match_time) <= (now() at time zone 'America/Sao_Paulo')
             then b.score_away end as score_away,
        b.created_at,
        b.updated_at
    from public.bets b
    join public.matches m on m.id = b.match_id
    cross join viewer v
    where v.uid is not null;
$$;

revoke all on function public.get_visible_bets() from public;
revoke all on function public.get_visible_bets() from anon;
grant execute on function public.get_visible_bets() to authenticated;
