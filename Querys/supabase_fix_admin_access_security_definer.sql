-- Bolao WDD - correcao segura para acesso admin
-- Execute primeiro no Supabase DEV. Depois de validar, execute em PRODUCAO.
--
-- Contexto:
-- A funcao public.is_admin() e usada por policies RLS para liberar acoes
-- administrativas. Em alguns ambientes, trocar para SECURITY INVOKER faz a
-- validacao depender das proprias policies e pode causar falha/carregamento
-- infinito na tela admin.

begin;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

commit;
