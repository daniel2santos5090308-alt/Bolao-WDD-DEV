import { useEffect, useMemo, useState } from 'react';
import { DetailsModal } from '../components/DetailsModal';
import { EmptyState } from '../components/EmptyState';
import { MatchCard } from '../components/MatchCard';
import { RankingPanel } from '../components/RankingPanel';
import { useBolaoData } from '../hooks/useBolaoData';
import { getLatestRoundId, getLegacy, getRoundNumber } from '../services/legacyBolao';

interface DashboardPageProps {
  currentUser: BolaoUser;
}

export function DashboardPage({ currentUser }: DashboardPageProps) {
  const { data, setData, loading, error, lastLoadedAt, refresh } = useBolaoData();
  const [selectedRoundId, setSelectedRoundId] = useState('all');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [detailsUser, setDetailsUser] = useState<RankingItem | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 5;

  useEffect(() => {
    if (data?.rounds?.length && selectedRoundId === 'all') {
      setSelectedRoundId(getLatestRoundId(data.rounds));
    }
  }, [data?.rounds, selectedRoundId]);

  const rounds = useMemo(
    () => [...(data?.rounds || [])].sort((a, b) => getRoundNumber(a) - getRoundNumber(b)),
    [data?.rounds]
  );

  const teams = useMemo(() => {
    const names = new Set<string>();
    (data?.matches || []).forEach((match) => {
      names.add(match.homeTeam);
      names.add(match.awayTeam);
    });
    return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [data?.matches]);

  const filteredMatches = useMemo(() => {
    return [...(data?.matches || [])]
      .filter((match) => selectedRoundId === 'all' || match.roundId === selectedRoundId)
      .filter((match) => selectedTeam === 'all' || match.homeTeam === selectedTeam || match.awayTeam === selectedTeam)
      .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());
  }, [data?.matches, selectedRoundId, selectedTeam]);
  const totalPages = Math.max(1, Math.ceil(filteredMatches.length / pageSize));
  const visibleMatches = filteredMatches.slice((page - 1) * pageSize, page * pageSize);

  const generalRanking = useMemo(() => data ? getLegacy().Ranking.calculate(data) : [], [data]);
  const roundRanking = useMemo(() => data ? getLegacy().Ranking.calculateByRound(data, selectedRoundId) : [], [data, selectedRoundId]);
  const selectedRound = rounds.find((round) => round.id === selectedRoundId);

  useEffect(() => {
    setPage(1);
  }, [selectedRoundId, selectedTeam]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <>
      <section className="hero-board">
        <div>
          <span className="eyebrow">Central da temporada</span>
          <h1>{selectedRound?.name || 'Jogos e apostas'}</h1>
          <p>Base React 2027 preparada para temporadas, perfis, rankings, PWA e WDD Coins com atualizacao manual.</p>
        </div>
        <div className="hero-actions">
          <button type="button" onClick={refresh} disabled={loading}>Atualizar</button>
          {lastLoadedAt ? <span>Atualizado {lastLoadedAt}</span> : null}
        </div>
      </section>

      <section className="filters-card" aria-label="Filtros">
        <select value={selectedRoundId} onChange={(event) => setSelectedRoundId(event.target.value)}>
          <option value="all">Todas as rodadas</option>
          {rounds.map((round) => <option key={round.id} value={round.id}>{round.name}</option>)}
        </select>
        <select value={selectedTeam} onChange={(event) => setSelectedTeam(event.target.value)}>
          <option value="all">Todos os times</option>
          {teams.map((team) => <option key={team} value={team}>{team}</option>)}
        </select>
      </section>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="content-grid">
        <section className="matches-area">
          {loading && !data ? <EmptyState>Carregando jogos...</EmptyState> : null}
          {!loading && filteredMatches.length === 0 ? <EmptyState>Nenhum jogo encontrado para o filtro.</EmptyState> : null}
          {data ? visibleMatches.map((match) => {
            const round = rounds.find((item) => item.id === match.roundId);
            return (
              <MatchCard
                key={match.id}
                match={match}
                roundName={round?.name || 'Rodada'}
                currentUser={currentUser}
                data={data}
                onSaved={setData}
              />
            );
          }) : null}
          {filteredMatches.length > pageSize ? (
            <div className="pagination-bar">
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>
                Anterior
              </button>
              <span>Pagina {page} de {totalPages}</span>
              <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages}>
                Proxima
              </button>
            </div>
          ) : null}
        </section>

        <aside className="side-stack">
          <RankingPanel
            title="Ranking da Rodada"
            tone="round"
            ranking={roundRanking}
            summary={roundRanking[0] ? `Melhor: ${roundRanking[0].name} (${getLegacy().Ranking.formatPoints(roundRanking[0].points)} pts)` : ''}
            onDetails={setDetailsUser}
          />
          <RankingPanel
            title="Ranking Geral"
            tone="general"
            ranking={generalRanking}
            onDetails={setDetailsUser}
          />
        </aside>
      </div>

      <DetailsModal user={detailsUser} onClose={() => setDetailsUser(null)} />
    </>
  );
}
