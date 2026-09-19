import { useCallback, useEffect, useState } from 'react';
import { getLegacy } from '../services/legacyBolao';

export function useBolaoData() {
  const [data, setData] = useState<BolaoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastLoadedAt, setLastLoadedAt] = useState('');

  const load = useCallback(async (options: { forceRefresh?: boolean } = {}) => {
    setLoading(true);
    setError('');

    try {
      const nextData = await getLegacy().Storage.getData({
        forceRefresh: Boolean(options.forceRefresh)
      });

      setData(nextData);
      setLastLoadedAt(new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      }));
    } catch (err) {
      console.error('Erro ao carregar dados do Bolao WDD:', err);
      setError('Nao foi possivel carregar os dados. Tente atualizar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    data,
    setData,
    loading,
    error,
    lastLoadedAt,
    refresh: () => load({ forceRefresh: true })
  };
}
