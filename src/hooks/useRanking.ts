import { useEffect, useState } from 'react';
import { getLegacy } from '../services/legacyBolao';

/**
 * Ranking calculado no banco (get_ranking), com cache por versao dos dados.
 * roundId 'all' ou nulo = ranking da temporada.
 * dataVersion: passe data.version para recarregar quando os dados mudarem.
 */
export function useRanking(roundId: string | null, dataVersion: number | null | undefined) {
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (dataVersion === undefined) return;

    let cancelled = false;
    setLoading(true);
    setError('');

    getLegacy().Storage.getRanking(roundId)
      .then((rows) => {
        if (!cancelled) setRanking(rows);
      })
      .catch((err) => {
        console.error('Erro ao carregar ranking:', err);
        if (!cancelled) setError('Não foi possível carregar o ranking.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [roundId, dataVersion]);

  return { ranking, loading, error };
}
