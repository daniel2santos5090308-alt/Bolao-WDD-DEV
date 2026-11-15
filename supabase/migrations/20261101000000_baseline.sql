-- Bolao WDD - BASELINE do schema principal (reconstruido do DEV em 2026-11-15)
--
-- Serve para recriar um banco do zero. NAO precisa ser rodado no DEV atual
-- (as tabelas ja existem). E idempotente: rodar de novo nao altera dados.
--
-- Ordem completa das migrations: veja supabase/README.md

begin;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    legacy_id text,
    username text not null unique,
    name text not null,
    role text not null default 'user' check (role in ('admin', 'user')),
    created_at timestamptz not null default now()
);

create table if not exists public.rounds (
    id text primary key,
    name text not null,
    number integer not null,
    created_at timestamptz not null default now()
);

create table if not exists public.matches (
    id text primary key,
    round_id text not null references public.rounds(id) on delete cascade,
    match_date date not null,
    match_time time not null,
    home_team text not null,
    away_team text not null,
    odd_home numeric(8,2) not null default 1,
    odd_draw numeric(8,2) not null default 1,
    odd_away numeric(8,2) not null default 1,
    result text check (result in ('home', 'draw', 'away')),
    created_at timestamptz not null default now(),
    is_bonus boolean not null default false,
    score_home integer constraint matches_score_home_non_negative check (score_home is null or score_home >= 0),
    score_away integer constraint matches_score_away_non_negative check (score_away is null or score_away >= 0)
);

create table if not exists public.bets (
    user_id uuid not null references auth.users(id) on delete cascade,
    legacy_user_id text,
    match_id text not null references public.matches(id) on delete cascade,
    pick text check (pick in ('home', 'draw', 'away')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    score_home integer constraint bets_score_home_non_negative check (score_home is null or score_home >= 0),
    score_away integer constraint bets_score_away_non_negative check (score_away is null or score_away >= 0),
    primary key (user_id, match_id)
);

create table if not exists public.standings (
    id text primary key,
    position integer not null,
    team text not null,
    points integer not null default 0,
    played integer not null default 0,
    wins integer not null default 0,
    draws integer not null default 0,
    losses integer not null default 0,
    goals_for integer not null default 0,
    goals_against integer not null default 0,
    goal_diff integer not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.scoring_settings (
    id text primary key default 'default',
    exact_score_points numeric(8,2) not null default 10,
    near_miss_points numeric(8,2) not null default 7,
    correct_result_points numeric(8,2) not null default 5,
    wrong_points numeric(8,2) not null default 0,
    near_miss_goal_diff integer not null default 1,
    bonus_multiplier numeric(8,2) not null default 2,
    bonus_enabled boolean not null default true,
    updated_at timestamptz not null default now(),
    constraint scoring_settings_singleton check (id = 'default'),
    constraint scoring_settings_non_negative check (
        exact_score_points >= 0 and near_miss_points >= 0 and correct_result_points >= 0
        and wrong_points >= 0 and near_miss_goal_diff >= 0 and bonus_multiplier >= 1
    )
);

insert into public.scoring_settings (id) values ('default') on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- is_admin (security definer: evita recursao de RLS em profiles)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.rounds enable row level security;
alter table public.matches enable row level security;
alter table public.bets enable row level security;
alter table public.standings enable row level security;
alter table public.scoring_settings enable row level security;

drop policy if exists "authenticated can read profiles" on public.profiles;
create policy "authenticated can read profiles" on public.profiles
    for select to authenticated using (true);
drop policy if exists "admin manage profiles" on public.profiles;
create policy "admin manage profiles" on public.profiles
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authenticated can read rounds" on public.rounds;
create policy "authenticated can read rounds" on public.rounds
    for select to authenticated using (true);
drop policy if exists "admin manage rounds" on public.rounds;
create policy "admin manage rounds" on public.rounds
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authenticated can read matches" on public.matches;
create policy "authenticated can read matches" on public.matches
    for select to authenticated using (true);
drop policy if exists "admin manage matches" on public.matches;
create policy "admin manage matches" on public.matches
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authenticated can read standings" on public.standings;
create policy "authenticated can read standings" on public.standings
    for select to authenticated using (true);
drop policy if exists "admin manage standings" on public.standings;
create policy "admin manage standings" on public.standings
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authenticated users read scoring settings" on public.scoring_settings;
create policy "authenticated users read scoring settings" on public.scoring_settings
    for select to authenticated using (true);
drop policy if exists "admins manage scoring settings" on public.scoring_settings;
create policy "admins manage scoring settings" on public.scoring_settings
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- bets: leitura direta somente das proprias apostas (ou admin).
-- Apostas dos outros so pela RPC get_visible_bets / get_ranking.
drop policy if exists "users read own bets" on public.bets;
create policy "users read own bets" on public.bets
    for select to authenticated using (user_id = auth.uid());
drop policy if exists "admin read all bets" on public.bets;
create policy "admin read all bets" on public.bets
    for select to authenticated using (public.is_admin());
drop policy if exists "admin manage bets" on public.bets;
create policy "admin manage bets" on public.bets
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "users insert own bets before match starts" on public.bets;
create policy "users insert own bets before match starts" on public.bets
    for insert to authenticated
    with check (
        user_id = auth.uid()
        and exists (
            select 1 from public.matches m
            where m.id = match_id and m.result is null
              and (m.match_date + m.match_time) > (now() at time zone 'America/Sao_Paulo')
        )
    );

drop policy if exists "users update own bets before match starts" on public.bets;
create policy "users update own bets before match starts" on public.bets
    for update to authenticated
    using (
        user_id = auth.uid()
        and exists (
            select 1 from public.matches m
            where m.id = match_id and m.result is null
              and (m.match_date + m.match_time) > (now() at time zone 'America/Sao_Paulo')
        )
    )
    with check (
        user_id = auth.uid()
        and exists (
            select 1 from public.matches m
            where m.id = match_id and m.result is null
              and (m.match_date + m.match_time) > (now() at time zone 'America/Sao_Paulo')
        )
    );

commit;
