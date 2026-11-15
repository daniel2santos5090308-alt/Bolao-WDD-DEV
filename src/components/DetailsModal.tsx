import { useEffect, useState } from 'react';
import { formatMatchDateTime, getLegacy, getMatchScore, isMatchFinished } from '../services/legacyBolao';

interface DetailsModalProps {
  user: RankingItem | null;
  data: BolaoData | null;
  /** Rodada do extrato; nulo = temporada inteira. */
  roundId: string | null;
  onClose(): void;
}

interface HistoryRow {
  match: BolaoMatch;
  bet: BolaoVisibleBet;
  result: MatchPointResult | null;
}

/**
 * Extrato de um participante. As apostas sao buscadas sob demanda
 * (get_season_bets), ja com a regra de ocultacao do banco: palpites dos
 * outros so aparecem depois do inicio do jogo.
 */
export function DetailsModal({ user, data, roundId, onClose }: DetailsModalProps) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !data) return;

    let cancelled = false;
    setLoading(true);
    setError('');
    setRows([]);

    const legacy = getLegacy();
    const matchesById = new Map(data.matches.map((match) => [match.id, match]));
    const settings = legacy.Ranking.getSettings(data);

    legacy.Storage.getVisibleBets({ userId: user.id, roundId })
      .then((bets) => {
        if (cancelled) return;
        const history = bets
          .map((bet) => {
            const match = matchesById.get(bet.matchId);
            if (!match) return null;
            return {
              match,
              bet,
              result: isMatchFinished(match) ? legacy.Ranking.calculateMatchPoints(match, bet, settings) : null
            };
          })
          .filter((row): row is HistoryRow => row !== null)
          .sort((a, b) => `${b.match.date}T${b.match.time}`.localeCompare(`${a.match.date}T${a.match.time}`));
        setRows(history);
      })
      .catch((err) => {
        console.error('Erro ao carregar extrato:', err);
        if (!cancelled) setError('Não foi possível carregar o extrato.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, data, roundId]);

  useEffect(() => {
    if (!user) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [user, onClose]);

  if (!user) return null;

  const formatPoints = getLegacy().Ranking.formatPoints;

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label={`Extrato de ${user.name}`} onClick={onClose}>
      <div className="details-modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>{user.name}</h2>
          <button type="button" onClick={onClose} autoFocus>Fechar</button>
        </header>
        <div className="details-grid">
          <span><strong>{formatPoints(user.points)}</strong> pts</span>
          <span><strong>{user.exactHits}</strong> cravadas</span>
          <span><strong>{user.nearMisses}</strong> na trave</span>
          <span><strong>{user.bonusHits}</strong> bônus</span>
        </div>
        <div className="details-list">
          {loading ? <div className="details-item"><span>Carregando extrato...</span></div> : null}
          {error ? <div className="details-item"><span>{error}</span></div> : null}
          {!loading && !error && rows.length === 0 ? <div className="details-item"><span>Nenhum palpite registrado.</span></div> : null}
          {rows.map(({ match, bet, result }) => {
            const hidden = bet.scoreHome === null || bet.scoreAway === null;
            const finalScore = getMatchScore(match);
            return (
              <div className="details-item" key={match.id}>
                <span>
                  {match.homeTeam} x {match.awayTeam}
                  <small>
                    {' '}| {formatMatchDateTime(match)}
                    {' '}| Palpite: {hidden ? 'oculto até o início do jogo' : `${bet.scoreHome} x ${bet.scoreAway}`}
                    {finalScore ? ` | Resultado: ${finalScore}` : ''}
                  </small>
                </span>
                <strong>
                  {result ? `${result.points > 0 ? '+' : ''}${formatPoints(result.points)}` : 'Aberto'}
                </strong>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
