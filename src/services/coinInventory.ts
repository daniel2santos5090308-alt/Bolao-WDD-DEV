/** Itens da loja (Fase 10): regras puras, sem acesso ao banco. */
import type { CoinStoreItem, CoinUserItem } from '../hooks/useCoinStore';

/**
 * Codigos dos itens que o participante ja tem, em qualquer temporada.
 * Cada temporada tem copias do catalogo (ids novos, mesmo codigo).
 */
export function getOwnedItemCodes(inventory: CoinUserItem[], items: CoinStoreItem[] = []): Set<string> {
  const codeById = new Map(items.map((item) => [item.id, item.code]));
  const codes = new Set<string>();
  inventory.forEach((entry) => {
    const code = entry.itemCode || codeById.get(entry.itemId) || '';
    if (code) codes.add(code);
  });
  return codes;
}
