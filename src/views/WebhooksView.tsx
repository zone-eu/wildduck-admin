import {
  CaretLeftIcon as ChevronLeft,
  CaretRightIcon as ChevronRight,
  PlusIcon as Plus,
  ArrowsClockwiseIcon as RefreshCw,
  MagnifyingGlassIcon as Search,
  TrashIcon as Trash2,
  WebhooksLogoIcon as WebhookIcon
} from '@phosphor-icons/react';
import { FormEvent, useEffect, useState } from 'react';
import { createWebhook, deleteWebhook, getWebhooks } from '../api';
import type { Webhook } from '../types';
import { ConfirmDialog, formatDate } from './ui';

function WebhookCreateForm({
  onCreate
}: {
  onCreate: (input: { type: string[]; user?: string; url: string }) => Promise<void>;
}) {
  const [type, setType] = useState('user.*');
  const [user, setUser] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!type.trim() || !url.trim()) {
      setError('Event type and URL are required');
      return;
    }

    setBusy(true);
    try {
      await onCreate({
        type: type
          .split(',')
          .map(item => item.trim())
          .filter(Boolean),
        user: user.trim() || undefined,
        url: url.trim()
      });
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create webhook');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="card border border-base-300 bg-base-100 p-4 shadow-xs"
    >
      <div className="mb-3 flex items-center gap-2">
        <WebhookIcon className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Create webhook</h3>
      </div>
      <div className="space-y-3">
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">Event types</span>
          <input
            value={type}
            onChange={event => setType(event.target.value)}
            className="input w-full"
            placeholder="user.*, message.*"
          />
        </label>
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">User ID</span>
          <input
            value={user}
            onChange={event => setUser(event.target.value)}
            className="input w-full"
          />
        </label>
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">URL</span>
          <input
            value={url}
            onChange={event => setUrl(event.target.value)}
            className="input w-full"
            placeholder="https://example.com/webhook"
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
          Create
        </button>
      </div>
    </form>
  );
}

export function WebhooksView() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [type, setType] = useState('');
  const [user, setUser] = useState('');
  const [activeType, setActiveType] = useState('');
  const [activeUser, setActiveUser] = useState('');
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | false>();
  const [previousCursor, setPreviousCursor] = useState<string | false>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Webhook | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load(
    options: { type?: string; user?: string; next?: string; previous?: string } = {}
  ) {
    const nextType = options.type ?? activeType;
    const nextUser = options.user ?? activeUser;
    setLoading(true);
    setError('');

    try {
      const response = await getWebhooks({
        type: nextType,
        user: nextUser,
        next: options.next,
        previous: options.previous,
        limit: 25
      });
      setWebhooks(response.results || []);
      setTotal(response.total || 0);
      setNextCursor(response.nextCursor);
      setPreviousCursor(response.previousCursor);
      setActiveType(nextType);
      setActiveUser(nextUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load webhooks');
    } finally {
      setLoading(false);
    }
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    load({ type, user });
  }

  async function addWebhook(input: { type: string[]; user?: string; url: string }) {
    await createWebhook(input);
    await load();
  }

  async function removeWebhook() {
    if (!pendingDelete) {
      return;
    }
    setDeleting(true);
    setError('');
    try {
      await deleteWebhook(pendingDelete.id);
      setPendingDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete webhook');
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Webhooks</h2>
          <p className="text-sm text-base-content/60">{total} hooks</p>
        </div>
        <button
          title="Refresh"
          onClick={() => load()}
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

      {error ? (
        <div role="alert" className="alert alert-error alert-soft">
          <span className="min-w-0 break-words">{error}</span>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="card border border-base-300 bg-base-100 shadow-xs">
          <div className="border-b border-base-300 p-4">
            <form
              onSubmit={submitSearch}
              className="grid gap-2 md:grid-cols-[minmax(0,1fr)_260px_auto]"
            >
              <div className="relative flex min-w-0 items-center">
                <Search className="pointer-events-none absolute z-10 left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/50" />
                <input
                  value={type}
                  onChange={event => setType(event.target.value)}
                  placeholder="Event type"
                  className="input w-full pl-9 pr-3"
                />
              </div>
              <input
                value={user}
                onChange={event => setUser(event.target.value)}
                placeholder="User ID"
                className="input w-full"
              />
              <button
                type="submit"
                className="btn btn-outline"
                disabled={loading}
                aria-busy={Boolean(loading) || undefined}
              >
                {loading ? (
                  <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                ) : null}
                <Search className="h-4 w-4" />
                Search
              </button>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Types</th>
                  <th>User</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map(webhook => {
                  const types = Array.isArray(webhook.type)
                    ? webhook.type
                    : webhook.type
                      ? [webhook.type]
                      : [];

                  return (
                    <tr key={webhook.id}>
                      <td>
                        <div className="break-all font-medium">{webhook.url}</div>
                        <div className="font-mono text-xs text-base-content/60">{webhook.id}</div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {types.map(typeItem => (
                            <span className="badge badge-sm badge-soft badge-ghost">
                              {typeItem}
                            </span>
                          ))}
                          {!types.length ? <span className="text-base-content/60">-</span> : null}
                        </div>
                      </td>
                      <td className="break-all text-base-content/70">{webhook.user || '-'}</td>
                      <td className="text-base-content/70">{formatDate(webhook.created)}</td>
                      <td className="text-right">
                        <button
                          title="Delete webhook"
                          onClick={() => setPendingDelete(webhook)}
                          aria-label="Delete webhook"
                          type="button"
                          className="btn btn-square btn-sm btn-error btn-soft"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!webhooks.length ? (
                  <tr>
                    <td className="text-center text-base-content/60" colSpan={5}>
                      No webhooks found
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-base-300 px-4 py-3">
            <div className="text-sm text-base-content/60">{webhooks.length} shown</div>
            <div className="flex gap-2">
              <button
                title="Previous page"
                onClick={() => previousCursor && load({ previous: previousCursor })}
                aria-label="Previous page"
                type="button"
                className="btn btn-square btn-sm btn-ghost"
                disabled={!previousCursor || loading}
                aria-busy={Boolean(loading) || undefined}
              >
                {loading ? (
                  <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
              <button
                title="Next page"
                onClick={() => nextCursor && load({ next: nextCursor })}
                aria-label="Next page"
                type="button"
                className="btn btn-square btn-sm btn-ghost"
                disabled={!nextCursor || loading}
                aria-busy={Boolean(loading) || undefined}
              >
                {loading ? (
                  <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <WebhookCreateForm onCreate={addWebhook} />
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete webhook"
        message={
          pendingDelete ? (
            <>
              Delete webhook for{' '}
              <strong className="break-all text-base-content">{pendingDelete.url}</strong>?
            </>
          ) : null
        }
        confirmLabel="Delete webhook"
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={removeWebhook}
      />
    </section>
  );
}
