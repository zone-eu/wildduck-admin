import { FormEvent, useEffect, useRef, useState } from 'react';
import { Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import {
  deleteFilter,
  getAutoreply,
  getFilter,
  getFilters,
  getMailboxes,
  getUsers,
  saveAutoreply,
  saveFilter
} from '../api';
import type { AutoreplyInput, FilterInput, FilterItem, MailboxItem, UserListItem } from '../types';
import { Button, ConfirmDialog, ErrorNotice, Field, IconButton, StatusPill } from './ui';

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
const button =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50';
const panel = 'rounded-xl border border-line bg-white dark:bg-slate-900 p-5 shadow-xs';
const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Request failed');

export function MailRulesView() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [user, setUser] = useState<UserListItem | null>(null);
  const [tab, setTab] = useState<'filters' | 'autoreply'>('filters');
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let current = true;
    const timeout = setTimeout(() => {
      setSearching(true);
      getUsers({ query, limit: 25 })
        .then(response => {
          if (current) {
            setUsers(response.results || []);
            setError('');
          }
        })
        .catch(err => {
          if (current) {
            setError(errorMessage(err));
          }
        })
        .finally(() => {
          if (current) {
            setSearching(false);
          }
        });
    }, 250);
    return () => {
      current = false;
      clearTimeout(timeout);
    };
  }, [query]);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold">Mail rules</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Manage incoming mail filters and vacation replies for an account.
        </p>
      </div>
      <div className={`${panel} grid gap-4 sm:grid-cols-2`}>
        <Field label="Search accounts">
          <input
            className="input"
            placeholder="Username or email address"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </Field>
        <Field label="Account">
          <select
            className="input"
            value={user?.id || ''}
            onChange={event => setUser(users.find(item => item.id === event.target.value) || null)}
          >
            <option value="">{searching ? 'Searching…' : 'Select an account'}</option>
            {user && !users.some(item => item.id === user.id) ? (
              <option value={user.id}>
                {user.username} · {user.address}
              </option>
            ) : null}
            {users.map(item => (
              <option key={item.id} value={item.id}>
                {item.username} · {item.address}
              </option>
            ))}
          </select>
        </Field>
        <ErrorNotice message={error} />
      </div>
      <div className="flex gap-2" aria-label="Mail rule type">
        {(['filters', 'autoreply'] as const).map(item => (
          <Button
            key={item}
            type="button"
            aria-pressed={tab === item}
            onClick={() => setTab(item)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === item ? 'bg-brand-600 text-white' : 'border border-line bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'}`}
          >
            {item === 'filters' ? 'Incoming mail filters' : 'Vacation reply'}
          </Button>
        ))}
      </div>
      {!user ? (
        <div className={`${panel} py-12 text-center text-slate-500 dark:text-slate-400`}>
          Select an account to manage its mail rules.
        </div>
      ) : tab === 'filters' ? (
        <Filters key={user.id} userId={user.id} />
      ) : (
        <Autoreply key={user.id} userId={user.id} />
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
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let current = true;
    getAutoreply(userId)
      .then(data => {
        if (current) {
          setReply({ ...emptyReply, ...data });
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
    setSaved(false);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSaved(false);
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
      setSaved(true);
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
        <StatusPill
          tone={reply.status ? 'success' : 'muted'}
          label={reply.status ? 'Enabled' : 'Disabled'}
        />
      </div>
      <ErrorNotice message={error} />
      <fieldset disabled={!ready || busy} className="space-y-4 disabled:opacity-60">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="checkbox"
            checked={reply.status}
            onChange={event => update('status', event.target.checked)}
          />
          Enable automatic replies
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['name', 'subject'] as const).map(key => (
            <Field key={key} label={key}>
              <input
                className="input"
                maxLength={key === 'name' ? 128 : 2048}
                value={reply[key]}
                onChange={event => update(key, event.target.value)}
              />
            </Field>
          ))}
        </div>
        <Field label="Reply message">
          <textarea
            className="input h-auto min-h-36 py-3"
            value={reply.text}
            maxLength={128 * 1024}
            onChange={event => update('text', event.target.value)}
          />
        </Field>
        <details>
          <summary className="cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-300">
            HTML alternative
          </summary>
          <div className="mt-3">
            <Field label="HTML message">
              <textarea
                className="input h-auto min-h-28 py-3 font-mono"
                value={reply.html}
                maxLength={128 * 1024}
                onChange={event => update('html', event.target.value)}
              />
            </Field>
          </div>
        </details>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['start', 'end'] as const).map(key => (
            <Field key={key} label={`${key} (optional, local time)`}>
              <input
                type="datetime-local"
                className="input"
                value={localDate(reply[key])}
                onChange={event =>
                  update(
                    key,
                    event.target.value ? new Date(event.target.value).toISOString() : false
                  )
                }
              />
            </Field>
          ))}
        </div>
        <Button loading={busy} className={button} type="submit">
          <Save className="h-4 w-4" />
          {busy ? 'Saving…' : 'Save vacation reply'}
        </Button>
      </fieldset>
      {!ready && !error ? (
        <p role="status" className="text-sm text-slate-500 dark:text-slate-400">
          Loading vacation reply…
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
          Vacation reply saved.
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
      <ErrorNotice message={error} />
      {notice ? (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
          {notice}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {limits ? `${limits.used} / ${limits.allowed} filters used` : `${filters.length} filters`}
        </p>
        <div className="flex gap-2">
          <IconButton
            loading={loading}
            title="Refresh filters"
            onClick={load}
            disabled={loading || busy}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </IconButton>
          <Button
            className={button}
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
          </Button>
        </div>
      </div>
      <div className={`${panel} space-y-3`} aria-busy={loading}>
        {loading ? (
          <p role="status" className="text-sm text-slate-500 dark:text-slate-400">
            Loading filters…
          </p>
        ) : !filters.length ? (
          <p className="py-6 text-center text-slate-500 dark:text-slate-400">
            No incoming mail filters. Create a rule to sort or forward matching messages.
          </p>
        ) : (
          filters.map(item => (
            <div
              key={item.id}
              className={`flex items-start justify-between gap-3 rounded-lg border p-4 ${editing === item.id ? 'border-brand-500 bg-brand-50 dark:bg-teal-950' : 'border-line'}`}
            >
              <Button
                loading={selectingId === item.id}
                type="button"
                disabled={busy}
                onClick={() => edit(item)}
                className="!block min-w-0 flex-1 text-left"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{item.name || 'Unnamed filter'}</span>
                  <StatusPill
                    tone={item.disabled ? 'muted' : 'success'}
                    label={item.disabled ? 'Disabled' : 'Enabled'}
                  />
                </div>
                <p className="mt-2 break-words text-sm text-slate-500 dark:text-slate-400">
                  {item.query.map(parts => parts.join(': ')).join(' · ') || 'All incoming messages'}
                </p>
                <p className="mt-1 break-words text-sm text-slate-700 dark:text-slate-200">
                  {item.action.map(parts => parts.join(': ')).join(' · ') || 'No actions'}
                </p>
              </Button>
              <IconButton
                loading={busy && deleting?.id === item.id}
                title={`Delete ${item.name || 'filter'}`}
                onClick={() => setDeleting(item)}
                disabled={busy}
              >
                <Trash2 className="h-4 w-4 text-rose-600 dark:text-rose-300" />
              </IconButton>
            </div>
          ))
        )}
      </div>
      {draft ? (
        <form onSubmit={save} className={`${panel} space-y-4`}>
          <h3 className="font-semibold">{editing ? 'Edit filter' : 'Create filter'}</h3>
          <fieldset disabled={busy} className="space-y-4">
            <Field label="Rule name">
              <input
                className="input"
                required
                maxLength={255}
                value={draft.name || ''}
                onChange={event => setDraft({ ...draft, name: event.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="checkbox"
                checked={!draft.disabled}
                onChange={event => setDraft({ ...draft, disabled: !event.target.checked })}
              />
              Enabled
            </label>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Messages must match all conditions. Leaving every condition empty matches all incoming
              messages.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {(['from', 'to', 'subject', 'listId', 'text'] as const).map(key => (
                <Field key={key} label={key === 'listId' ? 'Mailing list ID' : key}>
                  <input
                    className="input"
                    maxLength={255}
                    value={draft.query[key] || ''}
                    onChange={event =>
                      setDraft({ ...draft, query: { ...draft.query, [key]: event.target.value } })
                    }
                  />
                </Field>
              ))}
              <Field label="Size in bytes (+ larger, − smaller)">
                <input
                  type="number"
                  className="input"
                  value={draft.query.size || ''}
                  onChange={event =>
                    setDraft({
                      ...draft,
                      query: { ...draft.query, size: Number(event.target.value) }
                    })
                  }
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(['seen', 'flag', 'spam', 'delete'] as const).map(key => (
                <Field
                  key={key}
                  label={
                    {
                      seen: 'Mark as read',
                      flag: 'Star message',
                      spam: 'Send to junk',
                      delete: 'Do not store message'
                    }[key]
                  }
                >
                  <select
                    className="input"
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
                </Field>
              ))}
            </div>
            <Field label="Deliver to mailbox">
              <select
                className="input"
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
            </Field>
            <Field label="Forward to (one email address or URL per line)">
              <textarea
                className="input h-auto min-h-24 py-3"
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
            </Field>
            <div className="flex gap-3">
              <Button loading={busy} className={button} type="submit">
                <Save className="h-4 w-4" />
                {busy ? 'Saving…' : 'Save filter'}
              </Button>
              <Button
                type="button"
                className="text-sm font-semibold text-slate-600 dark:text-slate-300"
                onClick={() => {
                  setDraft(null);
                  setEditing(undefined);
                }}
              >
                Cancel
              </Button>
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
