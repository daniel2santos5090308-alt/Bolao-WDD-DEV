import { useEffect, useState } from 'react';
import { canPromptInstall, isIos, isStandalone, promptInstall, subscribeInstallPrompt } from '../pwa/pwa';

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(canPromptInstall);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => subscribeInstallPrompt(() => {
    setCanInstall(canPromptInstall());
    setInstalled(isStandalone());
  }), []);

  async function install() {
    const accepted = await promptInstall();
    if (accepted) setInstalled(true);
    setCanInstall(canPromptInstall());
  }

  return { canInstall, installed, ios: isIos(), install };
}
