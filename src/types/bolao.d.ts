/** Formas de dados do app (camelCase). As linhas do banco ficam em services/mappers.ts. */

interface BolaoUser {
  id: string;
  legacyId?: string | null;
  username?: string;
  name: string;
  role?: string;
}

interface BolaoRound {
  id: string;
  name: string;
  number?: number;
}

interface BolaoMatchOdds {
  home: number;
  draw: number;
  away: number;
}

interface BolaoMatch {
  id: string;
  roundId: string;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  odds?: BolaoMatchOdds;
  isBonus?: boolean;
  result?: string | null;
  score?: {
    home: number | null;
    away: number | null;
  } | null;
}

interface BolaoBet {
  pick?: string | null;
  scoreHome: number | null;
  scoreAway: number | null;
  createdAt?: string;
}

interface BolaoStanding {
  id: string;
  position: number;
  team: string;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
}

interface BolaoScoringSettings {
  id?: string;
  exactScorePoints: number;
  nearMissPoints: number;
  correctResultPoints?: number;
  wrongPoints: number;
  nearMissGoalDiff?: number;
  bonusMultiplier: number;
  bonusEnabled: boolean;
}

interface BolaoSeason {
  key: string;
  name: string;
}

interface BolaoVisibleBet extends BolaoBet {
  userId: string;
  matchId: string;
}

interface BolaoData {
  version?: number | null;
  season?: BolaoSeason | null;
  users: BolaoUser[];
  rounds: BolaoRound[];
  matches: BolaoMatch[];
  bets: Record<string, Record<string, BolaoBet>>;
  standings?: BolaoStanding[];
  scoringSettings?: BolaoScoringSettings;
}

interface RankingItem {
  id: string;
  position?: number;
  name: string;
  points: number;
  exactHits: number;
  nearMisses: number;
  bonusHits: number;
  betsCount: number;
}

interface RankingHistoryRow {
  roundId: string;
  roundNumber: number;
  roundName: string;
  userId: string;
  userName: string;
  roundPoints: number;
  roundPosition: number;
  totalPoints: number;
  position: number;
}

interface MatchPointResult {
  betScore: { home: number; away: number } | null;
  finalScore: { home: number; away: number } | null;
  points: number;
  basePoints: number;
  multiplier: number;
  isHit: boolean;
  isExact: boolean;
  isNearMiss: boolean;
  isCorrectResult: boolean;
  label: string;
}
