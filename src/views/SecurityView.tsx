import {
  CaretLeftIcon as ChevronLeft,
  CaretRightIcon as ChevronRight,
  CopyIcon as Copy,
  KeyIcon as KeyRound,
  SignOutIcon as LogOut,
  ArrowsClockwiseIcon as RefreshCw,
  ArrowCounterClockwiseIcon as RotateCcw,
  ShieldIcon as Shield
} from '@phosphor-icons/react';
import { FormEvent, useEffect, useState } from 'react';
import { getAuthLog, logoutUser, resetUserPassword, resetUserQuota } from '../api';
import type { AuthLogItem } from '../types';
import { CopyButton, formatBytes, formatDate } from './ui';

function resultTone(result?: string) {
  return result === 'success' ? 'success' : result ? 'danger' : 'muted';
}

export function SecurityView({ accountId }: { accountId: string }) {
  const [userId, setUserId] = useState(accountId);
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

  useEffect(() => {
    load({ user: accountId });
  }, [accountId]);

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
          <p className="text-sm text-base-content/60">
            {loadedUserId
              ? `${total} auth events for ${loadedUserId}`
              : 'User auth and access controls'}
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
        <form
          onSubmit={submit}
          noValidate
          className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px_auto] md:items-end"
        >
          <label className="fieldset min-w-0 py-0">
            <span className="fieldset-legend">Action filter</span>
            <input
              value={actionFilter}
              onChange={event => setActionFilter(event.target.value)}
              className="input w-full"
              placeholder="login"
            />
          </label>
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

      {!loadedUserId ? (
        <p className="text-sm text-base-content/60">
          Select an account above to view security details.
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="alert alert-error alert-soft">
          <span className="min-w-0 break-words">{error}</span>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="card border border-base-300 bg-base-100 p-4 shadow-xs">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">User actions</h3>
            </div>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() =>
                  runAction('password', async () => {
                    const response = await resetUserPassword(loadedUserId);
                    setTempPassword(response.password);
                  })
                }
                className="btn btn-primary"
                disabled={!loadedUserId || Boolean(busy) || busy === 'password'}
                aria-busy={Boolean(busy === 'password') || undefined}
              >
                {busy === 'password' ? (
                  <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                ) : null}
                <KeyRound className="h-4 w-4" />
                Reset password
              </button>
              <button
                type="button"
                onClick={() =>
                  runAction('quota', async () => {
                    const response = await resetUserQuota(loadedUserId);
                    setQuotaResult(
                      `${formatBytes(response.previousStorageUsed)} -> ${formatBytes(response.storageUsed)}`
                    );
                  })
                }
                className="btn btn-outline"
                disabled={!loadedUserId || Boolean(busy) || busy === 'quota'}
                aria-busy={Boolean(busy === 'quota') || undefined}
              >
                {busy === 'quota' ? (
                  <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                ) : null}
                <RotateCcw className="h-4 w-4" />
                Recalculate quota
              </button>
              <button
                type="button"
                onClick={() =>
                  runAction('logout', async () => {
                    await logoutUser(loadedUserId, 'Logged out by administrator');
                  })
                }
                className="btn btn-error btn-soft"
                disabled={!loadedUserId || Boolean(busy) || busy === 'logout'}
                aria-busy={Boolean(busy === 'logout') || undefined}
              >
                {busy === 'logout' ? (
                  <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                ) : null}
                <LogOut className="h-4 w-4" />
                Log out sessions
              </button>
            </div>
          </div>

          {tempPassword ? (
            <div className="alert alert-warning alert-soft block text-sm">
              <div className="mb-2 font-semibold">Temporary password</div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-base-100 px-3 py-2 text-xs">
                  {tempPassword}
                </code>
                <CopyButton value={tempPassword} title="Copy temporary password" />
              </div>
            </div>
          ) : null}

          {quotaResult ? (
            <div className="card border border-base-300 bg-base-100 p-4 text-sm shadow-xs">
              <div className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                Quota recalculated
              </div>
              <div className="mt-1 font-medium">{quotaResult}</div>
            </div>
          ) : null}
        </aside>

        <div className="card border border-base-300 bg-base-100 shadow-xs">
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Result</th>
                  <th>IP</th>
                  <th>Protocol</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map(event => (
                  <tr key={event.id}>
                    <td>
                      <div className="font-medium">{event.action || '-'}</div>
                      <div className="flex items-center gap-1 font-mono text-xs text-base-content/60">
                        <span className="break-all">{event.id}</span>
                        <Copy className="h-3 w-3" />
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge badge-sm badge-soft ${{ success: 'badge-success', warning: 'badge-warning', danger: 'badge-error', muted: 'badge-ghost' }[resultTone(event.result)]}`}
                      >
                        {event.result || '-'}
                      </span>
                    </td>
                    <td className="text-base-content/70">{event.ip || '-'}</td>
                    <td className="text-base-content/70">{event.protocol || '-'}</td>
                    <td className="text-base-content/70">{formatDate(event.created)}</td>
                  </tr>
                ))}
                {!events.length ? (
                  <tr>
                    <td className="text-center text-base-content/60" colSpan={5}>
                      No auth events loaded
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-base-300 px-4 py-3">
            <div className="text-sm text-base-content/60">{events.length} shown</div>
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
      </div>
    </section>
  );
}
