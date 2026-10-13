import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Webhook as WebhookIcon
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { createWebhook, deleteWebhook, getWebhooks } from '../api';
import type { Webhook } from '../types';
import {
  Button,
  ConfirmDialog,
  ErrorNotice,
  Field,
  IconButton,
  StatusPill,
  formatDate
} from './ui';

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
      className="rounded-lg border border-line bg-white dark:bg-slate-900 p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-2">
        <WebhookIcon className="h-4 w-4 text-brand-600 dark:text-teal-300" />
        <h3 className="font-semibold">Create webhook</h3>
      </div>
      <div className="space-y-3">
        <Field label="Event types">
          <input
            value={type}
            onChange={event => setType(event.target.value)}
            className="input"
            placeholder="user.*, message.*"
          />
        </Field>
        <Field label="User ID">
          <input value={user} onChange={event => setUser(event.target.value)} className="input" />
        </Field>
        <Field label="URL">
          <input
            value={url}
            onChange={event => setUrl(event.target.value)}
            className="input"
            placeholder="https://example.com/webhook"
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
          Create
        </Button>
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
          <p className="text-sm text-slate-500 dark:text-slate-400">{total} hooks</p>
        </div>
        <IconButton loading={loading} title="Refresh" onClick={() => load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </IconButton>
      </div>

      <ErrorNotice message={error} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="rounded-lg border border-line bg-white dark:bg-slate-900 shadow-sm">
          <div className="border-b border-line p-4">
            <form
              onSubmit={submitSearch}
              className="grid gap-2 md:grid-cols-[minmax(0,1fr)_260px_auto]"
            >
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={type}
                  onChange={event => setType(event.target.value)}
                  placeholder="Event type"
                  className="h-10 w-full rounded-lg border border-line pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-teal-900"
                />
              </div>
              <input
                value={user}
                onChange={event => setUser(event.target.value)}
                placeholder="User ID"
                className="input"
              />
              <Button
                loading={loading}
                type="submit"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white dark:bg-slate-900 px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:border-brand-500 hover:text-brand-700 dark:hover:text-teal-300"
              >
                <Search className="h-4 w-4" />
                Search
              </Button>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">URL</th>
                  <th className="px-4 py-3">Types</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {webhooks.map(webhook => {
                  const types = Array.isArray(webhook.type)
                    ? webhook.type
                    : webhook.type
                      ? [webhook.type]
                      : [];

                  return (
                    <tr key={webhook.id}>
                      <td className="px-4 py-3">
                        <div className="break-all font-medium">{webhook.url}</div>
                        <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                          {webhook.id}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {types.map(typeItem => (
                            <StatusPill key={typeItem} label={typeItem} tone="muted" />
                          ))}
                          {!types.length ? (
                            <span className="text-slate-500 dark:text-slate-400">-</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="break-all px-4 py-3 text-slate-600 dark:text-slate-300">
                        {webhook.user || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {formatDate(webhook.created)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <IconButton
                          title="Delete webhook"
                          onClick={() => setPendingDelete(webhook)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </td>
                    </tr>
                  );
                })}
                {!webhooks.length ? (
                  <tr>
                    <td
                      className="px-4 py-10 text-center text-slate-500 dark:text-slate-400"
                      colSpan={5}
                    >
                      No webhooks found
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line px-4 py-3">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {webhooks.length} shown
            </div>
            <div className="flex gap-2">
              <IconButton
                loading={loading}
                title="Previous page"
                onClick={() => previousCursor && load({ previous: previousCursor })}
                disabled={!previousCursor}
              >
                <ChevronLeft className="h-4 w-4" />
              </IconButton>
              <IconButton
                loading={loading}
                title="Next page"
                onClick={() => nextCursor && load({ next: nextCursor })}
                disabled={!nextCursor}
              >
                <ChevronRight className="h-4 w-4" />
              </IconButton>
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
              Delete webhook for <strong className="break-all text-ink">{pendingDelete.url}</strong>
              ?
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
