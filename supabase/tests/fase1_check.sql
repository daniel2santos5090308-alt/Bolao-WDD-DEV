-- Bolao WDD 2027 - Fase 1: verificacao (somente DEV)
-- Rode DEPOIS das migrations 20261115100000, 110000, 120000 e 130000.
-- Rode o arquivo INTEIRO. Nao precisa editar nada. Nada fica gravado:
-- o cenario de teste (usuarios ficticios f1_*, temporada 'T1', rodadas, jogos,
-- apostas e Coins) e criado e desfeito no final. Nao depende dos usuarios reais.
--
-- Cenario (exato=10, trave=5, erro=0), participantes A, B, C:
--   Rodada 1: m1 2x1 | m2 0x0 | m3 1x3
--     A: 2x1, 0x0, 0x0 -> 20 pts, 2 cravadas, 0 trave, 3 jogos
--     B: 2x1, 1x1, 0x2 -> 20 pts, 1 cravada,  2 trave, 3 jogos
--     C: 2x1, 0x0, --  -> 20 pts, 2 cravadas, 0 trave, 2 jogos
--     => A 1o (cravadas), C 2o (jogos apostados), B 3o
--   Rodada 2: m4 1x0
--     A: 1x0, B: 1x0, C: 0x1 => A e B empatados em 1o, C sem pontos
--   Coins esperadas (1o=1000, 2o=750, 3o=500, exato=50, rodada completa=200):
--     A = R1(100+200+1000) + R2(50+200+1000) = 2550
--     B = R1(50+200+500)   + R2(50+200+1000) = 2000
--     C = R1(100+750)      + R2(200)         = 1050

drop table if exists pg_temp.fase1_resultado;
create temp table fase1_resultado (ordem int, teste text, esperado text, obtido text);

do $$
declare
    v_admin uuid;
    v_a uuid;
    v_b uuid;
    v_c uuid;
    r jsonb := '[]'::jsonb;
    v_txt text;
begin
    v_admin := gen_random_uuid();
    v_a := gen_random_uuid();
    v_b := gen_random_uuid();
    v_c := gen_random_uuid();

    begin
        -- Usuarios ficticios (desfeitos no final junto com o resto do cenario)
        insert into auth.users (id, email, aud, role)
        values
            (v_admin, 'f1_admin@teste.local', 'authenticated', 'authenticated'),
            (v_a, 'f1_a@teste.local', 'authenticated', 'authenticated'),
            (v_b, 'f1_b@teste.local', 'authenticated', 'authenticated'),
            (v_c, 'f1_c@teste.local', 'authenticated', 'authenticated');

        insert into public.profiles (id, username, name, role)
        values
            (v_admin, 'f1_admin', 'F1 Admin', 'admin'),
            (v_a, 'f1_a', 'F1 A', 'user'),
            (v_b, 'f1_b', 'F1 B', 'user'),
            (v_c, 'f1_c', 'F1 C', 'user')
        on conflict (id) do update
            set username = excluded.username, name = excluded.name, role = excluded.role;

        perform set_config('request.jwt.claims',
            json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

        update public.scoring_settings
        set exact_score_points = 10, near_miss_points = 5, wrong_points = 0,
            bonus_multiplier = 2, bonus_enabled = true
        where id = 'default';

        insert into public.seasons (key, name, is_active) values ('T1', 'Temporada Teste', false);
        insert into public.coin_settings (season_key, initial_balance, first_place_reward, second_place_reward,
            third_place_reward, exact_score_reward, bonus_exact_score_reward, full_round_participation_reward)
        values ('T1', 0, 1000, 750, 500, 50, 100, 200);

        insert into public.rounds (id, name, number, season_key) values
            ('f1_r1', 'F1 Rodada 1', 1, 'T1'),
            ('f1_r2', 'F1 Rodada 2', 2, 'T1');

        insert into public.matches (id, round_id, match_date, match_time, home_team, away_team, result, score_home, score_away) values
            ('f1_m1', 'f1_r1', '2026-01-01', '16:00', 'T1 A', 'T1 B', 'home', 2, 1),
            ('f1_m2', 'f1_r1', '2026-01-01', '18:00', 'T1 C', 'T1 D', 'draw', 0, 0),
            ('f1_m3', 'f1_r1', '2026-01-01', '20:00', 'T1 E', 'T1 F', 'away', 1, 3),
            ('f1_m4', 'f1_r2', '2026-01-08', '16:00', 'T1 G', 'T1 H', 'home', 1, 0);

        insert into public.bets (user_id, match_id, score_home, score_away) values
            (v_a, 'f1_m1', 2, 1), (v_a, 'f1_m2', 0, 0), (v_a, 'f1_m3', 0, 0), (v_a, 'f1_m4', 1, 0),
            (v_b, 'f1_m1', 2, 1), (v_b, 'f1_m2', 1, 1), (v_b, 'f1_m3', 0, 2), (v_b, 'f1_m4', 1, 0),
            (v_c, 'f1_m1', 2, 1), (v_c, 'f1_m2', 0, 0),                       (v_c, 'f1_m4', 0, 1);

        -- Ranking da rodada 1
        select string_agg(case user_id when v_a then 'A' when v_b then 'B' else 'C' end || '=' || "position", ' ' order by "position", user_id = v_b)
        into v_txt from public.get_ranking('T1', 'f1_r1') where user_id in (v_a, v_b, v_c);
        r := r || jsonb_build_array(jsonb_build_object('o', 1, 't', 'Ranking rodada 1 (cravadas e jogos apostados desempatam)', 'e', 'A=1 C=2 B=3', 'g', v_txt));

        -- Ranking da rodada 2 (empate)
        select string_agg(case user_id when v_a then 'A' when v_b then 'B' else 'C' end || '=' || "position", ' ' order by "position", user_id <> v_a)
        into v_txt from public.get_ranking('T1', 'f1_r2') where user_id in (v_a, v_b, v_c);
        r := r || jsonb_build_array(jsonb_build_object('o', 2, 't', 'Ranking rodada 2 (empate = posicao compartilhada)', 'e', 'A=1 B=1 C=3', 'g', v_txt));

        -- Ranking da temporada
        select string_agg(case user_id when v_a then 'A' when v_b then 'B' else 'C' end || '=' || "position" || '(' || points || ')', ' ' order by "position")
        into v_txt from public.get_ranking('T1', null) where user_id in (v_a, v_b, v_c);
        r := r || jsonb_build_array(jsonb_build_object('o', 3, 't', 'Ranking da temporada', 'e', 'A=1(30.00) B=2(30.00) C=3(20.00)', 'g', v_txt));

        -- Coins
        perform * from public.process_round_coin_rewards('f1_r1', 'T1');
        perform * from public.process_round_coin_rewards('f1_r2', 'T1');

        select string_agg(case user_id when v_a then 'A' when v_b then 'B' else 'C' end || '=' || total, ' ' order by total desc)
        into v_txt
        from (
            select user_id, sum(amount) as total
            from public.coin_transactions
            where season_key = 'T1' and user_id in (v_a, v_b, v_c)
            group by user_id
        ) t;
        r := r || jsonb_build_array(jsonb_build_object('o', 4, 't', 'Coins: premio integral para empatados', 'e', 'A=2550 B=2000 C=1050', 'g', v_txt));

        -- Rodada de outra temporada deve ser recusada
        begin
            perform * from public.process_round_coin_rewards('f1_r1', '2027');
            v_txt := 'aceitou (errado)';
        exception when others then
            v_txt := case when sqlerrm like '%pertence a temporada%' then 'recusada' else 'erro: ' || sqlerrm end;
        end;
        r := r || jsonb_build_array(jsonb_build_object('o', 5, 't', 'Coins: recusa rodada de outra temporada', 'e', 'recusada', 'g', v_txt));

        -- Nova rodada sem season_key recebe a temporada ativa
        insert into public.rounds (id, name, number) values ('f1_r_default', 'F1 Default', 99);
        select season_key into v_txt from public.rounds where id = 'f1_r_default';
        r := r || jsonb_build_array(jsonb_build_object('o', 6, 't', 'Nova rodada recebe a temporada ativa', 'e', public.current_season_key(), 'g', v_txt));

        -- Leitura direta da tabela bets: A nao pode ver apostas de B
        insert into public.matches (id, round_id, match_date, match_time, home_team, away_team)
        values ('f1_future', 'f1_r2', '2099-01-01', '16:00', 'T1 X', 'T1 Y');
        insert into public.bets (user_id, match_id, score_home, score_away) values (v_b, 'f1_future', 3, 3);

        perform set_config('request.jwt.claims',
            json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
        set local role authenticated;
        select count(*)::text into v_txt from public.bets where user_id = v_b;
        reset role;
        r := r || jsonb_build_array(jsonb_build_object('o', 7, 't', 'Leitura direta de bets: A nao ve apostas de B', 'e', '0', 'g', v_txt));

        raise sqlstate 'FASE1';
    exception
        when sqlstate 'FASE1' then
            null; -- tudo desfeito
    end;

    insert into fase1_resultado
    select (x->>'o')::int, x->>'t', x->>'e', coalesce(x->>'g', '(vazio)')
    from jsonb_array_elements(r) x;
end $$;

insert into fase1_resultado
select 8, 'Permissao: anon NAO executa get_ranking', 'false',
       has_function_privilege('anon', 'public.get_ranking(text, text)', 'execute')::text
union all
select 9, 'is_admin() e security definer', 'true',
       (select prosecdef::text from pg_proc where proname = 'is_admin')
union all
select 10, 'Policy de leitura em UTC removida de bets', '0',
       (select count(*)::text from pg_policies where tablename = 'bets' and policyname = 'authenticated read visible bets')
union all
select 11, 'Temporada ativa', '2027', public.current_season_key()
union all
select 12, 'Dados de teste removidos', '0',
       ((select count(*) from public.rounds where id like 'f1_%')
        + (select count(*) from auth.users where email like 'f1_%@teste.local'))::text;

select ordem, teste, esperado, obtido,
       case when esperado = obtido then 'OK' else 'FALHOU' end as status
from fase1_resultado
order by ordem;
