import { useEffect, useState } from 'react';
import * as storage from '../services/storage';

/**
 * Temporada ativa, lida do snapshot (mesmo cache das telas: nao gera leitura extra).
 * enabled = false (sem login) nao consulta nada.
 */
export function useActiveSeason(enabled: boolean): BolaoSeason | null {
  const [season, setSeason] = useState<BolaoSeason | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSeason(null);
      return;
    }

    let cancelled = false;
    storage.getData()
      .then((data) => {
        if (!cancelled) setSeason(data.season ?? null);
      })
      .catch((err) => console.error('Erro ao carregar a temporada ativa:', err));

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return season;
}
