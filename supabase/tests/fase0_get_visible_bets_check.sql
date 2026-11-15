-- Bolao WDD 2027 - Fase 0: verificacao de get_visible_bets (somente DEV)
-- Rode no SQL Editor do Supabase DEV DEPOIS da migration 20261114120000.
--
-- Rode o arquivo INTEIRO de uma vez. Nao precisa editar nada:
--   - escolhe automaticamente 2 participantes nao-admin;
--   - cria jogos/aposta de teste dentro de um bloco que e desfeito no final
--     (nada fica gravado);
--   - mostra uma unica tabela com o resultado de cada teste (coluna "status").

drop table if exists pg_temp.fase0_resultado;
create temp table fase0_resultado (
    ordem int,
    teste text,
    esperado text,
    obtido text,
    ok boolean
);

do $$
declare
    v_a uuid;               -- quem consulta
    v_b uuid;               -- quem apostou
    v_future_home int;
    v_future_away int;
    v_future_found boolean := false;
    v_started_home int;
    v_started_away int;
    v_started_found boolean := false;
    v_sem_login int;
begin
    select id into v_a
    from public.profiles
    where coalesce(role, 'user') <> 'admin'
    order by username
    limit 1;

    select id into v_b
    from public.profiles
    where coalesce(role, 'user') <> 'admin' and id <> v_a
    order by username
    limit 1;

    if v_a is null or v_b is null then
        raise exception 'Sao necessarios 2 participantes nao-admin em profiles para o teste.';
    end if;

    -- Bloco interno: tudo aqui e desfeito pelo "raise sqlstate 'FASE0'" no final.
    begin
        insert into public.rounds (id, name, number)
        values ('fase0_round', 'Fase0 Teste', 9999);

        insert into public.matches (id, round_id, match_date, match_time, home_team, away_team)
        values
            ('fase0_future', 'fase0_round',
             ((now() at time zone 'America/Sao_Paulo') + interval '1 hour')::date,
             ((now() at time zone 'America/Sao_Paulo') + interval '1 hour')::time,
             'Fase0 Casa', 'Fase0 Fora'),
            ('fase0_started', 'fase0_round',
             ((now() at time zone 'America/Sao_Paulo') - interval '5 minutes')::date,
             ((now() at time zone 'America/Sao_Paulo') - interval '5 minutes')::time,
             'Fase0 Casa', 'Fase0 Fora');

        insert into public.bets (user_id, legacy_user_id, match_id, pick, score_home, score_away)
        values
            (v_b, 'fase0', 'fase0_future',  'home', 2, 1),
            (v_b, 'fase0', 'fase0_started', 'home', 3, 0);

        -- Simula a sessao do participante A
        perform set_config('request.jwt.claims',
            json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

        select score_home, score_away, true
        into v_future_home, v_future_away, v_future_found
        from public.get_visible_bets()
        where match_id = 'fase0_future' and user_id = v_b;

        select score_home, score_away, true
        into v_started_home, v_started_away, v_started_found
        from public.get_visible_bets()
        where match_id = 'fase0_started' and user_id = v_b;

        -- Simula chamada sem login
        perform set_config('request.jwt.claims', '{}', true);
        select count(*) into v_sem_login from public.get_visible_bets();

        raise sqlstate 'FASE0';
    exception
        when sqlstate 'FASE0' then
            null; -- dados de teste desfeitos
    end;

    insert into fase0_resultado values
        (1, 'Jogo daqui a 1h: palpite do outro fica oculto',
            'NULL x NULL',
            case when v_future_found then coalesce(v_future_home::text, 'NULL') || ' x ' || coalesce(v_future_away::text, 'NULL') else 'aposta nao retornada' end,
            v_future_found and v_future_home is null and v_future_away is null),
        (2, 'Jogo iniciado ha 5 min: palpite do outro aparece',
            '3 x 0',
            case when v_started_found then coalesce(v_started_home::text, 'NULL') || ' x ' || coalesce(v_started_away::text, 'NULL') else 'aposta nao retornada' end,
            v_started_found and v_started_home = 3 and v_started_away = 0),
        (3, 'Sem login: nenhuma aposta retornada',
            '0',
            v_sem_login::text,
            v_sem_login = 0);
end $$;

insert into fase0_resultado
select 4, 'Permissao: anon NAO executa a funcao', 'false',
       has_function_privilege('anon', 'public.get_visible_bets()', 'execute')::text,
       not has_function_privilege('anon', 'public.get_visible_bets()', 'execute')
union all
select 5, 'Permissao: authenticated executa a funcao', 'true',
       has_function_privilege('authenticated', 'public.get_visible_bets()', 'execute')::text,
       has_function_privilege('authenticated', 'public.get_visible_bets()', 'execute')
union all
select 6, 'Dados de teste removidos', '0',
       (select count(*) from public.matches where id like 'fase0_%')::text,
       not exists (select 1 from public.matches where id like 'fase0_%');

select ordem, teste, esperado, obtido,
       case when ok then 'OK' else 'FALHOU' end as status
from fase0_resultado
order by ordem;
