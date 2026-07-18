-- Bolao WDD - modelo de pontuacao por placar
-- Execute no Supabase SQL Editor antes de publicar esta versao.

alter table public.matches
    add column if not exists is_bonus boolean not null default false;

alter table public.bets
    add column if not exists score_home integer,
    add column if not exists score_away integer;

alter table public.bets
    drop constraint if exists bets_score_home_non_negative,
    add constraint bets_score_home_non_negative check (score_home is null or score_home >= 0);

alter table public.bets
    drop constraint if exists bets_score_away_non_negative,
    add constraint bets_score_away_non_negative check (score_away is null or score_away >= 0);

create table if not exists public.scoring_settings (
    id text primary key default 'default',
    exact_score_points numeric(8, 2) not null default 10,
    near_miss_points numeric(8, 2) not null default 7,
    correct_result_points numeric(8, 2) not null default 5,
    wrong_points numeric(8, 2) not null default 0,
    near_miss_goal_diff integer not null default 1,
    bonus_multiplier numeric(8, 2) not null default 2,
    bonus_enabled boolean not null default true,
    updated_at timestamptz not null default now(),
    constraint scoring_settings_singleton check (id = 'default'),
    constraint scoring_settings_non_negative check (
        exact_score_points >= 0
        and near_miss_points >= 0
        and correct_result_points >= 0
        and wrong_points >= 0
        and near_miss_goal_diff >= 0
        and bonus_multiplier >= 1
    )
);

insert into public.scoring_settings (
    id,
    exact_score_points,
    near_miss_points,
    correct_result_points,
    wrong_points,
    near_miss_goal_diff,
    bonus_multiplier,
    bonus_enabled
)
values ('default', 10, 7, 5, 0, 1, 2, true)
on conflict (id) do nothing;

alter table public.scoring_settings enable row level security;

drop policy if exists "authenticated users read scoring settings" on public.scoring_settings;
create policy "authenticated users read scoring settings"
on public.scoring_settings
for select
to authenticated
using (true);

drop policy if exists "admins manage scoring settings" on public.scoring_settings;
create policy "admins manage scoring settings"
on public.scoring_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop function if exists public.get_visible_bets();

create function public.get_visible_bets()
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
security definer
set search_path = public
as $$
    select
        b.user_id,
        b.legacy_user_id,
        b.match_id,
        case
            when b.user_id = auth.uid()
                or public.is_admin()
                or m.result is not null
                or ((m.match_date::text || ' ' || m.match_time::text)::timestamp <= now())
            then b.pick
            else null
        end as pick,
        case
            when b.user_id = auth.uid()
                or public.is_admin()
                or m.result is not null
                or ((m.match_date::text || ' ' || m.match_time::text)::timestamp <= now())
            then b.score_home
            else null
        end as score_home,
        case
            when b.user_id = auth.uid()
                or public.is_admin()
                or m.result is not null
                or ((m.match_date::text || ' ' || m.match_time::text)::timestamp <= now())
            then b.score_away
            else null
        end as score_away,
        b.created_at,
        b.updated_at
    from public.bets b
    join public.matches m on m.id = b.match_id;
$$;

grant execute on function public.get_visible_bets() to authenticated;
