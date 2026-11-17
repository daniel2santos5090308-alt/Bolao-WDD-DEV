/**
 * Temporadas (Fase 5): leitura para o admin e as duas acoes de admin
 * (create_season e activate_season, ambas no banco e restritas a admin).
 */
import { requireSupabase } from './supabase.ts';
import { clearDataCache } from './storage.ts';

export interface SeasonInfo {
  key: string;
  name: string;
  startsOn: string | null;
  endsOn: string | null;
  isActive: boolean;
}

type SeasonRow = Record<string, unknown>;

export function toSeasonInfo(row: SeasonRow): SeasonInfo {
  return {
    key: String(row.key ?? ''),
    name: String(row.name ?? ''),
    startsOn: row.starts_on ? String(row.starts_on) : null,
    endsOn: row.ends_on ? String(row.ends_on) : null,
    isActive: Boolean(row.is_active)
  };
}

export function defaultSeasonName(key: string): string {
  return `Brasileirão ${key.trim()}`;
}

/** Mensagem de erro em portugues, ou '' quando o ano e valido. */
export function validateSeasonKey(key: string, existing: SeasonInfo[] = []): string {
  const value = key.trim();
  if (!/^\d{4}$/.test(value)) return 'Informe o ano com 4 dígitos, por exemplo 2028.';
  if (existing.some((season) => season.key === value)) return `A temporada ${value} já existe.`;
  return '';
}

/** Mais recente primeiro. */
export function sortSeasons(seasons: SeasonInfo[]): SeasonInfo[] {
  return [...seasons].sort((a, b) => b.key.localeCompare(a.key));
}

function errorMessage(error: unknown, fallback: string): string {
  const message = error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : '';
  return message || fallback;
}

export async function listSeasons(): Promise<SeasonInfo[]> {
  const { data, error } = await requireSupabase()
    .from('seasons')
    .select('key, name, starts_on, ends_on, is_active');
  if (error) throw new Error(errorMessage(error, 'Não foi possível carregar as temporadas.'));
  return sortSeasons(((data || []) as SeasonRow[]).map(toSeasonInfo));
}

export async function createSeason(input: { key: string; name?: string; startsOn?: string }): Promise<SeasonInfo> {
  const { data, error } = await requireSupabase().rpc('create_season', {
    p_key: input.key.trim(),
    p_name: input.name?.trim() || null,
    p_starts_on: input.startsOn || null
  });
  if (error) throw new Error(errorMessage(error, 'Não foi possível criar a temporada.'));
  return toSeasonInfo((Array.isArray(data) ? data[0] : data) as SeasonRow);
}

export async function activateSeason(key: string): Promise<SeasonInfo> {
  const { data, error } = await requireSupabase().rpc('activate_season', { p_key: key });
  if (error) throw new Error(errorMessage(error, 'Não foi possível ativar a temporada.'));
  // Tudo no app depende da temporada ativa: descarta o cache local.
  clearDataCache();
  return toSeasonInfo((Array.isArray(data) ? data[0] : data) as SeasonRow);
}

/** 'AAAA-MM-DD' -> 'dd/mm/aaaa' (sem converter fuso). */
export function formatIsoDate(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return '';
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
}

export function describeSeasonPeriod(season: SeasonInfo): string {
  const start = formatIsoDate(season.startsOn);
  const end = formatIsoDate(season.endsOn);
  if (start && end) return `${start} a ${end}`;
  if (end) return `Encerrada em ${end}`;
  if (start) return `Desde ${start}`;
  return 'Sem datas';
}
