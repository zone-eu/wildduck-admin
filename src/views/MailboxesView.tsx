import {
  ArchiveIcon as Archive,
  PlusIcon as Plus,
  ArrowsClockwiseIcon as RefreshCw,
  FloppyDiskIcon as Save,
  TrashIcon as Trash2
} from '@phosphor-icons/react';
import { FormEvent, useEffect, useState } from 'react';
import { createMailbox, deleteMailbox, getMailboxes, updateMailbox } from '../api';
import type { MailboxItem } from '../types';
import { ConfirmDialog, formatBytes } from './ui';

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
      className="card border border-base-300 bg-base-100 p-4 shadow-xs"
    >
      <div className="mb-3 flex items-center gap-2">
        <Plus className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Create mailbox</h3>
      </div>
      <div className="space-y-3">
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">Path</span>
          <input
            value={path}
            onChange={event => setPath(event.target.value)}
            className="input w-full"
            placeholder="INBOX/Archive"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-base-content/80">
            <input
              type="checkbox"
              checked={hidden}
              onChange={event => setHidden(event.target.checked)}
              className="checkbox checkbox-primary checkbox-sm"
            />
            Hidden
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-base-content/80">
            <input
              type="checkbox"
              checked={encryptMessages}
              onChange={event => setEncryptMessages(event.target.checked)}
              className="checkbox checkbox-primary checkbox-sm"
            />
            Encrypt messages
          </label>
        </div>
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
      <div className="card border border-dashed border-base-300 bg-base-100 p-6 text-center text-sm text-base-content/60">
        <Archive className="mx-auto mb-3 h-8 w-8 text-base-content/30" />
        No mailbox selected
      </div>
    );
  }

  return (
    <div className="card border border-base-300 bg-base-100 shadow-xs">
      <div className="flex items-start justify-between gap-3 border-b border-base-300 px-4 py-3">
        <div className="min-w-0">
          <h3 className="break-all font-display text-lg font-semibold">{mailbox.path}</h3>
          <p className="font-mono text-xs text-base-content/60">{mailbox.id}</p>
        </div>
        <button
          title="Delete mailbox"
          onClick={() => setConfirmOpen(true)}
          aria-label="Delete mailbox"
          type="button"
          className="btn btn-square btn-sm btn-error btn-soft"
          disabled={busy}
          aria-busy={Boolean(busy) || undefined}
        >
          {busy ? (
            <span aria-hidden="true" className="loading loading-spinner loading-xs" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>
      <form onSubmit={save} noValidate className="space-y-3 p-4">
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">Path</span>
          <input
            value={path}
            onChange={event => setPath(event.target.value)}
            className="input w-full"
          />
        </label>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              Messages
            </div>
            <div className="mt-1 font-medium">{mailbox.total ?? '-'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              Size
            </div>
            <div className="mt-1 font-medium">{formatBytes(mailbox.size)}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-base-content/80">
            <input
              type="checkbox"
              checked={subscribed}
              onChange={event => setSubscribed(event.target.checked)}
              className="checkbox checkbox-primary checkbox-sm"
            />
            Subscribed
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-base-content/80">
            <input
              type="checkbox"
              checked={hidden}
              onChange={event => setHidden(event.target.checked)}
              className="checkbox checkbox-primary checkbox-sm"
            />
            Hidden
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-base-content/80">
            <input
              type="checkbox"
              checked={encryptMessages}
              onChange={event => setEncryptMessages(event.target.checked)}
              className="checkbox checkbox-primary checkbox-sm"
            />
            Encrypted
          </label>
        </div>
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
          <Save className="h-4 w-4" />
          Save mailbox
        </button>
      </form>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete mailbox"
        message={
          <>
            Delete <strong className="break-all text-base-content">{mailbox.path}</strong>?
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

export function MailboxesView({ accountId }: { accountId: string }) {
  const [userId, setUserId] = useState(accountId);
  const [loadedUserId, setLoadedUserId] = useState('');
  const [mailboxes, setMailboxes] = useState<MailboxItem[]>([]);
  const [selected, setSelected] = useState<MailboxItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    load(accountId);
  }, [accountId]);

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
          <p className="text-sm text-base-content/60">
            {loadedUserId ? `${mailboxes.length} for ${loadedUserId}` : 'Select a user'}
          </p>
        </div>
        <button
          title="Refresh"
          onClick={() => load()}
          aria-label="Refresh"
          type="button"
          className="btn btn-square btn-sm btn-ghost"
          disabled={loading || !loadedUserId || loading}
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
        <form onSubmit={submit} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1"></div>
          <button
            type="submit"
            className="btn btn-outline mt-0 sm:self-end"
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="card border border-base-300 bg-base-100 shadow-xs">
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr>
                  <th>Path</th>
                  <th>Messages</th>
                  <th>Unseen</th>
                  <th>Size</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {mailboxes.map(mailbox => (
                  <tr
                    key={mailbox.id}
                    onClick={() => setSelected(mailbox)}
                    className={`cursor-pointer transition ${selected?.id === mailbox.id ? 'bg-primary/10' : 'hover:bg-base-200'}`}
                  >
                    <td>
                      <div className="break-all font-medium">{mailbox.path}</div>
                      <div className="font-mono text-xs text-base-content/60">{mailbox.id}</div>
                    </td>
                    <td className="text-base-content/70">{mailbox.total ?? '-'}</td>
                    <td className="text-base-content/70">{mailbox.unseen ?? '-'}</td>
                    <td className="text-base-content/70">{formatBytes(mailbox.size)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {mailbox.specialUse ? (
                          <span className="badge badge-sm badge-soft badge-success">
                            {mailbox.specialUse}
                          </span>
                        ) : null}
                        {mailbox.hidden ? (
                          <span className="badge badge-sm badge-soft badge-warning">Hidden</span>
                        ) : null}
                        {mailbox.encryptMessages ? (
                          <span className="badge badge-sm badge-soft badge-ghost">Encrypted</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!mailboxes.length ? (
                  <tr>
                    <td className="text-center text-base-content/60" colSpan={5}>
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
