import { useEffect, useState } from 'react';
import * as storage from '../services/storage';

/** Historico do ranking por rodada; [] se ainda nao houver (ou se a funcao nao existir no banco). */
export function useRankingHistory(dataVersion: number | null | undefined) {
  const [history, setHistory] = useState<RankingHistoryRow[]>([]);

  useEffect(() => {
    if (dataVersion === undefined) return;
    let cancelled = false;
    storage.getRankingHistory()
      .then((rows) => { if (!cancelled) setHistory(rows); })
      .catch(() => { if (!cancelled) setHistory([]); });
    return () => { cancelled = true; };
  }, [dataVersion]);

  return history;
}
