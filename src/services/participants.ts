/**
 * Participantes (Fase 7): o admin cria login, redefine senha e desativa conta.
 * As tres acoes passam pela Edge Function admin-users (a chave de servico fica
 * no Supabase). A lista vem direto de profiles (o admin le todos).
 */
import { requireSupabase } from './supabase.ts';

export const MIN_PASSWORD = 6;
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;

export interface ParticipantInfo {
  id: string;
  username: string;
  name: string;
  role: string;
  active: boolean;
}

export function toParticipant(row: Record<string, unknown>): ParticipantInfo {
  return {
    id: String(row.id ?? ''),
    username: String(row.username ?? ''),
    name: String(row.name ?? ''),
    role: String(row.role ?? 'user'),
    active: row.active !== false
  };
}

/** "Ana Paula" -> "ana.paula" (sugestao de usuario a partir do nome). */
export function suggestUsername(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 30);
}

/** Mensagem de erro em portugues, ou '' quando valido. Mesmas regras da Edge Function. */
export function validateUsername(username: string, existing: ParticipantInfo[] = []): string {
  const value = username.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(value)) {
    return 'Usuário: 3 a 30 caracteres, só letras minúsculas, números, ponto, hífen ou sublinhado.';
  }
  if (existing.some((item) => item.username.toLowerCase() === value)) return `O usuário ${value} já existe.`;
  return '';
}

export function validatePassword(password: string): string {
  return password.length < MIN_PASSWORD ? `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.` : '';
}

/** Senha provisoria facil de ditar: sem letras parecidas (l, 1, O, 0). */
export function generateTemporaryPassword(length = 8): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}

/** Ativos primeiro, depois por nome. */
export function sortParticipants(list: ParticipantInfo[]): ParticipantInfo[] {
  return [...list].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'pt-BR'));
}

export const FUNCTION_NOT_DEPLOYED =
  'A função admin-users não está publicada neste ambiente do Supabase. Publique-a seguindo o supabase/README.md (Edge Functions).';

/** Traduz a resposta de erro da Edge Function (ou do Supabase na frente dela). */
export function describeFunctionError(status: number | null, body: unknown, fallback: string): string {
  const data = (body && typeof body === 'object' ? body : {}) as { error?: unknown; code?: unknown; message?: unknown };
  if (typeof data.error === 'string' && data.error) return data.error;
  if (status === 404 || data.code === 'NOT_FOUND') return FUNCTION_NOT_DEPLOYED;
  if (status === 401) return 'Sessão expirada. Saia e entre de novo.';
  return fallback;
}

async function readFunctionError(error: unknown, fallback: string): Promise<string> {
  const name = error && typeof error === 'object' && 'name' in error ? String((error as { name: unknown }).name) : '';
  if (name === 'FunctionsFetchError') return 'Não foi possível falar com o servidor. Verifique a conexão e tente de novo.';

  // FunctionsHttpError traz a resposta em error.context
  const context = error && typeof error === 'object' && 'context' in error ? (error as { context: unknown }).context : null;
  if (context && typeof (context as Response).json === 'function') {
    const response = context as Response;
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // corpo vazio ou nao-JSON
    }
    return describeFunctionError(typeof response.status === 'number' ? response.status : null, body, fallback);
  }
  return fallback;
}

async function callAdminUsers(body: Record<string, unknown>, fallback: string): Promise<Record<string, unknown>> {
  const { data, error } = await requireSupabase().functions.invoke('admin-users', { body });
  if (error) throw new Error(await readFunctionError(error, fallback));
  return (data || {}) as Record<string, unknown>;
}

export async function listParticipants(): Promise<ParticipantInfo[]> {
  const { data, error } = await requireSupabase().from('profiles').select('id, username, name, role, active');
  if (error) throw new Error('Não foi possível carregar os participantes.');
  return sortParticipants(((data || []) as Array<Record<string, unknown>>).map(toParticipant));
}

export async function createParticipant(input: { username: string; name: string; password: string }): Promise<ParticipantInfo> {
  const data = await callAdminUsers(
    { action: 'create', username: input.username.trim().toLowerCase(), name: input.name.trim(), password: input.password },
    'Não foi possível criar o participante.'
  );
  return toParticipant((data.user || {}) as Record<string, unknown>);
}

export async function resetParticipantPassword(userId: string, password: string): Promise<void> {
  await callAdminUsers({ action: 'reset_password', userId, password }, 'Não foi possível trocar a senha.');
}

export async function setParticipantActive(userId: string, active: boolean): Promise<void> {
  await callAdminUsers({ action: 'set_active', userId, active }, active ? 'Não foi possível reativar.' : 'Não foi possível desativar.');
}

/** Carteira na temporada ativa para quem entrou depois da ativacao (so admin executa). */
export async function prepareWallets(seasonKey: string): Promise<void> {
  if (!seasonKey) return;
  const { error } = await requireSupabase().rpc('initialize_coin_wallets_for_season', { p_season_key: seasonKey, p_include_admins: false });
  if (error) throw new Error('Participante criado, mas a carteira de WDD Coins não foi preparada. Use "Verificar carteiras" em WDD Coins.');
}
