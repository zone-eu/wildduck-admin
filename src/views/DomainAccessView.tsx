import {
  ProhibitIcon as CircleOff,
  PlusIcon as Plus,
  ArrowsClockwiseIcon as RefreshCw,
  ShieldIcon as Shield,
  TrashIcon as Trash2
} from '@phosphor-icons/react';
import { FormEvent, useEffect, useState } from 'react';
import { createDomainAccess, deleteDomainAccess, getDomainAccess } from '../api';
import type { DomainAccessAction, DomainAccessItem } from '../types';
import { ConfirmDialog } from './ui';

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
    <div className="card border border-base-300 bg-base-100 shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b border-base-300 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">{actionLabel(action)}</h3>
        </div>
        <span
          className={`badge badge-sm badge-soft ${items.length ? 'badge-success' : 'badge-ghost'}`}
        >{`${items.length} domains`}</span>
      </div>

      <form onSubmit={submit} noValidate className="space-y-3 border-b border-base-300 p-4">
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">Domain</span>
          <input
            value={domain}
            onChange={event => setDomain(event.target.value)}
            placeholder="example.com"
            className="input w-full"
          />
        </label>
        {error ? (
          <div role="alert" className="alert alert-error alert-soft">
            <span className="min-w-0 break-words">{error}</span>
          </div>
        ) : null}
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={busy}
          aria-busy={Boolean(busy) || undefined}
        >
          {busy ? <span aria-hidden="true" className="loading loading-spinner loading-xs" /> : null}
          <Plus className="h-4 w-4" />
          Add domain
        </button>
      </form>

      <div className="divide-y divide-base-300">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="min-w-0">
              <div className="break-all font-medium">{item.domain}</div>
              <div className="font-mono text-xs text-base-content/60">{item.id}</div>
            </div>
            <button
              title={`Remove ${item.domain}`}
              onClick={() => onDelete(item)}
              aria-label={`Remove ${item.domain}`}
              type="button"
              className="btn btn-square btn-sm btn-error btn-soft"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {!items.length ? (
          <div className="px-4 py-8 text-center text-sm text-base-content/60">No domains</div>
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
          <p className="text-sm text-base-content/60">Tag {loadedTag}</p>
        </div>
        <button
          title="Refresh"
          onClick={() => load(loadedTag)}
          aria-label="Refresh"
          type="button"
          className="btn btn-square btn-sm btn-ghost"
          disabled={loading}
          aria-busy={Boolean(loading) || undefined}
        >
          {loading ? (
            <span aria-hidden="true" className="loading loading-spinner loading-xs" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="card border border-base-300 bg-base-100 p-4 shadow-xs">
        <form onSubmit={submitTag} noValidate className="flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1">
            <label className="fieldset min-w-0">
              <span className="fieldset-legend">Tag</span>
              <input
                value={tag}
                onChange={event => setTag(event.target.value)}
                className="input w-full"
              />
            </label>
          </div>
          <button
            type="submit"
            className="btn btn-outline mt-0"
            disabled={loading}
            aria-busy={Boolean(loading) || undefined}
          >
            {loading ? (
              <span aria-hidden="true" className="loading loading-spinner loading-xs" />
            ) : null}
            <RefreshCw className="h-4 w-4" />
            Load
          </button>
        </form>
      </div>

      {error ? (
        <div role="alert" className="alert alert-error alert-soft">
          <span className="min-w-0 break-words">{error}</span>
        </div>
      ) : null}

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
              Remove <strong className="break-all text-base-content">{pendingDelete.domain}</strong>{' '}
              from {actionLabel(pendingDelete.action).toLowerCase()}?
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
