/**
 * Conversao entre as linhas do Supabase (snake_case) e as formas do app (camelCase).
 * Funcoes puras: sem rede, faceis de testar.
 */
import { DEFAULT_SCORING_SETTINGS } from './scoring.ts';

/** Linha generica vinda do PostgREST/RPC. */
export type DbRow = Record<string, any>;

function toNullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export function toUser(profile: DbRow): BolaoUser {
  return {
    id: profile.id,
    legacyId: profile.legacy_id ?? null,
    username: profile.username,
    name: profile.name,
    role: profile.role
  };
}

export function toRound(round: DbRow): BolaoRound {
  return { id: round.id, name: round.name, number: round.number };
}

export function toMatch(match: DbRow): BolaoMatch {
  return {
    id: match.id,
    roundId: match.round_id,
    date: match.match_date,
    time: match.match_time ? String(match.match_time).slice(0, 5) : '',
    homeTeam: match.home_team,
    awayTeam: match.away_team,
    odds: {
      home: Number(match.odd_home || 1),
      draw: Number(match.odd_draw || 1),
      away: Number(match.odd_away || 1)
    },
    isBonus: Boolean(match.is_bonus),
    result: match.result,
    score: match.score_home === null || match.score_home === undefined || match.score_away === null || match.score_away === undefined
      ? null
      : { home: Number(match.score_home), away: Number(match.score_away) }
  };
}

export function fromMatch(match: BolaoMatch): DbRow {
  return {
    id: match.id,
    round_id: match.roundId,
    match_date: match.date,
    match_time: match.time,
    home_team: match.homeTeam,
    away_team: match.awayTeam,
    odd_home: match.odds ? match.odds.home : 1,
    odd_draw: match.odds ? match.odds.draw : 1,
    odd_away: match.odds ? match.odds.away : 1,
    is_bonus: Boolean(match.isBonus),
    result: match.result || null,
    score_home: match.score ? match.score.home : null,
    score_away: match.score ? match.score.away : null
  };
}

export function toStanding(standing: DbRow): BolaoStanding {
  return {
    id: standing.id,
    position: standing.position,
    team: standing.team,
    points: standing.points,
    played: standing.played,
    wins: standing.wins,
    draws: standing.draws,
    losses: standing.losses,
    goalsFor: standing.goals_for,
    goalsAgainst: standing.goals_against,
    goalDiff: standing.goal_diff
  };
}

export function fromStanding(standing: BolaoStanding): DbRow {
  return {
    id: standing.id,
    position: standing.position,
    team: standing.team,
    points: standing.points,
    played: standing.played,
    wins: standing.wins,
    draws: standing.draws,
    losses: standing.losses,
    goals_for: standing.goalsFor,
    goals_against: standing.goalsAgainst,
    goal_diff: standing.goalDiff
  };
}

export function toScoringSettings(settings: DbRow | null | undefined): BolaoScoringSettings {
  const defaults = DEFAULT_SCORING_SETTINGS;
  if (!settings) return { ...defaults };
  return {
    id: settings.id || defaults.id,
    exactScorePoints: Number(settings.exact_score_points ?? defaults.exactScorePoints),
    nearMissPoints: Number(settings.near_miss_points ?? defaults.nearMissPoints),
    correctResultPoints: Number(settings.correct_result_points ?? defaults.correctResultPoints),
    wrongPoints: Number(settings.wrong_points ?? defaults.wrongPoints),
    nearMissGoalDiff: Number(settings.near_miss_goal_diff ?? defaults.nearMissGoalDiff),
    bonusMultiplier: Number(settings.bonus_multiplier ?? defaults.bonusMultiplier),
    bonusEnabled: settings.bonus_enabled ?? defaults.bonusEnabled
  };
}

export function fromScoringSettings(settings: BolaoScoringSettings): DbRow {
  return {
    id: settings.id || 'default',
    exact_score_points: Number(settings.exactScorePoints),
    near_miss_points: Number(settings.nearMissPoints),
    correct_result_points: Number(settings.correctResultPoints ?? settings.nearMissPoints),
    wrong_points: Number(settings.wrongPoints),
    near_miss_goal_diff: Number(settings.nearMissGoalDiff ?? 999),
    bonus_multiplier: Number(settings.bonusMultiplier),
    bonus_enabled: Boolean(settings.bonusEnabled),
    updated_at: new Date().toISOString()
  };
}

export function toBet(bet: DbRow): BolaoBet {
  return {
    pick: bet.pick,
    scoreHome: toNullableNumber(bet.score_home),
    scoreAway: toNullableNumber(bet.score_away),
    createdAt: bet.created_at
  };
}

export function getPick(scoreHome: number, scoreAway: number): 'home' | 'away' | 'draw' {
  if (scoreHome > scoreAway) return 'home';
  if (scoreHome < scoreAway) return 'away';
  return 'draw';
}

export function fromSnapshot(snapshot: DbRow): BolaoData {
  const bets: BolaoData['bets'] = {};
  (snapshot.my_bets || []).forEach((bet: DbRow) => {
    if (!bets[bet.user_id]) bets[bet.user_id] = {};
    bets[bet.user_id][bet.match_id] = toBet(bet);
  });

  return {
    version: toNullableNumber(snapshot.version),
    season: snapshot.season || null,
    users: (snapshot.profiles || []).map(toUser),
    rounds: (snapshot.rounds || []).map(toRound),
    matches: (snapshot.matches || []).map(toMatch),
    standings: (snapshot.standings || []).map(toStanding),
    scoringSettings: toScoringSettings(snapshot.scoring_settings),
    bets
  };
}

export function toRankingItem(row: DbRow): RankingItem {
  return {
    id: row.user_id,
    name: row.user_name,
    position: Number(row.position),
    points: Number(row.points),
    exactHits: Number(row.exact_hits),
    nearMisses: Number(row.near_misses),
    bonusHits: Number(row.bonus_hits),
    betsCount: Number(row.bets_count)
  };
}

export function toRankingHistoryRow(row: DbRow): RankingHistoryRow {
  return {
    roundId: row.round_id,
    roundNumber: Number(row.round_number),
    roundName: row.round_name,
    userId: row.user_id,
    userName: row.user_name,
    roundPoints: Number(row.round_points),
    roundPosition: Number(row.round_position),
    totalPoints: Number(row.total_points),
    position: Number(row.position)
  };
}
