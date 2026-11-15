import { formatCountdown, getKickoff, type MatchStatus } from '../services/matchTime';
import { TeamBadge } from './TeamBadge';
import { formatPoints } from '../services/scoring';

export interface BetDraft {
  home: string;
  away: string;
}

interface MatchRowProps {
  match: BolaoMatch;
  status: MatchStatus;
  now: number;
  savedBet: BolaoBet | null;
  draft: BetDraft;
  dirty: boolean;
  bonusMultiplier: number;
  pointResult: MatchPointResult | null;
  onDraftChange(next: BetDraft): void;
}

function StatusChip({ status, match, now }: { status: MatchStatus; match: BolaoMatch; now: number }) {
  if (status === 'finished') return <span className="chip chip--final">Encerrado</span>;
  if (status === 'locked') return <span className="chip chip--locked"><i className="bi bi-lock-fill" aria-hidden="true" /> Fechado</span>;
  if (status === 'closing') {
    return (
      <span className="chip chip--closing">
        <i className="bi bi-alarm" aria-hidden="true" /> Fecha em {formatCountdown(getKickoff(match).getTime() - now)}
      </span>
    );
  }
  return <span className="chip chip--open">Aberto</span>;
}

function ScoreStepper({ value, label, onChange }: { value: string; label: string; onChange(value: string): void }) {
  const numeric = value === '' ? null : Number(value);

  function step(delta: number) {
    const base = numeric ?? (delta > 0 ? -1 : 0);
    onChange(String(Math.min(20, Math.max(0, base + delta))));
  }

  return (
    <span className="stepper">
      <button type="button" className="stepper__btn" onClick={() => step(-1)} disabled={numeric === null || numeric <= 0} aria-label={`Diminuir gols ${label}`}>−</button>
      <input
        className="stepper__input"
        value={value}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        aria-label={`Gols ${label}`}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 2))}
        onFocus={(event) => event.target.select()}
      />
      <button type="button" className="stepper__btn" onClick={() => step(1)} aria-label={`Aumentar gols ${label}`}>+</button>
    </span>
  );
}

export function MatchRow({ match, status, now, savedBet, draft, dirty, bonusMultiplier, pointResult, onDraftChange }: MatchRowProps) {
  const editable = status === 'open' || status === 'closing';
  const hasScore = match.score && match.score.home !== null && match.score.away !== null;
  const savedText = savedBet && savedBet.scoreHome !== null && savedBet.scoreAway !== null
    ? `${savedBet.scoreHome} x ${savedBet.scoreAway}`
    : null;

  return (
    <article className={`match-row match-row--${status}${match.isBonus ? ' match-row--bonus' : ''}${dirty ? ' is-dirty' : ''}`}>
      {match.isBonus ? (
        <div className="match-row__bonus">
          <i className="bi bi-star-fill" aria-hidden="true" /> Jogo bônus · pontos x{formatPoints(bonusMultiplier)}
        </div>
      ) : null}

      <div className="match-row__meta">
        <strong className="match-row__time">{(match.time || '').slice(0, 5)}</strong>
        <StatusChip status={status} match={match} now={now} />
      </div>

      <div className="match-row__teams">
        <TeamBadge name={match.homeTeam} side="home" />

        <div className="match-row__score">
          {editable ? (
            <div className="bet-editor">
              <ScoreStepper value={draft.home} label={match.homeTeam} onChange={(home) => onDraftChange({ ...draft, home })} />
              <span className="bet-editor__x">x</span>
              <ScoreStepper value={draft.away} label={match.awayTeam} onChange={(away) => onDraftChange({ ...draft, away })} />
            </div>
          ) : (
            <div className="final-score">
              <span className="final-score__value">
                {hasScore ? `${match.score?.home} – ${match.score?.away}` : '– x –'}
              </span>
              <span className="final-score__pick">{savedText ? `Seu palpite ${savedText}` : 'Sem palpite'}</span>
            </div>
          )}
        </div>

        <TeamBadge name={match.awayTeam} side="away" />
      </div>

      <div className="match-row__outcome">
        {editable ? (
          dirty ? <span className="outcome outcome--pending">Não salvo</span>
            : savedText ? <span className="outcome outcome--saved"><i className="bi bi-check2" aria-hidden="true" /> Salvo</span>
              : <span className="outcome outcome--missing">Sem palpite</span>
        ) : status === 'finished' && pointResult && savedText ? (
          <span className={`outcome ${pointResult.isHit ? 'outcome--hit' : 'outcome--miss'}`}>
            <strong>{pointResult.points > 0 ? '+' : ''}{formatPoints(pointResult.points)}</strong>
            <small>{pointResult.label === 'Placar exato' ? 'Cravada' : pointResult.label}</small>
          </span>
        ) : status === 'finished' ? (
          <span className="outcome outcome--miss"><strong>0</strong><small>Sem palpite</small></span>
        ) : (
          <span className="outcome outcome--waiting">Aguardando</span>
        )}
      </div>
    </article>
  );
}
