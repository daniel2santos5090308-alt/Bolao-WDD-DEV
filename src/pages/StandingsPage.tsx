import { StandingsLegend, StandingsTable } from '../components/StandingsTable';
import { useBolaoData } from '../hooks/useBolaoData';

export function StandingsPage() {
  const { data, loading, error, lastLoadedAt, refresh } = useBolaoData();
  const standings = data?.standings || [];

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">{data?.season?.name || 'Brasileirão'}</span>
          <h1>Tabela</h1>
          <p>Classificação do campeonato, atualizada pelo admin.</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="ghost-button" onClick={refresh} disabled={loading}>
            <i className="bi bi-arrow-clockwise" aria-hidden="true" /> Atualizar
          </button>
          {lastLoadedAt ? <span className="muted-text">às {lastLoadedAt}</span> : null}
        </div>
      </header>

      {error ? <div className="banner banner--error">{error}</div> : null}

      <section className="panel">
        <StandingsTable standings={standings} emptyText={loading && !data ? 'Carregando tabela…' : undefined} />
        <StandingsLegend />
      </section>
    </section>
  );
}
