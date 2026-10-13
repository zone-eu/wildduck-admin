import { Archive, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { createMailbox, deleteMailbox, getMailboxes, updateMailbox } from '../api';
import type { MailboxItem } from '../types';
import {
  Button,
  ConfirmDialog,
  ErrorNotice,
  Field,
  IconButton,
  StatusPill,
  formatBytes
} from './ui';

function MailboxForm({ userId, onSaved }: { userId: string; onSaved: () => Promise<void> }) {
  const [path, setPath] = useState('');
  const [hidden, setHidden] = useState(false);
  const [encryptMessages, setEncryptMessages] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!userId.trim()) {
      setError('User ID is required');
      return;
    }
    if (!path.trim()) {
      setError('Mailbox path is required');
      return;
    }

    setBusy(true);
    try {
      await createMailbox(userId.trim(), { path: path.trim(), hidden, encryptMessages });
      setPath('');
      setHidden(false);
      setEncryptMessages(false);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create mailbox');
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
        <Plus className="h-4 w-4 text-brand-600 dark:text-teal-300" />
        <h3 className="font-semibold">Create mailbox</h3>
      </div>
      <div className="space-y-3">
        <Field label="Path">
          <input
            value={path}
            onChange={event => setPath(event.target.value)}
            className="input"
            placeholder="INBOX/Archive"
          />
        </Field>
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={hidden}
              onChange={event => setHidden(event.target.checked)}
              className="checkbox"
            />
            Hidden
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={encryptMessages}
              onChange={event => setEncryptMessages(event.target.checked)}
              className="checkbox"
            />
            Encrypt messages
          </label>
        </div>
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

function MailboxDetail({
  userId,
  mailbox,
  onUpdated,
  onDeleted
}: {
  userId: string;
  mailbox: MailboxItem | null;
  onUpdated: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [path, setPath] = useState('');
  const [hidden, setHidden] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [encryptMessages, setEncryptMessages] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setPath(mailbox?.path || '');
    setHidden(Boolean(mailbox?.hidden));
    setSubscribed(Boolean(mailbox?.subscribed));
    setEncryptMessages(Boolean(mailbox?.encryptMessages));
    setError('');
  }, [mailbox?.id]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!mailbox) {
      return;
    }
    setError('');
    if (!path.trim()) {
      setError('Mailbox path is required');
      return;
    }

    setBusy(true);
    try {
      await updateMailbox(userId, mailbox.id, {
        path: path.trim(),
        hidden,
        subscribed,
        encryptMessages
      });
      await onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update mailbox');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!mailbox) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await deleteMailbox(userId, mailbox.id);
      setConfirmOpen(false);
      await onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete mailbox');
    } finally {
      setBusy(false);
    }
  }

  if (!mailbox) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
        <Archive className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
        No mailbox selected
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-white dark:bg-slate-900 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h3 className="break-all font-display text-lg font-semibold">{mailbox.path}</h3>
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{mailbox.id}</p>
        </div>
        <IconButton
          loading={busy}
          title="Delete mailbox"
          onClick={() => setConfirmOpen(true)}
          disabled={busy}
        >
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>
      <form onSubmit={save} noValidate className="space-y-3 p-4">
        <Field label="Path">
          <input value={path} onChange={event => setPath(event.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Messages
            </div>
            <div className="mt-1 font-medium">{mailbox.total ?? '-'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Size
            </div>
            <div className="mt-1 font-medium">{formatBytes(mailbox.size)}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={subscribed}
              onChange={event => setSubscribed(event.target.checked)}
              className="checkbox"
            />
            Subscribed
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={hidden}
              onChange={event => setHidden(event.target.checked)}
              className="checkbox"
            />
            Hidden
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={encryptMessages}
              onChange={event => setEncryptMessages(event.target.checked)}
              className="checkbox"
            />
            Encrypted
          </label>
        </div>
        <ErrorNotice message={error} />
        <Button
          loading={busy}
          type="submit"
          disabled={busy}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          Save mailbox
        </Button>
      </form>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete mailbox"
        message={
          <>
            Delete <strong className="break-all text-ink">{mailbox.path}</strong>?
          </>
        }
        confirmLabel="Delete mailbox"
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={remove}
      />
    </div>
  );
}

export function MailboxesView() {
  const [userId, setUserId] = useState('');
  const [loadedUserId, setLoadedUserId] = useState('');
  const [mailboxes, setMailboxes] = useState<MailboxItem[]>([]);
  const [selected, setSelected] = useState<MailboxItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(nextUserId = loadedUserId || userId) {
    const id = nextUserId.trim();
    setError('');
    if (!id) {
      setError('User ID is required');
      return;
    }

    setLoading(true);
    try {
      const response = await getMailboxes(id, { counters: true, sizes: true, showHidden: true });
      setMailboxes(response.results || []);
      setLoadedUserId(id);
      setUserId(id);
      setSelected(current =>
        current ? response.results.find(item => item.id === current.id) || null : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load mailboxes');
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    load(userId);
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Mailboxes</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loadedUserId ? `${mailboxes.length} for ${loadedUserId}` : 'Select a user'}
          </p>
        </div>
        <IconButton
          loading={loading}
          title="Refresh"
          onClick={() => load()}
          disabled={loading || !loadedUserId}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </IconButton>
      </div>

      <div className="rounded-lg border border-line bg-white dark:bg-slate-900 p-4 shadow-sm">
        <form onSubmit={submit} noValidate className="flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1">
            <Field label="User ID">
              <input
                value={userId}
                onChange={event => setUserId(event.target.value)}
                className="input"
              />
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="rounded-lg border border-line bg-white dark:bg-slate-900 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Path</th>
                  <th className="px-4 py-3">Messages</th>
                  <th className="px-4 py-3">Unseen</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {mailboxes.map(mailbox => (
                  <tr
                    key={mailbox.id}
                    onClick={() => setSelected(mailbox)}
                    className={`cursor-pointer transition ${selected?.id === mailbox.id ? 'bg-brand-50 dark:bg-teal-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                  >
                    <td className="px-4 py-3">
                      <div className="break-all font-medium">{mailbox.path}</div>
                      <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {mailbox.id}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {mailbox.total ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {mailbox.unseen ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatBytes(mailbox.size)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {mailbox.specialUse ? (
                          <StatusPill label={mailbox.specialUse} tone="success" />
                        ) : null}
                        {mailbox.hidden ? <StatusPill label="Hidden" tone="warning" /> : null}
                        {mailbox.encryptMessages ? (
                          <StatusPill label="Encrypted" tone="muted" />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!mailboxes.length ? (
                  <tr>
                    <td
                      className="px-4 py-10 text-center text-slate-500 dark:text-slate-400"
                      colSpan={5}
                    >
                      No mailboxes loaded
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <aside className="space-y-4">
          <MailboxForm userId={loadedUserId} onSaved={() => load(loadedUserId)} />
          <MailboxDetail
            userId={loadedUserId}
            mailbox={selected}
            onUpdated={() => load(loadedUserId)}
            onDeleted={async () => {
              setSelected(null);
              await load(loadedUserId);
            }}
          />
        </aside>
      </div>
    </section>
  );
}
