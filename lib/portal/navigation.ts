export type PortalView = 'dashboard' | 'invoices' | 'calendar' | 'tour' | 'about' | 'admin';

export function portalNavigation(role: string) {
  const items: Array<{ view: PortalView; label: string }> = [
    { view: 'dashboard', label: 'Startseite' },
    ...(role !== 'employee' ? [{ view: 'invoices' as const, label: 'Rechnungen' }] : []),
    { view: 'calendar', label: 'Meetingraum' },
    { view: 'tour', label: 'Rundgang' },
    { view: 'about', label: 'Über uns' },
    ...(role === 'admin' ? [{ view: 'admin' as const, label: 'Admin' }] : []),
  ];
  return items;
}

export function initialPortalView(search: string, hash = ''): PortalView {
  const requested = new URLSearchParams(search).get('view');
  if (requested === 'issues') return 'admin';
  if (requested === 'invoices' || hash === '#member-invoices') return 'invoices';
  return 'dashboard';
}

export function visiblePortalView(requested: PortalView, role: string): PortalView {
  return portalNavigation(role).some(item => item.view === requested) ? requested : 'dashboard';
}
