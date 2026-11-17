import { useEffect, useMemo, useState } from 'react';
import type { AppRoute } from '../app/routes';
import { DetailsModal } from '../components/DetailsModal';
import { EmptyState } from '../components/EmptyState';
import { MatchRow, type BetDraft } from '../components/MatchRow';
import { RankingPanel } from '../components/RankingPanel';
import { useBolaoData } from '../hooks/useBolaoData';
import { useRanking } from '../hooks/useRanking';
import { getCurrentRoundId, getRoundNumber, isPostponedMatch } from '../services/matches';
import { formatCountdown, formatDayLabel, formatShortDate, getKickoff, getMatchStatus, useNow } from '../services/matchTime';
import { calculateMatchPoints, formatPoints, getScoringSettings } from '../services/scoring';
import * as storage from '../services/storage';
import { setUnsavedCount, unsavedMessage } from '../services/unsavedChanges';

interface DashboardPageProps {
  currentUser: BolaoUser;
  onNavigate(route: AppRoute): void;
}

function sortByKickoff(a: BolaoMatch, b: BolaoMatch) {
  return `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
}

function draftFromBet(bet: BolaoBet | null | undefined): BetDraft {
  return {
    home: bet?.scoreHome !== null && bet?.scoreHome !== undefined ? String(bet.scoreHome) : '',
    away: bet?.scoreAway !== null && bet?.scoreAway !== undefined ? String(bet.scoreAway) : ''
  };
}

export function DashboardPage({ currentUser, onNavigate }: DashboardPageProps) {
  const { data, loading, error, lastLoadedAt, refresh, reload } = useBolaoData();
  const now = useNow(30000);
  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [drafts, setDrafts] = useState<Record<string, BetDraft>>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [detailsUser, setDetailsUser] = useState<RankingItem | null>(null);

  const rounds = useMemo(
    () => [...(data?.rounds || [])].sort((a, b) => getRoundNumber(a) - getRoundNumber(b)),
    [data?.rounds]
  );
  const matches = data?.matches || [];

  useEffect(() => {
    if (!data) return;
    if (!selectedRoundId || !rounds.some((round) => round.id === selectedRoundId)) {
      setSelectedRoundId(getCurrentRoundId(rounds, data.matches));
    }
  }, [data, rounds, selectedRoundId]);

  const roundIndex = rounds.findIndex((round) => round.id === selectedRoundId);
  const round = roundIndex >= 0 ? rounds[roundIndex] : null;
  const roundMatches = useMemo(
    () => matches.filter((match) => match.roundId === selectedRoundId).sort(sortByKickoff),
    [matches, selectedRoundId]
  );
  const teams = useMemo(() => {
    const names = new Set<string>();
    roundMatches.forEach((match) => { names.add(match.homeTeam); names.add(match.awayTeam); });
    return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [roundMatches]);
  const visibleMatches = selectedTeam === 'all'
    ? roundMatches
    : roundMatches.filter((match) => match.homeTeam === selectedTeam || match.awayTeam === selectedTeam);

  const myBets = data?.bets?.[currentUser.id] || {};
  const settings = getScoringSettings(data);
  const bonusMultiplier = Number(settings.bonusMultiplier || 2);

  // Resumo da rodada
  const finishedCount = roundMatches.filter((match) => match.result).length;
  const betCount = roundMatches.filter((match) => myBets[match.id]?.scoreHome !== null && myBets[match.id]?.scoreHome !== undefined).length;
  const openWithoutBet = roundMatches.filter((match) => {
    const status = getMatchStatus(match, now);
    return (status === 'open' || status === 'closing') && !(myBets[match.id] && myBets[match.id].scoreHome !== null);
  }).length;
  const nextKickoff = roundMatches
    .filter((match) => !match.result)
    .map((match) => getKickoff(match).getTime())
    .filter((time) => time > now)
    .sort((a, b) => a - b)[0];
  // Jogos adiados (marcados bem depois da rodada) nao esticam o periodo do cabecalho.
  const postponedIds = useMemo(
    () => new Set(roundMatches.filter((match) => isPostponedMatch(match, roundMatches)).map((match) => match.id)),
    [roundMatches]
  );
  const regularMatches = roundMatches.filter((match) => !postponedIds.has(match.id));
  const firstDate = regularMatches[0]?.date;
  const lastDate = regularMatches[regularMatches.length - 1]?.date;

  // Rascunhos de palpite
  function getDraft(match: BolaoMatch): BetDraft {
    return drafts[match.id] || draftFromBet(myBets[match.id]);
  }

  function isDirty(match: BolaoMatch): boolean {
    const draft = drafts[match.id];
    if (!draft) return false;
    const saved = draftFromBet(myBets[match.id]);
    return draft.home !== '' && draft.away !== '' && (draft.home !== saved.home || draft.away !== saved.away);
  }

  // Todas as rodadas: trocar de rodada nao pode esconder palpite digitado.
  const dirtyMatches = matches.filter((match) => {
    const status = getMatchStatus(match, now);
    return (status === 'open' || status === 'closing') && isDirty(match);
  });
  const incompleteDrafts = roundMatches.filter((match) => {
    const draft = drafts[match.id];
    return draft && (draft.home === '') !== (draft.away === '');
  }).length;
  const dirtyElsewhere = dirtyMatches.filter((match) => match.roundId !== selectedRoundId).length;
  const unsaved = dirtyMatches.length;

  useEffect(() => {
    setUnsavedCount(unsaved);
    if (!unsaved) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = unsavedMessage(unsaved);
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  useEffect(() => () => setUnsavedCount(0), []);

  async function saveAll() {
    if (!dirtyMatches.length) return;
    setSaving(true);
    setFeedback(null);
    try {
      const result = await storage.saveBets(currentUser.id, dirtyMatches.map((match) => {
        const draft = getDraft(match);
        return { matchId: match.id, scoreHome: Number(draft.home), scoreAway: Number(draft.away) };
      }));

      setDrafts((current) => {
        const next = { ...current };
        result.saved.forEach((matchId) => delete next[matchId]);
        return next;
      });
      await reload();

      if (result.failed.length) {
        const names = matches
          .filter((match) => result.failed.includes(match.id))
          .map((match) => `${match.homeTeam} x ${match.awayTeam}`)
          .join(', ');
        setFeedback({ tone: 'error', text: `Não foi possível salvar: ${names}. O jogo pode ter começado.` });
      } else {
        setFeedback({ tone: 'ok', text: result.saved.length === 1 ? 'Palpite salvo.' : `${result.saved.length} palpites salvos.` });
      }
    } catch (err) {
      console.error('Erro ao salvar palpites:', err);
      setFeedback({ tone: 'error', text: 'Erro ao salvar. Verifique a conexão e tente de novo.' });
    } finally {
      setSaving(false);
    }
  }

  function goToRound(offset: number) {
    const target = rounds[roundIndex + offset];
    if (target) {
      setSelectedRoundId(target.id);
      setSelectedTeam('all');
      setFeedback(null);
    }
  }

  const { ranking: generalRanking, loading: generalLoading } = useRanking(null, data?.version);
  const { ranking: roundRanking, loading: roundLoading } = useRanking(selectedRoundId || null, data?.version);
  const roundLeaders = roundRanking.filter((item) => item.position === 1 && item.points > 0);

  // Agrupa por dia
  const days = useMemo(() => {
    const groups: Array<{ date: string; matches: BolaoMatch[] }> = [];
    visibleMatches.forEach((match) => {
      const last = groups[groups.length - 1];
      if (last && last.date === match.date) last.matches.push(match);
      else groups.push({ date: match.date, matches: [match] });
    });
    return groups;
  }, [visibleMatches]);

  return (
    <>
      <section className="round-header">
        <div className="round-stepper">
          <button type="button" className="icon-button" onClick={() => goToRound(-1)} disabled={roundIndex <= 0} aria-label="Rodada anterior">
            <i className="bi bi-chevron-left" aria-hidden="true" />
          </button>
          <div className="round-stepper__title">
            <span className="eyebrow">{data?.season?.name || 'Temporada'}</span>
            <h1>{round?.name || 'Sem rodadas'}</h1>
            {firstDate ? (
              <span className="round-stepper__dates">
                {formatShortDate(firstDate)}{lastDate && lastDate !== firstDate ? ` a ${formatShortDate(lastDate)}` : ''} · {roundMatches.length} {roundMatches.length === 1 ? 'jogo' : 'jogos'}
              </span>
            ) : null}
          </div>
          <button type="button" className="icon-button" onClick={() => goToRound(1)} disabled={roundIndex < 0 || roundIndex >= rounds.length - 1} aria-label="Próxima rodada">
            <i className="bi bi-chevron-right" aria-hidden="true" />
          </button>
        </div>

        <div className="round-stats">
          <div className="round-progress" aria-label={`${finishedCount} de ${roundMatches.length} jogos encerrados`}>
            <div className="progress"><span style={{ width: `${roundMatches.length ? (finishedCount / roundMatches.length) * 100 : 0}%` }} /></div>
            <span>{finishedCount}/{roundMatches.length} encerrados</span>
          </div>
          <span className={`stat-pill ${openWithoutBet ? 'stat-pill--warn' : 'stat-pill--ok'}`}>
            <i className={`bi ${openWithoutBet ? 'bi-exclamation-triangle' : 'bi-check2-circle'}`} aria-hidden="true" />
            Seus palpites {betCount}/{roundMatches.length}{openWithoutBet ? ` · faltam ${openWithoutBet}` : ''}
          </span>
          {nextKickoff ? (
            <span className="stat-pill">
              <i className="bi bi-clock" aria-hidden="true" /> Próximo jogo em {formatCountdown(nextKickoff - now)}
            </span>
          ) : null}
        </div>

        <div className="round-tools">
          <select value={selectedRoundId} onChange={(event) => { setSelectedRoundId(event.target.value); setSelectedTeam('all'); }} aria-label="Escolher rodada">
            {rounds.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={selectedTeam} onChange={(event) => setSelectedTeam(event.target.value)} aria-label="Filtrar por time">
            <option value="all">Todos os times</option>
            {teams.map((team) => <option key={team} value={team}>{team}</option>)}
          </select>
          <button type="button" className="ghost-button" onClick={refresh} disabled={loading}>
            <i className="bi bi-arrow-clockwise" aria-hidden="true" /> Atualizar
          </button>
          {lastLoadedAt ? <span className="muted-text">às {lastLoadedAt}</span> : null}
        </div>
      </section>

      {error ? <div className="banner banner--error">{error}</div> : null}

      <div className="dashboard-grid">
        <section className="matches-panel" aria-label="Jogos da rodada">
          {loading && !data ? <EmptyState>Carregando jogos…</EmptyState> : null}
          {data && !rounds.length ? <EmptyState>Nenhuma rodada cadastrada nesta temporada ainda.</EmptyState> : null}
          {data && rounds.length > 0 && visibleMatches.length === 0 ? <EmptyState>Nenhum jogo nesta rodada.</EmptyState> : null}

          {days.map((day) => (
            <div className="day-group" key={day.date}>
              <h2 className="day-label">{formatDayLabel(day.date)}</h2>
              {day.matches.map((match) => {
                const status = getMatchStatus(match, now);
                const savedBet = myBets[match.id] || null;
                const pointResult = status === 'finished' && savedBet && data
                  ? calculateMatchPoints(match, savedBet, getScoringSettings(data))
                  : null;
                return (
                  <MatchRow
                    key={match.id}
                    match={match}
                    status={status}
                    now={now}
                    savedBet={savedBet}
                    draft={getDraft(match)}
                    dirty={isDirty(match)}
                    postponed={postponedIds.has(match.id)}
                    bonusMultiplier={bonusMultiplier}
                    pointResult={pointResult}
                    onDraftChange={(next) => {
                      setFeedback(null);
                      setDrafts((current) => ({ ...current, [match.id]: next }));
                    }}
                  />
                );
              })}
            </div>
          ))}

          {feedback ? <div className={`banner banner--${feedback.tone}`} role="status">{feedback.text}</div> : null}

          {dirtyMatches.length || incompleteDrafts ? (
            <div className="save-bar">
              <span>
                {dirtyMatches.length ? `${dirtyMatches.length} ${dirtyMatches.length === 1 ? 'palpite não salvo' : 'palpites não salvos'}` : ''}
                {dirtyElsewhere ? ` (${dirtyElsewhere} em ${dirtyElsewhere === 1 ? 'outra rodada' : 'outras rodadas'})` : ''}
                {incompleteDrafts ? `${dirtyMatches.length ? ' · ' : ''}${incompleteDrafts} incompleto${incompleteDrafts > 1 ? 's' : ''}` : ''}
              </span>
              <button type="button" className="primary-button" onClick={saveAll} disabled={saving || !dirtyMatches.length}>
                {saving ? 'Salvando…' : 'Salvar palpites'}
              </button>
            </div>
          ) : null}
        </section>

        <aside className="side-stack">
          <RankingPanel
            title="Ranking da rodada"
            tone="round"
            ranking={roundRanking}
            loading={roundLoading || (loading && !data)}
            currentUserId={currentUser.id}
            summary={roundLeaders.length
              ? `${roundLeaders.length > 1 ? 'Melhores' : 'Melhor'} da rodada: ${roundLeaders.map((item) => item.name).join(', ')} (${formatPoints(roundLeaders[0].points)} pts)`
              : ''}
            onDetails={setDetailsUser}
          />
          <RankingPanel
            title="Ranking geral"
            tone="general"
            ranking={generalRanking}
            loading={generalLoading || (loading && !data)}
            currentUserId={currentUser.id}
            onDetails={setDetailsUser}
            onSeeAll={() => onNavigate('ranking')}
          />
        </aside>
      </div>

      <DetailsModal user={detailsUser} data={data} roundId={null} onClose={() => setDetailsUser(null)} />
    </>
  );
}
