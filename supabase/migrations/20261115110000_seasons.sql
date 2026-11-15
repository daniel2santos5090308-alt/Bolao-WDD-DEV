-- Bolao WDD 2027 - Fase 1.1: temporadas (somente DEV)
--
-- - Cria public.seasons (2026 encerrada, 2027 ativa).
-- - rounds e standings ganham season_key. Dados existentes -> '2026'.
-- - Novas rodadas/linhas de classificacao recebem automaticamente a temporada
--   ativa (default current_season_key()), sem mudar o front.
-- - coin_settings passa a referenciar seasons.

begin;

create table if not exists public.seasons (
    key text primary key,
    name text not null,
    starts_on date,
    ends_on date,
    is_active boolean not null default false,
    created_at timestamptz not null default now(),
    constraint seasons_key_not_blank check (length(trim(key)) > 0)
);

-- No maximo uma temporada ativa
create unique index if not exists uq_seasons_single_active
    on public.seasons (is_active) where is_active;

insert into public.seasons (key, name, starts_on, ends_on, is_active) values
    ('2026', 'Brasileirao 2026', null, null, false),
    ('2027', 'Brasileirao 2027', '2027-01-27', null, true)
on conflict (key) do nothing;

-- Toda temporada ja usada em coin_settings precisa existir em seasons
insert into public.seasons (key, name)
select cs.season_key, 'Temporada ' || cs.season_key
from public.coin_settings cs
on conflict (key) do nothing;

alter table public.seasons enable row level security;

drop policy if exists "authenticated read seasons" on public.seasons;
create policy "authenticated read seasons" on public.seasons
    for select to authenticated using (true);

drop policy if exists "admins manage seasons" on public.seasons;
create policy "admins manage seasons" on public.seasons
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.current_season_key()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select key from public.seasons where is_active limit 1;
$$;

revoke all on function public.current_season_key() from public;
revoke all on function public.current_season_key() from anon;
grant execute on function public.current_season_key() to authenticated;

-- rounds
alter table public.rounds add column if not exists season_key text;
update public.rounds set season_key = '2026' where season_key is null;
alter table public.rounds
    alter column season_key set default public.current_season_key(),
    alter column season_key set not null;
alter table public.rounds drop constraint if exists rounds_season_key_fkey;
alter table public.rounds
    add constraint rounds_season_key_fkey foreign key (season_key)
    references public.seasons(key) on update cascade on delete restrict;
create index if not exists idx_rounds_season_number on public.rounds (season_key, number);

-- standings
alter table public.standings add column if not exists season_key text;
update public.standings set season_key = '2026' where season_key is null;
alter table public.standings
    alter column season_key set default public.current_season_key(),
    alter column season_key set not null;
alter table public.standings drop constraint if exists standings_season_key_fkey;
alter table public.standings
    add constraint standings_season_key_fkey foreign key (season_key)
    references public.seasons(key) on update cascade on delete restrict;
create index if not exists idx_standings_season_position on public.standings (season_key, position);

-- coin_settings -> seasons
alter table public.coin_settings drop constraint if exists coin_settings_season_key_seasons_fkey;
alter table public.coin_settings
    add constraint coin_settings_season_key_seasons_fkey foreign key (season_key)
    references public.seasons(key) on update cascade on delete restrict;

commit;
