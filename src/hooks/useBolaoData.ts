import { useCallback, useEffect, useState } from 'react';
import * as storage from '../services/storage';

export function useBolaoData() {
  const [data, setData] = useState<BolaoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastLoadedAt, setLastLoadedAt] = useState('');

  const load = useCallback(async (options: { forceRefresh?: boolean } = {}) => {
    setLoading(true);
    setError('');

    try {
      const nextData = await storage.getData({
        forceRefresh: Boolean(options.forceRefresh)
      });

      setData(nextData);
      setLastLoadedAt(new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      }));
    } catch (err) {
      console.error('Erro ao carregar dados do Bolão WDD:', err);
      setError('Não foi possível carregar os dados. Verifique a conexão e tente atualizar.');
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
    /** Baixa tudo de novo (botao "Atualizar"). */
    refresh: () => load({ forceRefresh: true }),
    /** Le do cache local; so vai ao banco se o carimbo de versao mudou. */
    reload: () => load()
  };
}
