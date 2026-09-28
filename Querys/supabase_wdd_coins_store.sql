-- Bolao WDD 2027 - loja e inventario WDD Coins
-- Execute no ambiente DEV depois dos scripts de WDD Coins.

create table if not exists public.coin_store_items (
    id uuid primary key default gen_random_uuid(),
    season_key text not null references public.coin_settings(season_key) on update cascade on delete restrict,
    code text not null,
    name text not null,
    description text not null,
    item_type text not null,
    price integer not null default 0,
    rarity text not null default 'comum',
    preview_value text,
    is_active boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint coin_store_items_code_unique unique (season_key, code),
    constraint coin_store_items_price_non_negative check (price >= 0),
    constraint coin_store_items_text_not_blank check (
        length(trim(code)) > 0
        and length(trim(name)) > 0
        and length(trim(description)) > 0
        and length(trim(item_type)) > 0
    )
);

create table if not exists public.coin_user_items (
    id uuid primary key default gen_random_uuid(),
    season_key text not null references public.coin_settings(season_key) on update cascade on delete restrict,
    user_id uuid not null references public.profiles(id) on update cascade on delete cascade,
    item_id uuid not null references public.coin_store_items(id) on update cascade on delete restrict,
    purchased_at timestamptz not null default now(),
    is_equipped boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint coin_user_items_unique_user_item unique (season_key, user_id, item_id)
);

create index if not exists idx_coin_store_items_season_active
on public.coin_store_items (season_key, is_active, sort_order, name);

create index if not exists idx_coin_user_items_user_season
on public.coin_user_items (user_id, season_key, purchased_at desc);

alter table public.coin_store_items enable row level security;
alter table public.coin_user_items enable row level security;

drop policy if exists "authenticated read active store items" on public.coin_store_items;
create policy "authenticated read active store items"
on public.coin_store_items
for select
to authenticated
using (is_active = true or public.is_admin());

drop policy if exists "admins manage store items" on public.coin_store_items;
create policy "admins manage store items"
on public.coin_store_items
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "users read own inventory" on public.coin_user_items;
create policy "users read own inventory"
on public.coin_user_items
for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "admins manage user inventory" on public.coin_user_items;
create policy "admins manage user inventory"
on public.coin_user_items
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.coin_store_items (
    season_key,
    code,
    name,
    description,
    item_type,
    price,
    rarity,
    preview_value,
    sort_order
) values
    ('2027', 'frame_gold_goal', 'Moldura Gol de Ouro', 'Destaque dourado para o perfil do participante.', 'profile_frame', 250, 'raro', '#f5b315', 10),
    ('2027', 'frame_green_field', 'Moldura Campo WDD', 'Moldura verde inspirada no gramado para perfil.', 'profile_frame', 150, 'comum', '#0f7a4f', 20),
    ('2027', 'card_bonus_glow', 'Card Bonus Iluminado', 'Visual especial para destacar seus cards de jogos bonus.', 'match_card_skin', 350, 'epico', '#f59e0b', 30),
    ('2027', 'badge_cravador', 'Selo Cravador', 'Selo para exibir no perfil quando quiser mostrar confiança.', 'profile_badge', 200, 'raro', 'CRV', 40)
on conflict (season_key, code) do update
set
    name = excluded.name,
    description = excluded.description,
    item_type = excluded.item_type,
    price = excluded.price,
    rarity = excluded.rarity,
    preview_value = excluded.preview_value,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

create or replace function public.purchase_coin_store_item(
    p_season_key text,
    p_item_id uuid
)
returns table (
    item_id uuid,
    available_balance integer,
    locked_balance integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_item public.coin_store_items%rowtype;
    v_wallet public.coin_wallets%rowtype;
begin
    if v_user_id is null then
        raise exception 'Usuario autenticado nao encontrado';
    end if;

    select *
    into v_item
    from public.coin_store_items csi
    where csi.id = p_item_id
      and csi.season_key = p_season_key
      and csi.is_active = true;

    if not found then
        raise exception 'Item da loja nao encontrado ou indisponivel';
    end if;

    if exists (
        select 1
        from public.coin_user_items cui
        where cui.season_key = p_season_key
          and cui.user_id = v_user_id
          and cui.item_id = p_item_id
    ) then
        raise exception 'Item ja adquirido';
    end if;

    perform public.initialize_coin_wallet(p_season_key, v_user_id);

    select *
    into v_wallet
    from public.coin_wallets cw
    where cw.season_key = p_season_key
      and cw.user_id = v_user_id
    for update;

    if not found then
        raise exception 'Carteira WDD Coins nao encontrada';
    end if;

    if v_wallet.available_balance < v_item.price then
        raise exception 'Saldo WDD Coins insuficiente';
    end if;

    update public.coin_wallets cw
    set
        available_balance = cw.available_balance - v_item.price,
        updated_at = now()
    where cw.id = v_wallet.id
    returning *
    into v_wallet;

    insert into public.coin_user_items (
        season_key,
        user_id,
        item_id
    ) values (
        p_season_key,
        v_user_id,
        p_item_id
    );

    insert into public.coin_transactions (
        wallet_id,
        season_key,
        user_id,
        transaction_type,
        amount,
        available_balance_after,
        locked_balance_after,
        reference_type,
        reference_id,
        description,
        metadata
    ) values (
        v_wallet.id,
        p_season_key,
        v_user_id,
        'purchase',
        v_item.price * -1,
        v_wallet.available_balance,
        v_wallet.locked_balance,
        'store_item',
        v_item.id,
        'Compra na loja: ' || v_item.name,
        jsonb_build_object(
            'item_code', v_item.code,
            'item_type', v_item.item_type,
            'rarity', v_item.rarity
        )
    );

    return query
    select
        v_item.id,
        v_wallet.available_balance,
        v_wallet.locked_balance;
end;
$$;

revoke all on function public.purchase_coin_store_item(text, uuid) from public;
revoke all on function public.purchase_coin_store_item(text, uuid) from anon;
grant execute on function public.purchase_coin_store_item(text, uuid) to authenticated;
