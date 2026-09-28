import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { CoinTransaction } from '../hooks/useCoinTransactions';
import { useCoinTransactions } from '../hooks/useCoinTransactions';
import type { CoinStoreItem } from '../hooks/useCoinStore';
import { useCoinStore } from '../hooks/useCoinStore';
import type { AppRoute } from '../app/routes';

interface CoinsPageProps {
  currentUser: BolaoUser;
  availableBalance: number;
  lockedBalance: number;
  walletLoading: boolean;
  walletError: string;
  onNavigate(route: AppRoute): void;
  onWalletRefresh(): Promise<void>;
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

function getTransactionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    initial_balance: 'Saldo inicial',
    round_reward: 'Recompensa da rodada',
    bonus_reward: 'Bonus',
    full_round_reward: 'Participacao completa',
    admin_adjustment: 'Ajuste admin',
    purchase: 'Compra',
    challenge_lock: 'Desafio bloqueado',
    challenge_release: 'Desafio liberado',
    challenge_reward: 'Desafio ganho',
    reversal: 'Estorno'
  };

  return labels[type] || type || 'Movimentacao';
}

function TransactionRow({ transaction }: { transaction: CoinTransaction }) {
  const isCredit = transaction.amount > 0;

  return (
    <div className="coin-transaction">
      <div>
        <strong>{transaction.description}</strong>
        <span>{getTransactionTypeLabel(transaction.transactionType)} | {formatDate(transaction.createdAt)}</span>
      </div>
      <div className={isCredit ? 'coin-amount coin-amount--credit' : 'coin-amount coin-amount--debit'}>
        {formatAmount(transaction.amount)}
      </div>
    </div>
  );
}

function getItemTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    profile_frame: 'Moldura de perfil',
    match_card_skin: 'Skin de card',
    profile_badge: 'Selo de perfil'
  };

  return labels[type] || type || 'Item';
}

function StoreItemCard({ item, owned, availableBalance, purchasing, onPurchase }: { item: CoinStoreItem; owned: boolean; availableBalance: number; purchasing: boolean; onPurchase(item: CoinStoreItem): void }) {
  const canBuy = !owned && availableBalance >= item.price && !purchasing;

  return (
    <article className="store-item-card">
      <div className="store-item-card__preview" style={item.previewValue ? { '--item-color': item.previewValue } as CSSProperties : undefined}>
        <span>{item.name.slice(0, 2).toUpperCase()}</span>
      </div>
      <div className="store-item-card__body">
        <div>
          <span className="store-item-card__meta">{getItemTypeLabel(item.itemType)} | {item.rarity}</span>
          <h3>{item.name}</h3>
          <p>{item.description}</p>
        </div>
        <div className="store-item-card__footer">
          <strong>{item.price.toLocaleString('pt-BR')} coins</strong>
          {owned ? (
            <span className="store-owned-badge">Adquirido</span>
          ) : (
            <button type="button" onClick={() => onPurchase(item)} disabled={!canBuy}>
              {purchasing ? 'Comprando...' : availableBalance >= item.price ? 'Comprar' : 'Saldo insuficiente'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function CoinsPage({
  currentUser,
  availableBalance,
  lockedBalance,
  walletLoading,
  walletError,
  onNavigate,
  onWalletRefresh
}: CoinsPageProps) {
  const transactions = useCoinTransactions(currentUser.id, '2027');
  const store = useCoinStore(currentUser.id, '2027');
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const totalBalance = availableBalance + lockedBalance;
  const loadedTransactions = transactions.transactions;
  const ownedItemIds = useMemo(() => new Set(store.inventory.map((item) => item.itemId)), [store.inventory]);
  const creditTotal = useMemo(() => loadedTransactions.filter((transaction) => transaction.amount > 0).reduce((sum, transaction) => sum + transaction.amount, 0), [loadedTransactions]);
  const debitTotal = useMemo(() => loadedTransactions.filter((transaction) => transaction.amount < 0).reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0), [loadedTransactions]);
  const filteredTransactions = useMemo(() => {
    if (transactionFilter === 'credit') return loadedTransactions.filter((transaction) => transaction.amount > 0);
    if (transactionFilter === 'debit') return loadedTransactions.filter((transaction) => transaction.amount < 0);
    return loadedTransactions;
  }, [loadedTransactions, transactionFilter]);

  async function handlePurchase(item: CoinStoreItem) {
    const success = await store.purchase(item);
    if (!success) return;

    await onWalletRefresh();
    if (transactions.hasLoaded) await transactions.load();
  }

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
            <h2>Loja WDD</h2>
            <p>Itens visuais comprados com WDD Coins. Carregamento manual para evitar leituras desnecessarias.</p>
          </div>
          <button type="button" onClick={store.load} disabled={store.loading}>
            {store.loading ? 'Carregando...' : store.hasLoaded ? 'Atualizar loja' : 'Carregar loja'}
          </button>
        </header>

        {store.error ? <div className="error-banner">{store.error}</div> : null}
        {store.message ? <div className="inline-feedback">{store.message}</div> : null}

        {!store.hasLoaded ? (
          <div className="empty-state">Clique em carregar loja para consultar itens e inventario.</div>
        ) : (
          <div className="store-layout">
            <div>
              <div className="store-section-title">
                <h3>Itens disponiveis</h3>
                <span>{store.items.length.toLocaleString('pt-BR')} itens</span>
              </div>
              {store.items.length === 0 ? (
                <div className="empty-state">Nenhum item ativo na loja.</div>
              ) : (
                <div className="store-grid">
                  {store.items.map((item) => (
                    <StoreItemCard
                      key={item.id}
                      item={item}
                      owned={ownedItemIds.has(item.id)}
                      availableBalance={availableBalance}
                      purchasing={store.purchasingItemId === item.id}
                      onPurchase={handlePurchase}
                    />
                  ))}
                </div>
              )}
            </div>
            <aside className="inventory-panel">
              <h3>Meu inventario</h3>
              {store.inventory.length === 0 ? (
                <p>Nenhum item adquirido ainda.</p>
              ) : (
                <div className="inventory-list">
                  {store.inventory.map((inventoryItem) => {
                    const item = store.items.find((storeItem) => storeItem.id === inventoryItem.itemId);
                    return (
                      <div key={inventoryItem.id} className="inventory-row">
                        <strong>{item?.name || 'Item adquirido'}</strong>
                        <span>{item ? getItemTypeLabel(item.itemType) : 'Inventario'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </aside>
          </div>
        )}
      </section>

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
        ) : loadedTransactions.length === 0 ? (
          <div className="empty-state">Nenhuma movimentacao registrada ainda.</div>
        ) : (
          <>
            <div className="coin-ledger-summary">
              <span><strong>{loadedTransactions.length}</strong> movimentacoes</span>
              <span><strong>{creditTotal.toLocaleString('pt-BR')}</strong> coins recebidas</span>
              <span><strong>{debitTotal.toLocaleString('pt-BR')}</strong> coins utilizadas</span>
            </div>
            <div className="coin-filter-tabs">
              <button type="button" className={transactionFilter === 'all' ? 'is-active' : ''} onClick={() => setTransactionFilter('all')}>Todos</button>
              <button type="button" className={transactionFilter === 'credit' ? 'is-active' : ''} onClick={() => setTransactionFilter('credit')}>Creditos</button>
              <button type="button" className={transactionFilter === 'debit' ? 'is-active' : ''} onClick={() => setTransactionFilter('debit')}>Debitos</button>
            </div>
            {filteredTransactions.length === 0 ? (
              <div className="empty-state">Nenhuma movimentacao neste filtro.</div>
            ) : (
              <div className="coin-transaction-list">
                {filteredTransactions.map((transaction) => (
                  <TransactionRow key={transaction.id} transaction={transaction} />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </section>
  );
}
