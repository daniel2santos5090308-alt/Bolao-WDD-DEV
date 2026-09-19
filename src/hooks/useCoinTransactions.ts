import { useCallback, useState } from 'react';

export interface CoinTransaction {
  id: string;
  transactionType: string;
  amount: number;
  description: string;
  createdAt: string;
  availableBalanceAfter: number;
  lockedBalanceAfter: number;
}

interface CoinTransactionsState {
  transactions: CoinTransaction[];
  loading: boolean;
  error: string;
  hasLoaded: boolean;
  load(): Promise<void>;
}

function readNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapTransaction(row: Record<string, unknown>): CoinTransaction {
  return {
    id: String(row.id),
    transactionType: String(row.transaction_type || ''),
    amount: readNumber(row.amount),
    description: String(row.description || ''),
    createdAt: String(row.created_at || ''),
    availableBalanceAfter: readNumber(row.available_balance_after),
    lockedBalanceAfter: readNumber(row.locked_balance_after)
  };
}

export function useCoinTransactions(userId: string, seasonKey = '2027', pageSize = 20): CoinTransactionsState {
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      setTransactions([]);
      setHasLoaded(true);
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (typeof supabaseClient === 'undefined') {
        throw new Error('Supabase nao inicializado.');
      }

      const { data, error: queryError } = await supabaseClient
        .from('coin_transactions')
        .select('id, transaction_type, amount, description, created_at, available_balance_after, locked_balance_after')
        .eq('season_key', seasonKey)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(0, pageSize - 1);

      if (queryError) throw queryError;

      setTransactions((data || []).map(mapTransaction));
      setHasLoaded(true);
    } catch (err) {
      console.error('Erro ao carregar extrato WDD Coins:', err);
      setError('Nao foi possivel carregar o extrato.');
    } finally {
      setLoading(false);
    }
  }, [pageSize, seasonKey, userId]);

  return {
    transactions,
    loading,
    error,
    hasLoaded,
    load
  };
}
