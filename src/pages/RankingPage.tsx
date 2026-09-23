import { useMemo, useState } from 'react';
import { DetailsModal } from '../components/DetailsModal';
import { EmptyState } from '../components/EmptyState';
import { useBolaoData } from '../hooks/useBolaoData';
import { getLatestRoundId, getLegacy, getRoundNumber } from '../services/legacyBolao';

export function RankingPage() {
  const { data, loading, error, lastLoadedAt, refresh } = useBolaoData();
  const [selectedRoundId, setSelectedRoundId] = useState('all');
  const [detailsUser, setDetailsUser] = useState<RankingItem | null>(null);

  const rounds = useMemo(
    () => [...(data?.rounds || [])].sort((a, b) => getRoundNumber(a) - getRoundNumber(b)),
    [data?.rounds]
  );

  const defaultRound = data?.rounds?.length ? getLatestRoundId(data.rounds) : 'all';
  const roundForRanking = selectedRoundId === 'latest' ? defaultRound : selectedRoundId;
  const ranking = useMemo(
    () => data ? (
      roundForRanking === 'all'
        ? getLegacy().Ranking.calculate(data)
        : getLegacy().Ranking.calculateByRound(data, roundForRanking)
    ) : [],
    [data, roundForRanking]
  );

  return (
    <section className="page-stack">
      <div className="section-hero">
        <div>
          <span className="eyebrow">Ranking</span>
          <h1>Disputa do bolao</h1>
          <p>Acompanhe pontuacao geral, rodada, cravadas, trave e bonus.</p>
        </div>
        <div className="hero-actions">
          <button type="button" onClick={refresh} disabled={loading}>Atualizar</button>
          {lastLoadedAt ? <span>Atualizado {lastLoadedAt}</span> : null}
        </div>
      </div>

      <section className="filters-card">
        <select value={selectedRoundId} onChange={(event) => setSelectedRoundId(event.target.value)}>
          <option value="all">Ranking geral</option>
          <option value="latest">Ultima rodada</option>
          {rounds.map((round) => <option key={round.id} value={round.id}>{round.name}</option>)}
        </select>
      </section>

      {error ? <div className="error-banner">{error}</div> : null}
      {loading && !data ? <EmptyState>Carregando ranking...</EmptyState> : null}

      <div className="data-table-wrap">
        <table className="data-table ranking-table-full">
          <thead>
            <tr>
              <th>#</th>
              <th>Participante</th>
              <th>PTS</th>
              <th>PE</th>
              <th>NT</th>
              <th>B</th>
              <th>Palpites</th>
            </tr>
          </thead>
          <tbody>
            {ranking.length === 0 ? (
              <tr><td colSpan={7} className="table-empty">Sem dados.</td></tr>
            ) : ranking.map((user, index) => (
              <tr key={user.id} className={index === 0 ? 'is-leader-row' : ''}>
                <td>{index + 1}</td>
                <td>
                  <button type="button" className="link-button" onClick={() => setDetailsUser(user)}>
                    {user.name}
                  </button>
                </td>
                <td>{getLegacy().Ranking.formatPoints(user.points)}</td>
                <td>{user.exactHits}</td>
                <td>{user.nearMisses}</td>
                <td>{user.bonusHits}</td>
                <td>{user.betsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DetailsModal user={detailsUser} onClose={() => setDetailsUser(null)} />
    </section>
  );
}
