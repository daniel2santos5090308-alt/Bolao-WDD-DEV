/**
 * Palpites digitados e ainda nao salvos. A tela de Jogos informa quantos sao;
 * o App pergunta antes de trocar de tela ou sair, e o navegador avisa ao fechar a aba.
 */
let unsavedCount = 0;

export function setUnsavedCount(count: number): void {
  unsavedCount = Math.max(0, count);
}

export function getUnsavedCount(): number {
  return unsavedCount;
}

export function unsavedMessage(count: number): string {
  const what = count === 1 ? '1 palpite não salvo' : `${count} palpites não salvos`;
  return `Você tem ${what}. Sair mesmo assim e perder ${count === 1 ? 'esse palpite' : 'esses palpites'}?`;
}

/** true = pode sair. Pergunta so quando ha palpite pendente. */
export function confirmDiscardUnsaved(ask: (message: string) => boolean = (message) => window.confirm(message)): boolean {
  if (!unsavedCount) return true;
  const ok = ask(unsavedMessage(unsavedCount));
  if (ok) unsavedCount = 0;
  return ok;
}
