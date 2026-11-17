import { useCallback, useState } from 'react';
import { requireSupabase } from '../services/supabase';

export interface CoinStoreItem {
  id: string;
  code: string;
  name: string;
  description: string;
  itemType: string;
  price: number;
  rarity: string;
  previewValue: string;
  isActive: boolean;
  sortOrder: number;
}

export interface CoinUserItem {
  id: string;
  itemId: string;
  /** Codigo do item (igual em todas as temporadas): itens sao permanentes (Fase 10). */
  itemCode: string;
  /** Temporada em que foi comprado. */
  seasonKey: string;
  purchasedAt: string;
  isEquipped: boolean;
}

function readNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapStoreItem(row: Record<string, unknown>): CoinStoreItem {
  return {
    id: String(row.id),
    code: String(row.code || ''),
    name: String(row.name || ''),
    description: String(row.description || ''),
    itemType: String(row.item_type || ''),
    price: readNumber(row.price),
    rarity: String(row.rarity || 'comum'),
    previewValue: String(row.preview_value || ''),
    isActive: Boolean(row.is_active),
    sortOrder: readNumber(row.sort_order)
  };
}

function mapUserItem(row: Record<string, unknown>): CoinUserItem {
  const item = (row.item && typeof row.item === 'object' ? row.item : {}) as Record<string, unknown>;
  return {
    id: String(row.id),
    itemId: String(row.item_id || ''),
    itemCode: String(item.code || ''),
    seasonKey: String(row.season_key || ''),
    purchasedAt: String(row.purchased_at || ''),
    isEquipped: Boolean(row.is_equipped)
  };
}

export function useCoinStore(userId: string, seasonKey: string) {
  const [items, setItems] = useState<CoinStoreItem[]>([]);
  const [inventory, setInventory] = useState<CoinUserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [purchasingItemId, setPurchasingItemId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setInventory([]);
      setHasLoaded(true);
      return;
    }
    if (!seasonKey) return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const supabaseClient = requireSupabase();

      const [itemsResult, inventoryResult] = await Promise.all([
        supabaseClient
          .from('coin_store_items')
          .select('id, code, name, description, item_type, price, rarity, preview_value, is_active, sort_order')
          .eq('season_key', seasonKey)
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        // Itens sao permanentes: todas as temporadas, com o codigo do item.
        supabaseClient
          .from('coin_user_items')
          .select('id, item_id, season_key, purchased_at, is_equipped, item:coin_store_items(code)')
          .eq('user_id', userId)
          .order('purchased_at', { ascending: false })
      ]);

      if (itemsResult.error) throw itemsResult.error;
      if (inventoryResult.error) throw inventoryResult.error;

      setItems((itemsResult.data || []).map(mapStoreItem));
      setInventory((inventoryResult.data || []).map(mapUserItem));
      setHasLoaded(true);
    } catch (err) {
      console.error('Erro ao carregar loja WDD Coins:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a loja.');
    } finally {
      setLoading(false);
    }
  }, [seasonKey, userId]);

  const purchase = useCallback(async (item: CoinStoreItem) => {
    setPurchasingItemId(item.id);
    setError('');
    setMessage('');

    try {
      const supabaseClient = requireSupabase();

      const { error: purchaseError } = await supabaseClient.rpc('purchase_coin_store_item', {
        p_season_key: seasonKey,
        p_item_id: item.id
      });

      if (purchaseError) throw purchaseError;

      setMessage(`${item.name} comprado com sucesso.`);
      await load();
      return true;
    } catch (err) {
      console.error('Erro ao comprar item WDD Coins:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível comprar o item.');
      return false;
    } finally {
      setPurchasingItemId('');
    }
  }, [load, seasonKey]);

  return {
    items,
    inventory,
    loading,
    purchasingItemId,
    error,
    message,
    hasLoaded,
    load,
    purchase
  };
}
