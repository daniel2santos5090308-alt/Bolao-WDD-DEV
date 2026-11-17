/**
 * Importacao da tabela de jogos por CSV (Fase 6). Logica pura, sem banco:
 * parseScheduleCsv le o texto; planScheduleImport compara com o que ja existe
 * e diz o que sera criado, remarcado ou deixado como esta.
 *
 * Formato: rodada;data;hora;mandante;visitante (cabecalho opcional).
 * Separador ; , ou tab. Data dd/mm/aaaa ou aaaa-mm-dd. Hora HH:MM ou HHhMM.
 */
import { getRoundNumber } from './matches.ts';
import { getCanonicalTeamName, isKnownTeam, isSameTeam } from './teams.ts';

export const SCHEDULE_CSV_SAMPLE = `rodada;data;hora;mandante;visitante
1;27/01/2027;19:00;Flamengo;Palmeiras
1;27/01/2027;21:30;Corinthians;São Paulo
2;31/01/2027;16:00;Palmeiras;Corinthians`;

/** Jogos esperados por rodada na Serie A (20 times). */
export const MATCHES_PER_ROUND = 10;

export interface ScheduleRow {
  line: number;
  roundNumber: number;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
}

export interface ParsedSchedule {
  rows: ScheduleRow[];
  errors: string[];
}

export interface ScheduleUpdate {
  match: BolaoMatch;
  from: { date: string; time: string };
}

export interface SchedulePlan {
  newRounds: Array<{ number: number; name: string }>;
  creates: ScheduleRow[];
  updates: ScheduleUpdate[];
  unchanged: number;
  unknownTeams: string[];
  warnings: string[];
  errors: string[];
}

function detectSeparator(line: string): string {
  if (line.includes(';')) return ';';
  if (line.includes('\t')) return '\t';
  return ',';
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** dd/mm/aaaa, dd/mm/aa ou aaaa-mm-dd -> aaaa-mm-dd; '' se invalida. */
export function parseCsvDate(value: string): string {
  const text = value.trim();
  let year: number;
  let month: number;
  let day: number;

  let parts = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (parts) {
    [year, month, day] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  } else {
    parts = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (!parts) return '';
    [day, month, year] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
    if (year < 100) year += 2000;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** 19:00, 9:30, 19h, 19h30 -> HH:MM; '' se invalida. */
export function parseCsvTime(value: string): string {
  const parts = value.trim().toLowerCase().match(/^(\d{1,2})(?:[:h](\d{2})?)?$/);
  if (!parts) return '';
  const hour = Number(parts[1]);
  const minute = Number(parts[2] || 0);
  if (hour > 23 || minute > 59) return '';
  return `${pad(hour)}:${pad(minute)}`;
}

export function parseScheduleCsv(text: string): ParsedSchedule {
  const rows: ScheduleRow[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/);
  const firstContent = lines.find((line) => line.trim());
  if (!firstContent) return { rows, errors: ['Cole ou carregue o CSV com os jogos.'] };
  const separator = detectSeparator(firstContent);

  lines.forEach((raw, index) => {
    const lineNumber = index + 1;
    const line = raw.trim();
    if (!line) return;
    const cells = line.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, ''));

    // Cabecalho: primeira coluna sem numero (ex.: "rodada")
    if (!/\d/.test(cells[0] || '') && rows.length === 0 && errors.length === 0) return;

    if (cells.length < 5) {
      errors.push(`Linha ${lineNumber}: esperava 5 colunas (rodada;data;hora;mandante;visitante).`);
      return;
    }

    const [roundCell, dateCell, timeCell, homeCell, awayCell] = cells;
    const roundDigits = roundCell.match(/\d+/);
    const roundNumber = roundDigits ? Number(roundDigits[0]) : NaN;
    const date = parseCsvDate(dateCell);
    const time = parseCsvTime(timeCell);
    const homeTeam = getCanonicalTeamName(homeCell);
    const awayTeam = getCanonicalTeamName(awayCell);

    const problems: string[] = [];
    if (!Number.isInteger(roundNumber) || roundNumber < 1 || roundNumber > 99) problems.push(`rodada "${roundCell}" inválida`);
    if (!date) problems.push(`data "${dateCell}" inválida (use dd/mm/aaaa)`);
    if (!time) problems.push(`hora "${timeCell}" inválida (use HH:MM; se a CBF ainda não definiu, use o horário previsto e reimporte depois)`);
    if (!homeTeam) problems.push('mandante vazio');
    if (!awayTeam) problems.push('visitante vazio');
    if (homeTeam && awayTeam && isSameTeam(homeTeam, awayTeam)) problems.push(`${homeTeam} contra ele mesmo`);

    if (problems.length) {
      errors.push(`Linha ${lineNumber}: ${problems.join('; ')}.`);
      return;
    }
    rows.push({ line: lineNumber, roundNumber, date, time, homeTeam, awayTeam });
  });

  if (!rows.length && !errors.length) errors.push('Nenhum jogo encontrado no CSV.');
  return { rows, errors };
}

function matchKey(roundNumber: number, home: string, away: string): string {
  return `${roundNumber}|${getCanonicalTeamName(home).toLowerCase()}|${getCanonicalTeamName(away).toLowerCase()}`;
}

/**
 * Compara as linhas do CSV com a temporada ativa.
 * Mesmo jogo = mesma rodada + mesmo mandante + mesmo visitante (apelidos aceitos).
 * Jogo existente com data/hora diferente vira remarcacao; resultados nunca mudam.
 * Nada e apagado: jogos cadastrados que nao estao no CSV ficam como estao.
 */
export function planScheduleImport(rows: ScheduleRow[], rounds: BolaoRound[], matches: BolaoMatch[]): SchedulePlan {
  const plan: SchedulePlan = { newRounds: [], creates: [], updates: [], unchanged: 0, unknownTeams: [], warnings: [], errors: [] };

  const roundByNumber = new Map<number, BolaoRound>();
  rounds.forEach((round) => roundByNumber.set(getRoundNumber(round), round));
  const roundNumberById = new Map(rounds.map((round) => [round.id, getRoundNumber(round)]));

  const existingByKey = new Map<string, BolaoMatch>();
  matches.forEach((match) => {
    const number = roundNumberById.get(match.roundId);
    if (number !== undefined) existingByKey.set(matchKey(number, match.homeTeam, match.awayTeam), match);
  });

  const seen = new Map<string, number>();
  const teamsByRound = new Map<number, Map<string, number>>();
  const csvCountByRound = new Map<number, number>();
  const unknown = new Set<string>();

  rows.forEach((row) => {
    const key = matchKey(row.roundNumber, row.homeTeam, row.awayTeam);
    const previousLine = seen.get(key);
    if (previousLine) {
      plan.errors.push(`Linha ${row.line}: ${row.homeTeam} x ${row.awayTeam} da rodada ${row.roundNumber} repete a linha ${previousLine}.`);
      return;
    }
    seen.set(key, row.line);
    csvCountByRound.set(row.roundNumber, (csvCountByRound.get(row.roundNumber) || 0) + 1);

    const roundTeams = teamsByRound.get(row.roundNumber) || new Map<string, number>();
    [row.homeTeam, row.awayTeam].forEach((team) => {
      const teamKey = team.toLowerCase();
      if (roundTeams.has(teamKey)) {
        plan.warnings.push(`Rodada ${row.roundNumber}: ${team} aparece em mais de um jogo (linhas ${roundTeams.get(teamKey)} e ${row.line}).`);
      } else {
        roundTeams.set(teamKey, row.line);
      }
      if (!isKnownTeam(team)) unknown.add(team);
    });
    teamsByRound.set(row.roundNumber, roundTeams);

    if (!roundByNumber.has(row.roundNumber) && !plan.newRounds.some((round) => round.number === row.roundNumber)) {
      plan.newRounds.push({ number: row.roundNumber, name: `Rodada ${row.roundNumber}` });
    }

    const existing = existingByKey.get(key);
    if (!existing) {
      plan.creates.push(row);
      return;
    }

    const existingTime = (existing.time || '').slice(0, 5);
    if (existing.date === row.date && existingTime === row.time) {
      plan.unchanged += 1;
      return;
    }
    if (existing.result) {
      plan.warnings.push(`Linha ${row.line}: ${existing.homeTeam} x ${existing.awayTeam} já tem resultado; a data não foi alterada.`);
      plan.unchanged += 1;
      return;
    }
    plan.updates.push({ match: { ...existing, date: row.date, time: row.time }, from: { date: existing.date, time: existingTime } });
  });

  [...csvCountByRound.entries()].sort((a, b) => a[0] - b[0]).forEach(([number, count]) => {
    const round = roundByNumber.get(number);
    const alreadyThere = round ? matches.filter((match) => match.roundId === round.id).length : 0;
    const csvNew = plan.creates.filter((row) => row.roundNumber === number).length;
    const total = alreadyThere + csvNew;
    if (total !== MATCHES_PER_ROUND) {
      plan.warnings.push(`Rodada ${number} ficará com ${total} ${total === 1 ? 'jogo' : 'jogos'} (o normal são ${MATCHES_PER_ROUND}).`);
    }
    if (count < alreadyThere) {
      plan.warnings.push(`Rodada ${number}: ${alreadyThere - count} ${alreadyThere - count === 1 ? 'jogo cadastrado não está' : 'jogos cadastrados não estão'} no CSV e ${alreadyThere - count === 1 ? 'continua' : 'continuam'} como ${alreadyThere - count === 1 ? 'está' : 'estão'}.`);
    }
  });

  plan.newRounds.sort((a, b) => a.number - b.number);
  plan.unknownTeams = [...unknown].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return plan;
}
