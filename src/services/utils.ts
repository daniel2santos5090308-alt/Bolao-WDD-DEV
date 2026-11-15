/** Utilitarios sem dependencia de tela. */

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Inicio do jogo. Data/hora sao cadastradas no horario de Brasilia, que nao tem
 * mais horario de verao: sempre -03:00, igual ao banco (America/Sao_Paulo).
 * Assim o bloqueio no front bate com o do banco mesmo com o celular em outro fuso.
 */
export function createMatchDate(date: string, time: string): Date {
  const normalizedTime = (time || '00:00').slice(0, 5);
  return new Date(`${date}T${normalizedTime}:00-03:00`);
}

/** O jogo ja comecou? (bloqueia novos palpites no front; o banco tambem bloqueia). */
export function isMatchStarted(date: string, time: string, now: Date = new Date()): boolean {
  return now >= createMatchDate(date, time);
}

export function getLoginEmail(username: string): string {
  const value = String(username || '').trim().toLowerCase();
  return value.includes('@') ? value : `${value}@bolao.local`;
}
