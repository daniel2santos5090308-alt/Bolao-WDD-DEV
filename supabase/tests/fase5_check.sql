-- Bolao WDD 2027 - Fase 5: verificacao (somente DEV)
-- Rode DEPOIS da migration 20261118100000_season_admin.sql.
-- Rode o arquivo INTEIRO. Nao precisa editar nada. Nada fica gravado:
-- usuarios ficticios f5_* e as temporadas 2098/2099 sao desfeitos no final,
-- e a temporada ativa continua a mesma.

drop table if exists pg_temp.fase5_resultado;
create temp table fase5_resultado (ordem int, teste text, esperado text, obtido text);

do $$
declare
    v_admin uuid := gen_random_uuid();
    v_user uuid := gen_random_uuid();
    v_before text := public.current_season_key();
    r jsonb := '[]'::jsonb;
    v_txt text;
    v_expected text;
begin
    begin
        insert into auth.users (id, email, aud, role) values
            (v_admin, 'f5_admin@teste.local', 'authenticated', 'authenticated'),
            (v_user, 'f5_user@teste.local', 'authenticated', 'authenticated');
        insert into public.profiles (id, username, name, role) values
            (v_admin, 'f5_admin', 'F5 Admin', 'admin'),
            (v_user, 'f5_user', 'F5 User', 'user')
        on conflict (id) do update set username = excluded.username, name = excluded.name, role = excluded.role;

        -- Participante comum
        perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
        set local role authenticated;
        begin
            perform public.create_season('2099');
            v_txt := 'criou (errado)';
        exception when others then
            v_txt := 'recusado';
        end;
        r := r || jsonb_build_array(jsonb_build_object('o', 1, 't', 'Participante NAO cria temporada', 'e', 'recusado', 'g', v_txt));
        reset role;

        -- Admin
        perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
        set local role authenticated;

        begin
            perform public.create_season('abc');
            v_txt := 'criou (errado)';
        exception when others then
            v_txt := 'recusado';
        end;
        r := r || jsonb_build_array(jsonb_build_object('o', 2, 't', 'Ano invalido e recusado', 'e', 'recusado', 'g', v_txt));

        select s.name || ' / ' || case when s.is_active then 'ativa' else 'inativa' end into v_txt
        from public.create_season('2098') s;
        r := r || jsonb_build_array(jsonb_build_object('o', 3, 't', 'Cria com nome padrao e desativada', 'e', 'Brasileirão 2098 / inativa', 'g', v_txt));

        select coalesce(
            (select first_place_reward::text from public.coin_settings where season_key = v_before),
            (select first_place_reward::text from public.coin_settings where season_key <> '2098' order by season_key desc limit 1),
            '1000') into v_expected;
        select first_place_reward::text into v_txt from public.coin_settings where season_key = '2098';
        r := r || jsonb_build_array(jsonb_build_object('o', 4, 't', 'Copia as configuracoes de Coins', 'e', v_expected, 'g', v_txt));

        select count(*)::text into v_expected from public.coin_store_items where season_key = v_before;
        select count(*)::text into v_txt from public.coin_store_items where season_key = '2098';
        r := r || jsonb_build_array(jsonb_build_object('o', 5, 't', 'Copia o catalogo da loja', 'e', v_expected, 'g', v_txt));

        begin
            perform public.create_season('2098');
            v_txt := 'criou (errado)';
        exception when others then
            v_txt := 'recusado';
        end;
        r := r || jsonb_build_array(jsonb_build_object('o', 6, 't', 'Temporada repetida e recusada', 'e', 'recusado', 'g', v_txt));

        perform public.activate_season('2098');
        r := r || jsonb_build_array(jsonb_build_object('o', 7, 't', 'Ativar troca a temporada ativa', 'e', '2098', 'g', public.current_season_key()));

        select count(*)::text into v_txt from public.seasons where is_active;
        r := r || jsonb_build_array(jsonb_build_object('o', 8, 't', 'So uma temporada ativa', 'e', '1', 'g', v_txt));

        select case when v_before is null then 'sem anterior'
                    when ends_on is not null and not is_active then 'encerrada'
                    else 'aberta' end into v_txt
        from public.seasons where key = coalesce(v_before, '2098');
        r := r || jsonb_build_array(jsonb_build_object('o', 9, 't', 'Temporada anterior fica encerrada',
            'e', case when v_before is null then 'sem anterior' else 'encerrada' end, 'g', v_txt));

        reset role;
        select count(*)::text into v_expected from public.profiles where role <> 'admin';
        select count(*)::text into v_txt from public.coin_wallets where season_key = '2098';
        r := r || jsonb_build_array(jsonb_build_object('o', 10, 't', 'Carteiras preparadas para os participantes', 'e', v_expected, 'g', v_txt));

        perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
        set local role authenticated;
        begin
            perform public.activate_season(coalesce(v_before, '2098'));
            v_txt := 'ativou (errado)';
        exception when others then
            v_txt := 'recusado';
        end;
        r := r || jsonb_build_array(jsonb_build_object('o', 11, 't', 'Participante NAO ativa temporada', 'e', 'recusado', 'g', v_txt));
        reset role;

        raise sqlstate 'FASE5';
    exception
        when sqlstate 'FASE5' then
            null;
    end;

    perform set_config('request.jwt.claims', '{}', true);
    r := r || jsonb_build_array(jsonb_build_object('o', 12, 't', 'Temporada ativa continua a mesma',
        'e', coalesce(v_before, '(nenhuma)'), 'g', coalesce(public.current_season_key(), '(nenhuma)')));

    insert into fase5_resultado
    select (x->>'o')::int, x->>'t', x->>'e', coalesce(x->>'g', '(vazio)')
    from jsonb_array_elements(r) x;
end $$;

insert into fase5_resultado
select 13, 'Permissao: anon NAO executa create_season', 'false',
       has_function_privilege('anon', 'public.create_season(text, text, date)', 'execute')::text
union all
select 14, 'Permissao: anon NAO executa activate_season', 'false',
       has_function_privilege('anon', 'public.activate_season(text)', 'execute')::text
union all
select 15, 'Dados de teste removidos', '0',
       ((select count(*) from public.seasons where key in ('2098', '2099'))
        + (select count(*) from auth.users where email like 'f5_%@teste.local'))::text;

select ordem, teste, esperado, obtido,
       case when esperado = obtido then 'OK' else 'FALHOU' end as status
from fase5_resultado
order by ordem;
