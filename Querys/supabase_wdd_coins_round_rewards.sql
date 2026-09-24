-- Bolao WDD 2027 - processamento manual de recompensas por rodada
-- Execute no ambiente DEV depois de supabase_wdd_coins_schema.sql e supabase_wdd_coins_wallet_init.sql.
-- O admin deve chamar public.process_round_coin_rewards pela aplicacao.

create table if not exists public.coin_round_processes (
    id uuid primary key default gen_random_uuid(),
    season_key text not null references public.coin_settings(season_key) on update cascade on delete restrict,
    round_id text not null,
    status text not null default 'processed',
    processed_by uuid references public.profiles(id) on update cascade on delete set null,
    processed_at timestamptz not null default now(),
    summary jsonb not null default '{}'::jsonb,
    constraint coin_round_processes_unique_round unique (season_key, round_id),
    constraint coin_round_processes_status_allowed check (status in ('processed'))
);

alter table public.coin_round_processes enable row level security;

drop policy if exists "admins read coin round processes" on public.coin_round_processes;
create policy "admins read coin round processes"
on public.coin_round_processes
for select
to authenticated
using (public.is_admin());

drop policy if exists "admins insert coin round processes" on public.coin_round_processes;
create policy "admins insert coin round processes"
on public.coin_round_processes
for insert
to authenticated
with check (public.is_admin());

create unique index if not exists uq_coin_transactions_reward_reference
on public.coin_transactions (season_key, user_id, transaction_type, reference_type, reference_id)
where transaction_type in ('round_reward', 'bonus_reward', 'full_round_reward');

create or replace function public.process_round_coin_rewards(
    p_round_id text,
    p_season_key text default '2027'
)
returns table (
    rewarded_user_id uuid,
    rewarded_user_name text,
    reward_amount integer,
    reward_type text,
    reward_description text
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_settings public.coin_settings%rowtype;
    v_round public.rounds%rowtype;
    v_match_count integer;
    v_unfinished_count integer;
    v_reward record;
    v_wallet public.coin_wallets%rowtype;
    v_total_rewards integer := 0;
    v_total_amount integer := 0;
begin
    if auth.uid() is null or not public.is_admin() then
        raise exception 'Apenas administradores podem processar recompensas de rodada';
    end if;

    select *
    into v_settings
    from public.coin_settings cs
    where cs.season_key = p_season_key;

    if not found then
        raise exception 'Configuracao de WDD Coins nao encontrada para temporada %', p_season_key;
    end if;

    select *
    into v_round
    from public.rounds
    where id = p_round_id;

    if not found then
        raise exception 'Rodada nao encontrada';
    end if;

    select count(*)
    into v_match_count
    from public.matches
    where round_id = p_round_id;

    if v_match_count = 0 then
        raise exception 'Rodada sem jogos cadastrados';
    end if;

    select count(*)
    into v_unfinished_count
    from public.matches
    where round_id = p_round_id
      and (
        result is null
        or score_home is null
        or score_away is null
      );

    if v_unfinished_count > 0 then
        raise exception 'Todos os jogos da rodada precisam estar finalizados com placar';
    end if;

    if exists (
        select 1
        from public.coin_round_processes crp
        where crp.season_key = p_season_key
          and crp.round_id = p_round_id
    ) then
        raise exception 'As recompensas desta rodada ja foram processadas';
    end if;

    for v_reward in
        with settings as (
            select
                coalesce(ss.exact_score_points, 10) as exact_score_points,
                coalesce(ss.near_miss_points, 7) as near_miss_points,
                coalesce(ss.wrong_points, 0) as wrong_points,
                coalesce(ss.bonus_multiplier, 2) as bonus_multiplier,
                coalesce(ss.bonus_enabled, true) as bonus_enabled
            from public.scoring_settings ss
            where ss.id = 'default'
            union all
            select 10, 7, 0, 2, true
            where not exists (select 1 from public.scoring_settings where id = 'default')
            limit 1
        ),
        finished_matches as (
            select
                m.id,
                m.home_team,
                m.away_team,
                m.score_home,
                m.score_away,
                m.is_bonus,
                case
                    when m.score_home > m.score_away then 'home'
                    when m.score_home < m.score_away then 'away'
                    else 'draw'
                end as final_result
            from public.matches m
            where m.round_id = p_round_id
              and m.result is not null
              and m.score_home is not null
              and m.score_away is not null
        ),
        valid_bets as (
            select
                b.user_id,
                p.name as user_name,
                b.match_id,
                b.score_home,
                b.score_away,
                fm.home_team,
                fm.away_team,
                fm.score_home as final_home,
                fm.score_away as final_away,
                fm.is_bonus,
                fm.final_result,
                case
                    when b.score_home > b.score_away then 'home'
                    when b.score_home < b.score_away then 'away'
                    else 'draw'
                end as bet_result
            from public.bets b
            join finished_matches fm on fm.id = b.match_id
            join public.profiles p on p.id = b.user_id
            where b.score_home is not null
              and b.score_away is not null
              and coalesce(p.role, 'user') <> 'admin'
        ),
        bet_points as (
            select
                vb.*,
                case
                    when vb.score_home = vb.final_home and vb.score_away = vb.final_away then true
                    else false
                end as is_exact,
                case
                    when vb.score_home = vb.final_home and vb.score_away = vb.final_away then false
                    when vb.bet_result = vb.final_result then true
                    else false
                end as is_near_miss,
                case
                    when vb.score_home = vb.final_home and vb.score_away = vb.final_away then s.exact_score_points
                    when vb.bet_result = vb.final_result then s.near_miss_points
                    else s.wrong_points
                end
                * case when s.bonus_enabled and vb.is_bonus then s.bonus_multiplier else 1 end as points
            from valid_bets vb
            cross join settings s
        ),
        exact_rewards as (
            select
                user_id,
                user_name,
                v_settings.exact_score_reward as amount,
                'round_reward'::text as transaction_type,
                'match_exact'::text as reference_type,
                match_id::text as reference_id,
                'Placar exato: ' || home_team || ' x ' || away_team as description,
                jsonb_build_object(
                    'round_id', p_round_id,
                    'match_id', match_id,
                    'reward', 'exact_score',
                    'final_score', final_home || ' x ' || final_away,
                    'bet_score', score_home || ' x ' || score_away
                ) as metadata
            from bet_points
            where is_exact
              and v_settings.exact_score_reward > 0
        ),
        bonus_rewards as (
            select
                user_id,
                user_name,
                v_settings.bonus_exact_score_reward as amount,
                'bonus_reward'::text as transaction_type,
                'match_bonus_exact'::text as reference_type,
                match_id::text as reference_id,
                'Bonus por placar exato: ' || home_team || ' x ' || away_team as description,
                jsonb_build_object(
                    'round_id', p_round_id,
                    'match_id', match_id,
                    'reward', 'bonus_exact_score',
                    'final_score', final_home || ' x ' || final_away,
                    'bet_score', score_home || ' x ' || score_away
                ) as metadata
            from bet_points
            where is_exact
              and is_bonus
              and v_settings.bonus_exact_score_reward > 0
        ),
        participation_rewards as (
            select
                vb.user_id,
                max(vb.user_name) as user_name,
                v_settings.full_round_participation_reward as amount,
                'full_round_reward'::text as transaction_type,
                'round_full_participation'::text as reference_type,
                p_round_id::text as reference_id,
                'Participacao completa: ' || v_round.name as description,
                jsonb_build_object(
                    'round_id', p_round_id,
                    'reward', 'full_round_participation',
                    'matches_count', v_match_count
                ) as metadata
            from valid_bets vb
            group by vb.user_id
            having count(distinct vb.match_id) = v_match_count
               and v_settings.full_round_participation_reward > 0
        ),
        round_ranking as (
            select
                bp.user_id,
                max(bp.user_name) as user_name,
                sum(bp.points) as points,
                count(*) filter (where bp.is_exact) as exact_hits,
                count(*) filter (where bp.is_near_miss) as near_misses,
                count(*) as bets_count
            from bet_points bp
            group by bp.user_id
        ),
        ranked_users as (
            select
                rr.*,
                row_number() over (
                    order by rr.points desc, rr.exact_hits desc, rr.near_misses desc, rr.bets_count desc, rr.user_name asc
                ) as position
            from round_ranking rr
            where rr.points > 0
        ),
        position_rewards as (
            select
                user_id,
                user_name,
                case position
                    when 1 then v_settings.first_place_reward
                    when 2 then v_settings.second_place_reward
                    when 3 then v_settings.third_place_reward
                    else 0
                end as amount,
                'round_reward'::text as transaction_type,
                'round_position'::text as reference_type,
                (p_round_id || ':position:' || position)::text as reference_id,
                position || 'o lugar da rodada: ' || v_round.name as description,
                jsonb_build_object(
                    'round_id', p_round_id,
                    'reward', 'round_position',
                    'position', position,
                    'points', points,
                    'exact_hits', exact_hits,
                    'near_misses', near_misses,
                    'bets_count', bets_count
                ) as metadata
            from ranked_users
            where position <= 3
        )
        select *
        from (
            select * from exact_rewards
            union all
            select * from bonus_rewards
            union all
            select * from participation_rewards
            union all
            select * from position_rewards
        ) rewards
        where amount > 0
        order by user_name, transaction_type, reference_type, reference_id
    loop
        if exists (
            select 1
            from public.coin_transactions ct
            where ct.season_key = p_season_key
              and ct.user_id = v_reward.user_id
              and ct.transaction_type = v_reward.transaction_type
              and ct.reference_type = v_reward.reference_type
              and ct.reference_id = v_reward.reference_id
        ) then
            continue;
        end if;

        perform public.initialize_coin_wallet(p_season_key, v_reward.user_id);

        select *
        into v_wallet
        from public.coin_wallets cw
        where cw.season_key = p_season_key
          and cw.user_id = v_reward.user_id
        for update;

        update public.coin_wallets
        set
            available_balance = available_balance + v_reward.amount,
            updated_at = now()
        where id = v_wallet.id
        returning *
        into v_wallet;

        insert into public.coin_transactions (
            wallet_id,
            season_key,
            user_id,
            transaction_type,
            amount,
            available_balance_after,
            locked_balance_after,
            reference_type,
            reference_id,
            description,
            metadata,
            created_by
        )
        values (
            v_wallet.id,
            p_season_key,
            v_reward.user_id,
            v_reward.transaction_type,
            v_reward.amount,
            v_wallet.available_balance,
            v_wallet.locked_balance,
            v_reward.reference_type,
            v_reward.reference_id,
            v_reward.description,
            v_reward.metadata,
            auth.uid()
        );

        v_total_rewards := v_total_rewards + 1;
        v_total_amount := v_total_amount + v_reward.amount;

        rewarded_user_id := v_reward.user_id;
        rewarded_user_name := v_reward.user_name;
        reward_amount := v_reward.amount;
        reward_type := v_reward.transaction_type;
        reward_description := v_reward.description;
        return next;
    end loop;

    insert into public.coin_round_processes (
        season_key,
        round_id,
        status,
        processed_by,
        summary
    )
    values (
        p_season_key,
        p_round_id,
        'processed',
        auth.uid(),
        jsonb_build_object(
            'round_name', v_round.name,
            'matches_count', v_match_count,
            'transactions_count', v_total_rewards,
            'total_amount', v_total_amount
        )
    );
end;
$$;

revoke all on function public.process_round_coin_rewards(text, text) from public;
revoke all on function public.process_round_coin_rewards(text, text) from anon;
grant execute on function public.process_round_coin_rewards(text, text) to authenticated;
