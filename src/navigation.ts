export const views = [
  'overview',
  'users',
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
  const view = new URL(href).searchParams.get('view');
  return views.find(candidate => candidate === view) ?? 'overview';
}

export function viewUrl(href: string, view: View): string {
  const url = new URL(href);
  url.searchParams.set('view', view);
  return `${url.pathname}${url.search}${url.hash}`;
}
