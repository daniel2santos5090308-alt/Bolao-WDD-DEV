-- Bolao WDD 2027 - Fase 10: WDD Coins continuas e itens permanentes
--
-- Decisao de 16/11/2026: as Coins nao zeram entre temporadas e os itens
-- comprados sao do participante para sempre.
--
-- 1. Saldo transportado: ao ativar uma temporada, o saldo DISPONIVEL de cada
--    participante sai da carteira da temporada anterior ("Saldo levado para
--    a temporada X") e entra na nova ("Saldo trazido da temporada Y").
--    O extrato continua por temporada e tudo fica auditado.
-- 2. Bonus de boas-vindas (coin_settings.initial_balance): pago uma unica vez
--    por participante, na primeira carteira dele. Quem ja recebeu nao recebe
--    de novo nas temporadas seguintes.
-- 3. Itens permanentes: a compra recusa um item que o participante ja tem,
--    mesmo comprado em outra temporada (mesmo codigo). E o participante
--    sempre enxerga os itens que possui, mesmo os que sairam da loja.
-- Os saldos e lancamentos existentes nao sao alterados.

begin;

-- 1. Novos tipos de lancamento
alter table public.coin_transactions drop constraint if exists coin_transactions_type_allowed;
alter table public.coin_transactions add constraint coin_transactions_type_allowed check (
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
        'reversal',
        'season_carry_out',
        'season_carry_in'
    )
);

-- 2. Carteira: bonus de boas-vindas so na primeira vez (em qualquer temporada)
create or replace function public.initialize_coin_wallet(
    p_season_key text default public.current_season_key(),
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
#variable_conflict use_column
declare
    v_wallet public.coin_wallets%rowtype;
    v_settings public.coin_settings%rowtype;
    v_initial_balance integer;
begin
    if auth.uid() is null then
        raise exception 'Usuário não autenticado';
    end if;

    if p_user_id is null then
        raise exception 'Usuário alvo não informado';
    end if;

    if p_user_id <> auth.uid() and not public.is_admin() then
        raise exception 'Acesso negado para criar a carteira de outro usuário';
    end if;

    select * into v_settings from public.coin_settings cs where cs.season_key = p_season_key;
    if not found then
        raise exception 'Configuração de WDD Coins não encontrada para a temporada %', p_season_key;
    end if;

    v_initial_balance := coalesce(v_settings.initial_balance, 0);

    insert into public.coin_wallets (season_key, user_id, available_balance, locked_balance)
    values (p_season_key, p_user_id, 0, 0)
    on conflict on constraint coin_wallets_unique_user_season do nothing;

    select * into v_wallet
    from public.coin_wallets cw
    where cw.season_key = p_season_key and cw.user_id = p_user_id
    for update;

    if not found then
        raise exception 'Não foi possível criar ou localizar a carteira';
    end if;

    if v_initial_balance > 0 and not exists (
        select 1 from public.coin_transactions ct
        where ct.user_id = p_user_id and ct.transaction_type = 'initial_balance'
    ) then
        update public.coin_wallets cw
        set available_balance = cw.available_balance + v_initial_balance, updated_at = now()
        where cw.id = v_wallet.id
        returning * into v_wallet;

        insert into public.coin_transactions (
            wallet_id, season_key, user_id, transaction_type, amount,
            available_balance_after, locked_balance_after,
            reference_type, reference_id, description, metadata, created_by
        ) values (
            v_wallet.id, p_season_key, p_user_id, 'initial_balance', v_initial_balance,
            v_wallet.available_balance, v_wallet.locked_balance,
            'season', p_season_key, 'Bônus de boas-vindas WDD Coins',
            jsonb_build_object('source', 'initialize_coin_wallet'), auth.uid()
        );
    end if;

    return query
    select v_wallet.id, v_wallet.season_key, v_wallet.user_id, v_wallet.available_balance, v_wallet.locked_balance;
end;
$$;

revoke all on function public.initialize_coin_wallet(text, uuid) from public;
revoke all on function public.initialize_coin_wallet(text, uuid) from anon;
grant execute on function public.initialize_coin_wallet(text, uuid) to authenticated;

-- 3. Transporte de saldo entre temporadas (interno: so activate_season chama)
create or replace function public.carry_coin_balances(p_from text, p_to text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_from public.coin_wallets%rowtype;
    v_to public.coin_wallets%rowtype;
    v_amount integer;
    v_count integer := 0;
begin
    if p_from is null or p_to is null or p_from = p_to then
        return 0;
    end if;

    -- Move todo o saldo disponivel. Repetir nao duplica: a origem fica zerada.
    -- Ir e voltar (ativar a anterior por engano e depois a nova) leva o saldo de volta.
    for v_from in
        select * from public.coin_wallets cw
        where cw.season_key = p_from and cw.available_balance > 0
        order by cw.user_id
        for update
    loop
        v_amount := v_from.available_balance;

        insert into public.coin_wallets (season_key, user_id, available_balance, locked_balance)
        values (p_to, v_from.user_id, 0, 0)
        on conflict on constraint coin_wallets_unique_user_season do nothing;

        select * into v_to from public.coin_wallets cw
        where cw.season_key = p_to and cw.user_id = v_from.user_id
        for update;

        update public.coin_wallets cw
        set available_balance = cw.available_balance - v_amount, updated_at = now()
        where cw.id = v_from.id
        returning * into v_from;

        update public.coin_wallets cw
        set available_balance = cw.available_balance + v_amount, updated_at = now()
        where cw.id = v_to.id
        returning * into v_to;

        insert into public.coin_transactions (
            wallet_id, season_key, user_id, transaction_type, amount,
            available_balance_after, locked_balance_after,
            reference_type, reference_id, description, metadata, created_by
        ) values
        (
            v_from.id, p_from, v_from.user_id, 'season_carry_out', -v_amount,
            v_from.available_balance, v_from.locked_balance,
            'season', p_to, 'Saldo levado para a temporada ' || p_to,
            jsonb_build_object('to_season', p_to), auth.uid()
        ),
        (
            v_to.id, p_to, v_to.user_id, 'season_carry_in', v_amount,
            v_to.available_balance, v_to.locked_balance,
            'season', p_from, 'Saldo trazido da temporada ' || p_from,
            jsonb_build_object('from_season', p_from), auth.uid()
        );

        v_count := v_count + 1;
    end loop;

    return v_count;
end;
$$;

revoke all on function public.carry_coin_balances(text, text) from public;
revoke all on function public.carry_coin_balances(text, text) from anon;
revoke all on function public.carry_coin_balances(text, text) from authenticated;

-- 4. Ativar temporada agora transporta os saldos (mesma regra da Fase 5 + passo 3)
create or replace function public.activate_season(p_key text)
returns public.seasons
language plpgsql
security definer
set search_path = public
as $$
declare
    v_season public.seasons%rowtype;
    v_previous text;
begin
    if auth.uid() is null or not public.is_admin() then
        raise exception 'Apenas administradores podem ativar temporadas';
    end if;

    select * into v_season from public.seasons s where s.key = trim(coalesce(p_key, ''));
    if not found then
        raise exception 'Temporada não encontrada';
    end if;

    if v_season.is_active then
        return v_season;
    end if;

    select s.key into v_previous from public.seasons s where s.is_active;

    update public.seasons s
    set is_active = false,
        ends_on = coalesce(s.ends_on, (now() at time zone 'America/Sao_Paulo')::date)
    where s.is_active;

    update public.seasons s
    set is_active = true, ends_on = null
    where s.key = v_season.key
    returning * into v_season;

    insert into public.coin_settings (season_key) values (v_season.key)
    on conflict (season_key) do nothing;

    -- Carteiras da nova temporada (bonus so para quem nunca recebeu) e saldo transportado
    perform * from public.initialize_coin_wallets_for_season(v_season.key, false);
    perform public.carry_coin_balances(v_previous, v_season.key);

    return v_season;
end;
$$;

revoke all on function public.activate_season(text) from public;
revoke all on function public.activate_season(text) from anon;
grant execute on function public.activate_season(text) to authenticated;

-- 5. Compra: item ja possuido (mesmo codigo, qualquer temporada) e recusado
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
        raise exception 'Usuário não autenticado';
    end if;

    select * into v_item
    from public.coin_store_items csi
    where csi.id = p_item_id and csi.season_key = p_season_key and csi.is_active = true;

    if not found then
        raise exception 'Item da loja não encontrado ou indisponível';
    end if;

    if exists (
        select 1
        from public.coin_user_items cui
        join public.coin_store_items owned on owned.id = cui.item_id
        where cui.user_id = v_user_id and owned.code = v_item.code
    ) then
        raise exception 'Você já tem este item';
    end if;

    perform public.initialize_coin_wallet(p_season_key, v_user_id);

    select * into v_wallet
    from public.coin_wallets cw
    where cw.season_key = p_season_key and cw.user_id = v_user_id
    for update;

    if not found then
        raise exception 'Carteira WDD Coins não encontrada';
    end if;

    if v_wallet.available_balance < v_item.price then
        raise exception 'Saldo de WDD Coins insuficiente';
    end if;

    update public.coin_wallets cw
    set available_balance = cw.available_balance - v_item.price, updated_at = now()
    where cw.id = v_wallet.id
    returning * into v_wallet;

    insert into public.coin_user_items (season_key, user_id, item_id)
    values (p_season_key, v_user_id, p_item_id);

    insert into public.coin_transactions (
        wallet_id, season_key, user_id, transaction_type, amount,
        available_balance_after, locked_balance_after,
        reference_type, reference_id, description, metadata
    ) values (
        v_wallet.id, p_season_key, v_user_id, 'purchase', v_item.price * -1,
        v_wallet.available_balance, v_wallet.locked_balance,
        'store_item', v_item.id, 'Compra na loja: ' || v_item.name,
        jsonb_build_object('item_code', v_item.code, 'item_type', v_item.item_type, 'rarity', v_item.rarity)
    );

    return query select v_item.id, v_wallet.available_balance, v_wallet.locked_balance;
end;
$$;

revoke all on function public.purchase_coin_store_item(text, uuid) from public;
revoke all on function public.purchase_coin_store_item(text, uuid) from anon;
grant execute on function public.purchase_coin_store_item(text, uuid) to authenticated;

-- 6. O participante sempre enxerga os itens que possui (mesmo fora da loja)
drop policy if exists "users read owned store items" on public.coin_store_items;
create policy "users read owned store items"
on public.coin_store_items
for select
to authenticated
using (
    exists (
        select 1 from public.coin_user_items cui
        where cui.item_id = coin_store_items.id and cui.user_id = auth.uid()
    )
);

commit;
