/** Rotulos em portugues para valores de WDD Coins gravados no banco. */

export function getItemTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    profile_frame: 'Moldura de perfil',
    match_card_skin: 'Visual do card de jogo',
    profile_badge: 'Selo de perfil'
  };

  return labels[type] || type || 'Item';
}

/** Raridade gravada no banco sem acento (comum, raro, epico, lendario). */
export function getRarityLabel(rarity: string): string {
  const labels: Record<string, string> = {
    comum: 'Comum', common: 'Comum',
    raro: 'Raro', rare: 'Raro',
    epico: 'Épico', epic: 'Épico',
    lendario: 'Lendário', legendary: 'Lendário'
  };

  return labels[String(rarity || '').toLowerCase()] || rarity || '';
}
