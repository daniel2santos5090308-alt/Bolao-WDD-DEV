import { getLegacy } from '../services/legacyBolao';

interface StandingsTableProps {
  standings: BolaoStanding[];
  emptyText?: string;
}

type Zone = 'lib' | 'lib-qual' | 'sula' | 'z4' | '';

function getZone(position: number): Zone {
  if (position >= 1 && position <= 4) return 'lib';
  if (position === 5) return 'lib-qual';
  if (position >= 6 && position <= 11) return 'sula';
  if (position >= 17 && position <= 20) return 'z4';
  return '';
}

const zoneLabels: Record<Exclude<Zone, ''>, string> = {
  lib: 'Libertadores (fase de grupos)',
  'lib-qual': 'Libertadores (pré)',
  sula: 'Sul-Americana',
  z4: 'Rebaixamento'
};

export function StandingsLegend() {
  return (
    <ul className="zone-legend">
      {(Object.keys(zoneLabels) as Array<Exclude<Zone, ''>>).map((zone) => (
        <li key={zone}><span className={`zone-swatch zone-swatch--${zone}`} aria-hidden="true" />{zoneLabels[zone]}</li>
      ))}
    </ul>
  );
}

export function StandingsTable({ standings, emptyText = 'Classificação ainda não cadastrada.' }: StandingsTableProps) {
  const sorted = [...standings].sort((a, b) => a.position - b.position);

  return (
    <div className="table-wrap">
      <table className="data-table standings-table">
        <thead>
          <tr>
            <th scope="col" className="num">#</th>
            <th scope="col" className="sticky-col">Time</th>
            <th scope="col" className="num">Pts</th>
            <th scope="col" className="num">J</th>
            <th scope="col" className="num">V</th>
            <th scope="col" className="num">E</th>
            <th scope="col" className="num">D</th>
            <th scope="col" className="num hide-sm">GP</th>
            <th scope="col" className="num hide-sm">GC</th>
            <th scope="col" className="num">SG</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={10} className="table-empty">{emptyText}</td></tr>
          ) : sorted.map((standing) => {
            const zone = getZone(standing.position);
            return (
              <tr key={standing.id} className={zone ? `zone zone--${zone}` : ''} title={zone ? zoneLabels[zone] : undefined}>
                <td className="num"><span className="pos-number">{standing.position}</span></td>
                <td
                  className="sticky-col team-cell"
                  dangerouslySetInnerHTML={{
                    __html: getLegacy().Teams.getTeamMarkup(standing.team, { size: 'sm', layout: 'row' })
                  }}
                />
                <td className="num strong">{standing.points}</td>
                <td className="num">{standing.played}</td>
                <td className="num">{standing.wins}</td>
                <td className="num">{standing.draws}</td>
                <td className="num">{standing.losses}</td>
                <td className="num hide-sm">{standing.goalsFor}</td>
                <td className="num hide-sm">{standing.goalsAgainst}</td>
                <td className="num">{standing.goalDiff > 0 ? `+${standing.goalDiff}` : standing.goalDiff}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
