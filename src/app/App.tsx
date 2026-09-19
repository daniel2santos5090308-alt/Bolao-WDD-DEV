import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { parseRouteFromHash, type AppRoute } from './routes';
import { AdminPage } from '../pages/AdminPage';
import { CoinsPage } from '../pages/CoinsPage';
import { DashboardPage } from '../pages/DashboardPage';
import { PlaceholderPage } from '../pages/PlaceholderPage';
import { useCoinWallet } from '../hooks/useCoinWallet';
import { getCurrentUser, getLegacy, hasSupabaseAuthSession } from '../services/legacyBolao';

function getReturnToPath() {
  return window.location.pathname.endsWith('/react.html') ? 'react.html' : '/';
}

export function App() {
  const currentUser = useMemo(() => getCurrentUser(), []);
  const isAdmin = currentUser?.role === 'admin';
  const [activeRoute, setActiveRoute] = useState<AppRoute>(() => parseRouteFromHash(window.location.hash, Boolean(isAdmin)));
  const coinWallet = useCoinWallet(currentUser?.id || '', '2027');

  useEffect(() => {
    if (!currentUser) {
      localStorage.setItem('bolao_wdd_return_to', getReturnToPath());
      window.location.href = 'login.html';
      return;
    }

    void hasSupabaseAuthSession().then(async (hasSession) => {
      if (hasSession) return;

      localStorage.setItem('bolao_wdd_return_to', getReturnToPath());
      await getLegacy().Storage.logout();
      window.location.href = 'login.html';
    });
  }, [currentUser]);

  useEffect(() => {
    function syncRoute() {
      setActiveRoute(parseRouteFromHash(window.location.hash, Boolean(isAdmin)));
    }

    window.addEventListener('hashchange', syncRoute);
    syncRoute();
    return () => window.removeEventListener('hashchange', syncRoute);
  }, [isAdmin]);

  if (!currentUser) return null;

  function handleNavigate(route: AppRoute) {
    window.location.hash = `/${route}`;
    setActiveRoute(route);
  }

  return (
    <AppShell
      currentUser={currentUser}
      activeRoute={activeRoute}
      coinBalance={coinWallet.availableBalance}
      coinLoading={coinWallet.loading}
      onNavigate={handleNavigate}
    >
      {activeRoute === 'jogos' ? (
        <DashboardPage currentUser={currentUser} />
      ) : activeRoute === 'coins' ? (
        <CoinsPage
          currentUser={currentUser}
          availableBalance={coinWallet.availableBalance}
          lockedBalance={coinWallet.lockedBalance}
          walletLoading={coinWallet.loading}
          walletError={coinWallet.error}
          onNavigate={handleNavigate}
        />
      ) : activeRoute === 'admin' ? (
        <AdminPage />
      ) : (
        <PlaceholderPage route={activeRoute} />
      )}
    </AppShell>
  );
}
