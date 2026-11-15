import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { CoinSettings } from '../hooks/useCoinSettings';
import { StandingsLegend, StandingsTable } from '../components/StandingsTable';
import { useBolaoData } from '../hooks/useBolaoData';
import { useCoinSettings } from '../hooks/useCoinSettings';
import { getRoundNumber } from '../services/matches';
import * as storage from '../services/storage';
import { requireSupabase } from '../services/supabase';
import { generateId } from '../services/utils';

type AdminTab = 'jogos' | 'pontuacao' | 'classificacao' | 'coins';

interface CoinRoundProcess {
  id: string;
  roundId: string;
  processedAt: string;
  transactionsCount: number;
  totalAmount: number;
}

interface AdminCoinTransaction {
  id: string;
  userId: string;
  transactionType: string;
  amount: number;
  description: string;
  createdAt: string;
}

interface AdminCoinWallet {
  id: string;
  userId: string;
  userName: string;
  availableBalance: number;
  lockedBalance: number;
  totalBalance: number;
}

interface AdminStoreItem {
  id: string;
  name: string;
  itemType: string;
  price: number;
  rarity: string;
  isActive: boolean;
}

interface AdminUserStoreItem {
  id: string;
  userId: string;
  itemId: string;
  purchasedAt: string;
}

const coinFields: Array<{ key: keyof Omit<CoinSettings, 'seasonKey'>; label: string; help: string }> = [
  { key: 'initialBalance', label: 'Saldo inicial', help: 'Crédito único ao criar a carteira.' },
  { key: 'firstPlaceReward', label: '1o lugar da rodada', help: 'Prêmio por melhor pontuação da rodada.' },
  { key: 'secondPlaceReward', label: '2o lugar da rodada', help: 'Prêmio por segunda melhor pontuação.' },
  { key: 'thirdPlaceReward', label: '3o lugar da rodada', help: 'Prêmio por terceira melhor pontuação.' },
  { key: 'exactScoreReward', label: 'Placar exato', help: 'Recompensa por cravada simples.' },
  { key: 'bonusExactScoreReward', label: 'Placar exato bônus', help: 'Recompensa extra no jogo bônus.' },
  { key: 'fullRoundParticipationReward', label: 'Participação completa', help: 'Recompensa por palpitar em todos os jogos da rodada.' }
];

const defaultScoring: BolaoScoringSettings = {
  id: 'default',
  exactScorePoints: 10,
  nearMissPoints: 7,
  wrongPoints: 0,
  bonusMultiplier: 2,
  bonusEnabled: true
};

const csvSample = `position;team;points;played;wins;draws;losses;goals_for;goals_against;goal_diff
1;Palmeiras;47;21;14;5;2;38;16;22
2;Flamengo;39;20;11;6;3;37;18;19`;

function resultFromScore(home: number, away: number) {
  if (home > away) return 'home';
  if (home < away) return 'away';
  return 'draw';
}

function getGoalDiff(goalsFor: number, goalsAgainst: number) {
  return goalsFor - goalsAgainst;
}

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object') {
    const error = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [error.message, error.details, error.hint, error.code]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (parts.length) return parts.join(' | ');
  }
  return fallback;
}

function readNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseInteger(value: string, label: string, line: number) {
  const parsed = Number(String(value || '').trim());
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Linha ${line}: ${label} deve ser um número inteiro maior ou igual a zero.`);
  }
  return parsed;
}

function parseStandingsCsv(csv: string): Omit<BolaoStanding, 'id'>[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('Informe o cabecalho e pelo menos uma linha.');

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map((header) => header.trim().toLowerCase());
  const required = ['position', 'team', 'points', 'played', 'wins', 'draws', 'losses', 'goals_for', 'goals_against', 'goal_diff'];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Cabecalho incompleto: ${missing.join(', ')}.`);

  const index = Object.fromEntries(headers.map((header, idx) => [header, idx]));
  const seenPositions = new Set<number>();
  const seenTeams = new Set<string>();

  return lines.slice(1).map((line, lineIndex) => {
    const lineNumber = lineIndex + 2;
    const parts = line.split(delimiter).map((value) => value.trim());
    const team = parts[index.team];
    if (!team) throw new Error(`Linha ${lineNumber}: time obrigatório.`);

    const position = parseInteger(parts[index.position], 'position', lineNumber);
    const normalizedTeam = team.toLocaleLowerCase('pt-BR');
    if (seenPositions.has(position)) throw new Error(`Linha ${lineNumber}: posição duplicada.`);
    if (seenTeams.has(normalizedTeam)) throw new Error(`Linha ${lineNumber}: time duplicado.`);
    seenPositions.add(position);
    seenTeams.add(normalizedTeam);

    return {
      position,
      team,
      points: parseInteger(parts[index.points], 'points', lineNumber),
      played: parseInteger(parts[index.played], 'played', lineNumber),
      wins: parseInteger(parts[index.wins], 'wins', lineNumber),
      draws: parseInteger(parts[index.draws], 'draws', lineNumber),
      losses: parseInteger(parts[index.losses], 'losses', lineNumber),
      goalsFor: parseInteger(parts[index.goals_for], 'goals_for', lineNumber),
      goalsAgainst: parseInteger(parts[index.goals_against], 'goals_against', lineNumber),
      goalDiff: Number(parts[index.goal_diff])
    };
  }).sort((a, b) => a.position - b.position);
}

function emptyMatchForm(roundId = '') {
  return { id: '', roundId, date: '', time: '', homeTeam: '', awayTeam: '' };
}

function emptyStandingForm(): BolaoStanding {
  return { id: '', position: 1, team: '', points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0 };
}

export function AdminPage() {
  const bolaoData = useBolaoData();
  const coinSettings = useCoinSettings('2027');
  const data = bolaoData.data;

  const [activeTab, setActiveTab] = useState<AdminTab>('jogos');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [roundName, setRoundName] = useState('');
  const [filterRoundId, setFilterRoundId] = useState('all');
  const [matchForm, setMatchForm] = useState(emptyMatchForm());
  const [scoringDraft, setScoringDraft] = useState<BolaoScoringSettings | null>(null);
  const [standingForm, setStandingForm] = useState<BolaoStanding>(emptyStandingForm());
  const [csvText, setCsvText] = useState('');
  const [csvPreview, setCsvPreview] = useState<Omit<BolaoStanding, 'id'>[]>([]);
  const [coinDraft, setCoinDraft] = useState<CoinSettings | null>(null);
  const [selectedRewardRoundId, setSelectedRewardRoundId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [coinProcesses, setCoinProcesses] = useState<CoinRoundProcess[]>([]);
  const [coinTransactions, setCoinTransactions] = useState<AdminCoinTransaction[]>([]);
  const [coinWallets, setCoinWallets] = useState<AdminCoinWallet[]>([]);
  const [coinStoreItems, setCoinStoreItems] = useState<AdminStoreItem[]>([]);
  const [coinUserItems, setCoinUserItems] = useState<AdminUserStoreItem[]>([]);
  const [coinAdminLoading, setCoinAdminLoading] = useState(false);
  const [coinAdminLoaded, setCoinAdminLoaded] = useState(false);
  const [walletInitializing, setWalletInitializing] = useState(false);
  const [adjustingWallet, setAdjustingWallet] = useState(false);
  const [adjustmentUserId, setAdjustmentUserId] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentDescription, setAdjustmentDescription] = useState('');

  const rounds = useMemo(() => [...(data?.rounds || [])].sort((a, b) => getRoundNumber(a) - getRoundNumber(b)), [data?.rounds]);
  const matches = data?.matches || [];
  const standings = data?.standings || [];
  const scoring = scoringDraft || data?.scoringSettings || defaultScoring;
  const coins = coinDraft || coinSettings.settings;
  const selectedRoundMatches = matches
    .filter((match) => filterRoundId === 'all' || match.roundId === filterRoundId)
    .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());
  const finishedRounds = rounds.filter((round) => {
    const roundMatches = matches.filter((match) => match.roundId === round.id);
    return roundMatches.length > 0 && roundMatches.every((match) => {
      const home = Number(match.score?.home);
      const away = Number(match.score?.away);
      return Boolean(match.result) && Number.isFinite(home) && Number.isFinite(away);
    });
  });

  function notify(text: string) {
    setMessage(text);
    setError('');
  }

  function fail(text: string) {
    setError(text);
    setMessage('');
  }

  /** Botao "Atualizar": baixa tudo de novo. */
  async function refresh() {
    await bolaoData.refresh();
    await coinSettings.refresh();
  }

  /**
   * Depois de cada acao do admin: le do cache local (ja atualizado pela gravacao).
   * Nao baixa a base inteira de novo; a sincronizacao vem pelo carimbo de versao.
   */
  async function syncAfterWrite() {
    await bolaoData.reload();
  }

  async function handleCreateRound(event: FormEvent) {
    event.preventDefault();
    const name = roundName.trim();
    if (!name) return;
    const nextNumber = rounds.length ? Math.max(...rounds.map(getRoundNumber)) + 1 : 1;
    const success = await storage.addRound({ id: generateId(), name, number: nextNumber });
    if (!success) return fail('Não foi possível criar a rodada.');
    setRoundName('');
    notify('Rodada criada com sucesso.');
    await syncAfterWrite();
  }

  async function handleDeleteRound(roundId: string) {
    if (!window.confirm('Excluir esta rodada, seus jogos e as apostas desses jogos?')) return;
    // Uma chamada: o banco apaga jogos e apostas da rodada em cascata.
    const success = await storage.deleteRound(roundId);
    if (!success) return fail('Não foi possível excluir a rodada.');
    notify('Rodada excluida.');
    await syncAfterWrite();
  }

  async function handleSaveMatch(event: FormEvent) {
    event.preventDefault();
    if (!matchForm.roundId || !matchForm.date || !matchForm.time || !matchForm.homeTeam || !matchForm.awayTeam) return fail('Preencha todos os dados do jogo.');
    const existing = matchForm.id ? matches.find((match) => match.id === matchForm.id) : null;
    const payload: BolaoMatch = {
      ...(existing || {}),
      id: matchForm.id || generateId(),
      roundId: matchForm.roundId,
      date: matchForm.date,
      time: matchForm.time,
      homeTeam: matchForm.homeTeam.trim(),
      awayTeam: matchForm.awayTeam.trim(),
      isBonus: existing ? Boolean(existing.isBonus) : false,
      result: existing?.result || null,
      score: existing?.score || null
    };
    const success = existing ? await storage.updateMatch(payload) : await storage.addMatch(payload);
    if (!success) return fail('Não foi possível salvar o jogo.');
    setMatchForm(emptyMatchForm(matchForm.roundId));
    notify('Jogo salvo com sucesso.');
    await syncAfterWrite();
  }

  async function handleDeleteMatch(matchId: string) {
    if (!window.confirm('Excluir este jogo?')) return;
    const success = await storage.deleteMatch(matchId);
    if (!success) return fail('Não foi possível excluir o jogo.');
    notify('Jogo excluido.');
    await syncAfterWrite();
  }

  async function setRoundBonus(roundId: string, matchId: string | null) {
    // So os jogos que mudam, numa unica gravacao.
    const changed = matches
      .filter((item) => item.roundId === roundId && Boolean(item.isBonus) !== Boolean(matchId && item.id === matchId))
      .map((item) => ({ ...item, isBonus: Boolean(matchId && item.id === matchId) }));
    const success = await storage.updateMatches(changed);
    if (!success) return fail('Não foi possível atualizar o jogo bônus.');
    notify(matchId ? 'Jogo bônus atualizado.' : 'Bônus removido.');
    await syncAfterWrite();
  }

  async function randomBonus() {
    if (!filterRoundId || filterRoundId === 'all') return fail('Selecione uma rodada para sortear o bônus.');
    const roundMatches = matches.filter((match) => match.roundId === filterRoundId);
    if (!roundMatches.length) return fail('Esta rodada não possui jogos.');
    const selected = roundMatches[Math.floor(Math.random() * roundMatches.length)];
    await setRoundBonus(filterRoundId, selected.id);
  }

  async function saveScore(match: BolaoMatch, home: string, away: string) {
    const homeScore = Number(home);
    const awayScore = Number(away);
    if (!Number.isInteger(homeScore) || homeScore < 0 || !Number.isInteger(awayScore) || awayScore < 0) return fail('Informe um placar válido.');
    const success = await storage.updateMatch({ ...match, score: { home: homeScore, away: awayScore }, result: resultFromScore(homeScore, awayScore) });
    if (!success) return fail('Não foi possível salvar o placar.');
    notify('Placar salvo.');
    await syncAfterWrite();
  }

  async function clearScore(match: BolaoMatch) {
    const success = await storage.updateMatch({ ...match, score: null, result: null });
    if (!success) return fail('Não foi possível limpar o placar.');
    notify('Placar limpo.');
    await syncAfterWrite();
  }

  async function saveScoring() {
    const success = await storage.updateScoringSettings(scoring);
    if (!success) return fail('Não foi possível salvar a pontuação.');
    setScoringDraft(null);
    notify('Pontuação salva.');
    await syncAfterWrite();
  }

  async function handleSaveStanding(event: FormEvent) {
    event.preventDefault();
    const payload = { ...standingForm, id: standingForm.id || generateId(), goalDiff: getGoalDiff(standingForm.goalsFor, standingForm.goalsAgainst) };
    const existing = standings.some((item) => item.id === payload.id);
    const success = existing ? await storage.updateStanding(payload) : await storage.addStanding(payload);
    if (!success) return fail('Não foi possível salvar a classificação.');
    setStandingForm(emptyStandingForm());
    notify('Classificação salva.');
    await syncAfterWrite();
  }

  async function deleteStanding(id: string) {
    if (!window.confirm('Excluir esta linha da classificação?')) return;
    const success = await storage.deleteStanding(id);
    if (!success) return fail('Não foi possível excluir a linha.');
    notify('Linha excluida.');
    await syncAfterWrite();
  }

  function previewCsv() {
    try {
      setCsvPreview(parseStandingsCsv(csvText));
      notify('CSV validado. Confira a prévia antes de salvar.');
    } catch (err) {
      setCsvPreview([]);
      fail(err instanceof Error ? err.message : 'CSV inválido.');
    }
  }

  async function saveCsv() {
    if (!csvPreview.length) return fail('Pré-visualize um CSV válido antes de salvar.');
    if (!window.confirm('Salvar esta classificação em lote? Times fora do CSV serão removidos.')) return;
    const existingByTeam = new Map(standings.map((item) => [item.team.toLocaleLowerCase('pt-BR'), item]));
    const csvTeams = new Set(csvPreview.map((item) => item.team.toLocaleLowerCase('pt-BR')));
    // Duas chamadas no total: upsert de todas as linhas + remocao das que sairam.
    const payload = csvPreview.map((row) => ({
      id: existingByTeam.get(row.team.toLocaleLowerCase('pt-BR'))?.id || generateId(),
      ...row
    }));
    const removedIds = standings
      .filter((standing) => !csvTeams.has(standing.team.toLocaleLowerCase('pt-BR')))
      .map((standing) => standing.id);
    const success = await storage.replaceStandings(payload, removedIds);
    if (!success) return fail('A classificação foi parcialmente atualizada. Confira os dados.');
    setCsvPreview([]);
    notify('Classificação atualizada em lote.');
    await syncAfterWrite();
  }

  async function saveCoinSettings() {
    const success = await coinSettings.save(coins);
    if (!success) return fail('Não foi possível salvar as configurações WDD Coins.');
    setCoinDraft(null);
    notify('Configurações WDD Coins salvas.');
  }

  async function loadCoinAdminData() {
    setCoinAdminLoading(true);
    try {
      const supabaseClient = requireSupabase();

      const { data: processRows, error: processError } = await supabaseClient
        .from('coin_round_processes')
        .select('id, round_id, processed_at, summary')
        .eq('season_key', coins.seasonKey)
        .order('processed_at', { ascending: false })
        .range(0, 9);

      if (processError) throw processError;

      const { data: transactionRows, error: transactionError } = await supabaseClient
        .from('coin_transactions')
        .select('id, user_id, transaction_type, amount, description, created_at')
        .eq('season_key', coins.seasonKey)
        .order('created_at', { ascending: false })
        .range(0, 14);

      if (transactionError) throw transactionError;

      const { data: walletRows, error: walletError } = await supabaseClient
        .from('coin_wallet_summary')
        .select('id, user_id, user_name, available_balance, locked_balance, total_balance')
        .eq('season_key', coins.seasonKey)
        .order('total_balance', { ascending: false })
        .range(0, 19);

      if (walletError) throw walletError;

      const { data: storeRows, error: storeError } = await supabaseClient
        .from('coin_store_items')
        .select('id, name, item_type, price, rarity, is_active')
        .eq('season_key', coins.seasonKey)
        .order('sort_order', { ascending: true });

      if (storeError) throw storeError;

      const { data: userItemRows, error: userItemError } = await supabaseClient
        .from('coin_user_items')
        .select('id, user_id, item_id, purchased_at')
        .eq('season_key', coins.seasonKey)
        .order('purchased_at', { ascending: false })
        .range(0, 19);

      if (userItemError) throw userItemError;

      setCoinProcesses((processRows || []).map((row) => {
        const summary = row.summary && typeof row.summary === 'object' ? row.summary as Record<string, unknown> : {};
        return {
          id: readString(row.id),
          roundId: readString(row.round_id),
          processedAt: readString(row.processed_at),
          transactionsCount: readNumber(summary.transactions_count),
          totalAmount: readNumber(summary.total_amount)
        };
      }));
      setCoinTransactions((transactionRows || []).map((row) => ({
        id: readString(row.id),
        userId: readString(row.user_id),
        transactionType: readString(row.transaction_type),
        amount: readNumber(row.amount),
        description: readString(row.description),
        createdAt: readString(row.created_at)
      })));
      setCoinWallets((walletRows || []).map((row) => ({
        id: readString(row.id),
        userId: readString(row.user_id),
        userName: readString(row.user_name),
        availableBalance: readNumber(row.available_balance),
        lockedBalance: readNumber(row.locked_balance),
        totalBalance: readNumber(row.total_balance)
      })));
      setCoinStoreItems((storeRows || []).map((row: Record<string, unknown>) => ({
        id: readString(row.id),
        name: readString(row.name),
        itemType: readString(row.item_type),
        price: readNumber(row.price),
        rarity: readString(row.rarity),
        isActive: Boolean(row.is_active)
      })));
      setCoinUserItems((userItemRows || []).map((row: Record<string, unknown>) => ({
        id: readString(row.id),
        userId: readString(row.user_id),
        itemId: readString(row.item_id),
        purchasedAt: readString(row.purchased_at)
      })));
      setCoinAdminLoaded(true);
      notify('Histórico WDD Coins carregado.');
    } catch (err) {
      fail(getErrorMessage(err, 'Não foi possível carregar o histórico WDD Coins.'));
    } finally {
      setCoinAdminLoading(false);
    }
  }

  async function initializeCoinWallets() {
    const confirmed = window.confirm('Inicializar carteiras WDD Coins para todos os participantes? Se o saldo inicial estiver configurado acima de zero, ele será creditado uma única vez por usuário.');
    if (!confirmed) return;

    setWalletInitializing(true);
    try {
      const supabaseClient = requireSupabase();
      const { data: wallets, error: rpcError } = await supabaseClient.rpc('initialize_coin_wallets_for_season', { p_season_key: coins.seasonKey, p_include_admins: false });
      if (rpcError) throw rpcError;
      notify(`Carteiras verificadas: ${(wallets || []).length} participantes preparados para a temporada ${coins.seasonKey}.`);
      await loadCoinAdminData();
    } catch (err) {
      fail(getErrorMessage(err, 'Não foi possível inicializar as carteiras WDD Coins.'));
    } finally {
      setWalletInitializing(false);
    }
  }

  async function adjustCoinWallet(event: FormEvent) {
    event.preventDefault();
    const amount = Number(adjustmentAmount);
    if (!adjustmentUserId) return fail('Selecione o participante para ajustar.');
    if (!Number.isInteger(amount) || amount === 0) return fail('Informe um valor inteiro diferente de zero.');
    if (!adjustmentDescription.trim()) return fail('Informe o motivo do ajuste.');

    const selectedUser = data?.users.find((user) => user.id === adjustmentUserId);
    const confirmed = window.confirm(`Confirmar ajuste de ${amount.toLocaleString('pt-BR')} WDD Coins para ${selectedUser?.name || 'participante'}?`);
    if (!confirmed) return;

    setAdjustingWallet(true);
    try {
      const supabaseClient = requireSupabase();
      const { error: rpcError } = await supabaseClient.rpc('adjust_coin_wallet_by_admin', {
        p_season_key: coins.seasonKey,
        p_user_id: adjustmentUserId,
        p_amount: amount,
        p_description: adjustmentDescription.trim()
      });
      if (rpcError) throw rpcError;
      setAdjustmentAmount('');
      setAdjustmentDescription('');
      notify('Ajuste WDD Coins registrado com sucesso.');
      await loadCoinAdminData();
    } catch (err) {
      fail(getErrorMessage(err, 'Não foi possível ajustar a carteira WDD Coins.'));
    } finally {
      setAdjustingWallet(false);
    }
  }

  async function processRoundRewards() {
    if (!selectedRewardRoundId) return fail('Selecione uma rodada finalizada.');
    setProcessing(true);
    try {
      const supabaseClient = requireSupabase();
      const { data: rewards, error: rpcError } = await supabaseClient.rpc('process_round_coin_rewards', { p_round_id: selectedRewardRoundId, p_season_key: coins.seasonKey });
      if (rpcError) throw rpcError;
      const total = ((rewards || []) as Array<{ reward_amount?: number | string }>).reduce((sum, row) => sum + Number(row.reward_amount || 0), 0);
      notify(`Rodada processada: ${(rewards || []).length} lançamentos e ${total} WDD Coins creditadas.`);
      await loadCoinAdminData();
    } catch (err) {
      fail(getErrorMessage(err, 'Não foi possível processar a rodada.'));
    } finally {
      setProcessing(false);
    }
  }

  async function exportBackup() {
    if (!data) return;
    let allBets: BolaoVisibleBet[] = [];
    try {
      // Admin ve todas as apostas da temporada (paginado, sem limite de 1000 linhas)
      allBets = await storage.getVisibleBets();
    } catch (err) {
      return fail(getErrorMessage(err, 'Não foi possível carregar as apostas para o backup.'));
    }
    const backup = { exportedAt: new Date().toISOString(), ...data, bets: allBets };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bolao_backup_${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="admin-page">
      <div className="admin-hero">
        <div><span className="eyebrow">Administração</span><h1>Painel admin</h1><p>Controle jogos, placares, pontuação, classificação e WDD Coins no novo modelo React.</p></div>
        <div className="hero-actions"><button type="button" onClick={refresh} disabled={bolaoData.loading}>Atualizar</button><button type="button" onClick={exportBackup}>Exportar JSON</button></div>
      </div>

      <nav className="admin-tabs">
        {([['jogos', 'Jogos'], ['pontuacao', 'Pontuação'], ['classificacao', 'Classificação'], ['coins', 'WDD Coins']] as Array<[AdminTab, string]>).map(([id, label]) => (
          <button key={id} type="button" className={activeTab === id ? 'is-active' : ''} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </nav>

      {message ? <div className="inline-feedback">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      {activeTab === 'jogos' ? (
        <div className="admin-two-col">
          <section className="admin-panel">
            <header><div><h2>Rodadas</h2><p>Cadastre e organize as rodadas da temporada.</p></div></header>
            <form className="admin-inline-form" onSubmit={handleCreateRound}><input value={roundName} onChange={(event) => setRoundName(event.target.value)} placeholder="Ex: Rodada 1" /><button type="submit">Criar rodada</button></form>
            <div className="admin-list">{rounds.map((round) => <div key={round.id} className="admin-list-row"><strong>{round.name}</strong><button type="button" onClick={() => handleDeleteRound(round.id)}>Excluir</button></div>)}</div>
          </section>

          <section className="admin-panel">
            <header><div><h2>{matchForm.id ? 'Editar jogo' : 'Novo jogo'}</h2><p>Times, data, horário e rodada.</p></div></header>
            <form className="admin-fields-grid admin-fields-grid--match" onSubmit={handleSaveMatch}>
              <label className="admin-field"><span>Rodada</span><select value={matchForm.roundId} onChange={(event) => setMatchForm({ ...matchForm, roundId: event.target.value })} required><option value="">Selecione</option>{rounds.map((round) => <option key={round.id} value={round.id}>{round.name}</option>)}</select></label>
              <label className="admin-field"><span>Data</span><input type="date" value={matchForm.date} onChange={(event) => setMatchForm({ ...matchForm, date: event.target.value })} required /></label>
              <label className="admin-field"><span>Horário</span><input type="time" value={matchForm.time} onChange={(event) => setMatchForm({ ...matchForm, time: event.target.value })} required /></label>
              <label className="admin-field"><span>Time casa</span><input value={matchForm.homeTeam} onChange={(event) => setMatchForm({ ...matchForm, homeTeam: event.target.value })} required /></label>
              <label className="admin-field"><span>Time visitante</span><input value={matchForm.awayTeam} onChange={(event) => setMatchForm({ ...matchForm, awayTeam: event.target.value })} required /></label>
              <div className="admin-panel__actions"><button type="submit">{matchForm.id ? 'Salvar alterações' : 'Cadastrar jogo'}</button>{matchForm.id ? <button type="button" onClick={() => setMatchForm(emptyMatchForm(matchForm.roundId))}>Cancelar</button> : null}</div>
            </form>
          </section>

          <section className="admin-panel admin-panel--wide">
            <header><div><h2>Jogos cadastrados</h2><p>Edite placares, bônus e dados dos jogos.</p></div><div className="admin-panel__actions"><select value={filterRoundId} onChange={(event) => setFilterRoundId(event.target.value)}><option value="all">Todas as rodadas</option>{rounds.map((round) => <option key={round.id} value={round.id}>{round.name}</option>)}</select><button type="button" onClick={randomBonus}>Sortear bônus</button></div></header>
            <div className="admin-match-list">{selectedRoundMatches.length === 0 ? <div className="empty-row">Nenhum jogo cadastrado.</div> : selectedRoundMatches.map((match) => {
              const round = rounds.find((item) => item.id === match.roundId);
              return <AdminMatchRow key={match.id} match={match} roundName={round?.name || 'Rodada'} onEdit={() => setMatchForm({ id: match.id, roundId: match.roundId, date: match.date, time: match.time, homeTeam: match.homeTeam, awayTeam: match.awayTeam })} onDelete={() => handleDeleteMatch(match.id)} onScore={saveScore} onClear={clearScore} onBonus={() => setRoundBonus(match.roundId, match.isBonus ? null : match.id)} />;
            })}</div>
          </section>
        </div>
      ) : null}

      {activeTab === 'pontuacao' ? <ScoringAdmin scoring={scoring} onChange={setScoringDraft} onSave={saveScoring} /> : null}
      {activeTab === 'classificacao' ? <StandingsAdmin standingForm={standingForm} setStandingForm={setStandingForm} onSave={handleSaveStanding} csvText={csvText} setCsvText={setCsvText} csvPreview={csvPreview} previewCsv={previewCsv} saveCsv={saveCsv} standings={standings} deleteStanding={deleteStanding} /> : null}
      {activeTab === 'coins' ? <CoinsAdmin coins={coins} setCoinDraft={setCoinDraft} saveCoinSettings={saveCoinSettings} saving={coinSettings.saving} finishedRounds={finishedRounds} selectedRewardRoundId={selectedRewardRoundId} setSelectedRewardRoundId={setSelectedRewardRoundId} processRoundRewards={processRoundRewards} processing={processing} coinProcesses={coinProcesses} coinTransactions={coinTransactions} coinWallets={coinWallets} coinStoreItems={coinStoreItems} coinUserItems={coinUserItems} users={data?.users || []} rounds={rounds} loadCoinAdminData={loadCoinAdminData} coinAdminLoading={coinAdminLoading} coinAdminLoaded={coinAdminLoaded} initializeCoinWallets={initializeCoinWallets} walletInitializing={walletInitializing} adjustmentUserId={adjustmentUserId} setAdjustmentUserId={setAdjustmentUserId} adjustmentAmount={adjustmentAmount} setAdjustmentAmount={setAdjustmentAmount} adjustmentDescription={adjustmentDescription} setAdjustmentDescription={setAdjustmentDescription} adjustCoinWallet={adjustCoinWallet} adjustingWallet={adjustingWallet} /> : null}
    </section>
  );
}

function NumberField({ label, value, onChange, help, min = 0, step = '1' }: { label: string; value: number; onChange(value: number): void; help?: string; min?: number; step?: string }) {
  return <label className="admin-field"><span>{label}</span><input type="number" min={min} step={step} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Math.max(min, Number(event.target.value) || 0))} />{help ? <small>{help}</small> : null}</label>;
}

function AdminMatchRow({ match, roundName, onEdit, onDelete, onScore, onClear, onBonus }: { match: BolaoMatch; roundName: string; onEdit(): void; onDelete(): void; onScore(match: BolaoMatch, home: string, away: string): void; onClear(match: BolaoMatch): void; onBonus(): void }) {
  const [home, setHome] = useState(match.score?.home?.toString() || '');
  const [away, setAway] = useState(match.score?.away?.toString() || '');
  return <article className={`admin-match-row ${match.isBonus ? 'is-bonus' : ''}`}><div><strong>{match.homeTeam} x {match.awayTeam}</strong><span>{roundName} | {match.date} {match.time}</span></div><div className="score-editor"><input value={home} onChange={(event) => setHome(event.target.value)} type="number" min="0" /><span>x</span><input value={away} onChange={(event) => setAway(event.target.value)} type="number" min="0" /></div><div className="admin-row-actions"><button type="button" onClick={() => onScore(match, home, away)}>Salvar placar</button><button type="button" onClick={() => onClear(match)}>Limpar</button><button type="button" onClick={onBonus}>{match.isBonus ? 'Remover bônus' : 'Marcar bônus'}</button><button type="button" onClick={onEdit}>Editar</button><button type="button" onClick={onDelete}>Excluir</button></div></article>;
}

function ScoringAdmin({ scoring, onChange, onSave }: { scoring: BolaoScoringSettings; onChange(value: BolaoScoringSettings): void; onSave(): void }) {
  return <section className="admin-panel"><header><div><h2>Pontuação do bolão</h2><p>Valores usados no ranking de pontos.</p></div><div className="admin-panel__actions"><button type="button" onClick={onSave}>Salvar pontuação</button></div></header><div className="admin-fields-grid"><NumberField label="Placar exato" value={scoring.exactScorePoints} onChange={(value) => onChange({ ...scoring, exactScorePoints: value })} step="0.01" /><NumberField label="Na trave" value={scoring.nearMissPoints} onChange={(value) => onChange({ ...scoring, nearMissPoints: value })} step="0.01" /><NumberField label="Erro" value={scoring.wrongPoints} onChange={(value) => onChange({ ...scoring, wrongPoints: value })} step="0.01" /><NumberField label="Multiplicador bônus" value={scoring.bonusMultiplier} onChange={(value) => onChange({ ...scoring, bonusMultiplier: value })} min={1} step="0.1" /><label className="admin-field"><span>Jogo bônus</span><select value={scoring.bonusEnabled ? 'on' : 'off'} onChange={(event) => onChange({ ...scoring, bonusEnabled: event.target.value === 'on' })}><option value="on">Ativo</option><option value="off">Inativo</option></select><small>Controla multiplicador de pontos no ranking.</small></label></div></section>;
}

function StandingsAdmin({ standingForm, setStandingForm, onSave, csvText, setCsvText, csvPreview, previewCsv, saveCsv, standings, deleteStanding }: { standingForm: BolaoStanding; setStandingForm(value: BolaoStanding): void; onSave(event: FormEvent): void; csvText: string; setCsvText(value: string): void; csvPreview: Omit<BolaoStanding, 'id'>[]; previewCsv(): void; saveCsv(): void; standings: BolaoStanding[]; deleteStanding(id: string): void }) {
  return <div className="page-stack"><section className="admin-panel"><header><div><h2>{standingForm.id ? 'Editar classificação' : 'Nova linha da classificação'}</h2><p>Atualização individual da tabela.</p></div></header><form className="admin-fields-grid" onSubmit={onSave}><NumberField label="Posição" value={standingForm.position} onChange={(value) => setStandingForm({ ...standingForm, position: value })} min={1} /><label className="admin-field"><span>Time</span><input value={standingForm.team} onChange={(event) => setStandingForm({ ...standingForm, team: event.target.value })} required /></label><NumberField label="Pontos" value={standingForm.points} onChange={(value) => setStandingForm({ ...standingForm, points: value })} /><NumberField label="Jogos" value={standingForm.played} onChange={(value) => setStandingForm({ ...standingForm, played: value })} /><NumberField label="Vitórias" value={standingForm.wins} onChange={(value) => setStandingForm({ ...standingForm, wins: value })} /><NumberField label="Empates" value={standingForm.draws} onChange={(value) => setStandingForm({ ...standingForm, draws: value })} /><NumberField label="Derrotas" value={standingForm.losses} onChange={(value) => setStandingForm({ ...standingForm, losses: value })} /><NumberField label="GP" value={standingForm.goalsFor} onChange={(value) => setStandingForm({ ...standingForm, goalsFor: value, goalDiff: getGoalDiff(value, standingForm.goalsAgainst) })} /><NumberField label="GC" value={standingForm.goalsAgainst} onChange={(value) => setStandingForm({ ...standingForm, goalsAgainst: value, goalDiff: getGoalDiff(standingForm.goalsFor, value) })} /><label className="admin-field"><span>SG</span><input value={getGoalDiff(standingForm.goalsFor, standingForm.goalsAgainst)} readOnly /></label><div className="admin-panel__actions"><button type="submit">Salvar classificação</button>{standingForm.id ? <button type="button" onClick={() => setStandingForm(emptyStandingForm())}>Cancelar</button> : null}</div></form></section><section className="admin-panel"><header><div><h2>Atualização via CSV</h2><p>Cole a classificação completa e salve em lote.</p></div><div className="admin-panel__actions"><button type="button" onClick={() => setCsvText(csvSample)}>Usar modelo</button></div></header><div className="csv-editor"><textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder="position;team;points;played;wins;draws;losses;goals_for;goals_against;goal_diff" /><div className="admin-panel__actions"><button type="button" onClick={previewCsv}>Pré-visualizar CSV</button><button type="button" onClick={saveCsv} disabled={!csvPreview.length}>Salvar classificação em lote</button></div></div>{csvPreview.length ? <StandingsTable standings={csvPreview.map((row) => ({ id: row.team, ...row }))} emptyText="Sem prévia." /> : null}</section><section className="table-card"><header><h2>Classificação atual</h2></header><StandingsLegend /><StandingsTable standings={standings} /><div className="admin-list">{[...standings].sort((a, b) => a.position - b.position).map((standing) => <div key={standing.id} className="admin-list-row"><strong>{standing.position}. {standing.team}</strong><span>{standing.points} pts</span><button type="button" onClick={() => setStandingForm(standing)}>Editar</button><button type="button" onClick={() => deleteStanding(standing.id)}>Excluir</button></div>)}</div></section></div>;
}

function CoinsAdmin({ coins, setCoinDraft, saveCoinSettings, saving, finishedRounds, selectedRewardRoundId, setSelectedRewardRoundId, processRoundRewards, processing, coinProcesses, coinTransactions, coinWallets, coinStoreItems, coinUserItems, users, rounds, loadCoinAdminData, coinAdminLoading, coinAdminLoaded, initializeCoinWallets, walletInitializing, adjustmentUserId, setAdjustmentUserId, adjustmentAmount, setAdjustmentAmount, adjustmentDescription, setAdjustmentDescription, adjustCoinWallet, adjustingWallet }: { coins: CoinSettings; setCoinDraft(value: CoinSettings): void; saveCoinSettings(): void; saving: boolean; finishedRounds: BolaoRound[]; selectedRewardRoundId: string; setSelectedRewardRoundId(value: string): void; processRoundRewards(): void; processing: boolean; coinProcesses: CoinRoundProcess[]; coinTransactions: AdminCoinTransaction[]; coinWallets: AdminCoinWallet[]; coinStoreItems: AdminStoreItem[]; coinUserItems: AdminUserStoreItem[]; users: BolaoUser[]; rounds: BolaoRound[]; loadCoinAdminData(): void; coinAdminLoading: boolean; coinAdminLoaded: boolean; initializeCoinWallets(): void; walletInitializing: boolean; adjustmentUserId: string; setAdjustmentUserId(value: string): void; adjustmentAmount: string; setAdjustmentAmount(value: string): void; adjustmentDescription: string; setAdjustmentDescription(value: string): void; adjustCoinWallet(event: FormEvent): void; adjustingWallet: boolean }) {
  const [walletSearch, setWalletSearch] = useState('');
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const roundNameById = new Map(rounds.map((round) => [round.id, round.name]));
  const userNameById = new Map(users.map((user) => [user.id, user.name]));
  const participantUsers = users.filter((user) => user.role !== 'admin').sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const totalAvailableBalance = coinWallets.reduce((sum, wallet) => sum + wallet.availableBalance, 0);
  const totalLockedBalance = coinWallets.reduce((sum, wallet) => sum + wallet.lockedBalance, 0);
  const totalProcessedAmount = coinProcesses.reduce((sum, process) => sum + process.totalAmount, 0);
  const totalRecentCredits = coinTransactions.filter((transaction) => transaction.amount > 0).reduce((sum, transaction) => sum + transaction.amount, 0);
  const itemNameById = new Map(coinStoreItems.map((item) => [item.id, item.name]));
  const normalizedWalletSearch = walletSearch.trim().toLocaleLowerCase('pt-BR');
  const filteredWallets = normalizedWalletSearch
    ? coinWallets.filter((wallet) => (wallet.userName || userNameById.get(wallet.userId) || '').toLocaleLowerCase('pt-BR').includes(normalizedWalletSearch))
    : coinWallets;
  const filteredTransactions = transactionFilter === 'credit'
    ? coinTransactions.filter((transaction) => transaction.amount > 0)
    : transactionFilter === 'debit'
      ? coinTransactions.filter((transaction) => transaction.amount < 0)
      : coinTransactions;

  return (
    <div className="page-stack">
      <section className="admin-panel">
        <header>
          <div><h2>Temporada {coins.seasonKey}</h2><p>Valores em WDD Coins para processamentos futuros.</p></div>
          <div className="admin-panel__actions"><button type="button" onClick={initializeCoinWallets} disabled={walletInitializing}>{walletInitializing ? 'Inicializando...' : 'Inicializar carteiras'}</button><button type="button" onClick={saveCoinSettings} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></div>
        </header>
        <div className="admin-fields-grid">{coinFields.map((field) => <NumberField key={field.key} label={field.label} value={coins[field.key]} onChange={(value) => setCoinDraft({ ...coins, [field.key]: value })} help={field.help} />)}</div>
      </section>

      <section className="admin-panel">
        <header>
          <div><h2>Ajuste manual</h2><p>Registra crédito ou estorno com motivo no extrato do participante.</p></div>
          <div className="admin-panel__actions"><button type="submit" form="coin-adjustment-form" disabled={adjustingWallet}>{adjustingWallet ? 'Ajustando...' : 'Registrar ajuste'}</button></div>
        </header>
        <form id="coin-adjustment-form" className="admin-fields-grid" onSubmit={adjustCoinWallet}>
          <label className="admin-field">
            <span>Participante</span>
            <select value={adjustmentUserId} onChange={(event) => setAdjustmentUserId(event.target.value)} required>
              <option value="">Selecione</option>
              {participantUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </label>
          <label className="admin-field">
            <span>Valor</span>
            <input type="number" step="1" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} placeholder="Ex: 50 ou -20" required />
            <small>Use valor positivo para crédito e negativo para estorno.</small>
          </label>
          <label className="admin-field admin-field--wide">
            <span>Motivo</span>
            <input value={adjustmentDescription} onChange={(event) => setAdjustmentDescription(event.target.value)} placeholder="Ex: Correção de premiação" required />
          </label>
        </form>
      </section>

      <section className="admin-panel">
        <header>
          <div><h2>Processar rodada</h2><p>Credita moedas por placares, bônus, ranking e participação completa.</p></div>
          <div className="admin-panel__actions"><button type="button" onClick={processRoundRewards} disabled={processing || !selectedRewardRoundId}>{processing ? 'Processando...' : 'Processar recompensas'}</button></div>
        </header>
        <div className="admin-fields-grid admin-fields-grid--compact"><label className="admin-field admin-field--wide"><span>Rodada finalizada</span><select value={selectedRewardRoundId} onChange={(event) => setSelectedRewardRoundId(event.target.value)}><option value="">Selecione</option>{finishedRounds.map((round) => <option key={round.id} value={round.id}>{round.name}</option>)}</select><small>Somente rodadas com todos os jogos finalizados aparecem aqui.</small></label></div>
      </section>

      <section className="admin-panel">
        <header>
          <div><h2>Histórico de recompensas</h2><p>Consulta manual para conferir rodadas processadas e últimos lançamentos.</p></div>
          <div className="admin-panel__actions"><button type="button" onClick={loadCoinAdminData} disabled={coinAdminLoading}>{coinAdminLoading ? 'Carregando...' : 'Carregar histórico'}</button></div>
        </header>
        {!coinAdminLoaded ? <div className="empty-row">Clique em carregar histórico para consultar os dados.</div> : null}
        {coinAdminLoaded ? (
          <>
            <div className="admin-metric-grid">
              <article><span>Carteiras</span><strong>{coinWallets.length.toLocaleString('pt-BR')}</strong></article>
              <article><span>Saldo disponível</span><strong>{totalAvailableBalance.toLocaleString('pt-BR')}</strong></article>
              <article><span>Saldo bloqueado</span><strong>{totalLockedBalance.toLocaleString('pt-BR')}</strong></article>
              <article><span>Total processado</span><strong>{totalProcessedAmount.toLocaleString('pt-BR')}</strong><small>{totalRecentCredits.toLocaleString('pt-BR')} nos ultimos lancamentos</small></article>
              <article><span>Itens da loja</span><strong>{coinStoreItems.length.toLocaleString('pt-BR')}</strong><small>{coinUserItems.length.toLocaleString('pt-BR')} compras registradas</small></article>
            </div>
            <div className="admin-filter-row">
              <label>
                <span>Buscar carteira</span>
                <input value={walletSearch} onChange={(event) => setWalletSearch(event.target.value)} placeholder="Nome do participante" />
              </label>
              <label>
                <span>Filtrar lançamentos</span>
                <select value={transactionFilter} onChange={(event) => setTransactionFilter(event.target.value as 'all' | 'credit' | 'debit')}>
                  <option value="all">Todos</option>
                  <option value="credit">Créditos</option>
                  <option value="debit">Debitos</option>
                </select>
              </label>
            </div>
            <div className="admin-history-grid">
              <div>
                <h3>Rodadas processadas</h3>
                <div className="admin-list">
                  {coinProcesses.length === 0 ? <div className="empty-row">Nenhuma rodada processada.</div> : coinProcesses.map((process) => (
                    <div key={process.id} className="admin-list-row">
                      <strong>{roundNameById.get(process.roundId) || process.roundId}</strong>
                      <span>{process.transactionsCount} lancamentos | {process.totalAmount.toLocaleString('pt-BR')} coins</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3>Saldos das carteiras</h3>
                <div className="admin-list">
                  {filteredWallets.length === 0 ? <div className="empty-row">Nenhuma carteira encontrada.</div> : filteredWallets.map((wallet) => (
                    <div key={wallet.id} className="admin-list-row">
                      <strong>{wallet.userName || userNameById.get(wallet.userId) || 'Usuário'}</strong>
                      <span>{wallet.availableBalance.toLocaleString('pt-BR')} disp. | {wallet.lockedBalance.toLocaleString('pt-BR')} bloq. | {wallet.totalBalance.toLocaleString('pt-BR')} total</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3>Últimos lançamentos</h3>
                <div className="admin-list">
                  {filteredTransactions.length === 0 ? <div className="empty-row">Nenhum lançamento encontrado.</div> : filteredTransactions.map((transaction) => (
                    <div key={transaction.id} className="admin-list-row">
                      <strong>{userNameById.get(transaction.userId) || 'Usuário'}</strong>
                      <span>{transaction.amount.toLocaleString('pt-BR')} coins | {transaction.description}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3>Loja e inventário</h3>
                <div className="admin-list">
                  {coinStoreItems.length === 0 ? <div className="empty-row">Nenhum item cadastrado.</div> : coinStoreItems.map((item) => (
                    <div key={item.id} className="admin-list-row">
                      <strong>{item.name}</strong>
                      <span>{item.price.toLocaleString('pt-BR')} coins | {item.rarity} | {item.isActive ? 'ativo' : 'inativo'}</span>
                    </div>
                  ))}
                </div>
                <h3>Compras recentes</h3>
                <div className="admin-list">
                  {coinUserItems.length === 0 ? <div className="empty-row">Nenhuma compra registrada.</div> : coinUserItems.map((item) => (
                    <div key={item.id} className="admin-list-row">
                      <strong>{userNameById.get(item.userId) || 'Usuário'}</strong>
                      <span>{itemNameById.get(item.itemId) || 'Item'} | {item.purchasedAt ? new Date(item.purchasedAt).toLocaleString('pt-BR') : '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
