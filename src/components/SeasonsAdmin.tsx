import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  activateSeason,
  createSeason,
  defaultSeasonName,
  describeSeasonPeriod,
  listSeasons,
  sortSeasons,
  validateSeasonKey,
  type SeasonInfo
} from '../services/seasons';

interface SeasonsAdminProps {
  onNotify(text: string): void;
  onFail(text: string): void;
}

/**
 * Aba "Temporadas" do admin (Fase 5): criar a temporada do proximo ano e ativa-la.
 * Ativar troca Jogos, Ranking, Tabela e WDD Coins de todos para a nova temporada.
 */
export function SeasonsAdmin({ onNotify, onFail }: SeasonsAdminProps) {
  const [seasons, setSeasons] = useState<SeasonInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [startsOn, setStartsOn] = useState('');
  // O Admin recria onNotify/onFail a cada render; a ref evita recarregar a lista sem parar.
  const failRef = useRef(onFail);
  failRef.current = onFail;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSeasons(await listSeasons());
    } catch (err) {
      failRef.current(err instanceof Error ? err.message : 'Não foi possível carregar as temporadas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = seasons.find((season) => season.isActive) || null;

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const problem = validateSeasonKey(key, seasons);
    if (problem) return onFail(problem);

    setBusy(true);
    try {
      const created = await createSeason({ key, name, startsOn });
      setSeasons((current) => sortSeasons([...current, created]));
      setKey('');
      setName('');
      setStartsOn('');
      onNotify(`Temporada ${created.name} criada. Ela fica desativada até você ativá-la.`);
    } catch (err) {
      onFail(err instanceof Error ? err.message : 'Não foi possível criar a temporada.');
    } finally {
      setBusy(false);
    }
  }

  async function handleActivate(season: SeasonInfo) {
    const previous = active ? ` A temporada ${active.name} será encerrada hoje.` : '';
    const ok = window.confirm(
      `Ativar ${season.name}?${previous} Jogos, Ranking, Tabela e WDD Coins passam a mostrar ${season.key} para todos os participantes.`
    );
    if (!ok) return;

    setBusy(true);
    try {
      await activateSeason(season.key);
      onNotify(`Temporada ${season.name} ativada. Recarregando…`);
      // O app inteiro depende da temporada ativa: recarrega para todos os dados virem da nova.
      window.location.reload();
    } catch (err) {
      onFail(err instanceof Error ? err.message : 'Não foi possível ativar a temporada.');
      setBusy(false);
    }
  }

  return (
    <div className="admin-two-col">
      <section className="admin-panel">
        <header>
          <div>
            <h2>Temporadas</h2>
            <p>A temporada ativa é a que todos veem em Jogos, Ranking, Tabela e WDD Coins.</p>
          </div>
        </header>
        <div className="admin-list" aria-busy={loading}>
          {loading ? <div className="admin-list-row"><span>Carregando…</span></div> : null}
          {!loading && seasons.length === 0 ? <div className="admin-list-row"><span>Nenhuma temporada cadastrada.</span></div> : null}
          {seasons.map((season) => (
            <div key={season.key} className="admin-list-row season-row">
              <div className="season-row__info">
                <strong>{season.name}</strong>
                <span>{describeSeasonPeriod(season)}</span>
              </div>
              {season.isActive ? (
                <span className="chip chip--open">Ativa</span>
              ) : (
                <button type="button" onClick={() => handleActivate(season)} disabled={busy}>Ativar</button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <header>
          <div>
            <h2>Nova temporada</h2>
            <p>Copia as premiações de WDD Coins e o catálogo da loja da temporada ativa. Saldos e itens comprados não são copiados.</p>
          </div>
        </header>
        <form className="admin-fields-grid" onSubmit={handleCreate}>
          <label className="admin-field">
            <span>Ano</span>
            <input value={key} onChange={(event) => setKey(event.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="2028" required />
          </label>
          <label className="admin-field">
            <span>Nome</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder={key.length === 4 ? defaultSeasonName(key) : 'Brasileirão 2028'} />
            <small>Em branco: "Brasileirão" + ano.</small>
          </label>
          <label className="admin-field">
            <span>Início</span>
            <input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} />
          </label>
          <div className="admin-panel__actions">
            <button type="submit" disabled={busy}>Criar temporada</button>
          </div>
        </form>
      </section>
    </div>
  );
}
