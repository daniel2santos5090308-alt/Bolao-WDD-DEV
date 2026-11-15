-- Bolao WDD 2027 - Fase 1.3: WDD Coins por temporada + empate (somente DEV)
--
-- process_round_coin_rewards:
--   - a rodada precisa pertencer a temporada informada;
--   - posicoes vem de get_ranking (mesma regra do ranking do app):
--     pontos -> cravadas -> na trave -> jogos apostados; empate persistente =
--     posicao compartilhada e CADA empatado recebe o premio integral da posicao
--     (ex.: 1, 1, 3 -> dois premios de 1o lugar e um de 3o).
--   - nao usa mais o nome como criterio de desempate.
--
-- Hardening: saldo e extrato so mudam pelas RPCs (que ja sao security definer).
-- Admin passa a ter apenas leitura direta em carteiras/extrato/inventario/processos.

begin;

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
#variable_conflict use_column
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

    select * into v_settings from public.coin_settings cs where cs.season_key = p_season_key;
    if not found then
        raise exception 'Configuracao de WDD Coins nao encontrada para temporada %', p_season_key;
    end if;

    select * into v_round from public.rounds r where r.id = p_round_id;
    if not found then
        raise exception 'Rodada nao encontrada';
    end if;

    if v_round.season_key is distinct from p_season_key then
        raise exception 'A rodada % pertence a temporada %, nao a %', v_round.name, v_round.season_key, p_season_key;
    end if;

    select count(*) into v_match_count from public.matches m where m.round_id = p_round_id;
    if v_match_count = 0 then
        raise exception 'Rodada sem jogos cadastrados';
    end if;

    select count(*) into v_unfinished_count
    from public.matches m
    where m.round_id = p_round_id
      and (m.result is null or m.score_home is null or m.score_away is null);
    if v_unfinished_count > 0 then
        raise exception 'Todos os jogos da rodada precisam estar finalizados com placar';
    end if;

    if exists (
        select 1 from public.coin_round_processes crp
        where crp.season_key = p_season_key and crp.round_id = p_round_id
    ) then
        raise exception 'As recompensas desta rodada ja foram processadas';
    end if;

    for v_reward in
        with valid_bets as (
            select
                b.user_id,
                p.name as user_name,
                b.match_id,
                b.score_home,
                b.score_away,
                m.home_team,
                m.away_team,
                m.score_home as final_home,
                m.score_away as final_away,
                m.is_bonus
            from public.bets b
            join public.matches m on m.id = b.match_id
            join public.profiles p on p.id = b.user_id
            where m.round_id = p_round_id
              and b.score_home is not null
              and b.score_away is not null
              and p.role <> 'admin'
        ),
        exact_rewards as (
            select
                user_id, user_name,
                v_settings.exact_score_reward as amount,
                'round_reward'::text as transaction_type,
                'match_exact'::text as reference_type,
                match_id::text as reference_id,
                'Placar exato: ' || home_team || ' x ' || away_team as description,
                jsonb_build_object('round_id', p_round_id, 'match_id', match_id, 'reward', 'exact_score',
                    'final_score', final_home || ' x ' || final_away,
                    'bet_score', score_home || ' x ' || score_away) as metadata
            from valid_bets
            where score_home = final_home and score_away = final_away
        ),
        bonus_rewards as (
            select
                user_id, user_name,
                v_settings.bonus_exact_score_reward as amount,
                'bonus_reward'::text,
                'match_bonus_exact'::text,
                match_id::text,
                'Bonus por placar exato: ' || home_team || ' x ' || away_team,
                jsonb_build_object('round_id', p_round_id, 'match_id', match_id, 'reward', 'bonus_exact_score',
                    'final_score', final_home || ' x ' || final_away,
                    'bet_score', score_home || ' x ' || score_away)
            from valid_bets
            where score_home = final_home and score_away = final_away and is_bonus
        ),
        participation_rewards as (
            select
                user_id, max(user_name),
                v_settings.full_round_participation_reward,
                'full_round_reward'::text,
                'round_full_participation'::text,
                p_round_id::text,
                'Participacao completa: ' || v_round.name,
                jsonb_build_object('round_id', p_round_id, 'reward', 'full_round_participation',
                    'matches_count', v_match_count)
            from valid_bets
            group by user_id
            having count(distinct match_id) = v_match_count
        ),
        position_rewards as (
            select
                gr.user_id, gr.user_name,
                case gr."position"
                    when 1 then v_settings.first_place_reward
                    when 2 then v_settings.second_place_reward
                    when 3 then v_settings.third_place_reward
                    else 0
                end,
                'round_reward'::text,
                'round_position'::text,
                (p_round_id || ':position:' || gr."position")::text,
                gr."position" || 'o lugar da rodada: ' || v_round.name
                    || case when count(*) over (partition by gr."position") > 1 then ' (empate)' else '' end,
                jsonb_build_object('round_id', p_round_id, 'reward', 'round_position',
                    'position', gr."position", 'points', gr.points,
                    'exact_hits', gr.exact_hits, 'near_misses', gr.near_misses,
                    'bets_count', gr.bets_count,
                    'tied', count(*) over (partition by gr."position") > 1)
            from public.get_ranking(p_season_key, p_round_id) gr
            where gr.points > 0
              and gr."position" <= 3
        )
        select * from (
            select * from exact_rewards
            union all select * from bonus_rewards
            union all select * from participation_rewards
            union all select * from position_rewards
        ) rewards
        where amount > 0
        order by user_name, transaction_type, reference_type, reference_id
    loop
        if exists (
            select 1 from public.coin_transactions ct
            where ct.season_key = p_season_key
              and ct.user_id = v_reward.user_id
              and ct.transaction_type = v_reward.transaction_type
              and ct.reference_type = v_reward.reference_type
              and ct.reference_id = v_reward.reference_id
        ) then
            continue;
        end if;

        perform public.initialize_coin_wallet(p_season_key, v_reward.user_id);

        select * into v_wallet
        from public.coin_wallets cw
        where cw.season_key = p_season_key and cw.user_id = v_reward.user_id
        for update;

        update public.coin_wallets cw
        set available_balance = cw.available_balance + v_reward.amount, updated_at = now()
        where cw.id = v_wallet.id
        returning * into v_wallet;

        insert into public.coin_transactions (
            wallet_id, season_key, user_id, transaction_type, amount,
            available_balance_after, locked_balance_after,
            reference_type, reference_id, description, metadata, created_by
        ) values (
            v_wallet.id, p_season_key, v_reward.user_id, v_reward.transaction_type, v_reward.amount,
            v_wallet.available_balance, v_wallet.locked_balance,
            v_reward.reference_type, v_reward.reference_id, v_reward.description, v_reward.metadata, auth.uid()
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

    insert into public.coin_round_processes (season_key, round_id, status, processed_by, summary)
    values (
        p_season_key, p_round_id, 'processed', auth.uid(),
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

-- ---------------------------------------------------------------------------
-- Hardening: admin so le; alteracoes somente via RPCs auditadas.
-- ---------------------------------------------------------------------------
drop policy if exists "admins manage coin wallets" on public.coin_wallets;
drop policy if exists "admins read coin wallets" on public.coin_wallets;
create policy "admins read coin wallets" on public.coin_wallets
    for select to authenticated using (public.is_admin());

drop policy if exists "admins insert coin transactions" on public.coin_transactions;

drop policy if exists "admins manage user inventory" on public.coin_user_items;

drop policy if exists "admins insert coin round processes" on public.coin_round_processes;

commit;
