import { useEffect, useState } from 'react';
import { APP_BUILD, fetchRemoteBuild, isNewBuild, UPDATE_CHECK_MS } from '../pwa/pwa';

/**
 * Nova versao publicada? Confere /version.json ao abrir, a cada 10 minutos e
 * quando o app volta para a tela (celular desbloqueado, aba reaberta).
 */
export function useAppUpdate(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (available) return;
    let cancelled = false;

    async function check() {
      const remote = await fetchRemoteBuild();
      if (!cancelled && isNewBuild(APP_BUILD, remote)) setAvailable(true);
    }

    function onVisible() {
      if (document.visibilityState === 'visible') void check();
    }

    void check();
    const timer = window.setInterval(check, UPDATE_CHECK_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [available]);

  return available;
}
