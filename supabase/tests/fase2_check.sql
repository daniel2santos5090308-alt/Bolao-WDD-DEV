-- Bolao WDD 2027 - Fase 2: verificacao (somente DEV)
-- Rode DEPOIS da migration 20261116100000_app_snapshot.sql.
-- Rode o arquivo INTEIRO. Nao precisa editar nada. Nada fica gravado.

drop table if exists pg_temp.fase2_resultado;
create temp table fase2_resultado (ordem int, teste text, esperado text, obtido text);

do $$
declare
    v_a uuid := gen_random_uuid();
    v_b uuid := gen_random_uuid();
    r jsonb := '[]'::jsonb;
    v_txt text;
    v_v1 bigint;
    v_v2 bigint;
    v_snap jsonb;
begin
    begin
        insert into auth.users (id, email, aud, role) values
            (v_a, 'f2_a@teste.local', 'authenticated', 'authenticated'),
            (v_b, 'f2_b@teste.local', 'authenticated', 'authenticated');
        insert into public.profiles (id, username, name, role) values
            (v_a, 'f2_a', 'F2 A', 'user'),
            (v_b, 'f2_b', 'F2 B', 'user')
        on conflict (id) do update set username = excluded.username, name = excluded.name, role = excluded.role;

        insert into public.seasons (key, name, is_active) values ('T2', 'Temporada Teste 2', false);

        -- 1. Carimbo muda quando algo e gravado
        select version into v_v1 from public.app_meta where id = 1;
        insert into public.rounds (id, name, number, season_key) values ('f2_r1', 'F2 Rodada 1', 1, 'T2');
        select version into v_v2 from public.app_meta where id = 1;
        r := r || jsonb_build_array(jsonb_build_object('o', 1, 't', 'Carimbo de versao sobe ao gravar', 'e', 'subiu',
            'g', case when v_v2 > v_v1 then 'subiu' else 'nao mudou' end));

        insert into public.matches (id, round_id, match_date, match_time, home_team, away_team) values
            ('f2_future', 'f2_r1',
             ((now() at time zone 'America/Sao_Paulo') + interval '1 hour')::date,
             ((now() at time zone 'America/Sao_Paulo') + interval '1 hour')::time, 'F2 Casa', 'F2 Fora'),
            ('f2_started', 'f2_r1',
             ((now() at time zone 'America/Sao_Paulo') - interval '5 minutes')::date,
             ((now() at time zone 'America/Sao_Paulo') - interval '5 minutes')::time, 'F2 Casa', 'F2 Fora');

        select version into v_v1 from public.app_meta where id = 1;
        insert into public.bets (user_id, match_id, score_home, score_away) values
            (v_a, 'f2_future', 1, 0),
            (v_b, 'f2_future', 2, 2),
            (v_b, 'f2_started', 3, 1);
        select version into v_v2 from public.app_meta where id = 1;
        r := r || jsonb_build_array(jsonb_build_object('o', 2, 't', 'Carimbo sobe quando alguem aposta', 'e', 'subiu',
            'g', case when v_v2 > v_v1 then 'subiu' else 'nao mudou' end));

        -- Sessao do participante A, com RLS valendo
        perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
        set local role authenticated;

        v_snap := public.get_app_snapshot('T2');
        r := r || jsonb_build_array(jsonb_build_object('o', 3, 't', 'Snapshot: so rodadas/jogos da temporada pedida', 'e', '1 rodada, 2 jogos',
            'g', jsonb_array_length(v_snap->'rounds') || ' rodada, ' || jsonb_array_length(v_snap->'matches') || ' jogos'));
        r := r || jsonb_build_array(jsonb_build_object('o', 4, 't', 'Snapshot: traz so as apostas do proprio usuario', 'e', '1',
            'g', jsonb_array_length(v_snap->'my_bets')::text));
        r := r || jsonb_build_array(jsonb_build_object('o', 5, 't', 'Snapshot: inclui o carimbo de versao', 'e', 'sim',
            'g', case when (v_snap->>'version') is not null then 'sim' else 'nao' end));

        select coalesce(score_home::text, 'NULL') || ' x ' || coalesce(score_away::text, 'NULL') into v_txt
        from public.get_season_bets('T2', 'f2_r1', v_b) where match_id = 'f2_future';
        r := r || jsonb_build_array(jsonb_build_object('o', 6, 't', 'Extrato de B visto por A: jogo futuro oculto', 'e', 'NULL x NULL', 'g', v_txt));

        select score_home || ' x ' || score_away into v_txt
        from public.get_season_bets('T2', 'f2_r1', v_b) where match_id = 'f2_started';
        r := r || jsonb_build_array(jsonb_build_object('o', 7, 't', 'Extrato de B visto por A: jogo iniciado aparece', 'e', '3 x 1', 'g', v_txt));

        select count(*)::text into v_txt from public.get_season_bets('T2', null, v_b);
        r := r || jsonb_build_array(jsonb_build_object('o', 8, 't', 'Filtro por participante retorna so as apostas dele', 'e', '2', 'g', v_txt));

        reset role;

        -- Sem login
        perform set_config('request.jwt.claims', '{}', true);
        begin
            perform public.get_app_snapshot('T2');
            v_txt := 'retornou dados (errado)';
        exception when others then
            v_txt := 'recusado';
        end;
        r := r || jsonb_build_array(jsonb_build_object('o', 9, 't', 'Snapshot sem login e recusado', 'e', 'recusado', 'g', v_txt));

        raise sqlstate 'FASE2';
    exception
        when sqlstate 'FASE2' then
            null;
    end;

    insert into fase2_resultado
    select (x->>'o')::int, x->>'t', x->>'e', coalesce(x->>'g', '(vazio)')
    from jsonb_array_elements(r) x;
end $$;

insert into fase2_resultado
select 10, 'Permissao: anon NAO executa get_app_snapshot', 'false',
       has_function_privilege('anon', 'public.get_app_snapshot(text)', 'execute')::text
union all
select 11, 'Permissao: anon NAO executa get_season_bets', 'false',
       has_function_privilege('anon', 'public.get_season_bets(text, text, uuid)', 'execute')::text
union all
select 12, 'Triggers de versao instalados (7 tabelas)', '7',
       (select count(*)::text from pg_trigger where tgname = 'trg_bump_app_version')
union all
select 13, 'Dados de teste removidos', '0',
       ((select count(*) from public.rounds where id like 'f2_%')
        + (select count(*) from auth.users where email like 'f2_%@teste.local'))::text;

select ordem, teste, esperado, obtido,
       case when esperado = obtido then 'OK' else 'FALHOU' end as status
from fase2_resultado
order by ordem;
