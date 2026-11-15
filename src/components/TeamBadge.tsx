import { getLegacy } from '../services/legacyBolao';

interface TeamBadgeProps {
  name: string;
  side?: 'home' | 'away';
  size?: 'sm' | 'md' | 'lg';
}

/** Escudo + nome. O HTML vem de Teams.getTeamMarkup, que ja escapa o nome. */
export function TeamBadge({ name, side = 'home', size = 'md' }: TeamBadgeProps) {
  return (
    <span
      className={`team team--${side}`}
      dangerouslySetInnerHTML={{
        __html: getLegacy().Teams.getTeamMarkup(name, { size, layout: 'row' })
      }}
    />
  );
}
