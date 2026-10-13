import {
  ChevronLeft,
  ChevronRight,
  Copy,
  KeyRound,
  LogOut,
  RefreshCw,
  RotateCcw,
  Shield
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { getAuthLog, logoutUser, resetUserPassword, resetUserQuota } from '../api';
import type { AuthLogItem } from '../types';
import {
  Button,
  CopyButton,
  ErrorNotice,
  Field,
  IconButton,
  StatusPill,
  formatBytes,
  formatDate
} from './ui';

function resultTone(result?: string) {
  return result === 'success' ? 'success' : result ? 'danger' : 'muted';
}

export function SecurityView({ initialUserId = '' }: { initialUserId?: string }) {
  const [userId, setUserId] = useState(initialUserId);
  const [loadedUserId, setLoadedUserId] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [events, setEvents] = useState<AuthLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | false>();
  const [previousCursor, setPreviousCursor] = useState<string | false>();
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [quotaResult, setQuotaResult] = useState('');

  async function load(
    options: { next?: string; previous?: string; action?: string; user?: string } = {}
  ) {
    const id = (options.user ?? (loadedUserId || userId)).trim();
    const action = options.action ?? actionFilter;
    setError('');
    if (!id) {
      setError('User ID is required');
      return;
    }

    setLoading(true);
    try {
      const response = await getAuthLog(id, {
        action,
        next: options.next,
        previous: options.previous,
        limit: 25
      });
      setEvents(response.results || []);
      setTotal(response.total || 0);
      setNextCursor(response.nextCursor);
      setPreviousCursor(response.previousCursor);
      if (id !== loadedUserId) {
        setTempPassword('');
        setQuotaResult('');
      }
      setLoadedUserId(id);
      setUserId(id);
      setActionFilter(action);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load auth log');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialUserId) {
      load({ user: initialUserId });
    }
  }, [initialUserId]);

  function submit(event: FormEvent) {
    event.preventDefault();
    load({ user: userId, action: actionFilter });
  }

  async function runAction(name: string, action: () => Promise<void>) {
    setBusy(name);
    setError('');
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Security</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loadedUserId
              ? `${total} auth events for ${loadedUserId}`
              : 'User auth and access controls'}
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
        <form
          onSubmit={submit}
          noValidate
          className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px_auto]"
        >
          <Field label="User ID">
            <input
              value={userId}
              onChange={event => setUserId(event.target.value)}
              className="input"
              placeholder="Paste a user ID from Users"
            />
          </Field>
          <Field label="Action filter">
            <input
              value={actionFilter}
              onChange={event => setActionFilter(event.target.value)}
              className="input"
              placeholder="login"
            />
          </Field>
          <Button
            loading={loading}
            type="submit"
            disabled={loading}
            className="mt-0 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white dark:bg-slate-900 px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:border-brand-500 hover:text-brand-700 dark:hover:text-teal-300 disabled:cursor-not-allowed disabled:opacity-60 md:mt-5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Load
          </Button>
        </form>
      </div>

      {!loadedUserId ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Copy an ID from Users, or choose “Open security log” in the account details.
        </p>
      ) : null}
      <ErrorNotice message={error} />

      <div className="grid gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-lg border border-line bg-white dark:bg-slate-900 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-brand-600 dark:text-teal-300" />
              <h3 className="font-semibold">User actions</h3>
            </div>
            <div className="grid gap-2">
              <Button
                loading={busy === 'password'}
                type="button"
                disabled={!loadedUserId || Boolean(busy)}
                onClick={() =>
                  runAction('password', async () => {
                    const response = await resetUserPassword(loadedUserId);
                    setTempPassword(response.password);
                  })
                }
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <KeyRound className="h-4 w-4" />
                Reset password
              </Button>
              <Button
                loading={busy === 'quota'}
                type="button"
                disabled={!loadedUserId || Boolean(busy)}
                onClick={() =>
                  runAction('quota', async () => {
                    const response = await resetUserQuota(loadedUserId);
                    setQuotaResult(
                      `${formatBytes(response.previousStorageUsed)} -> ${formatBytes(response.storageUsed)}`
                    );
                  })
                }
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-line bg-white dark:bg-slate-900 px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:border-brand-500 hover:text-brand-700 dark:hover:text-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RotateCcw className="h-4 w-4" />
                Recalculate quota
              </Button>
              <Button
                danger
                loading={busy === 'logout'}
                type="button"
                disabled={!loadedUserId || Boolean(busy)}
                onClick={() =>
                  runAction('logout', async () => {
                    await logoutUser(loadedUserId, 'Logged out by administrator');
                  })
                }
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-line bg-white dark:bg-slate-900 px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:border-brand-500 hover:text-brand-700 dark:hover:text-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                Log out sessions
              </Button>
            </div>
          </div>

          {tempPassword ? (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-4 text-sm text-amber-900 dark:text-amber-200 shadow-sm">
              <div className="mb-2 font-semibold">Temporary password</div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-white dark:bg-slate-900 px-3 py-2 text-xs">
                  {tempPassword}
                </code>
                <CopyButton value={tempPassword} title="Copy temporary password" />
              </div>
            </div>
          ) : null}

          {quotaResult ? (
            <div className="rounded-lg border border-line bg-white dark:bg-slate-900 p-4 text-sm shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Quota recalculated
              </div>
              <div className="mt-1 font-medium">{quotaResult}</div>
            </div>
          ) : null}
        </aside>

        <div className="rounded-lg border border-line bg-white dark:bg-slate-900 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Protocol</th>
                  <th className="px-4 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {events.map(event => (
                  <tr key={event.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{event.action || '-'}</div>
                      <div className="flex items-center gap-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                        <span className="break-all">{event.id}</span>
                        <Copy className="h-3 w-3" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill label={event.result || '-'} tone={resultTone(event.result)} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {event.ip || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {event.protocol || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatDate(event.created)}
                    </td>
                  </tr>
                ))}
                {!events.length ? (
                  <tr>
                    <td
                      className="px-4 py-10 text-center text-slate-500 dark:text-slate-400"
                      colSpan={5}
                    >
                      No auth events loaded
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line px-4 py-3">
            <div className="text-sm text-slate-500 dark:text-slate-400">{events.length} shown</div>
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
      </div>
    </section>
  );
}
