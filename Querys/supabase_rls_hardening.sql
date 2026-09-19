-- Hardening RLS para BolaoWDDDEV / Supabase Free
-- Rode no SQL Editor do Supabase depois de validar que as tabelas existem.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.rounds enable row level security;
alter table public.matches enable row level security;
alter table public.bets enable row level security;
alter table public.standings enable row level security;

drop policy if exists "authenticated can read profiles" on public.profiles;
drop policy if exists "authenticated can read rounds" on public.rounds;
drop policy if exists "authenticated can read matches" on public.matches;
drop policy if exists "authenticated can read standings" on public.standings;
drop policy if exists "authenticated can read bets" on public.bets;
drop policy if exists "users read own bets" on public.bets;
drop policy if exists "admin read all bets" on public.bets;

drop policy if exists "users insert own bets" on public.bets;
drop policy if exists "users update own bets" on public.bets;
drop policy if exists "users insert own bets before match starts" on public.bets;
drop policy if exists "users update own bets before match starts" on public.bets;

drop policy if exists "admin manage profiles" on public.profiles;
drop policy if exists "admin manage rounds" on public.rounds;
drop policy if exists "admin manage matches" on public.matches;
drop policy if exists "admin manage standings" on public.standings;
drop policy if exists "admin manage bets" on public.bets;

create policy "authenticated can read profiles"
on public.profiles for select
to authenticated
using (true);

create policy "authenticated can read rounds"
on public.rounds for select
to authenticated
using (true);

create policy "authenticated can read matches"
on public.matches for select
to authenticated
using (true);

create policy "authenticated can read standings"
on public.standings for select
to authenticated
using (true);

create policy "users read own bets"
on public.bets for select
to authenticated
using (user_id = auth.uid());

create policy "admin read all bets"
on public.bets for select
to authenticated
using (public.is_admin());

create or replace function public.get_visible_bets()
returns table (
  user_id uuid,
  legacy_user_id text,
  match_id text,
  pick text,
  created_at timestamptz
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
        or (m.match_date + m.match_time) <= (now() at time zone 'America/Sao_Paulo')
      then b.pick
      else null
    end as pick,
    b.created_at
  from public.bets b
  join public.matches m on m.id = b.match_id
  where auth.uid() is not null;
$$;

revoke all on function public.get_visible_bets() from public;
revoke all on function public.get_visible_bets() from anon;
grant execute on function public.get_visible_bets() to authenticated;

create policy "users insert own bets before match starts"
on public.bets for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.result is null
      and (m.match_date + m.match_time) > (now() at time zone 'America/Sao_Paulo')
  )
);

create policy "users update own bets before match starts"
on public.bets for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.result is null
      and (m.match_date + m.match_time) > (now() at time zone 'America/Sao_Paulo')
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.result is null
      and (m.match_date + m.match_time) > (now() at time zone 'America/Sao_Paulo')
  )
);

create policy "admin manage profiles"
on public.profiles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admin manage rounds"
on public.rounds for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admin manage matches"
on public.matches for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admin manage standings"
on public.standings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admin manage bets"
on public.bets for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
