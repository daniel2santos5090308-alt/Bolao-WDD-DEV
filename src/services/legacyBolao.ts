export function getLegacy(): BolaoLegacyApi {
  if (!window.BolaoLegacy) {
    throw new Error('Bolao legacy API was not loaded.');
  }

  return window.BolaoLegacy;
}

export function getCurrentUser(): BolaoUser | null {
  return getLegacy().Storage.getCurrentUser();
}

export async function hasSupabaseAuthSession(): Promise<boolean> {
  if (typeof supabaseClient === 'undefined' || !supabaseClient?.auth) {
    return false;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.warn('Nao foi possivel validar a sessao Supabase.', error);
    return false;
  }

  return Boolean(data.session);
}

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

export function isMatchFinished(match: BolaoMatch): boolean {
  return match.result !== null && match.result !== undefined;
}

export function isMatchLocked(match: BolaoMatch): boolean {
  return getLegacy().Utils.isMatchLocked(match.date, match.time) || isMatchFinished(match);
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
