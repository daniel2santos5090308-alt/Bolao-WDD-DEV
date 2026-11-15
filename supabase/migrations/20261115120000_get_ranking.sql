-- Bolao WDD 2027 - Fase 1.2: ranking calculado no banco (somente DEV)
--
-- get_ranking(p_season_key, p_round_id)
--   - p_season_key nulo  -> temporada ativa
--   - p_round_id nulo    -> ranking da temporada; informado -> ranking da rodada
--
-- Pontuacao (igual ao front): placar exato -> exact_score_points;
-- mesmo resultado -> near_miss_points; senao wrong_points; x bonus_multiplier
-- quando o jogo e bonus e o bonus esta ativo. So jogos finalizados pontuam.
--
-- Desempate (regra do bolao, definida em 2026-11-14):
--   pontos -> cravadas -> na trave -> jogos apostados.
--   Persistindo o empate, a posicao e compartilhada (1, 1, 3).
--
-- Retorna 1 linha por participante (sem admins): resolve o limite de 1000
-- linhas da API e reduz o trafego (poucas linhas em vez de todas as apostas).
-- Nao revela palpites: so agrega jogos finalizados; bets_count conta apostas
-- feitas (inclusive em jogos futuros), sem mostrar o placar.

begin;

create or replace function public.get_ranking(
    p_season_key text default null,
    p_round_id text default null
)
returns table (
    "position" integer,
    user_id uuid,
    user_name text,
    points numeric,
    exact_hits integer,
    near_misses integer,
    bonus_hits integer,
    bets_count integer
)
language sql
stable
security definer
set search_path = public
as $$
    with params as (
        select coalesce(p_season_key, public.current_season_key()) as season_key
    ),
    settings as (
        select
            coalesce(max(ss.exact_score_points), 10) as exact_pts,
            coalesce(max(ss.near_miss_points), 7) as near_pts,
            coalesce(max(ss.wrong_points), 0) as wrong_pts,
            coalesce(max(ss.bonus_multiplier), 2) as bonus_mult,
            coalesce(bool_or(ss.bonus_enabled), true) as bonus_on
        from public.scoring_settings ss
        where ss.id = 'default'
    ),
    scope_matches as (
        select m.*
        from public.matches m
        join public.rounds r on r.id = m.round_id
        cross join params p
        where r.season_key = p.season_key
          and (p_round_id is null or m.round_id = p_round_id)
    ),
    participants as (
        select pr.id, pr.name
        from public.profiles pr
        where pr.role <> 'admin'
    ),
    scored as (
        select
            b.user_id,
            sm.is_bonus,
            (sm.result is not null and sm.score_home is not null and sm.score_away is not null
             and b.score_home is not null and b.score_away is not null) as is_scored,
            (b.score_home = sm.score_home and b.score_away = sm.score_away) as is_exact,
            (sign(b.score_home - b.score_away) = sign(sm.score_home - sm.score_away)) as same_result
        from public.bets b
        join scope_matches sm on sm.id = b.match_id
    ),
    per_bet as (
        select
            s.user_id,
            s.is_bonus,
            s.is_scored and s.is_exact as exact_hit,
            s.is_scored and not s.is_exact and s.same_result as near_hit,
            case
                when not s.is_scored then 0
                else (
                    case
                        when s.is_exact then st.exact_pts
                        when s.same_result then st.near_pts
                        else st.wrong_pts
                    end
                ) * case when st.bonus_on and s.is_bonus then st.bonus_mult else 1 end
            end as pts
        from scored s
        cross join settings st
    ),
    totals as (
        select
            pa.id as user_id,
            pa.name as user_name,
            round(coalesce(sum(pb.pts), 0), 2) as points,
            count(*) filter (where pb.exact_hit)::int as exact_hits,
            count(*) filter (where pb.near_hit)::int as near_misses,
            count(*) filter (where pb.is_bonus and pb.pts > 0)::int as bonus_hits,
            count(pb.user_id)::int as bets_count
        from participants pa
        left join per_bet pb on pb.user_id = pa.id
        group by pa.id, pa.name
    )
    select
        (rank() over (order by t.points desc, t.exact_hits desc, t.near_misses desc, t.bets_count desc))::int,
        t.user_id,
        t.user_name,
        t.points,
        t.exact_hits,
        t.near_misses,
        t.bonus_hits,
        t.bets_count
    from totals t
    where auth.uid() is not null
    order by 1, t.user_name;
$$;

revoke all on function public.get_ranking(text, text) from public;
revoke all on function public.get_ranking(text, text) from anon;
grant execute on function public.get_ranking(text, text) to authenticated;

commit;
