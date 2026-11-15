/**
 * Pontuacao de UM palpite, usada so para exibir o resultado de cada jogo.
 * O ranking oficial (somas e desempate) e calculado no banco por get_ranking.
 */

export const DEFAULT_SCORING_SETTINGS: BolaoScoringSettings = {
  id: 'default',
  exactScorePoints: 10,
  nearMissPoints: 7,
  correctResultPoints: 5,
  wrongPoints: 0,
  nearMissGoalDiff: 1,
  bonusMultiplier: 2,
  bonusEnabled: true
};

type Score = { home: number; away: number };
type Outcome = 'home' | 'away' | 'draw';

export function getScoringSettings(data?: Pick<BolaoData, 'scoringSettings'> | null): BolaoScoringSettings {
  return { ...DEFAULT_SCORING_SETTINGS, ...(data?.scoringSettings || {}) };
}

function getOutcome(score: Score): Outcome {
  if (score.home > score.away) return 'home';
  if (score.home < score.away) return 'away';
  return 'draw';
}

function getBetScore(bet: Partial<BolaoBet> | null | undefined): Score | null {
  if (!bet) return null;
  const { scoreHome, scoreAway } = bet;
  if (scoreHome === null || scoreHome === undefined || scoreAway === null || scoreAway === undefined) return null;
  const score = { home: Number(scoreHome), away: Number(scoreAway) };
  return Number.isInteger(score.home) && Number.isInteger(score.away) ? score : null;
}

function getFinalScore(match: BolaoMatch | null | undefined): Score | null {
  if (!match?.score) return null;
  const score = { home: Number(match.score.home), away: Number(match.score.away) };
  return match.score.home !== null && match.score.away !== null && Number.isFinite(score.home) && Number.isFinite(score.away)
    ? score
    : null;
}

export function calculateMatchPoints(
  match: BolaoMatch,
  bet: Partial<BolaoBet> | null | undefined,
  settings: BolaoScoringSettings
): MatchPointResult {
  const betScore = getBetScore(bet);
  const finalScore = getFinalScore(match);

  if (!betScore || !finalScore) {
    return {
      betScore,
      finalScore,
      points: 0,
      basePoints: 0,
      multiplier: 1,
      isHit: false,
      isExact: false,
      isNearMiss: false,
      isCorrectResult: false,
      label: 'Aguardando'
    };
  }

  let basePoints = Number(settings.wrongPoints || 0);
  let label = 'Errou';
  let isExact = false;
  let isNearMiss = false;

  if (betScore.home === finalScore.home && betScore.away === finalScore.away) {
    basePoints = Number(settings.exactScorePoints || 0);
    label = 'Placar exato';
    isExact = true;
  } else if (getOutcome(betScore) === getOutcome(finalScore)) {
    basePoints = Number(settings.nearMissPoints || 0);
    label = 'Na trave';
    isNearMiss = true;
  }

  const multiplier = settings.bonusEnabled && match.isBonus ? Number(settings.bonusMultiplier || 1) : 1;
  const points = Math.round(basePoints * multiplier * 100) / 100;

  return {
    betScore,
    finalScore,
    points,
    basePoints,
    multiplier,
    isHit: points > 0,
    isExact,
    isNearMiss,
    isCorrectResult: isExact || isNearMiss,
    label
  };
}

const pointsFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatPoints(value: number | string | null | undefined): string {
  const number = Number(value || 0);
  return Number.isFinite(number) ? pointsFormatter.format(number) : '0';
}
