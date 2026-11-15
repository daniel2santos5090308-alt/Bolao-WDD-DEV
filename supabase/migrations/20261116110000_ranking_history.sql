-- Bolao WDD 2027 - Visual novo: historico do ranking por rodada (somente DEV)
--
-- get_ranking_history(p_season_key) -> 1 linha por participante x rodada com
-- jogo finalizado (4 participantes x 38 rodadas ~ 150 linhas pequenas):
--   round_points  = pontos feitos naquela rodada
--   round_position= posicao na rodada (mesmo desempate do ranking)
--   total_points  = acumulado ate a rodada
--   position      = posicao no ranking geral apos a rodada
-- Usado para: setas de movimento, "ultimas 5 rodadas" e "Corrida pelo titulo".
-- Nao revela palpites: so jogos finalizados entram na conta.

begin;

create or replace function public.get_ranking_history(p_season_key text default null)
returns table (
    round_id text,
    round_number integer,
    round_name text,
    user_id uuid,
    user_name text,
    round_points numeric,
    round_position integer,
    total_points numeric,
    "position" integer
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
    played_rounds as (
        select r.id, r.number, r.name
        from public.rounds r
        cross join params p
        where r.season_key = p.season_key
          and exists (
              select 1 from public.matches m
              where m.round_id = r.id and m.result is not null
                and m.score_home is not null and m.score_away is not null
          )
    ),
    participants as (
        select pr.id, pr.name from public.profiles pr where pr.role <> 'admin'
    ),
    per_bet as (
        select
            m.round_id,
            b.user_id,
            (b.score_home = m.score_home and b.score_away = m.score_away) as is_exact,
            (sign(b.score_home - b.score_away) = sign(m.score_home - m.score_away)) as same_result,
            m.is_bonus,
            (m.result is not null and m.score_home is not null and m.score_away is not null
             and b.score_home is not null and b.score_away is not null) as is_scored
        from public.bets b
        join public.matches m on m.id = b.match_id
        join played_rounds pr on pr.id = m.round_id
    ),
    scored as (
        select
            pb.round_id,
            pb.user_id,
            case when not pb.is_scored then 0
                 else (case when pb.is_exact then st.exact_pts
                            when pb.same_result then st.near_pts
                            else st.wrong_pts end)
                      * case when st.bonus_on and pb.is_bonus then st.bonus_mult else 1 end
            end as pts,
            (pb.is_scored and pb.is_exact) as exact_hit,
            (pb.is_scored and not pb.is_exact and pb.same_result) as near_hit
        from per_bet pb
        cross join settings st
    ),
    grid as (
        select pr.id as round_id, pr.number as round_number, pr.name as round_name,
               pa.id as user_id, pa.name as user_name
        from played_rounds pr cross join participants pa
    ),
    per_round as (
        select
            g.round_id, g.round_number, g.round_name, g.user_id, g.user_name,
            round(coalesce(sum(s.pts), 0), 2) as round_points,
            count(*) filter (where s.exact_hit) as exact_hits,
            count(*) filter (where s.near_hit) as near_misses,
            count(s.user_id) as bets_count
        from grid g
        left join scored s on s.round_id = g.round_id and s.user_id = g.user_id
        group by g.round_id, g.round_number, g.round_name, g.user_id, g.user_name
    ),
    cumulative as (
        select
            pr.*,
            sum(pr.round_points) over w as total_points,
            sum(pr.exact_hits) over w as total_exact,
            sum(pr.near_misses) over w as total_near,
            sum(pr.bets_count) over w as total_bets
        from per_round pr
        window w as (partition by pr.user_id order by pr.round_number rows between unbounded preceding and current row)
    )
    select
        c.round_id,
        c.round_number,
        c.round_name,
        c.user_id,
        c.user_name,
        c.round_points,
        (rank() over (partition by c.round_id
                      order by c.round_points desc, c.exact_hits desc, c.near_misses desc, c.bets_count desc))::int,
        c.total_points,
        (rank() over (partition by c.round_id
                      order by c.total_points desc, c.total_exact desc, c.total_near desc, c.total_bets desc))::int
    from cumulative c
    where auth.uid() is not null
    order by c.round_number, 9, c.user_name;
$$;

revoke all on function public.get_ranking_history(text) from public;
revoke all on function public.get_ranking_history(text) from anon;
grant execute on function public.get_ranking_history(text) to authenticated;

commit;
