-- Somente CI (banco local vazio): 2 participantes ficticios.
-- O teste fase0_get_visible_bets_check.sql usa os 2 primeiros participantes
-- que encontrar em profiles; os demais testes criam os proprios usuarios.
-- Nunca rode no DEV nem no PROD.

-- O "supabase db start" sobe so o Postgres, sem o servico de Auth que atualiza
-- auth.uid(). A versao que vem na imagem le apenas request.jwt.claim.sub; a do
-- Supabase hospedado (DEV/PROD) le tambem request.jwt.claims, que e o que os
-- testes e o app usam. Aqui o CI fica igual ao hospedado.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
    select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid;
$$;

insert into auth.users (id, email, aud, role)
values
    ('00000000-0000-4000-8000-0000000000c1', 'ci_a@teste.local', 'authenticated', 'authenticated'),
    ('00000000-0000-4000-8000-0000000000c2', 'ci_b@teste.local', 'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into public.profiles (id, username, name, role)
values
    ('00000000-0000-4000-8000-0000000000c1', 'ci_a', 'CI A', 'user'),
    ('00000000-0000-4000-8000-0000000000c2', 'ci_b', 'CI B', 'user')
on conflict (id) do nothing;
