-- Bolao WDD 2027 - inicializacao segura de carteiras WDD Coins
-- Execute no ambiente DEV depois do supabase_wdd_coins_schema.sql.

drop function if exists public.initialize_coin_wallets_for_season(text, boolean);
drop function if exists public.initialize_coin_wallet(text, uuid);

create or replace function public.initialize_coin_wallet(
    p_season_key text default '2027',
    p_user_id uuid default auth.uid()
)
returns table (
    wallet_id uuid,
    wallet_season_key text,
    wallet_user_id uuid,
    wallet_available_balance integer,
    wallet_locked_balance integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_wallet public.coin_wallets%rowtype;
    v_settings public.coin_settings%rowtype;
    v_initial_balance integer;
begin
    if auth.uid() is null then
        raise exception 'Usuario nao autenticado';
    end if;

    if p_user_id is null then
        raise exception 'Usuario alvo nao informado';
    end if;

    if p_user_id <> auth.uid() and not public.is_admin() then
        raise exception 'Acesso negado para inicializar carteira de outro usuario';
    end if;

    select *
    into v_settings
    from public.coin_settings cs
    where cs.season_key = p_season_key;

    if not found then
        raise exception 'Configuracao de WDD Coins nao encontrada para temporada %', p_season_key;
    end if;

    v_initial_balance := coalesce(v_settings.initial_balance, 0);

    insert into public.coin_wallets (season_key, user_id, available_balance, locked_balance)
    values (p_season_key, p_user_id, 0, 0)
    on conflict on constraint coin_wallets_unique_user_season do nothing;

    select *
    into v_wallet
    from public.coin_wallets cw
    where cw.season_key = p_season_key
      and cw.user_id = p_user_id
    for update;

    if not found then
        raise exception 'Nao foi possivel criar ou localizar a carteira';
    end if;

    if v_initial_balance > 0 and not exists (
        select 1
        from public.coin_transactions ct
        where ct.season_key = p_season_key
          and ct.user_id = p_user_id
          and ct.transaction_type = 'initial_balance'
    ) then
        update public.coin_wallets cw
        set
            available_balance = cw.available_balance + v_initial_balance,
            updated_at = now()
        where cw.id = v_wallet.id
        returning *
        into v_wallet;

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
            metadata,
            created_by
        )
        values (
            v_wallet.id,
            p_season_key,
            p_user_id,
            'initial_balance',
            v_initial_balance,
            v_wallet.available_balance,
            v_wallet.locked_balance,
            'season',
            p_season_key,
            'Saldo inicial WDD Coins',
            jsonb_build_object('source', 'initialize_coin_wallet'),
            auth.uid()
        );
    end if;

    return query
    select
        v_wallet.id,
        v_wallet.season_key,
        v_wallet.user_id,
        v_wallet.available_balance,
        v_wallet.locked_balance;
end;
$$;

revoke all on function public.initialize_coin_wallet(text, uuid) from public;
revoke all on function public.initialize_coin_wallet(text, uuid) from anon;
grant execute on function public.initialize_coin_wallet(text, uuid) to authenticated;

create or replace function public.initialize_coin_wallets_for_season(
    p_season_key text default '2027',
    p_include_admins boolean default false
)
returns table (
    target_user_id uuid,
    target_user_name text,
    target_wallet_id uuid,
    target_available_balance integer,
    target_locked_balance integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_profile record;
    v_wallet record;
begin
    if auth.uid() is null or not public.is_admin() then
        raise exception 'Apenas administradores podem inicializar carteiras em lote';
    end if;

    for v_profile in
        select p.id, p.name, p.role
        from public.profiles p
        where p_include_admins or coalesce(p.role, 'user') <> 'admin'
        order by p.name
    loop
        select *
        into v_wallet
        from public.initialize_coin_wallet(p_season_key, v_profile.id);

        target_user_id := v_profile.id;
        target_user_name := v_profile.name;
        target_wallet_id := v_wallet.wallet_id;
        target_available_balance := v_wallet.wallet_available_balance;
        target_locked_balance := v_wallet.wallet_locked_balance;
        return next;
    end loop;
end;
$$;

revoke all on function public.initialize_coin_wallets_for_season(text, boolean) from public;
revoke all on function public.initialize_coin_wallets_for_season(text, boolean) from anon;
grant execute on function public.initialize_coin_wallets_for_season(text, boolean) to authenticated;
