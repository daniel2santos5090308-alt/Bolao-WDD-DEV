export type AppRoute = 'jogos' | 'ranking' | 'coins' | 'perfil' | 'admin';

export interface RouteItem {
  id: AppRoute;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

export const appRoutes: RouteItem[] = [
  { id: 'jogos', label: 'Jogos', icon: 'bi-controller' },
  { id: 'ranking', label: 'Ranking', icon: 'bi-trophy' },
  { id: 'coins', label: 'Coins', icon: 'bi-coin' },
  { id: 'perfil', label: 'Perfil', icon: 'bi-person-circle' },
  { id: 'admin', label: 'Admin', icon: 'bi-sliders', adminOnly: true }
];

export function parseRouteFromHash(hash: string, isAdmin: boolean): AppRoute {
  const route = hash.replace(/^#\/?/, '') as AppRoute;
  const allowed = appRoutes.some((item) => item.id === route && (!item.adminOnly || isAdmin));
  return allowed ? route : 'jogos';
}
