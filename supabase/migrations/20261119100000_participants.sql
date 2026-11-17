-- Bolao WDD 2027 - Fase 7: participantes gerenciados pelo app
--
-- profiles.active: false = conta desativada pelo admin (o login e bloqueado no
-- Supabase Auth pela Edge Function admin-users). O historico continua: apostas,
-- ranking e WDD Coins do participante nao sao apagados.
-- Criar conta e trocar senha ficam na Edge Function admin-users, que usa a
-- chave de servico do proprio Supabase; nada disso passa pelo navegador.
-- Somente o admin altera profiles (policy "admin manage profiles" do baseline).

begin;

alter table public.profiles add column if not exists active boolean not null default true;

commit;
