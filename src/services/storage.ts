/**
 * Camada de dados do bolao (Supabase + cache).
 *
 * Controle de consumo (Fase 2):
 * - Os dados da temporada ativa vem de UMA chamada (get_app_snapshot).
 * - Ficam em memoria e no localStorage, junto com o "carimbo" app_meta.version.
 * - A cada VERSION_CHECK_MS, no maximo, o app consulta so o carimbo (poucos bytes).
 *   O snapshot so e baixado de novo quando o carimbo muda.
 * - forceRefresh ("Atualizar") sempre baixa de novo.
 */
import { requireSupabase } from './supabase.ts';
import { getCurrentUser } from './session.ts';
import {
  fromMatch,
  fromScoringSettings,
  fromSnapshot,
  fromStanding,
  getPick,
  toBet,
  toRankingHistoryRow,
  toRankingItem,
  type DbRow
} from './mappers.ts';
import { DEFAULT_SCORING_SETTINGS } from './scoring.ts';

export const VERSION_CHECK_MS = 60 * 1000;
export const PERSIST_KEY = 'bolao_wdd_snapshot_v1';

type CachedList = 'rounds' | 'matches' | 'standings';

const state = {
  cache: null as BolaoData | null,
  cachePromise: null as Promise<BolaoData> | null,
  versionPromise: null as Promise<number | null> | null,
  lastVersionCheckAt: 0,
  rankingCache: {} as Record<string, unknown>
};

export function cloneData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

/* ---------- cache ---------- */

function persistCache(): void {
  try {
    const user = getCurrentUser();
    if (!user || !state.cache) return;
    localStorage.setItem(PERSIST_KEY, JSON.stringify({ userId: user.id, data: state.cache }));
  } catch {
    // Armazenamento cheio/bloqueado: segue so com o cache em memoria
  }
}

function restorePersistedCache(): boolean {
  try {
    const user = getCurrentUser();
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!user || !raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.userId !== user.id || !parsed.data) return false;
    state.cache = parsed.data;
    state.lastVersionCheckAt = 0;
    return true;
  } catch {
    return false;
  }
}

function setCache(data: BolaoData): void {
  state.cache = cloneData(data);
  state.lastVersionCheckAt = Date.now();
  persistCache();
}

function resetMemory(): void {
  state.cache = null;
  state.cachePromise = null;
  state.versionPromise = null;
  state.lastVersionCheckAt = 0;
  state.rankingCache = {};
}

/** Limpa memoria e localStorage (login/logout). */
export function clearDataCache(): void {
  resetMemory();
  try {
    localStorage.removeItem(PERSIST_KEY);
  } catch {
    // ignora
  }
}

/** Somente para testes: forca a proxima getData() a conferir o carimbo. */
export function expireVersionCheckForTests(): void {
  state.lastVersionCheckAt = 0;
}

/** Somente para testes: zera a memoria sem tocar no localStorage (simula recarga da pagina). */
export function resetMemoryForTests(): void {
  resetMemory();
}

function upsertCachedItem<T extends { id: string }>(listName: CachedList, item: T): void {
  const list = state.cache?.[listName] as T[] | undefined;
  if (!state.cache || !Array.isArray(list)) return;
  const next = cloneData(item);
  const index = list.findIndex((entry) => entry.id === next.id);
  if (index >= 0) list[index] = next;
  else list.push(next);
  persistCache();
}

function removeCachedItem(listName: CachedList, id: string): void {
  if (!state.cache) return;
  const cache = state.cache as unknown as Record<CachedList, Array<{ id: string }> | undefined>;
  const list = cache[listName];
  if (!Array.isArray(list)) return;
  cache[listName] = list.filter((entry) => entry.id !== id);
  persistCache();
}

function removeCachedBets(matchIds: Set<string>): void {
  if (!state.cache) return;
  Object.values(state.cache.bets || {}).forEach((userBets) => {
    matchIds.forEach((matchId) => delete userBets[matchId]);
  });
}

function getSeasonKey(): string | null {
  return state.cache?.season?.key ?? null;
}

/* ---------- leitura ---------- */

async function fetchVersion(): Promise<number | null> {
  const { data, error } = await requireSupabase().from('app_meta').select('version').eq('id', 1).maybeSingle();
  if (error) throw error;
  return data ? Number(data.version) : null;
}

async function fetchData(): Promise<BolaoData> {
  const { data: snapshot, error } = await requireSupabase().rpc('get_app_snapshot');
  if (error) {
    console.error('Erro ao buscar dados do Supabase:', error);
    throw error;
  }

  const data = fromSnapshot((snapshot || {}) as DbRow);
  setCache(data);
  return data;
}

export async function getData(options: { forceRefresh?: boolean } = {}): Promise<BolaoData> {
  const forceRefresh = Boolean(options.forceRefresh);

  if (!forceRefresh && !state.cache) restorePersistedCache();

  if (!forceRefresh && state.cache) {
    if (Date.now() - state.lastVersionCheckAt < VERSION_CHECK_MS) {
      return cloneData(state.cache);
    }

    try {
      if (!state.versionPromise) {
        state.versionPromise = fetchVersion().finally(() => { state.versionPromise = null; });
      }
      const version = await state.versionPromise;
      if (version !== null && version === state.cache.version) {
        state.lastVersionCheckAt = Date.now();
        return cloneData(state.cache);
      }
    } catch (error) {
      console.warn('Não foi possível verificar a versão dos dados. Usando cache local.', error);
      return cloneData(state.cache);
    }
  }

  if (!state.cachePromise) {
    state.cachePromise = fetchData().finally(() => { state.cachePromise = null; });
  }

  try {
    return cloneData(await state.cachePromise);
  } catch (error) {
    // Sem rede: se houver cache, mostra o que temos; senao, propaga o erro para a tela
    if (state.cache) return cloneData(state.cache);
    throw error;
  }
}

/** Ranking calculado no banco (get_ranking), cacheado por versao + rodada. roundId nulo/'all' = temporada. */
export async function getRanking(roundId: string | null = null): Promise<RankingItem[]> {
  const data = await getData();
  const scope = roundId && roundId !== 'all' ? roundId : null;
  const cacheKey = `${data.version}|${data.season?.key ?? ''}|${scope || 'season'}`;
  const cached = state.rankingCache[cacheKey] as RankingItem[] | undefined;
  if (cached) return cloneData(cached);

  const { data: rows, error } = await requireSupabase().rpc('get_ranking', {
    p_season_key: data.season?.key ?? null,
    p_round_id: scope
  });
  if (error) throw error;

  const ranking = ((rows || []) as DbRow[]).map(toRankingItem);

  // Mantem so os rankings da versao atual
  const versionPrefix = `${data.version}|`;
  Object.keys(state.rankingCache).forEach((key) => {
    if (!key.startsWith(versionPrefix)) delete state.rankingCache[key];
  });
  state.rankingCache[cacheKey] = ranking;
  return cloneData(ranking);
}

/** Historico por rodada (get_ranking_history). Retorna [] se a funcao nao existir no banco. */
export async function getRankingHistory(): Promise<RankingHistoryRow[]> {
  const data = await getData();
  const cacheKey = `${data.version}|${data.season?.key ?? ''}|history`;
  const cached = state.rankingCache[cacheKey] as RankingHistoryRow[] | undefined;
  if (cached) return cloneData(cached);

  const { data: rows, error } = await requireSupabase().rpc('get_ranking_history', {
    p_season_key: data.season?.key ?? null
  });
  if (error) {
    console.warn('Histórico do ranking indisponível:', error);
    return [];
  }

  const history = ((rows || []) as DbRow[]).map(toRankingHistoryRow);
  state.rankingCache[cacheKey] = history;
  return cloneData(history);
}

/** Apostas visiveis (com a regra de ocultacao do banco), paginadas de 1000 em 1000. */
export async function getVisibleBets(filters: { roundId?: string | null; userId?: string | null } = {}): Promise<BolaoVisibleBet[]> {
  const pageSize = 1000;
  const result: BolaoVisibleBet[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data: rows, error } = await requireSupabase()
      .rpc('get_season_bets', {
        p_season_key: getSeasonKey(),
        p_round_id: filters.roundId && filters.roundId !== 'all' ? filters.roundId : null,
        p_user_id: filters.userId || null
      })
      .range(from, from + pageSize - 1);
    if (error) throw error;

    const page = (rows || []) as DbRow[];
    page.forEach((row) => result.push({ userId: row.user_id, matchId: row.match_id, ...toBet(row) }));
    if (page.length < pageSize) break;
  }

  return result;
}

/* ---------- palpites ---------- */

export interface BetInput {
  matchId: string;
  scoreHome: number;
  scoreAway: number;
  createdAt?: string;
}

/**
 * Salva varios palpites numa unica chamada. Se o lote falhar (ex.: um jogo fechou
 * no meio do caminho), tenta um a um para salvar os que ainda podem.
 */
export async function saveBets(userId: string, bets: BetInput[]): Promise<{ saved: string[]; failed: string[] }> {
  if (!bets.length) return { saved: [], failed: [] };
  const client = requireSupabase();
  const currentUser = getCurrentUser();
  const now = new Date().toISOString();
  const rows = bets.map((bet) => {
    const scoreHome = Number(bet.scoreHome);
    const scoreAway = Number(bet.scoreAway);
    return {
      user_id: userId,
      legacy_user_id: currentUser ? (currentUser.legacyId || userId) : userId,
      match_id: bet.matchId,
      pick: getPick(scoreHome, scoreAway),
      score_home: scoreHome,
      score_away: scoreAway,
      created_at: bet.createdAt || now,
      updated_at: now
    };
  });

  const applyToCache = (row: DbRow) => {
    if (!state.cache) return;
    if (!state.cache.bets[userId]) state.cache.bets[userId] = {};
    state.cache.bets[userId][row.match_id] = toBet(row);
  };

  const { error } = await client.from('bets').upsert(rows, { onConflict: 'user_id,match_id' });
  if (!error) {
    rows.forEach(applyToCache);
    persistCache();
    return { saved: rows.map((row) => row.match_id), failed: [] };
  }

  console.warn('Lote de palpites recusado; tentando um a um.', error);
  const saved: string[] = [];
  const failed: string[] = [];
  for (const row of rows) {
    const { error: rowError } = await client.from('bets').upsert(row, { onConflict: 'user_id,match_id' });
    if (rowError) {
      failed.push(row.match_id);
    } else {
      saved.push(row.match_id);
      applyToCache(row);
    }
  }
  persistCache();
  return { saved, failed };
}

/* ---------- admin ---------- */

export async function addRound(round: BolaoRound): Promise<boolean> {
  const { error } = await requireSupabase().from('rounds').upsert(round);
  if (error) console.error('Erro ao adicionar rodada:', error);
  else upsertCachedItem('rounds', round);
  return !error;
}

/** Uma unica chamada: o banco remove jogos e apostas da rodada (ON DELETE CASCADE). */
export async function deleteRound(roundId: string): Promise<boolean> {
  const { error } = await requireSupabase().from('rounds').delete().eq('id', roundId);
  if (error) {
    console.error('Erro ao deletar rodada:', error);
    return false;
  }
  if (state.cache) {
    const removed = new Set(state.cache.matches.filter((match) => match.roundId === roundId).map((match) => match.id));
    state.cache.matches = state.cache.matches.filter((match) => match.roundId !== roundId);
    removeCachedBets(removed);
    removeCachedItem('rounds', roundId);
  }
  return true;
}

export async function addMatch(match: BolaoMatch): Promise<boolean> {
  const { error } = await requireSupabase().from('matches').upsert(fromMatch(match));
  if (error) console.error('Erro ao adicionar jogo:', error);
  else upsertCachedItem('matches', match);
  return !error;
}

export async function updateMatch(match: BolaoMatch): Promise<boolean> {
  const { error } = await requireSupabase().from('matches').update(fromMatch(match)).eq('id', match.id);
  if (error) console.error('Erro ao atualizar jogo:', error);
  else upsertCachedItem('matches', match);
  return !error;
}

/** Atualiza varios jogos numa unica chamada (ex.: troca do jogo bonus). */
export async function updateMatches(matches: BolaoMatch[]): Promise<boolean> {
  if (!matches.length) return true;
  const { error } = await requireSupabase().from('matches').upsert(matches.map(fromMatch));
  if (error) console.error('Erro ao atualizar jogos:', error);
  else matches.forEach((match) => upsertCachedItem('matches', match));
  return !error;
}

export async function deleteMatch(matchId: string): Promise<boolean> {
  const { error } = await requireSupabase().from('matches').delete().eq('id', matchId);
  if (error) {
    console.error('Erro ao deletar jogo:', error);
    return false;
  }
  removeCachedBets(new Set([matchId]));
  removeCachedItem('matches', matchId);
  return true;
}

export async function addStanding(standing: BolaoStanding): Promise<boolean> {
  const { error } = await requireSupabase().from('standings').upsert(fromStanding(standing));
  if (error) console.error('Erro ao adicionar classificação:', error);
  else upsertCachedItem('standings', standing);
  return !error;
}

export async function updateStanding(standing: BolaoStanding): Promise<boolean> {
  const { error } = await requireSupabase().from('standings').update(fromStanding(standing)).eq('id', standing.id);
  if (error) console.error('Erro ao atualizar classificação:', error);
  else upsertCachedItem('standings', standing);
  return !error;
}

export async function deleteStanding(standingId: string): Promise<boolean> {
  const { error } = await requireSupabase().from('standings').delete().eq('id', standingId);
  if (error) console.error('Erro ao deletar classificação:', error);
  else removeCachedItem('standings', standingId);
  return !error;
}

/** Grava a classificacao em lote: upsert das linhas + remocao das que sairam. */
export async function replaceStandings(standings: BolaoStanding[], removedIds: string[] = []): Promise<boolean> {
  const client = requireSupabase();
  if (standings.length) {
    const { error } = await client.from('standings').upsert(standings.map(fromStanding));
    if (error) {
      console.error('Erro ao salvar classificação em lote:', error);
      return false;
    }
    standings.forEach((standing) => upsertCachedItem('standings', standing));
  }

  if (removedIds.length) {
    const { error } = await client.from('standings').delete().in('id', removedIds);
    if (error) {
      console.error('Erro ao remover linhas da classificação:', error);
      return false;
    }
    removedIds.forEach((id) => removeCachedItem('standings', id));
  }

  return true;
}

export async function updateScoringSettings(settings: Partial<BolaoScoringSettings>): Promise<boolean> {
  const next: BolaoScoringSettings = { ...DEFAULT_SCORING_SETTINGS, ...(settings || {}), id: 'default' };
  const { error } = await requireSupabase()
    .from('scoring_settings')
    .upsert(fromScoringSettings(next), { onConflict: 'id' });

  if (error) console.error('Erro ao atualizar pontuação:', error);
  else if (state.cache) {
    state.cache.scoringSettings = cloneData(next);
    persistCache();
  }
  return !error;
}
