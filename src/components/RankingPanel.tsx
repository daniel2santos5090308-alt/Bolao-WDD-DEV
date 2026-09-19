import { getLegacy } from '../services/legacyBolao';

interface RankingPanelProps {
  title: string;
  tone: 'round' | 'general';
  ranking: RankingItem[];
  summary?: string;
  onDetails(user: RankingItem): void;
}

export function RankingPanel({ title, tone, ranking, summary, onDetails }: RankingPanelProps) {
  return (
    <section className={`side-card side-card--${tone}`}>
      <header className="side-card__header">
        <span>{title}</span>
      </header>
      {summary ? <div className="side-card__summary">{summary}</div> : null}
      <div className="ranking-list">
        {ranking.length === 0 ? (
          <div className="empty-row">Sem dados.</div>
        ) : ranking.slice(0, 6).map((item, index) => (
          <button className="ranking-row" type="button" key={item.id} onClick={() => onDetails(item)}>
            <span className={`ranking-row__pos ${index === 0 ? 'is-leader' : ''}`}>{index + 1}</span>
            <span className="ranking-row__name">{item.name}</span>
            <span className="ranking-row__points">{getLegacy().Ranking.formatPoints(item.points)}</span>
            <span className="ranking-row__stats">
              PE {item.exactHits} | NT {item.nearMisses} | B {item.bonusHits}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
