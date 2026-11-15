import { useMemo, useState } from 'react';
import { DetailsModal } from '../components/DetailsModal';
import { EmptyState } from '../components/EmptyState';
import { RaceChart } from '../components/RaceChart';
import { RankingStats } from '../components/RankingPanel';
import { useBolaoData } from '../hooks/useBolaoData';
import { useRanking } from '../hooks/useRanking';
import { useRankingHistory } from '../hooks/useRankingHistory';
import { getLegacy, getRoundNumber } from '../services/legacyBolao';

interface RankingPageProps {
  currentUser: BolaoUser;
}

function Movement({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="move move--none" aria-label="Sem histórico">–</span>;
  if (delta > 0) return <span className="move move--up" title={`Subiu ${delta}`}><i className="bi bi-caret-up-fill" aria-hidden="true" />{delta}<span className="sr-only"> posições acima</span></span>;
  if (delta < 0) return <span className="move move--down" title={`Caiu ${-delta}`}><i className="bi bi-caret-down-fill" aria-hidden="true" />{-delta}<span className="sr-only"> posições abaixo</span></span>;
  return <span className="move move--same" title="Manteve a posição"><i className="bi bi-dash" aria-hidden="true" /><span className="sr-only">Manteve</span></span>;
}

export function RankingPage({ currentUser }: RankingPageProps) {
  const { data, loading, error, lastLoadedAt, refresh } = useBolaoData();
  const [scope, setScope] = useState('season');
  const [detailsUser, setDetailsUser] = useState<RankingItem | null>(null);
  const formatPoints = getLegacy().Ranking.formatPoints;

  const rounds = useMemo(
    () => [...(data?.rounds || [])].sort((a, b) => getRoundNumber(a) - getRoundNumber(b)),
    [data?.rounds]
  );
  const roundId = scope === 'season' ? null : scope;
  const { ranking, error: rankingError } = useRanking(roundId, data?.version);
  const history = useRankingHistory(data?.version);

  // Movimento e ultimas 5 rodadas (so no ranking da temporada)
  const playedRounds = useMemo(() => [...new Set(history.map((row) => row.roundNumber))].sort((a, b) => a - b), [history]);
  const lastRound = playedRounds[playedRounds.length - 1];
  const previousRound = playedRounds[playedRounds.length - 2];
  const recentRounds = playedRounds.slice(-5);
  const participantsInRound = (roundNumber: number) => history.filter((row) => row.roundNumber === roundNumber).length;

  function getDelta(userId: string): number | null {
    if (previousRound === undefined) return null;
    const before = history.find((row) => row.userId === userId && row.roundNumber === previousRound);
    const after = history.find((row) => row.userId === userId && row.roundNumber === lastRound);
    return before && after ? before.position - after.position : null;
  }

  const podium = scope === 'season' ? ranking.filter((item) => item.points > 0).slice(0, 3) : [];
  const selectedRound = rounds.find((round) => round.id === roundId);

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">{data?.season?.name || 'Temporada'}</span>
          <h1>Ranking</h1>
          <p>{scope === 'season' ? 'Classificação geral do bolão na temporada.' : `Pontuação da ${selectedRound?.name || 'rodada'}.`}</p>
        </div>
        <div className="page-header__actions">
          <select value={scope} onChange={(event) => setScope(event.target.value)} aria-label="Escolher ranking">
            <option value="season">Temporada</option>
            {rounds.map((round) => <option key={round.id} value={round.id}>{round.name}</option>)}
          </select>
          <button type="button" className="ghost-button" onClick={refresh} disabled={loading}>
            <i className="bi bi-arrow-clockwise" aria-hidden="true" /> Atualizar
          </button>
          {lastLoadedAt ? <span className="muted-text">às {lastLoadedAt}</span> : null}
        </div>
      </header>

      {error || rankingError ? <div className="banner banner--error">{error || rankingError}</div> : null}
      {loading && !data ? <EmptyState>Carregando ranking…</EmptyState> : null}

      {podium.length ? (
        <div className={`podium podium--count-${podium.length}`}>
          {podium.map((item) => (
            <button type="button" key={item.id} className={`podium__card podium__card--${item.position}`} onClick={() => setDetailsUser(item)}>
              <span className="podium__pos">{item.position}º</span>
              <strong className="podium__name">{item.name}</strong>
              <span className="podium__points">{formatPoints(item.points)} <small>pts</small></span>
              <RankingStats item={item} />
            </button>
          ))}
        </div>
      ) : null}

      <section className="panel">
        <div className="table-wrap">
          <table className="data-table ranking-table">
            <thead>
              <tr>
                <th scope="col" className="num">#</th>
                {scope === 'season' ? <th scope="col" className="num"><span className="sr-only">Movimento</span></th> : null}
                <th scope="col">Participante</th>
                <th scope="col" className="num">Pts</th>
                <th scope="col" className="num" title="Cravadas (placar exato)"><i className="bi bi-bullseye" aria-hidden="true" /><span className="th-label"> Cravadas</span></th>
                <th scope="col" className="num" title="Na trave (acertou o resultado)"><i className="bi bi-record-circle" aria-hidden="true" /><span className="th-label"> Na trave</span></th>
                <th scope="col" className="num" title="Acertos em jogo bônus"><i className="bi bi-star" aria-hidden="true" /><span className="th-label"> Bônus</span></th>
                <th scope="col" className="num hide-sm">Palpites</th>
                {scope === 'season' && recentRounds.length ? <th scope="col" className="hide-sm">Últimas rodadas</th> : null}
              </tr>
            </thead>
            <tbody>
              {ranking.length === 0 ? (
                <tr><td colSpan={9} className="table-empty">Sem pontuação ainda.</td></tr>
              ) : ranking.map((item, index) => {
                const position = item.position ?? index + 1;
                return (
                  <tr key={item.id} className={`${position === 1 ? 'is-leader' : ''}${item.id === currentUser.id ? ' is-me' : ''}`}>
                    <td className="num"><span className={`pos-badge${position === 1 ? ' pos-badge--leader' : ''}`}>{position}</span></td>
                    {scope === 'season' ? <td className="num"><Movement delta={getDelta(item.id)} /></td> : null}
                    <td>
                      <button type="button" className="link-button" onClick={() => setDetailsUser(item)}>{item.name}</button>
                    </td>
                    <td className="num strong">{formatPoints(item.points)}</td>
                    <td className="num">{item.exactHits}</td>
                    <td className="num">{item.nearMisses}</td>
                    <td className="num">{item.bonusHits}</td>
                    <td className="num hide-sm">{item.betsCount}</td>
                    {scope === 'season' && recentRounds.length ? (
                      <td className="hide-sm">
                        <span className="form-strip">
                          {recentRounds.map((roundNumber) => {
                            const row = history.find((entry) => entry.userId === item.id && entry.roundNumber === roundNumber);
                            if (!row) return <span key={roundNumber} className="form-chip">–</span>;
                            const isLast = row.roundPosition === participantsInRound(roundNumber) && row.roundPosition > 1;
                            const tone = row.roundPosition === 1 && row.roundPoints > 0 ? 'best' : isLast ? 'worst' : 'mid';
                            return (
                              <span key={roundNumber} className={`form-chip form-chip--${tone}`} title={`${row.roundName}: ${formatPoints(row.roundPoints)} pts (${row.roundPosition}º)`}>
                                {formatPoints(row.roundPoints)}
                              </span>
                            );
                          })}
                        </span>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="table-note">
          Desempate: pontos, cravadas, na trave e jogos apostados. Persistindo o empate, a posição é dividida.
        </p>
      </section>

      {scope === 'season' ? (
        <section className="panel">
          <header className="panel__header"><h2>Corrida pelo título</h2><span className="muted-text">Pontos acumulados por rodada</span></header>
          <RaceChart history={history} />
        </section>
      ) : null}

      <DetailsModal user={detailsUser} data={data} roundId={roundId} onClose={() => setDetailsUser(null)} />
    </section>
  );
}
