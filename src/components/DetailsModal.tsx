import { getLegacy } from '../services/legacyBolao';

interface DetailsModalProps {
  user: RankingItem | null;
  onClose(): void;
}

export function DetailsModal({ user, onClose }: DetailsModalProps) {
  if (!user) return null;

  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <div className="details-modal">
        <header>
          <h2>{user.name}</h2>
          <button type="button" onClick={onClose}>Fechar</button>
        </header>
        <div className="details-grid">
          <span><strong>{getLegacy().Ranking.formatPoints(user.points)}</strong> pts</span>
          <span><strong>{user.exactHits}</strong> exatos</span>
          <span><strong>{user.nearMisses}</strong> trave</span>
          <span><strong>{user.bonusHits}</strong> bonus</span>
        </div>
        <div className="details-list">
          {(user.history || []).slice(0, 12).map((item, index) => (
            <div className="details-item" key={`${item.match}-${index}`}>
              <span>{item.match}</span>
              <strong>{item.isFinished ? `+${getLegacy().Ranking.formatPoints(item.points)}` : 'Aberto'}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
