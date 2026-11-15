import { useEffect, useState } from 'react';
import { getLegacy } from '../services/legacyBolao';

/** Historico do ranking por rodada; [] se ainda nao houver (ou se a funcao nao existir no banco). */
export function useRankingHistory(dataVersion: number | null | undefined) {
  const [history, setHistory] = useState<RankingHistoryRow[]>([]);

  useEffect(() => {
    if (dataVersion === undefined) return;
    let cancelled = false;
    getLegacy().Storage.getRankingHistory()
      .then((rows) => { if (!cancelled) setHistory(rows); })
      .catch(() => { if (!cancelled) setHistory([]); });
    return () => { cancelled = true; };
  }, [dataVersion]);

  return history;
}
