import type { CoinTransaction } from '../hooks/useCoinTransactions';
import { useCoinTransactions } from '../hooks/useCoinTransactions';
import type { AppRoute } from '../app/routes';

interface CoinsPageProps {
  currentUser: BolaoUser;
  availableBalance: number;
  lockedBalance: number;
  walletLoading: boolean;
  walletError: string;
  onNavigate(route: AppRoute): void;
}

function formatDate(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatAmount(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('pt-BR')}`;
}

function TransactionRow({ transaction }: { transaction: CoinTransaction }) {
  const isCredit = transaction.amount > 0;

  return (
    <div className="coin-transaction">
      <div>
        <strong>{transaction.description}</strong>
        <span>{transaction.transactionType} | {formatDate(transaction.createdAt)}</span>
      </div>
      <div className={isCredit ? 'coin-amount coin-amount--credit' : 'coin-amount coin-amount--debit'}>
        {formatAmount(transaction.amount)}
      </div>
    </div>
  );
}

export function CoinsPage({
  currentUser,
  availableBalance,
  lockedBalance,
  walletLoading,
  walletError,
  onNavigate
}: CoinsPageProps) {
  const transactions = useCoinTransactions(currentUser.id, '2027');
  const totalBalance = availableBalance + lockedBalance;

  return (
    <section className="coins-page">
      <div className="coins-hero">
        <div>
          <span className="eyebrow">WDD Coins</span>
          <h1>Carteira e extrato</h1>
          <p>Consulte saldo, moedas bloqueadas e movimentacoes confirmadas da temporada.</p>
        </div>
        <button type="button" onClick={() => onNavigate('jogos')}>Voltar aos jogos</button>
      </div>

      <div className="coin-summary-grid">
        <article className="coin-summary-card">
          <span>Saldo disponivel</span>
          <strong>{walletLoading ? '...' : availableBalance.toLocaleString('pt-BR')}</strong>
        </article>
        <article className="coin-summary-card">
          <span>Saldo bloqueado</span>
          <strong>{walletLoading ? '...' : lockedBalance.toLocaleString('pt-BR')}</strong>
        </article>
        <article className="coin-summary-card">
          <span>Total</span>
          <strong>{walletLoading ? '...' : totalBalance.toLocaleString('pt-BR')}</strong>
        </article>
      </div>

      {walletError ? <div className="error-banner">{walletError}</div> : null}

      <section className="coin-ledger">
        <header>
          <div>
            <h2>Extrato</h2>
            <p>Carregamento manual para evitar leituras desnecessarias.</p>
          </div>
          <button type="button" onClick={transactions.load} disabled={transactions.loading}>
            {transactions.loading ? 'Carregando...' : transactions.hasLoaded ? 'Atualizar extrato' : 'Carregar extrato'}
          </button>
        </header>

        {transactions.error ? <div className="error-banner">{transactions.error}</div> : null}
        {!transactions.hasLoaded ? (
          <div className="empty-state">Clique em carregar para consultar as movimentacoes.</div>
        ) : transactions.transactions.length === 0 ? (
          <div className="empty-state">Nenhuma movimentacao registrada ainda.</div>
        ) : (
          <div className="coin-transaction-list">
            {transactions.transactions.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
