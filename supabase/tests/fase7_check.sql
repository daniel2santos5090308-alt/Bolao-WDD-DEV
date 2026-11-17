-- Bolao WDD 2027 - Fase 7: verificacao (somente DEV)
-- Rode DEPOIS da migration 20261119100000_participants.sql.
-- Rode o arquivo INTEIRO. Nao precisa editar nada. Nada fica gravado.
-- (Criar login e trocar senha ficam na Edge Function admin-users: teste pelo app.)

drop table if exists pg_temp.fase7_resultado;
create temp table fase7_resultado (ordem int, teste text, esperado text, obtido text);

do $$
declare
    v_admin uuid := gen_random_uuid();
    v_user uuid := gen_random_uuid();
    r jsonb := '[]'::jsonb;
    v_txt text;
begin
    begin
        insert into auth.users (id, email, aud, role) values
            (v_admin, 'f7_admin@teste.local', 'authenticated', 'authenticated'),
            (v_user, 'f7_user@teste.local', 'authenticated', 'authenticated');
        insert into public.profiles (id, username, name, role) values
            (v_admin, 'f7_admin', 'F7 Admin', 'admin'),
            (v_user, 'f7_user', 'F7 User', 'user')
        on conflict (id) do update set username = excluded.username, name = excluded.name, role = excluded.role;

        select active::text into v_txt from public.profiles where id = v_user;
        r := r || jsonb_build_array(jsonb_build_object('o', 1, 't', 'Perfil novo nasce ativo', 'e', 'true', 'g', v_txt));

        -- Participante tenta se desativar (ou reativar) direto na tabela
        perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
        set local role authenticated;
        update public.profiles set active = false where id = v_user;
        reset role;
        select active::text into v_txt from public.profiles where id = v_user;
        r := r || jsonb_build_array(jsonb_build_object('o', 2, 't', 'Participante NAO altera o proprio active', 'e', 'true', 'g', v_txt));

        -- Admin desativa
        perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
        set local role authenticated;
        update public.profiles set active = false where id = v_user;
        reset role;
        select active::text into v_txt from public.profiles where id = v_user;
        r := r || jsonb_build_array(jsonb_build_object('o', 3, 't', 'Admin desativa o participante', 'e', 'false', 'g', v_txt));

        -- Participante desativado continua visivel (historico do ranking)
        perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
        set local role authenticated;
        select count(*)::text into v_txt from public.profiles where id = v_user;
        reset role;
        r := r || jsonb_build_array(jsonb_build_object('o', 4, 't', 'Desativado continua na lista de perfis', 'e', '1', 'g', v_txt));

        raise sqlstate 'FASE7';
    exception
        when sqlstate 'FASE7' then
            null;
    end;

    perform set_config('request.jwt.claims', '{}', true);
    insert into fase7_resultado
    select (x->>'o')::int, x->>'t', x->>'e', coalesce(x->>'g', '(vazio)')
    from jsonb_array_elements(r) x;
end $$;

insert into fase7_resultado
select 5, 'Coluna profiles.active obrigatoria com padrao true', 'NO|true',
       (select is_nullable || '|' || column_default from information_schema.columns
        where table_schema = 'public' and table_name = 'profiles' and column_name = 'active')
union all
select 6, 'Dados de teste removidos', '0',
       (select count(*)::text from auth.users where email like 'f7_%@teste.local');

select ordem, teste, esperado, obtido,
       case when esperado = obtido then 'OK' else 'FALHOU' end as status
from fase7_resultado
order by ordem;
