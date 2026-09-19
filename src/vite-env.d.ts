/// <reference types="vite/client" />

interface BolaoUser {
  id: string;
  name: string;
  role?: string;
}

interface BolaoRound {
  id: string;
  name: string;
  number?: number;
}

interface BolaoMatch {
  id: string;
  roundId: string;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  isBonus?: boolean;
  result?: string | null;
  score?: {
    home: number | null;
    away: number | null;
  } | null;
}

interface BolaoBet {
  scoreHome: number | null;
  scoreAway: number | null;
  createdAt?: string;
}

interface BolaoData {
  users: BolaoUser[];
  rounds: BolaoRound[];
  matches: BolaoMatch[];
  bets: Record<string, Record<string, BolaoBet>>;
  scoringSettings?: Record<string, unknown>;
}

interface RankingItem {
  id: string;
  name: string;
  points: number;
  exactHits: number;
  nearMisses: number;
  bonusHits: number;
  betsCount: number;
  history?: Array<{
    match: string;
    points: number;
    isFinished: boolean;
  }>;
}

interface MatchPointResult {
  isHit: boolean;
  label: string;
  points: number;
}

interface BolaoLegacyApi {
  Storage: {
    getCurrentUser(): BolaoUser | null;
    getData(options?: { forceRefresh?: boolean }): Promise<BolaoData>;
    cloneData(data: BolaoData): BolaoData;
    saveBet(userId: string, matchId: string, bet: BolaoBet): Promise<boolean>;
    logout(): Promise<void>;
  };
  Ranking: {
    calculate(data: BolaoData): RankingItem[];
    calculateByRound(data: BolaoData, roundId: string): RankingItem[];
    calculateMatchPoints(match: BolaoMatch, bet: BolaoBet, settings: unknown): MatchPointResult;
    getSettings(data: BolaoData): unknown;
    formatPoints(value: number): string;
  };
  Teams: {
    getTeamMarkup(name: string, options?: { size?: string; layout?: string }): string;
  };
  Utils: {
    isMatchLocked(date: string, time: string): boolean;
  };
}

interface Window {
  BolaoLegacy: BolaoLegacyApi;
}

declare const supabaseClient: {
  auth: {
    getSession(): Promise<{ data: { session: unknown | null }; error: unknown | null }>;
  };
  rpc(functionName: string, args?: Record<string, unknown>): Promise<{ data: Record<string, unknown>[] | null; error: unknown | null }>;
  from(table: string): {
    select(columns?: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): {
          order(column: string, options?: { ascending?: boolean }): {
            range(from: number, to: number): Promise<{ data: Record<string, unknown>[] | null; error: unknown | null }>;
          };
          maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: unknown | null }>;
        };
        order(column: string, options?: { ascending?: boolean }): {
          range(from: number, to: number): Promise<{ data: Record<string, unknown>[] | null; error: unknown | null }>;
        };
        maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: unknown | null }>;
      };
    };
    upsert(values: Record<string, unknown>): Promise<{ data: unknown; error: unknown | null }>;
  };
} | undefined;
