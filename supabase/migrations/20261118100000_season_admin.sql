-- Bolao WDD 2027 - Fase 5: administracao de temporadas
--
-- 1. create_season(key, name, starts_on): cria a temporada desativada e copia,
--    da temporada ativa (ou da mais recente com configuracao), as configuracoes
--    de WDD Coins e o catalogo da loja. Saldos e inventarios NAO sao copiados.
-- 2. activate_season(key): torna a temporada ativa, encerra a anterior
--    (ends_on = hoje em Sao Paulo, se vazio) e prepara as carteiras dos
--    participantes na nova temporada. O carimbo de versao sobe pelo trigger
--    de seasons, entao os apps recarregam sozinhos.
-- Somente admin. Nao altera dados existentes.

begin;

create or replace function public.create_season(
    p_key text,
    p_name text default null,
    p_starts_on date default null
)
returns public.seasons
language plpgsql
security definer
set search_path = public
as $$
declare
    v_key text := trim(coalesce(p_key, ''));
    v_name text := nullif(trim(coalesce(p_name, '')), '');
    v_source text;
    v_season public.seasons%rowtype;
begin
    if auth.uid() is null or not public.is_admin() then
        raise exception 'Apenas administradores podem criar temporadas';
    end if;

    if v_key !~ '^[0-9]{4}$' then
        raise exception 'A temporada deve ser um ano com 4 dígitos, por exemplo 2028';
    end if;

    if exists (select 1 from public.seasons s where s.key = v_key) then
        raise exception 'A temporada % já existe', v_key;
    end if;

    insert into public.seasons (key, name, starts_on, is_active)
    values (v_key, coalesce(v_name, 'Brasileirão ' || v_key), p_starts_on, false)
    returning * into v_season;

    -- Fonte: a temporada ativa, se tiver configuracao; senao, a mais recente.
    select cs.season_key into v_source
    from public.coin_settings cs
    where cs.season_key <> v_key
    order by (cs.season_key is not distinct from public.current_season_key()) desc, cs.season_key desc
    limit 1;

    if v_source is null then
        insert into public.coin_settings (season_key) values (v_key)
        on conflict (season_key) do nothing;
    else
        insert into public.coin_settings (
            season_key, initial_balance, first_place_reward, second_place_reward, third_place_reward,
            exact_score_reward, bonus_exact_score_reward, full_round_participation_reward
        )
        select v_key, cs.initial_balance, cs.first_place_reward, cs.second_place_reward, cs.third_place_reward,
               cs.exact_score_reward, cs.bonus_exact_score_reward, cs.full_round_participation_reward
        from public.coin_settings cs
        where cs.season_key = v_source
        on conflict (season_key) do nothing;

        insert into public.coin_store_items (
            season_key, code, name, description, item_type, price, rarity, preview_value, is_active, sort_order
        )
        select v_key, i.code, i.name, i.description, i.item_type, i.price, i.rarity, i.preview_value, i.is_active, i.sort_order
        from public.coin_store_items i
        where i.season_key = v_source
        on conflict (season_key, code) do nothing;
    end if;

    return v_season;
end;
$$;

create or replace function public.activate_season(p_key text)
returns public.seasons
language plpgsql
security definer
set search_path = public
as $$
declare
    v_season public.seasons%rowtype;
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

    -- Uma temporada ativa por vez (indice uq_seasons_single_active): desliga a atual primeiro.
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

    perform * from public.initialize_coin_wallets_for_season(v_season.key, false);

    return v_season;
end;
$$;

revoke all on function public.create_season(text, text, date) from public;
revoke all on function public.create_season(text, text, date) from anon;
grant execute on function public.create_season(text, text, date) to authenticated;

revoke all on function public.activate_season(text) from public;
revoke all on function public.activate_season(text) from anon;
grant execute on function public.activate_season(text) to authenticated;

commit;
