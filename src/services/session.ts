/** Usuario logado (perfil salvo no localStorage apos o login). */

export const SESSION_KEY = 'bolao_wdd_session';

export function getCurrentUser(): BolaoUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as BolaoUser) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: BolaoUser): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearCurrentUser(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignora: armazenamento bloqueado
  }
}
