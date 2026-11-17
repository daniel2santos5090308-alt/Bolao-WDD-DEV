-- Bolao WDD 2027 - Fase 10: verificacao (somente DEV)
-- Rode DEPOIS da migration 20261120100000_coins_continuous.sql.
-- Rode o arquivo INTEIRO. Nao precisa editar nada. Nada fica gravado:
-- temporadas 2096/2097, usuarios f10_* e lancamentos sao desfeitos no final,
-- e a temporada ativa continua a mesma.
--
-- Cenario: bonus de boas-vindas = 500. A e B entram na 2096 (recebem 500 uma vez).
-- A compra o item f10_item (100) -> A = 400, B = 500. Ativa 2097:
-- A leva 400 e B leva 500; ninguem recebe bonus de novo; A nao compra o item de novo.

drop table if exists pg_temp.fase10_resultado;
create temp table fase10_resultado (ordem int, teste text, esperado text, obtido text);

do $$
declare
    v_admin uuid := gen_random_uuid();
    v_a uuid := gen_random_uuid();
    v_b uuid := gen_random_uuid();
    v_before text := public.current_season_key();
    v_item uuid;
    v_item_2097 uuid;
    r jsonb := '[]'::jsonb;
    v_txt text;
begin
    begin
        insert into auth.users (id, email, aud, role) values
            (v_admin, 'f10_admin@teste.local', 'authenticated', 'authenticated'),
            (v_a, 'f10_a@teste.local', 'authenticated', 'authenticated'),
            (v_b, 'f10_b@teste.local', 'authenticated', 'authenticated');
        insert into public.profiles (id, username, name, role) values
            (v_admin, 'f10_admin', 'F10 Admin', 'admin'),
            (v_a, 'f10_a', 'F10 A', 'user'),
            (v_b, 'f10_b', 'F10 B', 'user')
        on conflict (id) do update set username = excluded.username, name = excluded.name, role = excluded.role;

        -- Admin cria e ativa 2096 com bonus 500 e um item de teste
        perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
        perform public.create_season('2096');
        update public.coin_settings set initial_balance = 500 where season_key = '2096';
        insert into public.coin_store_items (season_key, code, name, description, item_type, price, rarity, is_active, sort_order)
        values ('2096', 'f10_item', 'Item F10', 'Item de teste', 'profile_badge', 100, 'comum', true, 999)
        returning id into v_item;
        perform public.activate_season('2096');

        select coalesce(sum(available_balance), 0)::text into v_txt from public.coin_wallets where season_key = '2096' and user_id in (v_a, v_b);
        r := r || jsonb_build_array(jsonb_build_object('o', 1, 't', 'Participantes novos recebem o bonus de boas-vindas', 'e', '1000', 'g', v_txt));

        -- A compra o item
        perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
        set local role authenticated;
        perform * from public.purchase_coin_store_item('2096', v_item);
        reset role;
        select available_balance::text into v_txt from public.coin_wallets where season_key = '2096' and user_id = v_a;
        r := r || jsonb_build_array(jsonb_build_object('o', 2, 't', 'Compra desconta o preco', 'e', '400', 'g', v_txt));

        -- Admin cria e ativa 2097 (bonus copiado = 500)
        perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
        perform public.create_season('2097');
        perform public.activate_season('2097');

        select string_agg(p.username || '=' || cw.available_balance, ' ' order by p.username) into v_txt
        from public.coin_wallets cw join public.profiles p on p.id = cw.user_id
        where cw.season_key = '2097' and cw.user_id in (v_a, v_b);
        r := r || jsonb_build_array(jsonb_build_object('o', 3, 't', 'Saldo transportado para a nova temporada', 'e', 'f10_a=400 f10_b=500', 'g', v_txt));

        select string_agg(p.username || '=' || cw.available_balance, ' ' order by p.username) into v_txt
        from public.coin_wallets cw join public.profiles p on p.id = cw.user_id
        where cw.season_key = '2096' and cw.user_id in (v_a, v_b);
        r := r || jsonb_build_array(jsonb_build_object('o', 4, 't', 'Temporada anterior fica zerada', 'e', 'f10_a=0 f10_b=0', 'g', v_txt));

        select count(*)::text into v_txt from public.coin_transactions
        where user_id in (v_a, v_b) and transaction_type = 'initial_balance';
        r := r || jsonb_build_array(jsonb_build_object('o', 5, 't', 'Bonus de boas-vindas so uma vez por pessoa', 'e', '2', 'g', v_txt));

        select string_agg(transaction_type || ':' || amount, ' ' order by season_key, transaction_type) into v_txt
        from public.coin_transactions where user_id = v_a and transaction_type like 'season_carry_%';
        r := r || jsonb_build_array(jsonb_build_object('o', 6, 't', 'Extrato registra a saida e a entrada', 'e', 'season_carry_out:-400 season_carry_in:400', 'g', v_txt));

        -- Ativar de novo nao duplica
        perform public.activate_season('2096');
        perform public.activate_season('2097');
        select available_balance::text into v_txt from public.coin_wallets where season_key = '2097' and user_id = v_a;
        r := r || jsonb_build_array(jsonb_build_object('o', 7, 't', 'Ir e voltar entre temporadas nao duplica saldo', 'e', '400', 'g', v_txt));

        -- A tenta comprar o mesmo item na 2097 (copiado com novo id)
        select id into v_item_2097 from public.coin_store_items where season_key = '2097' and code = 'f10_item';
        perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
        set local role authenticated;
        begin
            perform * from public.purchase_coin_store_item('2097', v_item_2097);
            v_txt := 'comprou de novo (errado)';
        exception when others then
            v_txt := case when sqlerrm like '%já tem este item%' then 'recusado' else 'erro: ' || sqlerrm end;
        end;
        reset role;
        r := r || jsonb_build_array(jsonb_build_object('o', 8, 't', 'Item permanente: nao compra o mesmo item de novo', 'e', 'recusado', 'g', v_txt));

        -- Item sai da loja: o dono continua enxergando
        update public.coin_store_items set is_active = false where id = v_item;
        perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
        set local role authenticated;
        select count(*)::text into v_txt from public.coin_store_items where id = v_item;
        reset role;
        r := r || jsonb_build_array(jsonb_build_object('o', 9, 't', 'Dono ve o item mesmo fora da loja', 'e', '1', 'g', v_txt));

        perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
        set local role authenticated;
        select count(*)::text into v_txt from public.coin_store_items where id = v_item;
        reset role;
        r := r || jsonb_build_array(jsonb_build_object('o', 10, 't', 'Quem nao tem nao ve item fora da loja', 'e', '0', 'g', v_txt));

        raise sqlstate 'FAS10';
    exception
        when sqlstate 'FAS10' then
            null;
    end;

    perform set_config('request.jwt.claims', '{}', true);
    r := r || jsonb_build_array(jsonb_build_object('o', 11, 't', 'Temporada ativa continua a mesma',
        'e', coalesce(v_before, '(nenhuma)'), 'g', coalesce(public.current_season_key(), '(nenhuma)')));

    insert into fase10_resultado
    select (x->>'o')::int, x->>'t', x->>'e', coalesce(x->>'g', '(vazio)')
    from jsonb_array_elements(r) x;
end $$;

insert into fase10_resultado
select 12, 'Permissao: participante NAO executa carry_coin_balances', 'false',
       has_function_privilege('authenticated', 'public.carry_coin_balances(text, text)', 'execute')::text
union all
select 13, 'Dados de teste removidos', '0',
       ((select count(*) from public.seasons where key in ('2096', '2097'))
        + (select count(*) from auth.users where email like 'f10_%@teste.local'))::text;

select ordem, teste, esperado, obtido,
       case when esperado = obtido then 'OK' else 'FALHOU' end as status
from fase10_resultado
order by ordem;
