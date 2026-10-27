import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  PlusIcon as Plus,
  ArrowsClockwiseIcon as RefreshCw,
  FloppyDiskIcon as Save,
  TrashIcon as Trash2
} from '@phosphor-icons/react';
import {
  deleteFilter,
  getAutoreply,
  getFilter,
  getFilters,
  getMailboxes,
  saveAutoreply,
  saveFilter
} from '../api';
import type { AutoreplyInput, FilterInput, FilterItem, MailboxItem } from '../types';
import { ConfirmDialog } from './ui';

const emptyReply: AutoreplyInput = {
  status: false,
  name: '',
  subject: '',
  text: '',
  html: '',
  start: false,
  end: false
};
const emptyFilter = (): FilterInput => ({ name: '', disabled: false, query: {}, action: {} });
const panel = 'card border border-base-300 bg-base-100 p-5 shadow-xs';
const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Request failed');

export function MailRulesView({ accountId }: { accountId: string }) {
  const [tab, setTab] = useState<'filters' | 'autoreply'>('filters');
  return (
    <section className="space-y-5">
      <h2 className="font-display text-2xl font-semibold">Mail rules</h2>
      <div className="tabs tabs-box">
        {(['filters', 'autoreply'] as const).map(item => (
          <button
            key={item}
            className={`tab ${tab === item ? 'tab-active' : ''}`}
            onClick={() => setTab(item)}
          >
            {item === 'filters' ? 'Incoming mail filters' : 'Vacation reply'}
          </button>
        ))}
      </div>
      {tab === 'filters' ? (
        <Filters key={accountId} userId={accountId} />
      ) : (
        <Autoreply key={accountId} userId={accountId} />
      )}
    </section>
  );
}

function localDate(value: string | false | undefined) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function Autoreply({ userId }: { userId: string }) {
  const [reply, setReply] = useState<AutoreplyInput>(emptyReply);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedReply, setSavedReply] = useState<AutoreplyInput | null>(null);
  useEffect(() => {
    let current = true;
    getAutoreply(userId)
      .then(data => {
        if (current) {
          const loaded = { ...emptyReply, ...data };
          setReply(loaded);
          setSavedReply(loaded);
          setReady(true);
        }
      })
      .catch(err => {
        if (current) {
          setError(errorMessage(err));
        }
      });
    return () => {
      current = false;
    };
  }, [userId]);
  function update<K extends keyof AutoreplyInput>(key: K, value: AutoreplyInput[K]) {
    setReply(current => ({ ...current, [key]: value }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (reply.status && !reply.text.trim() && !reply.html.trim()) {
      setError('Enter a reply message before enabling vacation replies.');
      return;
    }
    if (reply.start && reply.end && new Date(reply.start) >= new Date(reply.end)) {
      setError('End must be after start.');
      return;
    }
    setBusy(true);
    try {
      await saveAutoreply(userId, reply);
      setSavedReply({ ...reply });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={`${panel} space-y-4`} onSubmit={submit}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">Vacation reply</h3>
        <span
          className={`badge badge-sm badge-soft ${reply.status ? 'badge-success' : 'badge-ghost'}`}
        >
          {reply.status ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      {error ? (
        <div role="alert" className="alert alert-error alert-soft">
          <span className="min-w-0 break-words">{error}</span>
        </div>
      ) : null}
      {ready ? (
        <div
          className="rounded-lg border border-base-300 bg-base-200 p-4"
          aria-label="Vacation reply preview"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Reply preview</span>
            <span
              className={`badge badge-sm badge-soft ${reply.status ? 'badge-success' : 'badge-ghost'}`}
            >
              {reply.status ? 'Automatic replies enabled' : 'Automatic replies disabled'}
            </span>
            {savedReply && JSON.stringify(reply) !== JSON.stringify(savedReply) ? (
              <span className="badge badge-sm badge-warning badge-soft">Unsaved changes</span>
            ) : null}
          </div>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-base-content/60">From</dt>
              <dd className="break-words">{reply.name || 'Account name'}</dd>
            </div>
            <div>
              <dt className="text-base-content/60">Subject</dt>
              <dd className="break-words">{reply.subject || '(no subject)'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-base-content/60">Schedule</dt>
              <dd>
                {reply.start || reply.end
                  ? `${reply.start ? `Starts ${new Date(reply.start).toLocaleString()}` : 'No start date'}${reply.end ? ` · Ends ${new Date(reply.end).toLocaleString()}` : ''}`
                  : 'No start or end date'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-base-content/60">Message</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words">
                {reply.text || (reply.html ? 'HTML message is set.' : 'No message entered yet.')}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
      <fieldset disabled={!ready || busy} className="space-y-4 disabled:opacity-60">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="checkbox checkbox-primary checkbox-sm"
            checked={reply.status}
            onChange={event => update('status', event.target.checked)}
          />
          Enable automatic replies
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['name', 'subject'] as const).map(key => (
            <label key={key} className="fieldset min-w-0">
              <span className="fieldset-legend">{key}</span>
              <input
                className="input w-full"
                maxLength={key === 'name' ? 128 : 2048}
                value={reply[key]}
                onChange={event => update(key, event.target.value)}
              />
            </label>
          ))}
        </div>
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">Reply message</span>
          <textarea
            className="textarea w-full h-auto min-h-36"
            value={reply.text}
            maxLength={128 * 1024}
            onChange={event => update('text', event.target.value)}
          />
        </label>
        <details className="collapse collapse-arrow border border-base-300">
          <summary className="collapse-title text-sm font-medium">HTML alternative</summary>
          <div className="collapse-content">
            <label className="fieldset min-w-0">
              <span className="fieldset-legend">HTML message</span>
              <textarea
                className="textarea w-full h-auto min-h-28 font-mono"
                value={reply.html}
                maxLength={128 * 1024}
                onChange={event => update('html', event.target.value)}
              />
            </label>
          </div>
        </details>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['start', 'end'] as const).map(key => (
            <label key={key} className="fieldset min-w-0">
              <span className="fieldset-legend">{`${key} (optional, local time)`}</span>
              <input
                type="datetime-local"
                className="input w-full"
                value={localDate(reply[key])}
                onChange={event =>
                  update(
                    key,
                    event.target.value ? new Date(event.target.value).toISOString() : false
                  )
                }
              />
            </label>
          ))}
        </div>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={busy}
          aria-busy={Boolean(busy) || undefined}
        >
          {busy ? <span aria-hidden="true" className="loading loading-spinner loading-xs" /> : null}
          <Save className="h-4 w-4" />
          {busy ? 'Saving…' : 'Save vacation reply'}
        </button>
      </fieldset>
      {!ready && !error ? (
        <p role="status" className="text-sm text-base-content/60">
          Loading vacation reply…
        </p>
      ) : null}
    </form>
  );
}

function Filters({ userId }: { userId: string }) {
  const [filters, setFilters] = useState<FilterItem[]>([]);
  const [limits, setLimits] = useState<{ used: number; allowed: number }>();
  const [mailboxes, setMailboxes] = useState<MailboxItem[]>([]);
  const [draft, setDraft] = useState<FilterInput | null>(null);
  const [editing, setEditing] = useState<string>();
  const [deleting, setDeleting] = useState<FilterItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selection = useRef(0);
  const [selectingId, setSelectingId] = useState('');
  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await getFilters(userId);
      setFilters(data.results);
      setLimits(data.limits);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    getMailboxes(userId)
      .then(data => setMailboxes(data.results || []))
      .catch(err => setError(errorMessage(err)));
  }, [userId]);
  async function edit(item: FilterItem) {
    const request = ++selection.current;
    setBusy(true);
    setSelectingId(item.id);
    setError('');
    setNotice('');
    try {
      const detail = await getFilter(userId, item.id);
      if (request === selection.current) {
        setEditing(item.id);
        setDraft(detail);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      if (request === selection.current) {
        setBusy(false);
        setSelectingId('');
      }
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) {
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await saveFilter(
        userId,
        {
          ...draft,
          action: {
            ...draft.action,
            ...(draft.action.targets
              ? { targets: draft.action.targets.map(value => value.trim()).filter(Boolean) }
              : {})
          }
        },
        editing
      );
      setDraft(null);
      setEditing(undefined);
      setNotice('Filter saved.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await deleteFilter(userId, deleting.id);
      if (editing === deleting.id) {
        setDraft(null);
        setEditing(undefined);
      }
      setDeleting(null);
      setNotice('Filter deleted.');
      await load();
    } catch (err) {
      setDeleting(null);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      {error ? (
        <div role="alert" className="alert alert-error alert-soft">
          <span className="min-w-0 break-words">{error}</span>
        </div>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-success">
          {notice}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-base-content/60">
          {limits ? `${limits.used} / ${limits.allowed} filters used` : `${filters.length} filters`}
        </p>
        <div className="flex gap-2">
          <button
            title="Refresh filters"
            onClick={load}
            aria-label="Refresh filters"
            type="button"
            className="btn btn-square btn-sm btn-ghost"
            disabled={loading || busy || loading}
            aria-busy={Boolean(loading) || undefined}
          >
            {loading ? (
              <span aria-hidden="true" className="loading loading-spinner loading-xs" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy || loading}
            onClick={() => {
              ++selection.current;
              setEditing(undefined);
              setDraft(emptyFilter());
              setNotice('');
            }}
          >
            <Plus className="h-4 w-4" />
            New filter
          </button>
        </div>
      </div>
      <div className={`${panel} space-y-3`} aria-busy={loading}>
        {loading ? (
          <p role="status" className="text-sm text-base-content/60">
            Loading filters…
          </p>
        ) : !filters.length ? (
          <p className="py-6 text-center text-base-content/60">
            No incoming mail filters. Create a rule to sort or forward matching messages.
          </p>
        ) : (
          filters.map(item => (
            <div
              key={item.id}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-lg border-2 p-4 ${editing === item.id ? 'border-primary bg-primary/10' : 'border-base-300'}`}
            >
              <button
                type="button"
                onClick={() => edit(item)}
                className="block min-w-0 w-full cursor-pointer rounded-md p-2 text-left whitespace-normal [overflow-wrap:anywhere] transition-colors hover:bg-base-200 disabled:cursor-wait disabled:opacity-60"
                disabled={busy || selectingId === item.id}
                aria-busy={Boolean(selectingId === item.id) || undefined}
              >
                {selectingId === item.id ? (
                  <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                ) : null}
                <span className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 font-semibold">{item.name || 'Unnamed filter'}</span>
                  <span
                    className={`badge badge-sm badge-soft shrink-0 ${item.disabled ? 'badge-ghost' : 'badge-success'}`}
                  >
                    {item.disabled ? 'Disabled' : 'Enabled'}
                  </span>
                </span>
                <span className="mt-2 block text-sm text-base-content/60">
                  {item.query.map(parts => parts.join(': ')).join(' · ') || 'All incoming messages'}
                </span>
                <span className="mt-1 block text-sm text-base-content/80">
                  {item.action.map(parts => parts.join(': ')).join(' · ') || 'No actions'}
                </span>
              </button>
              <button
                title={`Delete ${item.name || 'filter'}`}
                onClick={() => setDeleting(item)}
                aria-label={`Delete ${item.name || 'filter'}`}
                type="button"
                className="btn btn-square btn-sm btn-error btn-soft"
                disabled={busy || (busy && deleting?.id === item.id)}
                aria-busy={Boolean(busy && deleting?.id === item.id) || undefined}
              >
                {busy && deleting?.id === item.id ? (
                  <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                ) : (
                  <Trash2 className="h-4 w-4 text-error" />
                )}
              </button>
            </div>
          ))
        )}
      </div>
      {draft ? (
        <form onSubmit={save} className={`${panel} space-y-4`}>
          <h3 className="font-semibold">{editing ? 'Edit filter' : 'Create filter'}</h3>
          <fieldset disabled={busy} className="space-y-4">
            <label className="fieldset min-w-0">
              <span className="fieldset-legend">Rule name</span>
              <input
                className="input w-full"
                required
                maxLength={255}
                value={draft.name || ''}
                onChange={event => setDraft({ ...draft, name: event.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="checkbox checkbox-primary checkbox-sm"
                checked={!draft.disabled}
                onChange={event => setDraft({ ...draft, disabled: !event.target.checked })}
              />
              Enabled
            </label>
            <p className="text-sm text-base-content/60">
              Messages must match all conditions. Leaving every condition empty matches all incoming
              messages.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {(['from', 'to', 'subject', 'listId', 'text'] as const).map(key => (
                <label key={key} className="fieldset min-w-0">
                  <span className="fieldset-legend">
                    {key === 'listId' ? 'Mailing list ID' : key}
                  </span>
                  <input
                    className="input w-full"
                    maxLength={255}
                    value={draft.query[key] || ''}
                    onChange={event =>
                      setDraft({ ...draft, query: { ...draft.query, [key]: event.target.value } })
                    }
                  />
                </label>
              ))}
              <label className="fieldset min-w-0">
                <span className="fieldset-legend">Size in bytes (+ larger, − smaller)</span>
                <input
                  type="number"
                  className="input w-full"
                  value={draft.query.size || ''}
                  onChange={event =>
                    setDraft({
                      ...draft,
                      query: { ...draft.query, size: Number(event.target.value) }
                    })
                  }
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(['seen', 'flag', 'spam', 'delete'] as const).map(key => (
                <label key={key} className="fieldset min-w-0">
                  <span className="fieldset-legend">
                    {
                      {
                        seen: 'Mark as read',
                        flag: 'Star message',
                        spam: 'Send to junk',
                        delete: 'Do not store message'
                      }[key]
                    }
                  </span>
                  <select
                    className="select w-full"
                    value={draft.action[key] == null ? '' : String(draft.action[key])}
                    onChange={event =>
                      setDraft({
                        ...draft,
                        action: {
                          ...draft.action,
                          [key]: event.target.value === '' ? null : event.target.value === 'true'
                        }
                      })
                    }
                  >
                    <option value="">No action</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </label>
              ))}
            </div>
            <label className="fieldset min-w-0">
              <span className="fieldset-legend">Deliver to mailbox</span>
              <select
                className="select w-full"
                value={draft.action.mailbox || ''}
                onChange={event =>
                  setDraft({ ...draft, action: { ...draft.action, mailbox: event.target.value } })
                }
              >
                <option value="">Default delivery</option>
                {draft.action.mailbox &&
                !mailboxes.some(item => item.id === draft.action.mailbox) ? (
                  <option value={draft.action.mailbox}>Current mailbox</option>
                ) : null}
                {mailboxes.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.path}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldset min-w-0">
              <span className="fieldset-legend">
                Forward to (one email address or URL per line)
              </span>
              <textarea
                className="textarea w-full h-auto min-h-24"
                value={(draft.action.targets || []).join('\n')}
                onChange={event =>
                  setDraft({
                    ...draft,
                    action: { ...draft.action, targets: event.target.value.split('\n') }
                  })
                }
                onBlur={() =>
                  setDraft({
                    ...draft,
                    action: {
                      ...draft.action,
                      targets: draft.action.targets?.map(value => value.trim()).filter(Boolean)
                    }
                  })
                }
              />
            </label>
            <div className="flex gap-3">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={busy}
                aria-busy={Boolean(busy) || undefined}
              >
                {busy ? (
                  <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                ) : null}
                <Save className="h-4 w-4" />
                {busy ? 'Saving…' : 'Save filter'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setDraft(null);
                  setEditing(undefined);
                }}
              >
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete filter?"
        message={`Delete ${deleting?.name || 'this filter'}? Incoming messages will no longer use this rule.`}
        confirmLabel="Delete filter"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
