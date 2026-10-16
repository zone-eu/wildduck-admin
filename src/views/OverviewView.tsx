import {
  WarningCircleIcon as AlertCircle,
  ArrowRightIcon as ArrowRight,
  CheckCircleIcon as CheckCircle2,
  ProhibitIcon as CircleOff,
  KeyIcon as KeyRound,
  SpinnerGapIcon as LoaderCircle,
  ArrowsClockwiseIcon as RefreshCw,
  GearIcon as Settings,
  ShieldIcon as Shield,
  UserPlusIcon as UserPlus,
  UsersIcon as Users
} from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { getHealth, getUsers } from '../api';
import type { HealthResponse, SessionResponse } from '../types';

type CheckError = { message: string; status?: number };
function checkError(error: unknown): CheckError {
  if (error instanceof Error) {
    return { message: error.message, status: (error as Error & { status?: number }).status };
  }
  return { message: 'The check could not be completed.' };
}

function timeAgo(timestamp: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 5) {
    return 'just now';
  }
  if (seconds < 60) {
    return `${seconds} seconds ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  return new Date(timestamp).toLocaleString();
}

export function OverviewView({
  session,
  onCreateUser,
  onUsers,
  onDkim,
  onSettings
}: {
  session: SessionResponse;
  onCreateUser: () => void;
  onUsers: () => void;
  onDkim: () => void;
  onSettings: () => void;
}) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<CheckError | null>(null);
  const [healthChecked, setHealthChecked] = useState<number | null>(null);
  const [lastHealthSuccess, setLastHealthSuccess] = useState<number | null>(null);
  const [accountTotal, setAccountTotal] = useState<number | null>(null);
  const [accountError, setAccountError] = useState<CheckError | null>(null);
  const [accountsChecked, setAccountsChecked] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [now, setNow] = useState(Date.now());
  const request = useRef(0);

  async function refresh() {
    const generation = ++request.current;
    setRefreshing(true);
    await Promise.all([
      (async () => {
        try {
          const response = await getHealth();
          if (generation !== request.current) {
            return;
          }
          setHealth(response);
          setHealthError(null);
          setLastHealthSuccess(Date.now());
        } catch (err) {
          if (generation === request.current) {
            setHealthError(checkError(err));
          }
        } finally {
          if (generation === request.current) {
            setHealthChecked(Date.now());
          }
        }
      })(),
      (async () => {
        try {
          // Only the unfiltered total is used; no page/search state from Users enters this request.
          const response = await getUsers({ limit: 1 });
          if (!Number.isFinite(response.total) || response.total < 0) {
            throw new Error('WildDuck did not return a valid account total.');
          }
          if (generation !== request.current) {
            return;
          }
          setAccountTotal(response.total);
          setAccountError(null);
          setAccountsChecked(Date.now());
        } catch (err) {
          if (generation === request.current) {
            setAccountError(checkError(err));
          }
        }
      })()
    ]);
    if (generation === request.current) {
      setNow(Date.now());
      setRefreshing(false);
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      ++request.current;
      clearInterval(timer);
    };
  }, []);

  const issues: {
    id: string;
    title: string;
    detail: string;
    action?: string;
    onAction?: () => void;
  }[] = [];
  if (healthError) {
    const denied = healthError.status === 401 || healthError.status === 403;
    issues.push({
      id: 'health',
      title: denied ? 'API access denied' : 'API health check failed',
      detail: denied
        ? `${healthError.message}. Check the configured API token and its permissions.`
        : healthError.message,
      action: 'Retry',
      onAction: refresh
    });
  }
  if (accountError && accountError.message !== healthError?.message) {
    const denied = accountError.status === 401 || accountError.status === 403;
    issues.push({
      id: 'accounts',
      title: denied ? 'Account access denied' : 'Account count unavailable',
      detail: denied
        ? `${accountError.message}. Check the configured API token and its account-read permissions.`
        : accountError.message,
      action: 'Retry',
      onAction: refresh
    });
  }
  if (!session.twoFactor.methods.length) {
    const available = session.twoFactor.totpAllowed || session.twoFactor.webauthnAllowed;
    issues.push({
      id: '2fa',
      title: 'Administrator 2FA is not enabled',
      detail: available
        ? 'Add an authenticator app or passkey to protect your administrator account.'
        : 'Enable TOTP or WebAuthn in the administrator configuration to protect this account.',
      ...(available ? { action: 'Configure', onAction: onSettings } : {})
    });
  }

  const actions = [
    { title: 'Create user', detail: 'Add a mail account', icon: UserPlus, onClick: onCreateUser },
    {
      title: 'Manage accounts',
      detail: 'Users, addresses, and quotas',
      icon: Users,
      onClick: onUsers
    },
    {
      title: 'Manage DKIM',
      detail: 'Domain signing keys and DNS records',
      icon: KeyRound,
      onClick: onDkim
    },
    {
      title: 'Settings',
      detail: 'Administrator security and server settings',
      icon: Settings,
      onClick: onSettings
    }
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Overview</h2>
          <p className="text-sm text-base-content/60">
            Service access, account summary, and next steps
          </p>
        </div>
        <button
          title="Refresh overview"
          onClick={refresh}
          aria-label="Refresh overview"
          type="button"
          className="btn btn-square btn-sm btn-ghost"
          disabled={refreshing}
          aria-busy={Boolean(refreshing) || undefined}
        >
          {refreshing ? (
            <span aria-hidden="true" className="loading loading-spinner loading-xs" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2" aria-busy={refreshing}>
        <div className="stat min-w-0 rounded-box border border-base-300 bg-base-100 shadow-xs">
          <div className="stat-title flex items-center gap-2">
            {refreshing ? (
              <span aria-hidden="true" className="loading loading-spinner size-5" />
            ) : healthError ? (
              <CircleOff className="h-5 w-5 text-error" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-success" />
            )}
            API status
          </div>
          <div className="stat-value font-display text-2xl">
            {refreshing
              ? 'Checking…'
              : healthError
                ? 'Unavailable'
                : health
                  ? 'Online'
                  : 'Not checked'}
          </div>
          <p className="stat-desc whitespace-normal">
            {healthChecked ? `Checked ${timeAgo(healthChecked, now)}` : 'Checking the WildDuck API'}
          </p>
          {healthError && lastHealthSuccess ? (
            <p className="mt-1 text-xs text-base-content/60">
              Last successful check {timeAgo(lastHealthSuccess, now)}
            </p>
          ) : null}
          {!healthError && health?.version ? (
            <p className="mt-1 text-xs text-base-content/60">Version {health.version}</p>
          ) : null}
          <p className="mt-3 break-all text-xs text-base-content/60">{session.api.url}</p>
        </div>
        <div className="stat min-w-0 rounded-box border border-base-300 bg-base-100 shadow-xs">
          <div className="stat-title flex items-center gap-2">
            <Users className="h-5 w-5" />
            Total accounts
          </div>
          <div className="stat-value font-display text-2xl">
            {accountTotal !== null
              ? accountTotal.toLocaleString()
              : refreshing
                ? 'Checking…'
                : 'Unavailable'}
          </div>
          <p className="stat-desc whitespace-normal">
            {accountError && accountTotal !== null
              ? 'Last known total — refresh failed'
              : 'Across all mail accounts'}
          </p>
          {accountsChecked ? (
            <p className="mt-1 text-xs text-base-content/60">
              Updated {timeAgo(accountsChecked, now)}
            </p>
          ) : null}
          <button type="button" onClick={onUsers} className="btn btn-link mt-3 w-fit px-0">
            View accounts
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <section
        className="card border border-base-300 bg-base-100 shadow-xs"
        aria-labelledby="attention-heading"
      >
        <div className="border-b border-base-300 px-5 py-4">
          <h3 id="attention-heading" className="font-semibold">
            Needs attention
          </h3>
        </div>
        {issues.length ? (
          <ul className="divide-y divide-base-300">
            {issues.map(issue => (
              <li key={issue.id} className="flex flex-wrap items-start gap-3 p-5">
                {issue.id === '2fa' ? (
                  <Shield className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                ) : (
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-error" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{issue.title}</p>
                  <p className="mt-1 break-words text-sm text-base-content/60">{issue.detail}</p>
                </div>
                {issue.onAction ? (
                  <button
                    type="button"
                    onClick={issue.onAction}
                    className="btn btn-outline"
                    disabled={issue.id !== '2fa' && refreshing}
                    aria-busy={Boolean(issue.id !== '2fa' && refreshing) || undefined}
                  >
                    {issue.id !== '2fa' && refreshing ? (
                      <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                    ) : null}
                    {issue.action}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div role="status" className="flex items-center gap-2 p-5 text-sm text-base-content/60">
            {refreshing ? (
              <>
                <span aria-hidden="true" className="loading loading-spinner size-4" />
                Checking service and account access…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-success" />
                No issues detected by the latest checks.
              </>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="quick-actions-heading" className="space-y-3">
        <h3 id="quick-actions-heading" className="font-semibold">
          Quick actions
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {actions.map(action => (
            <button
              key={action.title}
              type="button"
              onClick={action.onClick}
              className="btn btn-outline text-left h-auto py-4 whitespace-normal justify-start"
            >
              <action.icon className="h-5 w-5 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{action.title}</span>
                <span className="mt-1 block text-xs text-base-content/60">{action.detail}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
