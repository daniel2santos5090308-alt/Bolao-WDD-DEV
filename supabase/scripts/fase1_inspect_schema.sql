-- Bolao WDD 2027 - Fase 1: leitura do schema atual (somente leitura, nao altera nada)
-- Rode no SQL Editor do Supabase DEV. Retorna UMA linha com um JSON:
-- copie o conteudo da celula "schema" e envie para gerar a migration base.

with tabelas as (
    select c.oid, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'v')
)
select jsonb_pretty(jsonb_build_object(
    'tables', (
        select jsonb_object_agg(t.relname, jsonb_build_object(
            'columns', (
                select jsonb_agg(jsonb_build_object(
                    'name', a.attname,
                    'type', format_type(a.atttypid, a.atttypmod),
                    'not_null', a.attnotnull,
                    'default', pg_get_expr(d.adbin, d.adrelid)
                ) order by a.attnum)
                from pg_attribute a
                left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
                where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
            ),
            'constraints', (
                select jsonb_agg(jsonb_build_object('name', con.conname, 'def', pg_get_constraintdef(con.oid)))
                from pg_constraint con where con.conrelid = t.oid
            ),
            'indexes', (
                select jsonb_agg(pg_get_indexdef(i.indexrelid))
                from pg_index i where i.indrelid = t.oid
            ),
            'triggers', (
                select jsonb_agg(pg_get_triggerdef(tg.oid))
                from pg_trigger tg where tg.tgrelid = t.oid and not tg.tgisinternal
            ),
            'rls_enabled', (select relrowsecurity from pg_class where oid = t.oid),
            'policies', (
                select jsonb_agg(jsonb_build_object(
                    'name', p.policyname, 'cmd', p.cmd, 'roles', p.roles,
                    'using', p.qual, 'check', p.with_check))
                from pg_policies p where p.schemaname = 'public' and p.tablename = t.relname
            )
        ))
        from tabelas t
    ),
    'functions', (
        select jsonb_agg(jsonb_build_object(
            'name', p.proname,
            'args', pg_get_function_identity_arguments(p.oid),
            'security_definer', p.prosecdef
        ) order by p.proname)
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
    ),
    'row_counts', (
        select jsonb_object_agg(relname, n_live_tup)
        from pg_stat_user_tables where schemaname = 'public'
    ),
    'database_size', pg_size_pretty(pg_database_size(current_database()))
)) as schema;
