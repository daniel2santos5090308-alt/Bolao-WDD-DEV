-- Bolao WDD 2027 - Fase 2: controle de consumo (somente DEV)
--
-- 1. app_meta.version: "carimbo" incrementado automaticamente (triggers) sempre
--    que algo relevante muda. O app guarda os dados no navegador e so baixa de
--    novo quando o carimbo muda (consulta de poucos bytes).
-- 2. get_app_snapshot(): UMA chamada com tudo que o app precisa da temporada
--    ativa (rodadas, jogos, classificacao, pontuacao, participantes e as
--    apostas do proprio usuario), so com as colunas usadas.
-- 3. get_season_bets(): apostas visiveis filtradas por temporada/rodada/usuario
--    (extrato de um participante e backup do admin), com a mesma regra de
--    ocultacao de get_visible_bets.

begin;

-- ---------------------------------------------------------------------------
-- 1. Carimbo de versao
-- ---------------------------------------------------------------------------
create table if not exists public.app_meta (
    id integer primary key default 1,
    version bigint not null default 1,
    updated_at timestamptz not null default now(),
    constraint app_meta_singleton check (id = 1)
);

insert into public.app_meta (id) values (1) on conflict (id) do nothing;

alter table public.app_meta enable row level security;

drop policy if exists "authenticated read app meta" on public.app_meta;
create policy "authenticated read app meta" on public.app_meta
    for select to authenticated using (true);

create or replace function public.bump_app_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.app_meta set version = version + 1, updated_at = now() where id = 1;
    return null;
end;
$$;

revoke all on function public.bump_app_version() from public;
revoke all on function public.bump_app_version() from anon;

do $$
declare
    t text;
begin
    foreach t in array array['seasons', 'profiles', 'rounds', 'matches', 'standings', 'scoring_settings', 'bets']
    loop
        execute format('drop trigger if exists trg_bump_app_version on public.%I', t);
        execute format(
            'create trigger trg_bump_app_version after insert or update or delete on public.%I
             for each statement execute function public.bump_app_version()', t);
    end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Snapshot da temporada (security invoker: respeita RLS do usuario)
-- ---------------------------------------------------------------------------
create or replace function public.get_app_snapshot(p_season_key text default null)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
    v_season text := coalesce(p_season_key, public.current_season_key());
    v_uid uuid := auth.uid();
begin
    if v_uid is null then
        raise exception 'Usuario nao autenticado';
    end if;

    return jsonb_build_object(
        'version', (select version from public.app_meta where id = 1),
        'season', (
            select jsonb_build_object('key', s.key, 'name', s.name)
            from public.seasons s where s.key = v_season
        ),
        'profiles', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', p.id, 'legacy_id', p.legacy_id, 'username', p.username,
                'name', p.name, 'role', p.role) order by p.username)
            from public.profiles p
        ), '[]'::jsonb),
        'rounds', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', r.id, 'name', r.name, 'number', r.number, 'season_key', r.season_key)
                order by r.number)
            from public.rounds r where r.season_key = v_season
        ), '[]'::jsonb),
        'matches', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', m.id, 'round_id', m.round_id, 'match_date', m.match_date,
                'match_time', m.match_time, 'home_team', m.home_team, 'away_team', m.away_team,
                'is_bonus', m.is_bonus, 'result', m.result,
                'score_home', m.score_home, 'score_away', m.score_away)
                order by m.match_date, m.match_time)
            from public.matches m
            join public.rounds r on r.id = m.round_id
            where r.season_key = v_season
        ), '[]'::jsonb),
        'standings', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', st.id, 'position', st.position, 'team', st.team, 'points', st.points,
                'played', st.played, 'wins', st.wins, 'draws', st.draws, 'losses', st.losses,
                'goals_for', st.goals_for, 'goals_against', st.goals_against,
                'goal_diff', st.goal_diff)
                order by st.position)
            from public.standings st where st.season_key = v_season
        ), '[]'::jsonb),
        'scoring_settings', (
            select to_jsonb(ss) from public.scoring_settings ss where ss.id = 'default'
        ),
        'my_bets', coalesce((
            select jsonb_agg(jsonb_build_object(
                'user_id', b.user_id, 'match_id', b.match_id, 'pick', b.pick,
                'score_home', b.score_home, 'score_away', b.score_away,
                'created_at', b.created_at))
            from public.bets b
            join public.matches m on m.id = b.match_id
            join public.rounds r on r.id = m.round_id
            where b.user_id = v_uid and r.season_key = v_season
        ), '[]'::jsonb)
    );
end;
$$;

revoke all on function public.get_app_snapshot(text) from public;
revoke all on function public.get_app_snapshot(text) from anon;
grant execute on function public.get_app_snapshot(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Apostas visiveis filtradas
-- ---------------------------------------------------------------------------
create or replace function public.get_season_bets(
    p_season_key text default null,
    p_round_id text default null,
    p_user_id uuid default null
)
returns table (
    user_id uuid,
    match_id text,
    pick text,
    score_home integer,
    score_away integer,
    created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
    with viewer as (
        select auth.uid() as uid, public.is_admin() as is_admin,
               coalesce(p_season_key, public.current_season_key()) as season_key
    )
    select
        b.user_id,
        b.match_id,
        case when v.is_admin or b.user_id = v.uid or m.result is not null
                  or (m.match_date + m.match_time) <= (now() at time zone 'America/Sao_Paulo')
             then b.pick end,
        case when v.is_admin or b.user_id = v.uid or m.result is not null
                  or (m.match_date + m.match_time) <= (now() at time zone 'America/Sao_Paulo')
             then b.score_home end,
        case when v.is_admin or b.user_id = v.uid or m.result is not null
                  or (m.match_date + m.match_time) <= (now() at time zone 'America/Sao_Paulo')
             then b.score_away end,
        b.created_at
    from public.bets b
    join public.matches m on m.id = b.match_id
    join public.rounds r on r.id = m.round_id
    cross join viewer v
    where v.uid is not null
      and r.season_key = v.season_key
      and (p_round_id is null or m.round_id = p_round_id)
      and (p_user_id is null or b.user_id = p_user_id)
    order by m.match_date, m.match_time, b.user_id;
$$;

revoke all on function public.get_season_bets(text, text, uuid) from public;
revoke all on function public.get_season_bets(text, text, uuid) from anon;
grant execute on function public.get_season_bets(text, text, uuid) to authenticated;

commit;
