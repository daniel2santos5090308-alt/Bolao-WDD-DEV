import { EmptyState } from '../components/EmptyState';
import { StandingsLegend, StandingsTable } from '../components/StandingsTable';
import { useBolaoData } from '../hooks/useBolaoData';

export function StandingsPage() {
  const { data, loading, error, lastLoadedAt, refresh } = useBolaoData();
  const standings = data?.standings || [];

  return (
    <section className="page-stack">
      <div className="section-hero">
        <div>
          <span className="eyebrow">Brasileirao</span>
          <h1>Classificacao</h1>
          <p>Tabela atualizada manualmente via admin, sem consumo automatico de API.</p>
        </div>
        <div className="hero-actions">
          <button type="button" onClick={refresh} disabled={loading}>Atualizar</button>
          {lastLoadedAt ? <span>Atualizado {lastLoadedAt}</span> : null}
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}
      {loading && !data ? <EmptyState>Carregando classificacao...</EmptyState> : null}

      <section className="table-card">
        <header>
          <h2>Classificacao Brasileirao 2027</h2>
        </header>
        <StandingsLegend />
        <StandingsTable standings={standings} />
      </section>
    </section>
  );
}
