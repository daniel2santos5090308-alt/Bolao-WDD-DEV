-- Bolao WDD 2027 - nomes das temporadas com acento (somente DEV)
-- O nome aparece no topo das telas ("BRASILEIRÃO 2027").

begin;

update public.seasons set name = 'Brasileirão 2026' where key = '2026' and name = 'Brasileirao 2026';
update public.seasons set name = 'Brasileirão 2027' where key = '2027' and name = 'Brasileirao 2027';

commit;
