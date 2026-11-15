import { useEffect, useState } from 'react';
import { createMatchDate } from './utils.ts';

/** Inicio do jogo no horario de Brasilia (-03:00), igual ao banco. */
export function getKickoff(match: BolaoMatch): Date {
  return createMatchDate(match.date, match.time);
}

export type MatchStatus = 'open' | 'closing' | 'locked' | 'finished';

const CLOSING_WINDOW_MS = 2 * 60 * 60 * 1000;

export function getMatchStatus(match: BolaoMatch, now: number): MatchStatus {
  if (match.result !== null && match.result !== undefined) return 'finished';
  const kickoff = getKickoff(match).getTime();
  if (Number.isNaN(kickoff)) return 'open';
  if (kickoff <= now) return 'locked';
  if (kickoff - now <= CLOSING_WINDOW_MS) return 'closing';
  return 'open';
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'agora';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}min` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 dia' : `${days} dias`;
}

const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' });
const dayFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

/** "Sábado, 14/11" */
export function formatDayLabel(date: string): string {
  const reference = new Date(`${date}T12:00:00-03:00`);
  if (Number.isNaN(reference.getTime())) return date;
  const weekday = weekdayFormatter.format(reference);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${dayFormatter.format(reference)}`;
}

/** "14/11" */
export function formatShortDate(date: string): string {
  const reference = new Date(`${date}T12:00:00-03:00`);
  return Number.isNaN(reference.getTime()) ? date : dayFormatter.format(reference);
}

/** Relogio que atualiza a tela periodicamente (contagem regressiva / status dos jogos). */
export function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
