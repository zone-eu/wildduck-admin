export const views = [
  'overview',
  'users',
  'addresses',
  'operations',
  'mailrules',
  'mailboxes',
  'security',
  'dkim',
  'domainaccess',
  'domainaliases',
  'certs',
  'storage',
  'webhooks',
  'settings'
] as const;

export type View = (typeof views)[number];

export function readView(href: string): View {
  const view = new URL(href).pathname.replace(/^\//, '').replace(/\/$/, '');
  return views.find(candidate => candidate === view) ?? 'overview';
}

export function viewUrl(href: string, view: View): string {
  const url = new URL(href);
  url.pathname = view === 'overview' ? '/' : `/${view}`;
  url.searchParams.delete('view');
  return `${url.pathname}${url.search}${url.hash}`;
}
