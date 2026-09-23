import { getLegacy } from '../services/legacyBolao';

interface StandingsTableProps {
  standings: BolaoStanding[];
  emptyText?: string;
}

function getStandingZone(position: number): string {
  if (position >= 1 && position <= 4) return 'standing-row--lib-group';
  if (position === 5) return 'standing-row--lib-qual';
  if (position >= 6 && position <= 11) return 'standing-row--sula';
  if (position >= 17 && position <= 20) return 'standing-row--relegation';
  return '';
}

export function StandingsLegend() {
  return (
    <div className="standings-legend">
      <strong>Qualificacao/Rebaixamento</strong>
      <span><i className="legend-color legend-color--lib-group" /> Fase de grupos da CONMEBOL Libertadores</span>
      <span><i className="legend-color legend-color--lib-qual" /> Qualificatorias da CONMEBOL Libertadores</span>
      <span><i className="legend-color legend-color--sula" /> Fase de grupos da CONMEBOL Sudamericana</span>
      <span><i className="legend-color legend-color--relegation" /> Rebaixamento</span>
    </div>
  );
}

export function StandingsTable({ standings, emptyText = 'Classificacao ainda nao cadastrada.' }: StandingsTableProps) {
  const sorted = [...standings].sort((a, b) => a.position - b.position);

  return (
    <div className="data-table-wrap">
      <table className="data-table standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Time</th>
            <th>PTS</th>
            <th>J</th>
            <th>V</th>
            <th>E</th>
            <th>D</th>
            <th>SG</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={8} className="table-empty">{emptyText}</td></tr>
          ) : sorted.map((standing) => (
            <tr key={standing.id} className={getStandingZone(standing.position)}>
              <td>{standing.position}</td>
              <td
                className="team-cell"
                dangerouslySetInnerHTML={{
                  __html: getLegacy().Teams.getTeamMarkup(standing.team, { size: 'sm', layout: 'row' })
                }}
              />
              <td>{standing.points}</td>
              <td>{standing.played}</td>
              <td>{standing.wins}</td>
              <td>{standing.draws}</td>
              <td>{standing.losses}</td>
              <td>{standing.goalDiff}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
