import { useCallback, useEffect, useState } from 'react';

interface CoinWalletState {
  availableBalance: number;
  lockedBalance: number;
  loading: boolean;
  error: string;
  refresh(): Promise<void>;
}

function readNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function useCoinWallet(userId: string, seasonKey = '2027'): CoinWalletState {
  const [availableBalance, setAvailableBalance] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!userId) {
      setAvailableBalance(0);
      setLockedBalance(0);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (typeof supabaseClient === 'undefined') {
        throw new Error('Supabase nao inicializado.');
      }

      const { data, error: queryError } = await supabaseClient
        .from('coin_wallet_summary')
        .select('available_balance, locked_balance')
        .eq('season_key', seasonKey)
        .eq('user_id', userId)
        .maybeSingle();

      if (queryError) throw queryError;

      setAvailableBalance(readNumber(data?.available_balance));
      setLockedBalance(readNumber(data?.locked_balance));
    } catch (err) {
      console.error('Erro ao carregar WDD Coins:', err);
      setError('Nao foi possivel carregar WDD Coins.');
      setAvailableBalance(0);
      setLockedBalance(0);
    } finally {
      setLoading(false);
    }
  }, [seasonKey, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    availableBalance,
    lockedBalance,
    loading,
    error,
    refresh: load
  };
}
