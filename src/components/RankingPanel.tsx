import { getLegacy } from '../services/legacyBolao';

interface RankingPanelProps {
  title: string;
  tone: 'round' | 'general';
  ranking: RankingItem[];
  summary?: string;
  currentUserId?: string;
  onDetails(user: RankingItem): void;
  onSeeAll?(): void;
}

export function RankingStats({ item }: { item: RankingItem }) {
  return (
    <span className="rank-stats">
      <span title="Cravadas (placar exato)"><i className="bi bi-bullseye" aria-hidden="true" /> {item.exactHits}<span className="sr-only"> cravadas</span></span>
      <span title="Na trave (acertou o resultado)"><i className="bi bi-record-circle" aria-hidden="true" /> {item.nearMisses}<span className="sr-only"> na trave</span></span>
      <span title="Acertos em jogo bônus"><i className="bi bi-star" aria-hidden="true" /> {item.bonusHits}<span className="sr-only"> bônus</span></span>
    </span>
  );
}

export function RankingPanel({ title, tone, ranking, summary, currentUserId, onDetails, onSeeAll }: RankingPanelProps) {
  const formatPoints = getLegacy().Ranking.formatPoints;

  return (
    <section className={`panel rank-panel rank-panel--${tone}`}>
      <header className="panel__header">
        <h2>{title}</h2>
        {onSeeAll ? <button type="button" className="link-button" onClick={onSeeAll}>Ver tudo</button> : null}
      </header>
      {summary ? <div className="rank-panel__summary"><i className="bi bi-award" aria-hidden="true" /> {summary}</div> : null}
      <ol className="rank-list">
        {ranking.length === 0 ? (
          <li className="empty-row">Sem pontuação ainda.</li>
        ) : ranking.slice(0, 6).map((item, index) => {
          const position = item.position ?? index + 1;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`rank-row${item.id === currentUserId ? ' is-me' : ''}`}
                onClick={() => onDetails(item)}
              >
                <span className={`pos-badge${position === 1 ? ' pos-badge--leader' : ''}`}>{position}</span>
                <span className="rank-row__name">
                  {item.name}
                  <RankingStats item={item} />
                </span>
                <span className="rank-row__points">{formatPoints(item.points)}<small>pts</small></span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
