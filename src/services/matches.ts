/** Helpers de rodadas e jogos para as telas. */
import { isMatchStarted } from './utils.ts';

export function getRoundNumber(round: BolaoRound): number {
  const value = Number(round.number);
  if (Number.isFinite(value)) return value;

  const match = String(round.name || '').match(/(\d+)/g);
  return match ? Number(match[match.length - 1]) : 0;
}

export function getLatestRoundId(rounds: BolaoRound[]): string {
  const sorted = [...rounds].sort((a, b) => getRoundNumber(b) - getRoundNumber(a));
  return sorted[0]?.id || 'all';
}

/** Dias de folga depois da data tipica da rodada antes de um jogo contar como adiado. */
export const POSTPONED_GAP_DAYS = 4;

function dayNumber(date: string): number {
  return Math.floor(Date.parse(`${String(date).slice(0, 10)}T00:00:00Z`) / 864e5);
}

/** Data tipica da rodada (mediana inferior das datas), em dias. */
function roundTypicalDay(roundMatches: BolaoMatch[]): number | null {
  const days = roundMatches.map((match) => dayNumber(match.date)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!days.length) return null;
  return days[Math.floor((days.length - 1) / 2)];
}

/**
 * Jogo adiado: marcado mais de POSTPONED_GAP_DAYS dias depois da data tipica da
 * propria rodada (ex.: jogo da Rodada 21 disputado em novembro).
 */
export function isPostponedMatch(match: BolaoMatch, roundMatches: BolaoMatch[]): boolean {
  const typical = roundTypicalDay(roundMatches);
  const day = dayNumber(match.date);
  return typical !== null && Number.isFinite(day) && day - typical > POSTPONED_GAP_DAYS;
}

/**
 * Rodada "atual": a primeira (por numero) com jogo sem resultado que NAO seja
 * adiado. Se so restarem jogos adiados, a rodada do proximo deles; se tudo
 * acabou, a ultima rodada.
 */
export function getCurrentRoundId(rounds: BolaoRound[], matches: BolaoMatch[]): string {
  if (!rounds.length) return '';
  const ordered = [...rounds].sort((a, b) => getRoundNumber(a) - getRoundNumber(b));
  const byRound = new Map<string, BolaoMatch[]>();
  matches.forEach((match) => {
    const list = byRound.get(match.roundId);
    if (list) list.push(match);
    else byRound.set(match.roundId, [match]);
  });

  const pending = ordered.find((round) => {
    const roundMatches = byRound.get(round.id) || [];
    return roundMatches.some((match) => !match.result && !isPostponedMatch(match, roundMatches));
  });
  if (pending) return pending.id;

  const roundIds = new Set(ordered.map((round) => round.id));
  const nextPostponed = matches
    .filter((match) => !match.result && roundIds.has(match.roundId))
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0];
  return nextPostponed ? nextPostponed.roundId : ordered[ordered.length - 1].id;
}

export function isMatchFinished(match: BolaoMatch): boolean {
  return match.result !== null && match.result !== undefined;
}

export function isMatchLocked(match: BolaoMatch): boolean {
  return isMatchStarted(match.date, match.time) || isMatchFinished(match);
}

export function formatMatchDateTime(match: BolaoMatch): string {
  const normalizedTime = match.time?.slice(0, 5) || '00:00';
  const date = new Date(`${match.date}T${normalizedTime}:00`);

  if (Number.isNaN(date.getTime())) {
    return `${match.date} as ${normalizedTime}`;
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function getMatchScore(match: BolaoMatch): string | null {
  if (!match.score) return null;

  const home = Number(match.score.home);
  const away = Number(match.score.away);
  return Number.isFinite(home) && Number.isFinite(away) ? `${home} x ${away}` : null;
}
