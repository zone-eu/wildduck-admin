import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleOff,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Settings,
  Shield,
  UserPlus,
  Users
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getHealth, getUsers } from '../api';
import type { HealthResponse, SessionResponse } from '../types';
import { Button, IconButton } from './ui';

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
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Service access, account summary, and next steps
          </p>
        </div>
        <IconButton title="Refresh overview" loading={refreshing} onClick={refresh}>
          <RefreshCw className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="grid gap-4 sm:grid-cols-2" aria-busy={refreshing}>
        <div className="rounded-xl border border-line bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            {refreshing ? (
              <LoaderCircle className="h-5 w-5 animate-spin" />
            ) : healthError ? (
              <CircleOff className="h-5 w-5 text-rose-600 dark:text-rose-300" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
            )}
            API status
          </div>
          <div className="font-display text-2xl font-semibold">
            {refreshing
              ? 'Checking…'
              : healthError
                ? 'Unavailable'
                : health
                  ? 'Online'
                  : 'Not checked'}
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {healthChecked ? `Checked ${timeAgo(healthChecked, now)}` : 'Checking the WildDuck API'}
          </p>
          {healthError && lastHealthSuccess ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Last successful check {timeAgo(lastHealthSuccess, now)}
            </p>
          ) : null}
          {!healthError && health?.version ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Version {health.version}
            </p>
          ) : null}
          <p className="mt-3 break-all text-xs text-slate-500 dark:text-slate-400">
            {session.api.url}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Users className="h-5 w-5" />
            Total accounts
          </div>
          <div className="font-display text-2xl font-semibold">
            {accountTotal !== null
              ? accountTotal.toLocaleString()
              : refreshing
                ? 'Checking…'
                : 'Unavailable'}
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {accountError && accountTotal !== null
              ? 'Last known total — refresh failed'
              : 'Across all mail accounts'}
          </p>
          {accountsChecked ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Updated {timeAgo(accountsChecked, now)}
            </p>
          ) : null}
          <Button
            type="button"
            onClick={onUsers}
            className="mt-3 text-sm font-semibold text-brand-700 dark:text-teal-300 hover:underline"
          >
            View accounts
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <section
        className="rounded-xl border border-line bg-white dark:bg-slate-900 shadow-xs"
        aria-labelledby="attention-heading"
      >
        <div className="border-b border-line px-5 py-4">
          <h3 id="attention-heading" className="font-semibold">
            Needs attention
          </h3>
        </div>
        {issues.length ? (
          <ul className="divide-y divide-line">
            {issues.map(issue => (
              <li key={issue.id} className="flex flex-wrap items-start gap-3 p-5">
                {issue.id === '2fa' ? (
                  <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
                ) : (
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{issue.title}</p>
                  <p className="mt-1 break-words text-sm text-slate-500 dark:text-slate-400">
                    {issue.detail}
                  </p>
                </div>
                {issue.onAction ? (
                  <Button
                    type="button"
                    loading={issue.id !== '2fa' && refreshing}
                    onClick={issue.onAction}
                    className="min-h-9 border border-line px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {issue.action}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div
            role="status"
            className="flex items-center gap-2 p-5 text-sm text-slate-500 dark:text-slate-400"
          >
            {refreshing ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Checking service and account access…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
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
            <Button
              key={action.title}
              type="button"
              align="start"
              onClick={action.onClick}
              className="gap-3 border border-line bg-white dark:bg-slate-900 p-4 text-left shadow-xs hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-teal-950"
            >
              <action.icon className="h-5 w-5 shrink-0 text-brand-600 dark:text-teal-300" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{action.title}</span>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                  {action.detail}
                </span>
              </span>
            </Button>
          ))}
        </div>
      </section>
    </section>
  );
}
