-- Bolao WDD 2027 - WDD Coins schema inicial
-- Execute primeiro no ambiente DEV do Supabase.
-- Este script cria a base de carteira, extrato imutavel e configuracoes por temporada.

create extension if not exists pgcrypto;

create table if not exists public.coin_settings (
    season_key text primary key,
    initial_balance integer not null default 0,
    first_place_reward integer not null default 1000,
    second_place_reward integer not null default 750,
    third_place_reward integer not null default 500,
    exact_score_reward integer not null default 50,
    bonus_exact_score_reward integer not null default 100,
    full_round_participation_reward integer not null default 200,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint coin_settings_season_key_not_blank check (length(trim(season_key)) > 0),
    constraint coin_settings_non_negative_values check (
        initial_balance >= 0
        and first_place_reward >= 0
        and second_place_reward >= 0
        and third_place_reward >= 0
        and exact_score_reward >= 0
        and bonus_exact_score_reward >= 0
        and full_round_participation_reward >= 0
    )
);

insert into public.coin_settings (season_key, initial_balance)
values ('2027', 0)
on conflict (season_key) do nothing;

create table if not exists public.coin_wallets (
    id uuid primary key default gen_random_uuid(),
    season_key text not null references public.coin_settings(season_key) on update cascade on delete restrict,
    user_id uuid not null references public.profiles(id) on update cascade on delete restrict,
    available_balance integer not null default 0,
    locked_balance integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint coin_wallets_available_non_negative check (available_balance >= 0),
    constraint coin_wallets_locked_non_negative check (locked_balance >= 0),
    constraint coin_wallets_unique_user_season unique (season_key, user_id)
);

create table if not exists public.coin_transactions (
    id uuid primary key default gen_random_uuid(),
    wallet_id uuid not null references public.coin_wallets(id) on update cascade on delete restrict,
    season_key text not null,
    user_id uuid not null,
    transaction_type text not null,
    amount integer not null,
    available_balance_after integer not null,
    locked_balance_after integer not null,
    reference_type text,
    reference_id text,
    description text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_by uuid references public.profiles(id) on update cascade on delete set null,
    created_at timestamptz not null default now(),
    constraint coin_transactions_amount_not_zero check (amount <> 0),
    constraint coin_transactions_balances_non_negative check (
        available_balance_after >= 0
        and locked_balance_after >= 0
    ),
    constraint coin_transactions_description_not_blank check (length(trim(description)) > 0),
    constraint coin_transactions_type_allowed check (
        transaction_type in (
            'initial_balance',
            'round_reward',
            'bonus_reward',
            'full_round_reward',
            'admin_adjustment',
            'purchase',
            'challenge_lock',
            'challenge_release',
            'challenge_reward',
            'reversal'
        )
    )
);

create index if not exists idx_coin_wallets_user_season
on public.coin_wallets (user_id, season_key);

create index if not exists idx_coin_transactions_wallet_created
on public.coin_transactions (wallet_id, created_at desc);

create index if not exists idx_coin_transactions_user_season_created
on public.coin_transactions (user_id, season_key, created_at desc);

create index if not exists idx_coin_transactions_reference
on public.coin_transactions (reference_type, reference_id);

create unique index if not exists uq_coin_transactions_initial_balance
on public.coin_transactions (season_key, user_id, transaction_type)
where transaction_type = 'initial_balance';

alter table public.coin_settings enable row level security;
alter table public.coin_wallets enable row level security;
alter table public.coin_transactions enable row level security;

drop policy if exists "authenticated read coin settings" on public.coin_settings;
create policy "authenticated read coin settings"
on public.coin_settings
for select
to authenticated
using (true);

drop policy if exists "admins manage coin settings" on public.coin_settings;
create policy "admins manage coin settings"
on public.coin_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "users read own coin wallets" on public.coin_wallets;
create policy "users read own coin wallets"
on public.coin_wallets
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "admins manage coin wallets" on public.coin_wallets;
create policy "admins manage coin wallets"
on public.coin_wallets
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "users read own coin transactions" on public.coin_transactions;
create policy "users read own coin transactions"
on public.coin_transactions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "admins read all coin transactions" on public.coin_transactions;
create policy "admins read all coin transactions"
on public.coin_transactions
for select
to authenticated
using (public.is_admin());

drop policy if exists "admins insert coin transactions" on public.coin_transactions;
create policy "admins insert coin transactions"
on public.coin_transactions
for insert
to authenticated
with check (public.is_admin());

-- Transacoes nao devem ser editadas ou apagadas. Correcoes futuras devem usar transaction_type = 'reversal'.
revoke update, delete on public.coin_transactions from authenticated;

create or replace view public.coin_wallet_summary
with (security_invoker = true)
as
select
    w.id,
    w.season_key,
    w.user_id,
    p.name as user_name,
    w.available_balance,
    w.locked_balance,
    (w.available_balance + w.locked_balance) as total_balance,
    w.updated_at
from public.coin_wallets w
join public.profiles p on p.id = w.user_id;

grant select on public.coin_wallet_summary to authenticated;
