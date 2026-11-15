import { useState } from 'react';
import { getTeamInitials, getTeamLogoUrl } from '../services/teams';

type TeamSize = 'sm' | 'md' | 'lg';

const LOGO_SIZES: Record<TeamSize, number> = { sm: 28, md: 40, lg: 52 };

interface TeamMarkProps {
  name: string;
  size?: TeamSize;
}

/** Escudo + nome (classes .team-badge / .team-logo do app.css). Sem escudo ou se a imagem falhar, mostra as iniciais. */
export function TeamMark({ name, size = 'md' }: TeamMarkProps) {
  const logoUrl = getTeamLogoUrl(name);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showLogo = Boolean(logoUrl) && failedUrl !== logoUrl;
  const dimension = LOGO_SIZES[size];
  const displayName = name || 'Time';

  return (
    <div className="team-badge team-badge--row">
      {showLogo && logoUrl ? (
        <img
          src={logoUrl}
          alt={`Escudo do ${displayName}`}
          className={`team-logo team-logo--${size}`}
          width={dimension}
          height={dimension}
          style={{ width: dimension, height: dimension, maxWidth: dimension, maxHeight: dimension }}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(logoUrl)}
        />
      ) : (
        <span className={`team-logo-fallback team-logo--${size}`}>{getTeamInitials(name)}</span>
      )}
      <span className="team-badge__name">{displayName}</span>
    </div>
  );
}

interface TeamBadgeProps extends TeamMarkProps {
  side?: 'home' | 'away';
}

export function TeamBadge({ name, side = 'home', size = 'md' }: TeamBadgeProps) {
  return (
    <span className={`team team--${side}`}>
      <TeamMark name={name} size={size} />
    </span>
  );
}
