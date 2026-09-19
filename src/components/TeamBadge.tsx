import { getLegacy } from '../services/legacyBolao';

interface TeamBadgeProps {
  name: string;
}

export function TeamBadge({ name }: TeamBadgeProps) {
  return (
    <span
      className="team-slot"
      dangerouslySetInnerHTML={{
        __html: getLegacy().Teams.getTeamMarkup(name, { size: 'lg', layout: 'stacked' })
      }}
    />
  );
}
