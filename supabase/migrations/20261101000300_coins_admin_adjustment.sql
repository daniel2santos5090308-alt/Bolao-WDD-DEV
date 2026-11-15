-- Bolao WDD 2027 - ajuste manual auditavel de WDD Coins
-- Execute no ambiente DEV depois de supabase_wdd_coins_schema.sql e supabase_wdd_coins_wallet_init.sql.

create or replace function public.adjust_coin_wallet_by_admin(
    p_season_key text,
    p_user_id uuid,
    p_amount integer,
    p_description text
)
returns table (
    adjusted_user_id uuid,
    adjusted_amount integer,
    adjusted_available_balance integer,
    adjustment_description text
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    v_wallet public.coin_wallets%rowtype;
    v_description text;
begin
    if auth.uid() is null or not public.is_admin() then
        raise exception 'Apenas administradores podem ajustar carteiras WDD Coins';
    end if;

    if p_user_id is null then
        raise exception 'Usuario alvo nao informado';
    end if;

    if p_amount = 0 then
        raise exception 'O valor do ajuste precisa ser diferente de zero';
    end if;

    v_description := nullif(trim(coalesce(p_description, '')), '');
    if v_description is null then
        raise exception 'Informe o motivo do ajuste';
    end if;

    perform public.initialize_coin_wallet(p_season_key, p_user_id);

    select *
    into v_wallet
    from public.coin_wallets cw
    where cw.season_key = p_season_key
      and cw.user_id = p_user_id
    for update;

    if not found then
        raise exception 'Carteira WDD Coins nao encontrada';
    end if;

    if v_wallet.available_balance + p_amount < 0 then
        raise exception 'Saldo insuficiente para aplicar este ajuste';
    end if;

    update public.coin_wallets cw
    set
        available_balance = cw.available_balance + p_amount,
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
        case when p_amount > 0 then 'admin_adjustment' else 'reversal' end,
        p_amount,
        v_wallet.available_balance,
        v_wallet.locked_balance,
        'admin_adjustment',
        gen_random_uuid()::text,
        v_description,
        jsonb_build_object('source', 'admin_manual_adjustment'),
        auth.uid()
    );

    adjusted_user_id := p_user_id;
    adjusted_amount := p_amount;
    adjusted_available_balance := v_wallet.available_balance;
    adjustment_description := v_description;
    return next;
end;
$$;

revoke all on function public.adjust_coin_wallet_by_admin(text, uuid, integer, text) from public;
revoke all on function public.adjust_coin_wallet_by_admin(text, uuid, integer, text) from anon;
grant execute on function public.adjust_coin_wallet_by_admin(text, uuid, integer, text) to authenticated;
