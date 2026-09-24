import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { CoinSettings } from '../hooks/useCoinSettings';
import { StandingsLegend, StandingsTable } from '../components/StandingsTable';
import { useBolaoData } from '../hooks/useBolaoData';
import { useCoinSettings } from '../hooks/useCoinSettings';
import { getLegacy, getRoundNumber } from '../services/legacyBolao';

type AdminTab = 'jogos' | 'pontuacao' | 'classificacao' | 'coins';

const coinFields: Array<{ key: keyof Omit<CoinSettings, 'seasonKey'>; label: string; help: string }> = [
  { key: 'initialBalance', label: 'Saldo inicial', help: 'Credito unico ao criar a carteira.' },
  { key: 'firstPlaceReward', label: '1o lugar da rodada', help: 'Premio por melhor pontuacao da rodada.' },
  { key: 'secondPlaceReward', label: '2o lugar da rodada', help: 'Premio por segunda melhor pontuacao.' },
  { key: 'thirdPlaceReward', label: '3o lugar da rodada', help: 'Premio por terceira melhor pontuacao.' },
  { key: 'exactScoreReward', label: 'Placar exato', help: 'Recompensa por cravada simples.' },
  { key: 'bonusExactScoreReward', label: 'Placar exato bonus', help: 'Recompensa extra no jogo bonus.' },
  { key: 'fullRoundParticipationReward', label: 'Participacao completa', help: 'Recompensa por palpitar em todos os jogos da rodada.' }
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

function parseInteger(value: string, label: string, line: number) {
  const parsed = Number(String(value || '').trim());
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Linha ${line}: ${label} deve ser um numero inteiro maior ou igual a zero.`);
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
    if (!team) throw new Error(`Linha ${lineNumber}: time obrigatorio.`);

    const position = parseInteger(parts[index.position], 'position', lineNumber);
    const normalizedTeam = team.toLocaleLowerCase('pt-BR');
    if (seenPositions.has(position)) throw new Error(`Linha ${lineNumber}: posicao duplicada.`);
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
  const storage = getLegacy().Storage;
  const utils = getLegacy().Utils;

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

  async function refresh() {
    await bolaoData.refresh();
    await coinSettings.refresh();
  }

  async function handleCreateRound(event: FormEvent) {
    event.preventDefault();
    const name = roundName.trim();
    if (!name) return;
    const nextNumber = rounds.length ? Math.max(...rounds.map(getRoundNumber)) + 1 : 1;
    const success = await storage.addRound({ id: utils.generateId(), name, number: nextNumber });
    if (!success) return fail('Nao foi possivel criar a rodada.');
    setRoundName('');
    notify('Rodada criada com sucesso.');
    await refresh();
  }

  async function handleDeleteRound(roundId: string) {
    if (!window.confirm('Excluir esta rodada e seus jogos?')) return;
    for (const match of matches.filter((item) => item.roundId === roundId)) await storage.deleteMatch(match.id);
    const success = await storage.deleteRound(roundId);
    if (!success) return fail('Nao foi possivel excluir a rodada.');
    notify('Rodada excluida.');
    await refresh();
  }

  async function handleSaveMatch(event: FormEvent) {
    event.preventDefault();
    if (!matchForm.roundId || !matchForm.date || !matchForm.time || !matchForm.homeTeam || !matchForm.awayTeam) return fail('Preencha todos os dados do jogo.');
    const existing = matchForm.id ? matches.find((match) => match.id === matchForm.id) : null;
    const payload: BolaoMatch = {
      ...(existing || {}),
      id: matchForm.id || utils.generateId(),
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
    if (!success) return fail('Nao foi possivel salvar o jogo.');
    setMatchForm(emptyMatchForm(matchForm.roundId));
    notify('Jogo salvo com sucesso.');
    await refresh();
  }

  async function handleDeleteMatch(matchId: string) {
    if (!window.confirm('Excluir este jogo?')) return;
    const success = await storage.deleteMatch(matchId);
    if (!success) return fail('Nao foi possivel excluir o jogo.');
    notify('Jogo excluido.');
    await refresh();
  }

  async function setRoundBonus(roundId: string, matchId: string | null) {
    let success = true;
    for (const match of matches.filter((item) => item.roundId === roundId)) {
      const nextIsBonus = Boolean(matchId && match.id === matchId);
      if (Boolean(match.isBonus) !== nextIsBonus) success = (await storage.updateMatch({ ...match, isBonus: nextIsBonus })) && success;
    }
    if (!success) return fail('Nao foi possivel atualizar o jogo bonus.');
    notify(matchId ? 'Jogo bonus atualizado.' : 'Bonus removido.');
    await refresh();
  }

  async function randomBonus() {
    if (!filterRoundId || filterRoundId === 'all') return fail('Selecione uma rodada para sortear o bonus.');
    const roundMatches = matches.filter((match) => match.roundId === filterRoundId);
    if (!roundMatches.length) return fail('Esta rodada nao possui jogos.');
    const selected = roundMatches[Math.floor(Math.random() * roundMatches.length)];
    await setRoundBonus(filterRoundId, selected.id);
  }

  async function saveScore(match: BolaoMatch, home: string, away: string) {
    const homeScore = Number(home);
    const awayScore = Number(away);
    if (!Number.isInteger(homeScore) || homeScore < 0 || !Number.isInteger(awayScore) || awayScore < 0) return fail('Informe um placar valido.');
    const success = await storage.updateMatch({ ...match, score: { home: homeScore, away: awayScore }, result: resultFromScore(homeScore, awayScore) });
    if (!success) return fail('Nao foi possivel salvar o placar.');
    notify('Placar salvo.');
    await refresh();
  }

  async function clearScore(match: BolaoMatch) {
    const success = await storage.updateMatch({ ...match, score: null, result: null });
    if (!success) return fail('Nao foi possivel limpar o placar.');
    notify('Placar limpo.');
    await refresh();
  }

  async function saveScoring() {
    const success = await storage.updateScoringSettings(scoring);
    if (!success) return fail('Nao foi possivel salvar a pontuacao.');
    setScoringDraft(null);
    notify('Pontuacao salva.');
    await refresh();
  }

  async function handleSaveStanding(event: FormEvent) {
    event.preventDefault();
    const payload = { ...standingForm, id: standingForm.id || utils.generateId(), goalDiff: getGoalDiff(standingForm.goalsFor, standingForm.goalsAgainst) };
    const existing = standings.some((item) => item.id === payload.id);
    const success = existing ? await storage.updateStanding(payload) : await storage.addStanding(payload);
    if (!success) return fail('Nao foi possivel salvar a classificacao.');
    setStandingForm(emptyStandingForm());
    notify('Classificacao salva.');
    await refresh();
  }

  async function deleteStanding(id: string) {
    if (!window.confirm('Excluir esta linha da classificacao?')) return;
    const success = await storage.deleteStanding(id);
    if (!success) return fail('Nao foi possivel excluir a linha.');
    notify('Linha excluida.');
    await refresh();
  }

  function previewCsv() {
    try {
      setCsvPreview(parseStandingsCsv(csvText));
      notify('CSV validado. Confira a previa antes de salvar.');
    } catch (err) {
      setCsvPreview([]);
      fail(err instanceof Error ? err.message : 'CSV invalido.');
    }
  }

  async function saveCsv() {
    if (!csvPreview.length) return fail('Pre-visualize um CSV valido antes de salvar.');
    if (!window.confirm('Salvar esta classificacao em lote? Times fora do CSV serao removidos.')) return;
    const existingByTeam = new Map(standings.map((item) => [item.team.toLocaleLowerCase('pt-BR'), item]));
    const csvTeams = new Set(csvPreview.map((item) => item.team.toLocaleLowerCase('pt-BR')));
    let success = true;
    for (const row of csvPreview) {
      const existing = existingByTeam.get(row.team.toLocaleLowerCase('pt-BR'));
      const payload = { id: existing?.id || utils.generateId(), ...row };
      success = (existing ? await storage.updateStanding(payload) : await storage.addStanding(payload)) && success;
    }
    for (const standing of standings) {
      if (!csvTeams.has(standing.team.toLocaleLowerCase('pt-BR'))) success = (await storage.deleteStanding(standing.id)) && success;
    }
    if (!success) return fail('A classificacao foi parcialmente atualizada. Confira os dados.');
    setCsvPreview([]);
    notify('Classificacao atualizada em lote.');
    await refresh();
  }

  async function saveCoinSettings() {
    await coinSettings.save(coins);
    setCoinDraft(null);
    notify('Configuracoes WDD Coins salvas.');
  }

  async function processRoundRewards() {
    if (!selectedRewardRoundId) return fail('Selecione uma rodada finalizada.');
    setProcessing(true);
    try {
      if (typeof supabaseClient === 'undefined') throw new Error('Supabase nao inicializado.');
      const { data: rewards, error: rpcError } = await supabaseClient.rpc('process_round_coin_rewards', { p_round_id: selectedRewardRoundId, p_season_key: coins.seasonKey });
      if (rpcError) throw rpcError;
      const total = (rewards || []).reduce((sum, row) => sum + Number(row.reward_amount || 0), 0);
      notify(`Rodada processada: ${(rewards || []).length} lancamentos e ${total} WDD Coins creditadas.`);
      await refresh();
    } catch (err) {
      fail(getErrorMessage(err, 'Nao foi possivel processar a rodada.'));
    } finally {
      setProcessing(false);
    }
  }

  function exportBackup() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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
        <div><span className="eyebrow">Administracao</span><h1>Painel admin</h1><p>Controle jogos, placares, pontuacao, classificacao e WDD Coins no novo modelo React.</p></div>
        <div className="hero-actions"><button type="button" onClick={refresh} disabled={bolaoData.loading}>Atualizar</button><button type="button" onClick={exportBackup}>Exportar JSON</button></div>
      </div>

      <nav className="admin-tabs">
        {([['jogos', 'Jogos'], ['pontuacao', 'Pontuacao'], ['classificacao', 'Classificacao'], ['coins', 'WDD Coins']] as Array<[AdminTab, string]>).map(([id, label]) => (
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
            <header><div><h2>{matchForm.id ? 'Editar jogo' : 'Novo jogo'}</h2><p>Times, data, horario e rodada.</p></div></header>
            <form className="admin-fields-grid admin-fields-grid--match" onSubmit={handleSaveMatch}>
              <label className="admin-field"><span>Rodada</span><select value={matchForm.roundId} onChange={(event) => setMatchForm({ ...matchForm, roundId: event.target.value })} required><option value="">Selecione</option>{rounds.map((round) => <option key={round.id} value={round.id}>{round.name}</option>)}</select></label>
              <label className="admin-field"><span>Data</span><input type="date" value={matchForm.date} onChange={(event) => setMatchForm({ ...matchForm, date: event.target.value })} required /></label>
              <label className="admin-field"><span>Horario</span><input type="time" value={matchForm.time} onChange={(event) => setMatchForm({ ...matchForm, time: event.target.value })} required /></label>
              <label className="admin-field"><span>Time casa</span><input value={matchForm.homeTeam} onChange={(event) => setMatchForm({ ...matchForm, homeTeam: event.target.value })} required /></label>
              <label className="admin-field"><span>Time visitante</span><input value={matchForm.awayTeam} onChange={(event) => setMatchForm({ ...matchForm, awayTeam: event.target.value })} required /></label>
              <div className="admin-panel__actions"><button type="submit">{matchForm.id ? 'Salvar alteracoes' : 'Cadastrar jogo'}</button>{matchForm.id ? <button type="button" onClick={() => setMatchForm(emptyMatchForm(matchForm.roundId))}>Cancelar</button> : null}</div>
            </form>
          </section>

          <section className="admin-panel admin-panel--wide">
            <header><div><h2>Jogos cadastrados</h2><p>Edite placares, bonus e dados dos jogos.</p></div><div className="admin-panel__actions"><select value={filterRoundId} onChange={(event) => setFilterRoundId(event.target.value)}><option value="all">Todas as rodadas</option>{rounds.map((round) => <option key={round.id} value={round.id}>{round.name}</option>)}</select><button type="button" onClick={randomBonus}>Sortear bonus</button></div></header>
            <div className="admin-match-list">{selectedRoundMatches.length === 0 ? <div className="empty-row">Nenhum jogo cadastrado.</div> : selectedRoundMatches.map((match) => {
              const round = rounds.find((item) => item.id === match.roundId);
              return <AdminMatchRow key={match.id} match={match} roundName={round?.name || 'Rodada'} onEdit={() => setMatchForm({ id: match.id, roundId: match.roundId, date: match.date, time: match.time, homeTeam: match.homeTeam, awayTeam: match.awayTeam })} onDelete={() => handleDeleteMatch(match.id)} onScore={saveScore} onClear={clearScore} onBonus={() => setRoundBonus(match.roundId, match.isBonus ? null : match.id)} />;
            })}</div>
          </section>
        </div>
      ) : null}

      {activeTab === 'pontuacao' ? <ScoringAdmin scoring={scoring} onChange={setScoringDraft} onSave={saveScoring} /> : null}
      {activeTab === 'classificacao' ? <StandingsAdmin standingForm={standingForm} setStandingForm={setStandingForm} onSave={handleSaveStanding} csvText={csvText} setCsvText={setCsvText} csvPreview={csvPreview} previewCsv={previewCsv} saveCsv={saveCsv} standings={standings} deleteStanding={deleteStanding} /> : null}
      {activeTab === 'coins' ? <CoinsAdmin coins={coins} setCoinDraft={setCoinDraft} saveCoinSettings={saveCoinSettings} saving={coinSettings.saving} finishedRounds={finishedRounds} selectedRewardRoundId={selectedRewardRoundId} setSelectedRewardRoundId={setSelectedRewardRoundId} processRoundRewards={processRoundRewards} processing={processing} /> : null}
    </section>
  );
}

function NumberField({ label, value, onChange, help, min = 0, step = '1' }: { label: string; value: number; onChange(value: number): void; help?: string; min?: number; step?: string }) {
  return <label className="admin-field"><span>{label}</span><input type="number" min={min} step={step} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Math.max(min, Number(event.target.value) || 0))} />{help ? <small>{help}</small> : null}</label>;
}

function AdminMatchRow({ match, roundName, onEdit, onDelete, onScore, onClear, onBonus }: { match: BolaoMatch; roundName: string; onEdit(): void; onDelete(): void; onScore(match: BolaoMatch, home: string, away: string): void; onClear(match: BolaoMatch): void; onBonus(): void }) {
  const [home, setHome] = useState(match.score?.home?.toString() || '');
  const [away, setAway] = useState(match.score?.away?.toString() || '');
  return <article className={`admin-match-row ${match.isBonus ? 'is-bonus' : ''}`}><div><strong>{match.homeTeam} x {match.awayTeam}</strong><span>{roundName} | {match.date} {match.time}</span></div><div className="score-editor"><input value={home} onChange={(event) => setHome(event.target.value)} type="number" min="0" /><span>x</span><input value={away} onChange={(event) => setAway(event.target.value)} type="number" min="0" /></div><div className="admin-row-actions"><button type="button" onClick={() => onScore(match, home, away)}>Salvar placar</button><button type="button" onClick={() => onClear(match)}>Limpar</button><button type="button" onClick={onBonus}>{match.isBonus ? 'Remover bonus' : 'Marcar bonus'}</button><button type="button" onClick={onEdit}>Editar</button><button type="button" onClick={onDelete}>Excluir</button></div></article>;
}

function ScoringAdmin({ scoring, onChange, onSave }: { scoring: BolaoScoringSettings; onChange(value: BolaoScoringSettings): void; onSave(): void }) {
  return <section className="admin-panel"><header><div><h2>Pontuacao do bolao</h2><p>Valores usados no ranking de pontos.</p></div><div className="admin-panel__actions"><button type="button" onClick={onSave}>Salvar pontuacao</button></div></header><div className="admin-fields-grid"><NumberField label="Placar exato" value={scoring.exactScorePoints} onChange={(value) => onChange({ ...scoring, exactScorePoints: value })} step="0.01" /><NumberField label="Na trave" value={scoring.nearMissPoints} onChange={(value) => onChange({ ...scoring, nearMissPoints: value })} step="0.01" /><NumberField label="Erro" value={scoring.wrongPoints} onChange={(value) => onChange({ ...scoring, wrongPoints: value })} step="0.01" /><NumberField label="Multiplicador bonus" value={scoring.bonusMultiplier} onChange={(value) => onChange({ ...scoring, bonusMultiplier: value })} min={1} step="0.1" /><label className="admin-field"><span>Jogo bonus</span><select value={scoring.bonusEnabled ? 'on' : 'off'} onChange={(event) => onChange({ ...scoring, bonusEnabled: event.target.value === 'on' })}><option value="on">Ativo</option><option value="off">Inativo</option></select><small>Controla multiplicador de pontos no ranking.</small></label></div></section>;
}

function StandingsAdmin({ standingForm, setStandingForm, onSave, csvText, setCsvText, csvPreview, previewCsv, saveCsv, standings, deleteStanding }: { standingForm: BolaoStanding; setStandingForm(value: BolaoStanding): void; onSave(event: FormEvent): void; csvText: string; setCsvText(value: string): void; csvPreview: Omit<BolaoStanding, 'id'>[]; previewCsv(): void; saveCsv(): void; standings: BolaoStanding[]; deleteStanding(id: string): void }) {
  return <div className="page-stack"><section className="admin-panel"><header><div><h2>{standingForm.id ? 'Editar classificacao' : 'Nova linha da classificacao'}</h2><p>Atualizacao individual da tabela.</p></div></header><form className="admin-fields-grid" onSubmit={onSave}><NumberField label="Posicao" value={standingForm.position} onChange={(value) => setStandingForm({ ...standingForm, position: value })} min={1} /><label className="admin-field"><span>Time</span><input value={standingForm.team} onChange={(event) => setStandingForm({ ...standingForm, team: event.target.value })} required /></label><NumberField label="Pontos" value={standingForm.points} onChange={(value) => setStandingForm({ ...standingForm, points: value })} /><NumberField label="Jogos" value={standingForm.played} onChange={(value) => setStandingForm({ ...standingForm, played: value })} /><NumberField label="Vitorias" value={standingForm.wins} onChange={(value) => setStandingForm({ ...standingForm, wins: value })} /><NumberField label="Empates" value={standingForm.draws} onChange={(value) => setStandingForm({ ...standingForm, draws: value })} /><NumberField label="Derrotas" value={standingForm.losses} onChange={(value) => setStandingForm({ ...standingForm, losses: value })} /><NumberField label="GP" value={standingForm.goalsFor} onChange={(value) => setStandingForm({ ...standingForm, goalsFor: value, goalDiff: getGoalDiff(value, standingForm.goalsAgainst) })} /><NumberField label="GC" value={standingForm.goalsAgainst} onChange={(value) => setStandingForm({ ...standingForm, goalsAgainst: value, goalDiff: getGoalDiff(standingForm.goalsFor, value) })} /><label className="admin-field"><span>SG</span><input value={getGoalDiff(standingForm.goalsFor, standingForm.goalsAgainst)} readOnly /></label><div className="admin-panel__actions"><button type="submit">Salvar classificacao</button>{standingForm.id ? <button type="button" onClick={() => setStandingForm(emptyStandingForm())}>Cancelar</button> : null}</div></form></section><section className="admin-panel"><header><div><h2>Atualizacao via CSV</h2><p>Cole a classificacao completa e salve em lote.</p></div><div className="admin-panel__actions"><button type="button" onClick={() => setCsvText(csvSample)}>Usar modelo</button></div></header><div className="csv-editor"><textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder="position;team;points;played;wins;draws;losses;goals_for;goals_against;goal_diff" /><div className="admin-panel__actions"><button type="button" onClick={previewCsv}>Pre-visualizar CSV</button><button type="button" onClick={saveCsv} disabled={!csvPreview.length}>Salvar classificacao em lote</button></div></div>{csvPreview.length ? <StandingsTable standings={csvPreview.map((row) => ({ id: row.team, ...row }))} emptyText="Sem previa." /> : null}</section><section className="table-card"><header><h2>Classificacao atual</h2></header><StandingsLegend /><StandingsTable standings={standings} /><div className="admin-list">{[...standings].sort((a, b) => a.position - b.position).map((standing) => <div key={standing.id} className="admin-list-row"><strong>{standing.position}. {standing.team}</strong><span>{standing.points} pts</span><button type="button" onClick={() => setStandingForm(standing)}>Editar</button><button type="button" onClick={() => deleteStanding(standing.id)}>Excluir</button></div>)}</div></section></div>;
}

function CoinsAdmin({ coins, setCoinDraft, saveCoinSettings, saving, finishedRounds, selectedRewardRoundId, setSelectedRewardRoundId, processRoundRewards, processing }: { coins: CoinSettings; setCoinDraft(value: CoinSettings): void; saveCoinSettings(): void; saving: boolean; finishedRounds: BolaoRound[]; selectedRewardRoundId: string; setSelectedRewardRoundId(value: string): void; processRoundRewards(): void; processing: boolean }) {
  return <div className="page-stack"><section className="admin-panel"><header><div><h2>Temporada {coins.seasonKey}</h2><p>Valores em WDD Coins para processamentos futuros.</p></div><div className="admin-panel__actions"><button type="button" onClick={saveCoinSettings} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></div></header><div className="admin-fields-grid">{coinFields.map((field) => <NumberField key={field.key} label={field.label} value={coins[field.key]} onChange={(value) => setCoinDraft({ ...coins, [field.key]: value })} help={field.help} />)}</div></section><section className="admin-panel"><header><div><h2>Processar rodada</h2><p>Credita moedas por placares, bonus, ranking e participacao completa.</p></div><div className="admin-panel__actions"><button type="button" onClick={processRoundRewards} disabled={processing || !selectedRewardRoundId}>{processing ? 'Processando...' : 'Processar recompensas'}</button></div></header><div className="admin-fields-grid admin-fields-grid--compact"><label className="admin-field admin-field--wide"><span>Rodada finalizada</span><select value={selectedRewardRoundId} onChange={(event) => setSelectedRewardRoundId(event.target.value)}><option value="">Selecione</option>{finishedRounds.map((round) => <option key={round.id} value={round.id}>{round.name}</option>)}</select><small>Somente rodadas com todos os jogos finalizados aparecem aqui.</small></label></div></section></div>;
}
