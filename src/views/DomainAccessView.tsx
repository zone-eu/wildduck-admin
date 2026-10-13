import { CircleOff, Plus, RefreshCw, Shield, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { createDomainAccess, deleteDomainAccess, getDomainAccess } from '../api';
import type { DomainAccessAction, DomainAccessItem } from '../types';
import { Button, ConfirmDialog, ErrorNotice, Field, IconButton, StatusPill } from './ui';

function actionLabel(action: DomainAccessAction) {
  return action === 'allow' ? 'Allowlist' : 'Blocklist';
}

function DomainAccessList({
  action,
  items,
  onCreate,
  onDelete
}: {
  action: DomainAccessAction;
  items: DomainAccessItem[];
  onCreate: (domain: string) => Promise<void>;
  onDelete: (item: DomainAccessItem) => void;
}) {
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const Icon = action === 'allow' ? Shield : CircleOff;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!domain.trim()) {
      setError('Domain is required');
      return;
    }

    setBusy(true);

    try {
      await onCreate(domain.trim());
      setDomain('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Could not update ${actionLabel(action).toLowerCase()}`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-white dark:bg-slate-900 shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 text-brand-600 dark:text-teal-300" />
          <h3 className="font-semibold">{actionLabel(action)}</h3>
        </div>
        <StatusPill label={`${items.length} domains`} tone={items.length ? 'success' : 'muted'} />
      </div>

      <form onSubmit={submit} noValidate className="space-y-3 border-b border-line p-4">
        <Field label="Domain">
          <input
            value={domain}
            onChange={event => setDomain(event.target.value)}
            placeholder="example.com"
            className="input"
          />
        </Field>
        <ErrorNotice message={error} />
        <Button
          loading={busy}
          type="submit"
          disabled={busy}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Add domain
        </Button>
      </form>

      <div className="divide-y divide-line">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="min-w-0">
              <div className="break-all font-medium">{item.domain}</div>
              <div className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.id}</div>
            </div>
            <IconButton title={`Remove ${item.domain}`} onClick={() => onDelete(item)}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
        ))}
        {!items.length ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No domains
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DomainAccessView() {
  const [tag, setTag] = useState('default');
  const [loadedTag, setLoadedTag] = useState('default');
  const [allowed, setAllowed] = useState<DomainAccessItem[]>([]);
  const [blocked, setBlocked] = useState<DomainAccessItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<DomainAccessItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load(nextTag = tag) {
    const normalizedTag = nextTag.trim() || 'default';
    setLoading(true);
    setError('');

    try {
      const [allowResponse, blockResponse] = await Promise.all([
        getDomainAccess(normalizedTag, 'allow'),
        getDomainAccess(normalizedTag, 'block')
      ]);
      setAllowed(allowResponse.results || []);
      setBlocked(blockResponse.results || []);
      setTag(normalizedTag);
      setLoadedTag(normalizedTag);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load domain access lists');
    } finally {
      setLoading(false);
    }
  }

  async function submitTag(event: FormEvent) {
    event.preventDefault();
    await load(tag);
  }

  async function createEntry(action: DomainAccessAction, domain: string) {
    if (!domain) {
      throw new Error('Domain is required');
    }

    await createDomainAccess(loadedTag, action, domain);
    await load(loadedTag);
  }

  async function removeEntry() {
    if (!pendingDelete) {
      return;
    }

    setDeleting(true);
    try {
      await deleteDomainAccess(pendingDelete.id);
      setPendingDelete(null);
      await load(loadedTag);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove domain');
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    load('default');
  }, []);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Domain Access</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Tag {loadedTag}</p>
        </div>
        <IconButton
          loading={loading}
          title="Refresh"
          onClick={() => load(loadedTag)}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </IconButton>
      </div>

      <div className="rounded-lg border border-line bg-white dark:bg-slate-900 p-4 shadow-xs">
        <form onSubmit={submitTag} noValidate className="flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1">
            <Field label="Tag">
              <input value={tag} onChange={event => setTag(event.target.value)} className="input" />
            </Field>
          </div>
          <Button
            loading={loading}
            type="submit"
            disabled={loading}
            className="mt-0 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white dark:bg-slate-900 px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:border-brand-500 hover:text-brand-700 dark:hover:text-teal-300 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Load
          </Button>
        </form>
      </div>

      <ErrorNotice message={error} />

      <div className="grid gap-4 lg:grid-cols-2">
        <DomainAccessList
          action="allow"
          items={allowed}
          onCreate={domain => createEntry('allow', domain)}
          onDelete={setPendingDelete}
        />
        <DomainAccessList
          action="block"
          items={blocked}
          onCreate={domain => createEntry('block', domain)}
          onDelete={setPendingDelete}
        />
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Remove domain"
        message={
          pendingDelete ? (
            <>
              Remove <strong className="break-all text-ink">{pendingDelete.domain}</strong> from{' '}
              {actionLabel(pendingDelete.action).toLowerCase()}?
            </>
          ) : null
        }
        confirmLabel="Remove"
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={removeEntry}
      />
    </section>
  );
}
