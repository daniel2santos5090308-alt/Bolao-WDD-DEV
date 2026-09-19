import { useEffect, useState } from 'react';
import { formatMatchDateTime, getLegacy, getMatchScore, isMatchFinished, isMatchLocked } from '../services/legacyBolao';
import { TeamBadge } from './TeamBadge';

interface MatchCardProps {
  match: BolaoMatch;
  roundName: string;
  currentUser: BolaoUser;
  data: BolaoData;
  onSaved(data: BolaoData): void;
}

export function MatchCard({ match, roundName, currentUser, data, onSaved }: MatchCardProps) {
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const userBet = data.bets?.[currentUser.id]?.[match.id] || null;
  const locked = isMatchLocked(match);
  const score = getMatchScore(match);

  useEffect(() => {
    setHome(userBet?.scoreHome?.toString() ?? '');
    setAway(userBet?.scoreAway?.toString() ?? '');
  }, [userBet?.scoreHome, userBet?.scoreAway]);

  async function saveBet() {
    const scoreHome = Number(home);
    const scoreAway = Number(away);

    if (!Number.isInteger(scoreHome) || scoreHome < 0 || !Number.isInteger(scoreAway) || scoreAway < 0) {
      setFeedback('Informe um placar valido.');
      return;
    }

    setSaving(true);
    setFeedback('');

    const createdAt = new Date().toISOString();
    const success = await getLegacy().Storage.saveBet(currentUser.id, match.id, {
      scoreHome,
      scoreAway,
      createdAt
    });

    setSaving(false);

    if (!success) {
      setFeedback('Erro ao salvar. Tente novamente.');
      return;
    }

    const nextData = getLegacy().Storage.cloneData(data);
    if (!nextData.bets[currentUser.id]) nextData.bets[currentUser.id] = {};
    nextData.bets[currentUser.id][match.id] = { scoreHome, scoreAway, createdAt };
    onSaved(nextData);
    setFeedback(`Palpite salvo: ${scoreHome} x ${scoreAway}`);
  }

  const result = isMatchFinished(match) && userBet
    ? getLegacy().Ranking.calculateMatchPoints(match, userBet, getLegacy().Ranking.getSettings(data))
    : null;

  return (
    <article className={`match-card ${match.isBonus ? 'match-card--bonus' : ''} ${locked ? 'is-locked' : ''}`}>
      {match.isBonus ? <div className="bonus-ribbon">Bonus 2x</div> : null}
      <header className="match-card__top">
        <span>{roundName}</span>
        <strong>{formatMatchDateTime(match)}</strong>
      </header>

      <div className="scoreboard">
        <TeamBadge name={match.homeTeam} />
        <div className="scoreboard__center">
          <span className="scoreboard__score">{score || 'x'}</span>
          <span className={`status-pill ${locked ? 'status-pill--locked' : 'status-pill--open'}`}>
            {isMatchFinished(match) ? 'Finalizado' : locked ? 'Encerrado' : 'Aberto'}
          </span>
        </div>
        <TeamBadge name={match.awayTeam} />
      </div>

      <div className="bet-box">
        {locked ? (
          <div className="saved-pick">
            <span>{userBet ? `Seu palpite: ${userBet.scoreHome} x ${userBet.scoreAway}` : 'Voce nao apostou neste jogo.'}</span>
            {result?.isHit ? <strong>{result.label}: +{getLegacy().Ranking.formatPoints(result.points)} pts</strong> : null}
          </div>
        ) : (
          <>
            <div className="bet-box__title">Seu palpite</div>
            <div className="bet-inputs">
              <label>
                <span>{match.homeTeam}</span>
                <input value={home} onChange={(event) => setHome(event.target.value)} type="number" min="0" />
              </label>
              <b>X</b>
              <label>
                <span>{match.awayTeam}</span>
                <input value={away} onChange={(event) => setAway(event.target.value)} type="number" min="0" />
              </label>
            </div>
            <button className="primary-action" type="button" disabled={saving} onClick={saveBet}>
              {saving ? 'Salvando...' : 'Salvar palpite'}
            </button>
            {feedback ? <div className="inline-feedback">{feedback}</div> : null}
          </>
        )}
      </div>
    </article>
  );
}
