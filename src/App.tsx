import {
  Activity,
  AlertCircle,
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  KeyRound,
  LoaderCircle,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Server,
  Settings,
  Shield,
  Trash2,
  UserPlus,
  Users,
  Webhook
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  createAddress,
  createDkimKey,
  createUser,
  deleteAddress,
  deleteDkimKey,
  deleteUser,
  getAddresses,
  getDkimKey,
  getDkimKeys,
  getSession,
  getSettings,
  getUser,
  getUsers,
  login,
  logout,
  updateAddress,
  updateUser,
  updateSetting
} from './api';
import type {
  AddressItem,
  DkimCreateInput,
  DkimKey,
  SessionResponse,
  SettingItem,
  UserDetails,
  UserListItem,
  UserUpdateInput
} from './types';
import { AdminSecuritySettings, AdminTwoFactorGate } from './views/AdminTwoFactorView';
import { CertsView } from './views/CertsView';
import { DomainAccessView } from './views/DomainAccessView';
import { DomainAliasesView } from './views/DomainAliasesView';
import { OverviewView } from './views/OverviewView';
import { MailRulesView } from './views/MailRulesView';
import { MailboxesView } from './views/MailboxesView';
import { SecurityView } from './views/SecurityView';
import { StorageView } from './views/StorageView';
import { WebhooksView } from './views/WebhooksView';
import { Button, ConfirmDialog, CopyButton, Field, IconButton, StatusPill } from './views/ui';
import { ThemeToggle } from './views/ThemeToggle';

type View =
  | 'overview'
  | 'users'
  | 'mailrules'
  | 'mailboxes'
  | 'security'
  | 'dkim'
  | 'domainaccess'
  | 'domainaliases'
  | 'certs'
  | 'storage'
  | 'webhooks'
  | 'settings';

const quotaChoices = [
  { label: 'Default', value: 0 },
  { label: '1 GB', value: 1024 ** 3 },
  { label: '5 GB', value: 5 * 1024 ** 3 },
  { label: '10 GB', value: 10 * 1024 ** 3 }
];

function formatBytes(value?: number) {
  if (!value) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount >= 10 || unit === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unit]}`;
}

function userStatus(user?: UserListItem | UserDetails): {
  label: string;
  tone: 'muted' | 'danger' | 'warning' | 'success';
} {
  if (!user) {
    return { label: 'Unknown', tone: 'muted' };
  }
  if (user.disabled) {
    return { label: 'Disabled', tone: 'danger' };
  }
  if (user.suspended) {
    return { label: 'Suspended', tone: 'warning' };
  }
  if (user.activated === false) {
    return { label: 'Inactive', tone: 'warning' };
  }
  return { label: 'Active', tone: 'success' };
}

function LoginScreen({ onLogin }: { onLogin: (session: SessionResponse) => void }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Username and password are required');
      return;
    }

    setBusy(true);

    try {
      onLogin(await login(username, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center bg-mist px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-lg border border-line bg-white dark:bg-slate-900 p-6 shadow-panel">
        <div className="mb-6 flex items-center gap-3">
          <img
            src="/duck.png"
            alt=""
            className="h-11 w-11 rounded-lg bg-brand-50 dark:bg-teal-950 p-1"
          />
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">WildDuck Admin</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Configured administrator</p>
          </div>
        </div>

        <form onSubmit={submit} noValidate className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Username
            </span>
            <input
              value={username}
              onChange={event => setUsername(event.target.value)}
              className="h-10 w-full rounded-lg border border-line px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-teal-900"
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Password
            </span>
            <input
              value={password}
              onChange={event => setPassword(event.target.value)}
              type="password"
              className="h-10 w-full rounded-lg border border-line px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-teal-900"
              autoComplete="current-password"
            />
          </label>
          {error ? (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : null}
          <Button
            loading={busy}
            type="submit"
            disabled={busy}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Shield className="h-4 w-4" />
            Sign in
          </Button>
        </form>
      </div>
    </main>
  );
}

function Shell({
  session,
  view,
  onView,
  onLogout,
  children
}: {
  session: SessionResponse;
  view: View;
  onView: (view: View) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const nav = [
    { id: 'overview' as const, label: 'Overview', icon: Activity },
    { id: 'users' as const, label: 'Users', icon: Users },
    { id: 'mailrules' as const, label: 'Mail rules', icon: Mail },
    { id: 'mailboxes' as const, label: 'Mailboxes', icon: Archive },
    { id: 'security' as const, label: 'Security', icon: Shield },
    { id: 'dkim' as const, label: 'DKIM', icon: KeyRound },
    { id: 'domainaccess' as const, label: 'Domain Access', icon: Shield },
    { id: 'domainaliases' as const, label: 'Aliases', icon: Mail },
    { id: 'certs' as const, label: 'Certs', icon: Server },
    { id: 'storage' as const, label: 'Storage', icon: HardDrive },
    { id: 'webhooks' as const, label: 'Webhooks', icon: Webhook },
    { id: 'settings' as const, label: 'Settings', icon: Settings }
  ];

  const groups = [
    {
      label: 'Accounts',
      ids: ['overview', 'users', 'mailboxes', 'mailrules', 'security', 'storage']
    },
    { label: 'Domains', ids: ['dkim', 'domainaccess', 'domainaliases', 'certs'] },
    { label: 'System', ids: ['webhooks', 'settings'] }
  ];
  function navigation(ids: string[]) {
    return nav
      .filter(item => ids.includes(item.id))
      .map(item => {
        const Icon = item.icon;
        return (
          <Button
            align="start"
            key={item.id}
            type="button"
            aria-current={view === item.id ? 'page' : undefined}
            onClick={() => onView(item.id)}
            className={`inline-flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition lg:w-full ${view === item.id ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-teal-950 hover:text-brand-700 dark:hover:text-teal-300'}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Button>
        );
      });
  }
  return (
    <div className="min-h-screen bg-mist text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white dark:focus:bg-slate-900 focus:p-3"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 dark:bg-slate-900/95 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/duck.png"
              alt=""
              className="h-10 w-10 rounded-xl bg-brand-50 dark:bg-teal-950 p-1"
            />
            <div className="min-w-0">
              <div className="truncate font-display text-base font-semibold">
                {session.service?.name || 'WildDuck Admin'}
              </div>
              <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                Mail administration
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="hidden text-sm text-slate-500 dark:text-slate-400 sm:inline">
              {session.user}
            </span>
            <StatusPill
              label={session.api?.tokenConfigured ? 'API configured' : 'No API token'}
              tone={session.api?.tokenConfigured ? 'success' : 'warning'}
            />
            <IconButton title="Sign out" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
        <nav
          aria-label="Main navigation"
          className="flex gap-1 overflow-x-auto px-4 pb-3 lg:hidden"
        >
          {navigation(nav.map(item => item.id))}
        </nav>
      </header>
      <div className="flex">
        <aside className="sticky top-[65px] hidden h-[calc(100dvh-65px)] w-56 shrink-0 flex-col justify-between overflow-y-auto border-r border-line bg-white dark:bg-slate-900 p-4 lg:flex">
          <nav aria-label="Main navigation" className="space-y-6">
            {groups.map(group => (
              <div key={group.label}>
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {group.label}
                </p>
                <div className="space-y-1">{navigation(group.ids)}</div>
              </div>
            ))}
          </nav>
          <div className="mt-8 border-t border-line px-3 pt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">WildDuck API</p>
            <p title={session.api?.url} className="mt-1 break-all text-xs text-slate-400">
              {session.api?.url}
            </p>
          </div>
        </aside>
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

function UsersView({
  users,
  total,
  selectedUser,
  addresses,
  nextCursor,
  previousCursor,
  loading,
  selectingId,
  initialQuery,
  showCreate,
  onCreateToggle,
  onSearch,
  onNext,
  onPrevious,
  onRefresh,
  onSelect,
  onCreated,
  onChanged,
  onDeleted,
  onAddressCreated,
  onSecurity
}: {
  users: UserListItem[];
  total: number;
  selectedUser: UserDetails | null;
  addresses: AddressItem[];
  nextCursor?: string | false;
  previousCursor?: string | false;
  loading: boolean;
  selectingId: string;
  initialQuery: string;
  showCreate: boolean;
  onCreateToggle: (open: boolean) => void;
  onSearch: (query: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onRefresh: () => void;
  onSelect: (user: UserListItem) => void;
  onCreated: (id: string) => void;
  onChanged: () => void;
  onDeleted: (user: UserDetails) => void;
  onAddressCreated: () => void;
  onSecurity: (id: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    onSearch(query);
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Users</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{total} accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <IconButton loading={loading} title="Refresh" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </IconButton>
          <Button
            type="button"
            onClick={() => onCreateToggle(!showCreate)}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            <UserPlus className="h-4 w-4" />
            New user
          </Button>
        </div>
      </div>

      {showCreate ? <CreateUserForm onCreated={onCreated} /> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="rounded-lg border border-line bg-white dark:bg-slate-900 shadow-sm">
          <div className="border-b border-line p-4">
            <form onSubmit={submitSearch} className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Username or address"
                  className="h-10 w-full rounded-lg border border-line pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-teal-900"
                />
              </div>
              <Button
                loading={loading}
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white dark:bg-slate-900 px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:border-brand-500 hover:text-brand-700 dark:hover:text-teal-300"
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
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Quota</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map(user => {
                  const status = userStatus(user);
                  const active = selectedUser?.id === user.id;
                  return (
                    <tr
                      key={user.id}
                      onClick={() => onSelect(user)}
                      className={`cursor-pointer transition ${active ? 'bg-brand-50 dark:bg-teal-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                      <td className="px-4 py-3">
                        <Button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            onSelect(user);
                          }}
                          className="font-semibold hover:text-brand-700 dark:hover:text-teal-300"
                        >
                          {selectingId === user.id ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : null}
                          {user.username}
                        </Button>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {user.name || '-'}
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <code className="select-all text-[11px] text-slate-500 dark:text-slate-400">
                            {user.id}
                          </code>
                          <CopyButton value={user.id} title={`Copy ${user.username} user ID`} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {user.address || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {formatBytes(user.quota?.used)} / {formatBytes(user.quota?.allowed)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill label={status.label} tone={status.tone} />
                      </td>
                    </tr>
                  );
                })}
                {!users.length ? (
                  <tr>
                    <td
                      className="px-4 py-10 text-center text-slate-500 dark:text-slate-400"
                      colSpan={4}
                    >
                      {loading ? (
                        <span role="status" className="inline-flex items-center gap-2">
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          Loading users…
                        </span>
                      ) : (
                        'No users found'
                      )}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-line px-4 py-3">
            <div className="text-sm text-slate-500 dark:text-slate-400">{users.length} shown</div>
            <div className="flex gap-2">
              <IconButton
                loading={loading}
                title="Previous page"
                onClick={onPrevious}
                disabled={!previousCursor}
              >
                <ChevronLeft className="h-4 w-4" />
              </IconButton>
              <IconButton
                loading={loading}
                title="Next page"
                onClick={onNext}
                disabled={!nextCursor}
              >
                <ChevronRight className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        </div>

        {selectingId ? (
          <aside className="rounded-lg border border-line bg-white dark:bg-slate-900 p-6">
            <div
              role="status"
              className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400"
            >
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading user details…
            </div>
          </aside>
        ) : (
          <UserDetailPanel
            user={selectedUser}
            addresses={addresses}
            onChanged={onChanged}
            onDeleted={onDeleted}
            onAddressCreated={onAddressCreated}
            onSecurity={onSecurity}
          />
        )}
      </div>
    </section>
  );
}

function CreateUserForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [quota, setQuota] = useState(0);
  const [requirePasswordChange, setRequirePasswordChange] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Username and password are required');
      return;
    }

    setBusy(true);

    try {
      const response = await createUser({
        username,
        password,
        address: address || undefined,
        name: name || undefined,
        quota,
        requirePasswordChange
      });
      setUsername('');
      setPassword('');
      setAddress('');
      setName('');
      onCreated(response.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'User creation failed');
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
      <div className="grid gap-3 md:grid-cols-5">
        <Field label="Username">
          <input
            value={username}
            onChange={event => setUsername(event.target.value)}
            className="input"
          />
        </Field>
        <Field label="Password">
          <input
            value={password}
            onChange={event => setPassword(event.target.value)}
            type="password"
            className="input"
          />
        </Field>
        <Field label="Address">
          <input
            value={address}
            onChange={event => setAddress(event.target.value)}
            type="email"
            className="input"
          />
        </Field>
        <Field label="Name">
          <input value={name} onChange={event => setName(event.target.value)} className="input" />
        </Field>
        <Field label="Quota">
          <select
            value={quota}
            onChange={event => setQuota(Number(event.target.value))}
            className="input"
          >
            {quotaChoices.map(choice => (
              <option key={choice.label} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={requirePasswordChange}
            onChange={event => setRequirePasswordChange(event.target.checked)}
            className="h-4 w-4 rounded border-line text-brand-600 dark:text-teal-300 focus:ring-brand-500"
          />
          Require password change
        </label>
        <Button
          loading={busy}
          type="submit"
          disabled={busy}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Create
        </Button>
      </div>
      {error ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : null}
    </form>
  );
}

function UserDetailPanel({
  user,
  addresses,
  onChanged,
  onDeleted,
  onAddressCreated,
  onSecurity
}: {
  user: UserDetails | null;
  addresses: AddressItem[];
  onChanged: () => void;
  onDeleted: (user: UserDetails) => void;
  onAddressCreated: () => void;
  onSecurity: (id: string) => void;
}) {
  const [nameDraft, setNameDraft] = useState('');
  const [quotaDraft, setQuotaDraft] = useState('0');
  const [spamLevelDraft, setSpamLevelDraft] = useState('');
  const [tagsDraft, setTagsDraft] = useState('');
  const [metadataDraft, setMetadataDraft] = useState('{}');
  const [disabledDraft, setDisabledDraft] = useState(false);
  const [suspendedDraft, setSuspendedDraft] = useState(false);
  const [requirePasswordChangeDraft, setRequirePasswordChangeDraft] = useState(false);
  const [require2faDraft, setRequire2faDraft] = useState(false);
  const [disable2faDraft, setDisable2faDraft] = useState(false);
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [main, setMain] = useState(false);
  const [allowWildcard, setAllowWildcard] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [userError, setUserError] = useState('');
  const [savingUser, setSavingUser] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [addressBusy, setAddressBusy] = useState('');
  const [pendingAddressDelete, setPendingAddressDelete] = useState<AddressItem | null>(null);
  const [pendingUserDelete, setPendingUserDelete] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const status = userStatus(user || undefined);
  const quota = user?.limits?.quota || user?.quota;

  useEffect(() => {
    setNameDraft(user?.name || '');
    setQuotaDraft(String((user?.limits?.quota || user?.quota)?.allowed || 0));
    setSpamLevelDraft(user?.spamLevel === undefined ? '' : String(user.spamLevel));
    setTagsDraft(user?.tags?.join(', ') || '');
    setMetadataDraft(JSON.stringify(user?.metaData ?? {}, null, 2));
    setDisabledDraft(Boolean(user?.disabled));
    setSuspendedDraft(Boolean(user?.suspended));
    setRequirePasswordChangeDraft(Boolean(user?.requirePasswordChange));
    setRequire2faDraft(Boolean(user?.require2faEnabled));
    setDisable2faDraft(false);
    setUserError('');
    setAddressError('');
    setPendingAddressDelete(null);
    setPendingUserDelete(false);
  }, [user?.id]);

  async function saveUser(event: FormEvent) {
    event.preventDefault();
    if (!user) {
      return;
    }

    setUserError('');

    const quotaValue = quotaDraft.trim() ? Number(quotaDraft) : 0;
    if (!Number.isFinite(quotaValue) || quotaValue < 0) {
      setUserError('Quota must be zero or a positive number');
      return;
    }

    const spamLevel = spamLevelDraft.trim() ? Number(spamLevelDraft) : undefined;
    if (spamLevel !== undefined && !Number.isFinite(spamLevel)) {
      setUserError('Spam level must be a number');
      return;
    }

    let metadata: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(metadataDraft);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Expected an object');
      }
      metadata = parsed as Record<string, unknown>;
    } catch {
      setUserError(
        'Custom metadata must be a valid JSON object, for example {"department": "Sales"}.'
      );
      return;
    }

    const payload: UserUpdateInput = {
      name: nameDraft.trim() || undefined,
      quota: quotaValue,
      tags: tagsDraft
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
      disabled: disabledDraft,
      suspended: suspendedDraft,
      requirePasswordChange: requirePasswordChangeDraft,
      require2faEnabled: require2faDraft,
      spamLevel
    };

    if (metadataDraft !== JSON.stringify(user.metaData ?? {}, null, 2)) {
      payload.metaData = metadata;
    }

    if (disable2faDraft) {
      payload.disable2fa = true;
    }

    setSavingUser(true);
    try {
      await updateUser(user.id, payload);
      setDisable2faDraft(false);
      onChanged();
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'User update failed');
    } finally {
      setSavingUser(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user) {
      return;
    }
    setError('');

    if (!address.trim()) {
      setError('Address is required');
      return;
    }

    setBusy(true);

    try {
      await createAddress(user.id, { address, name: name || undefined, main, allowWildcard });
      setAddress('');
      setName('');
      setMain(false);
      setAllowWildcard(false);
      onAddressCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Address creation failed');
    } finally {
      setBusy(false);
    }
  }

  async function makeAddressMain(item: AddressItem) {
    if (!user) {
      return;
    }

    setAddressBusy(item.id);
    setAddressError('');
    try {
      await updateAddress(user.id, item.id, { main: true });
      onAddressCreated();
    } catch (err) {
      setAddressError(err instanceof Error ? err.message : 'Address update failed');
    } finally {
      setAddressBusy('');
    }
  }

  async function removeAddress() {
    if (!user || !pendingAddressDelete) {
      return;
    }

    setAddressBusy(pendingAddressDelete.id);
    setAddressError('');
    try {
      await deleteAddress(user.id, pendingAddressDelete.id);
      setPendingAddressDelete(null);
      onAddressCreated();
    } catch (err) {
      setAddressError(err instanceof Error ? err.message : 'Address deletion failed');
    } finally {
      setAddressBusy('');
    }
  }

  async function removeUser() {
    if (!user) {
      return;
    }

    setDeletingUser(true);
    setUserError('');
    try {
      await deleteUser(user.id);
      setPendingUserDelete(false);
      onDeleted(user);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'User deletion failed');
    } finally {
      setDeletingUser(false);
    }
  }

  if (!user) {
    return (
      <aside className="rounded-lg border border-dashed border-line bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
        <Users className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
        No user selected
      </aside>
    );
  }

  return (
    <aside className="space-y-4">
      <div className="rounded-lg border border-line bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold">{user.username}</h3>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">
              {user.address || user.name || user.id}
            </p>
          </div>
          <StatusPill label={status.label} tone={status.tone} />
        </div>

        <div className="mb-4 rounded-lg border border-line bg-slate-50 dark:bg-slate-800 p-3">
          <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">User ID</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 select-all break-all text-xs">{user.id}</code>
            <CopyButton value={user.id} title="Copy user ID" />
          </div>
          <Button
            type="button"
            className="mt-2 text-sm font-semibold text-brand-700 dark:text-teal-300 hover:underline"
            onClick={() => onSecurity(user.id)}
          >
            <Shield className="h-4 w-4" />
            Open security log
          </Button>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Name" value={user.name || '-'} />
          <Info label="Password" value={user.hasPasswordSet ? 'Set' : 'Not set'} />
          <Info label="2FA" value={user.enabled2fa?.length ? user.enabled2fa.join(', ') : '-'} />
          <Info
            label="Spam level"
            value={user.spamLevel === undefined ? '-' : String(user.spamLevel)}
          />
          <Info
            label="Quota"
            value={`${formatBytes(quota?.used)} / ${formatBytes(quota?.allowed)}`}
            wide
          />
          <Info label="Tags" value={user.tags?.length ? user.tags.join(', ') : '-'} wide />
        </dl>
      </div>

      <form
        onSubmit={saveUser}
        noValidate
        className="rounded-lg border border-line bg-white dark:bg-slate-900 p-4 shadow-sm"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-brand-600 dark:text-teal-300" />
            <h3 className="font-semibold">Account</h3>
          </div>
          <IconButton
            loading={deletingUser}
            title="Delete user"
            onClick={() => setPendingUserDelete(true)}
            disabled={savingUser || deletingUser}
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="space-y-3">
          <Field label="Name">
            <input
              value={nameDraft}
              onChange={event => setNameDraft(event.target.value)}
              className="input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quota bytes">
              <input
                value={quotaDraft}
                onChange={event => setQuotaDraft(event.target.value)}
                type="number"
                min="0"
                className="input"
              />
            </Field>
            <Field label="Spam level">
              <input
                value={spamLevelDraft}
                onChange={event => setSpamLevelDraft(event.target.value)}
                type="number"
                className="input"
              />
            </Field>
          </div>
          <Field label="Tags">
            <input
              value={tagsDraft}
              onChange={event => setTagsDraft(event.target.value)}
              className="input"
              placeholder="vip, internal"
            />
          </Field>
          <Field label="Custom metadata (JSON)">
            <textarea
              value={metadataDraft}
              onChange={event => setMetadataDraft(event.target.value)}
              rows={6}
              spellCheck={false}
              className="input font-mono text-xs"
              aria-describedby="user-metadata-help"
            />
          </Field>
          <p id="user-metadata-help" className="text-xs text-slate-500 dark:text-slate-400">
            Add custom fields as a JSON object, for example {'{"department": "Sales"}'}. Saving
            replaces the metadata object; use {'{}'} to clear it.
          </p>
          <div className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={disabledDraft}
                onChange={event => setDisabledDraft(event.target.checked)}
                className="checkbox"
              />
              Disabled
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={suspendedDraft}
                onChange={event => setSuspendedDraft(event.target.checked)}
                className="checkbox"
              />
              Suspended
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={requirePasswordChangeDraft}
                onChange={event => setRequirePasswordChangeDraft(event.target.checked)}
                className="checkbox"
              />
              Require password change
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={require2faDraft}
                onChange={event => setRequire2faDraft(event.target.checked)}
                className="checkbox"
              />
              Require 2FA
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={disable2faDraft}
                onChange={event => setDisable2faDraft(event.target.checked)}
                className="checkbox"
              />
              Disable current 2FA
            </label>
          </div>
          {userError ? (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="min-w-0 break-words">{userError}</span>
            </div>
          ) : null}
          <Button
            loading={savingUser}
            type="submit"
            disabled={savingUser}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            Save user
          </Button>
        </div>
      </form>

      <div className="rounded-lg border border-line bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Mail className="h-4 w-4 text-brand-600 dark:text-teal-300" />
          <h3 className="font-semibold">Addresses</h3>
        </div>
        <div className="divide-y divide-line">
          {addresses.map(item => (
            <div key={item.id} className="px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 break-all font-medium">{item.address || item.id}</span>
                <div className="flex shrink-0 items-center gap-2">
                  {item.main ? <StatusPill label="Main" tone="success" /> : null}
                  {!item.main ? (
                    <IconButton
                      loading={addressBusy === item.id}
                      title="Set as main address"
                      onClick={() => makeAddressMain(item)}
                      disabled={Boolean(addressBusy)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </IconButton>
                  ) : null}
                  <IconButton
                    loading={addressBusy === item.id}
                    title="Delete address"
                    onClick={() => setPendingAddressDelete(item)}
                    disabled={Boolean(addressBusy)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
              <div className="text-slate-500 dark:text-slate-400">{item.name || '-'}</div>
              {item.targets?.length ? (
                <div className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                  {item.targets.join(', ')}
                </div>
              ) : null}
            </div>
          ))}
          {!addresses.length ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No addresses
            </div>
          ) : null}
        </div>
        {addressError ? (
          <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words">{addressError}</span>
          </div>
        ) : null}
        <form onSubmit={submit} noValidate className="space-y-3 border-t border-line p-4">
          <Field label="Address">
            <input
              value={address}
              onChange={event => setAddress(event.target.value)}
              className="input"
            />
          </Field>
          <Field label="Name">
            <input value={name} onChange={event => setName(event.target.value)} className="input" />
          </Field>
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={main}
                onChange={event => setMain(event.target.checked)}
                className="checkbox"
              />
              Main
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={allowWildcard}
                onChange={event => setAllowWildcard(event.target.checked)}
                className="checkbox"
              />
              Wildcard
            </label>
          </div>
          {error ? (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : null}
          <Button
            loading={busy}
            type="submit"
            disabled={busy}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-brand-600 bg-white dark:bg-slate-900 px-3 text-sm font-semibold text-brand-700 dark:text-teal-300 transition hover:bg-brand-50 dark:hover:bg-teal-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Add address
          </Button>
        </form>
      </div>

      <ConfirmDialog
        open={Boolean(pendingAddressDelete)}
        title="Delete address"
        message={
          pendingAddressDelete ? (
            <>
              Delete{' '}
              <strong className="break-all text-ink">
                {pendingAddressDelete.address || pendingAddressDelete.id}
              </strong>
              ?
            </>
          ) : null
        }
        confirmLabel="Delete address"
        busy={Boolean(addressBusy)}
        onCancel={() => setPendingAddressDelete(null)}
        onConfirm={removeAddress}
      />

      <ConfirmDialog
        open={pendingUserDelete}
        title="Delete user"
        message={
          <>
            Delete <strong className="break-all text-ink">{user.username}</strong> and its mailbox
            data?
          </>
        }
        confirmLabel="Delete user"
        busy={deletingUser}
        onCancel={() => setPendingUserDelete(false)}
        onConfirm={removeUser}
      />
    </aside>
  );
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium text-slate-800 dark:text-slate-100">{value}</dd>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function DkimView({
  keys,
  total,
  selectedKey,
  nextCursor,
  previousCursor,
  loading,
  onSearch,
  onNext,
  onPrevious,
  onRefresh,
  onSelect,
  onCreate,
  onDelete
}: {
  keys: DkimKey[];
  total: number;
  selectedKey: DkimKey | null;
  nextCursor?: string | false;
  previousCursor?: string | false;
  loading: boolean;
  onSearch: (query: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onRefresh: () => void;
  onSelect: (key: DkimKey) => void;
  onCreate: (input: DkimCreateInput) => Promise<void>;
  onDelete: (key: DkimKey) => Promise<void>;
}) {
  const [query, setQuery] = useState('');

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    onSearch(query);
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">DKIM</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{total} keys</p>
        </div>
        <IconButton loading={loading} title="Refresh" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </IconButton>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="rounded-lg border border-line bg-white dark:bg-slate-900 shadow-sm">
          <div className="border-b border-line p-4">
            <form onSubmit={submitSearch} className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Domain"
                  className="h-10 w-full rounded-lg border border-line pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-teal-900"
                />
              </div>
              <Button
                loading={loading}
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white dark:bg-slate-900 px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:border-brand-500 hover:text-brand-700 dark:hover:text-teal-300"
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
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Selector</th>
                  <th className="px-4 py-3">Fingerprint</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {keys.map(key => {
                  const active = selectedKey?.id === key.id;
                  return (
                    <tr
                      key={key.id}
                      onClick={() => onSelect(key)}
                      className={`cursor-pointer transition ${active ? 'bg-brand-50 dark:bg-teal-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{key.domain}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {key.description || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {key.selector}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">
                        {key.fingerprint}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {formatDate(key.created)}
                      </td>
                    </tr>
                  );
                })}
                {!keys.length ? (
                  <tr>
                    <td
                      className="px-4 py-10 text-center text-slate-500 dark:text-slate-400"
                      colSpan={4}
                    >
                      No DKIM keys found
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-line px-4 py-3">
            <div className="text-sm text-slate-500 dark:text-slate-400">{keys.length} shown</div>
            <div className="flex gap-2">
              <IconButton
                loading={loading}
                title="Previous page"
                onClick={onPrevious}
                disabled={!previousCursor}
              >
                <ChevronLeft className="h-4 w-4" />
              </IconButton>
              <IconButton
                loading={loading}
                title="Next page"
                onClick={onNext}
                disabled={!nextCursor}
              >
                <ChevronRight className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <DkimCreateForm onCreate={onCreate} />
          <DkimDetailPanel selectedKey={selectedKey} onDelete={onDelete} />
        </aside>
      </div>
    </section>
  );
}

function DkimCreateForm({ onCreate }: { onCreate: (input: DkimCreateInput) => Promise<void> }) {
  const [domain, setDomain] = useState('');
  const [selector, setSelector] = useState('default');
  const [description, setDescription] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!domain.trim()) {
      setError('Domain is required');
      return;
    }

    if (!selector.trim()) {
      setError('Selector is required');
      return;
    }

    setBusy(true);

    try {
      await onCreate({
        domain: domain.trim(),
        selector: selector.trim(),
        description: description.trim() || undefined,
        privateKey: privateKey.trim() || undefined
      });
      setDescription('');
      setPrivateKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'DKIM update failed');
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
        <KeyRound className="h-4 w-4 text-brand-600 dark:text-teal-300" />
        <h3 className="font-semibold">Create or update key</h3>
      </div>
      <div className="space-y-3">
        <Field label="Domain">
          <input
            value={domain}
            onChange={event => setDomain(event.target.value)}
            className="input"
            placeholder="mail domain, for example example.com"
          />
        </Field>
        <Field label="Selector">
          <input
            value={selector}
            onChange={event => setSelector(event.target.value)}
            className="input"
          />
        </Field>
        <Field label="Description">
          <input
            value={description}
            onChange={event => setDescription(event.target.value)}
            className="input"
          />
        </Field>
        <Field label="Private key">
          <textarea
            value={privateKey}
            onChange={event => setPrivateKey(event.target.value)}
            className="min-h-28 w-full rounded-lg border border-line bg-white dark:bg-slate-900 px-3 py-2 font-mono text-xs outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-teal-900"
          />
        </Field>
      </div>
      {error ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : null}
      <Button
        loading={busy}
        type="submit"
        disabled={busy}
        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        Save DKIM key
      </Button>
    </form>
  );
}

function DkimDetailPanel({
  selectedKey,
  onDelete
}: {
  selectedKey: DkimKey | null;
  onDelete: (key: DkimKey) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function remove() {
    if (!selectedKey) {
      return;
    }

    setBusy(true);
    setError('');
    try {
      await onDelete(selectedKey);
      setConfirmOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  if (!selectedKey) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
        <KeyRound className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
        No DKIM key selected
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-white dark:bg-slate-900 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-semibold">{selectedKey.domain}</h3>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">
            {selectedKey.selector}
          </p>
        </div>
        <IconButton
          loading={busy}
          title="Delete DKIM key"
          onClick={() => setConfirmOpen(true)}
          disabled={busy}
        >
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="space-y-4 p-4 text-sm">
        <dl className="grid grid-cols-2 gap-3">
          <Info label="Fingerprint" value={selectedKey.fingerprint} wide />
          <Info label="Created" value={formatDate(selectedKey.created)} />
          <Info label="Description" value={selectedKey.description || '-'} />
        </dl>

        {selectedKey.dnsTxt ? (
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                TXT name
              </div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs">
                  {selectedKey.dnsTxt.name}
                </code>
                <CopyButton value={selectedKey.dnsTxt.name} title="Copy TXT name" />
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                TXT value
              </div>
              <div className="flex items-start gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs">
                  {selectedKey.dnsTxt.value}
                </code>
                <CopyButton value={selectedKey.dnsTxt.value} title="Copy TXT value" />
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-line bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-500 dark:text-slate-400">
            DNS TXT data is loaded when opening key details.
          </div>
        )}

        {selectedKey.publicKey ? (
          <details className="rounded-lg border border-line bg-slate-50 dark:bg-slate-800 px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold">Public key</summary>
            <code className="mt-2 block break-all text-xs text-slate-600 dark:text-slate-300">
              {selectedKey.publicKey}
            </code>
          </details>
        ) : null}

        {error ? (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete DKIM key"
        message={
          <>
            Delete DKIM key for <strong className="break-all text-ink">{selectedKey.domain}</strong>
            ?
          </>
        }
        confirmLabel="Delete key"
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={remove}
      />
    </div>
  );
}

function isBooleanSetting(setting: SettingItem) {
  return (
    typeof setting.value === 'boolean' ||
    typeof setting.default === 'boolean' ||
    setting.type === 'boolean'
  );
}

function isNumericSetting(setting: SettingItem) {
  return (
    typeof setting.value === 'number' ||
    typeof setting.default === 'number' ||
    ['duration', 'number', 'size'].includes(setting.type || '')
  );
}

function parseSettingValue(setting: SettingItem, draft: string): SettingItem['value'] {
  if (isBooleanSetting(setting)) {
    return draft === 'true';
  }

  if (isNumericSetting(setting)) {
    const value = Number(draft);
    if (!Number.isFinite(value)) {
      throw new Error('Enter a number');
    }
    return value;
  }

  return draft;
}

function settingMatchesDefault(setting: SettingItem) {
  if (setting.default === undefined) {
    return !setting.custom;
  }

  if (isNumericSetting(setting)) {
    return Number(setting.value) === Number(setting.default);
  }

  if (isBooleanSetting(setting)) {
    return Boolean(setting.value) === Boolean(setting.default);
  }

  return String(setting.value) === String(setting.default);
}

function settingIsCustom(setting: SettingItem) {
  return Boolean(setting.custom) && !settingMatchesDefault(setting);
}

function EditableSettingValue({
  setting,
  onUpdate
}: {
  setting: SettingItem;
  onUpdate: (setting: SettingItem, value: SettingItem['value']) => Promise<void>;
}) {
  const [draft, setDraft] = useState(String(setting.value));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const booleanSetting = isBooleanSetting(setting);
  const numericSetting = isNumericSetting(setting);
  const dirty = draft !== String(setting.value);

  useEffect(() => {
    setDraft(String(setting.value));
    setError('');
  }, [setting.key, setting.value]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      await onUpdate(setting, parseSettingValue(setting, draft));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="min-w-[220px] space-y-2">
      <div className="flex items-center gap-2">
        {booleanSetting ? (
          <select
            value={draft}
            onChange={event => setDraft(event.target.value)}
            className="input h-9 min-w-24"
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input
            value={draft}
            onChange={event => setDraft(event.target.value)}
            type={numericSetting ? 'number' : 'text'}
            className="input h-9 min-w-0"
            aria-label={`${setting.key} value`}
          />
        )}
        <Button
          loading={saving}
          type="submit"
          title="Save setting"
          aria-label={`Save ${setting.key}`}
          disabled={!dirty || saving}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 shadow-sm transition hover:border-brand-500 hover:text-brand-700 dark:hover:text-teal-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
        </Button>
        <IconButton
          title="Discard edits"
          onClick={() => setDraft(String(setting.value))}
          disabled={!dirty || saving}
        >
          <RotateCcw className="h-4 w-4" />
        </IconButton>
      </div>
      {error ? (
        <div className="text-xs font-medium text-rose-700 dark:text-rose-300">{error}</div>
      ) : null}
    </form>
  );
}

function SettingsView({
  settings,
  loading,
  onRefresh,
  onUpdate
}: {
  settings: SettingItem[];
  loading: boolean;
  onRefresh: () => void;
  onUpdate: (setting: SettingItem, value: SettingItem['value']) => Promise<void>;
}) {
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState('');
  const categories = [
    { label: 'All', value: '' },
    { label: 'ACME', value: 'acme' },
    { label: 'Domain cache', value: 'domaincache' },
    { label: 'Auth', value: 'auth' },
    { label: 'Limits', value: 'limit' },
    { label: 'Spam', value: 'spam' }
  ].map(item => ({
    ...item,
    count: settings.filter(setting => !item.value || setting.key.toLowerCase().includes(item.value))
      .length
  }));
  const visibleSettings = settings.filter(setting => {
    const categoryMatch = !category || setting.key.toLowerCase().includes(category);
    const search = filter.trim().toLowerCase();
    return (
      categoryMatch &&
      [setting.key, setting.name, setting.description].some(value =>
        value?.toLowerCase().includes(search)
      )
    );
  });
  useEffect(() => {
    if (category && !settings.some(setting => setting.key.toLowerCase().includes(category))) {
      setCategory('');
    }
  }, [category, settings]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Settings</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {visibleSettings.length} of {settings.length} settings
          </p>
        </div>
        <IconButton loading={loading} title="Refresh" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </IconButton>
      </div>

      <div className="rounded-lg border border-line bg-white dark:bg-slate-900 shadow-sm">
        <div className="border-b border-line p-4">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={filter}
                onChange={event => setFilter(event.target.value)}
                placeholder="Search settings by key or description"
                aria-label="Search settings"
                className="h-10 w-full rounded-lg border border-line pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-teal-900"
              />
            </div>
            {filter ? (
              <Button
                type="button"
                onClick={() => setFilter('')}
                className="border border-line px-3 text-sm text-slate-600 dark:text-slate-300"
              >
                Clear
              </Button>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories
              .filter(item => !item.value || item.count > 0)
              .map(item => (
                <Button
                  key={item.label}
                  type="button"
                  aria-pressed={category === item.value}
                  onClick={() => setCategory(item.value)}
                  className={`inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold transition ${
                    category === item.value
                      ? 'border-brand-600 bg-brand-50 dark:bg-teal-950 text-brand-700 dark:text-teal-300'
                      : 'border-line bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-brand-500 hover:text-brand-700 dark:hover:text-teal-300'
                  }`}
                >
                  {item.label} <span className="ml-1 opacity-70">{item.count}</span>
                </Button>
              ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Default</th>
                <th className="px-4 py-3">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visibleSettings.map(setting => (
                <tr key={setting.key}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{setting.key}</div>
                    <div className="max-w-xl text-xs text-slate-500 dark:text-slate-400">
                      {setting.description || setting.name || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    <EditableSettingValue setting={setting} onUpdate={onUpdate} />
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {String(setting.default ?? '-')}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill
                      label={settingIsCustom(setting) ? 'Custom' : setting.type || 'Default'}
                      tone={settingIsCustom(setting) ? 'success' : 'muted'}
                    />
                  </td>
                </tr>
              ))}
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6">
                    <div
                      role="status"
                      className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400"
                    >
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Loading settings…
                    </div>
                  </td>
                </tr>
              ) : !visibleSettings.length ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-slate-500 dark:text-slate-400"
                  >
                    No settings match these filters
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<View>('overview');
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | false>();
  const [previousCursor, setPreviousCursor] = useState<string | false>();
  const [userQuery, setUserQuery] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [securityUserId, setSecurityUserId] = useState('');
  const [selectingUserId, setSelectingUserId] = useState('');
  const userSelectionRequest = useRef(0);
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [dkimKeys, setDkimKeys] = useState<DkimKey[]>([]);
  const [dkimTotal, setDkimTotal] = useState(0);
  const [dkimNextCursor, setDkimNextCursor] = useState<string | false>();
  const [dkimPreviousCursor, setDkimPreviousCursor] = useState<string | false>();
  const [dkimQuery, setDkimQuery] = useState('');
  const [selectedDkimKey, setSelectedDkimKey] = useState<DkimKey | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [loadingDkim, setLoadingDkim] = useState(false);
  const [notice, setNotice] = useState('');
  const [refreshingNotice, setRefreshingNotice] = useState('');

  const activeUser = useMemo(
    () => users.find(user => user.id === selectedUser?.id),
    [selectedUser?.id, users]
  );

  async function loadUsers(options: { query?: string; next?: string; previous?: string } = {}) {
    setLoadingUsers(true);
    try {
      const response = await getUsers({
        query: options.query ?? userQuery,
        next: options.next,
        previous: options.previous,
        limit: 25
      });
      setUsers(response.results || []);
      setTotal(response.total || 0);
      setNextCursor(response.nextCursor);
      setPreviousCursor(response.previousCursor);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not load users');
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadSettings() {
    setLoadingSettings(true);
    try {
      const response = await getSettings();
      setSettings(response.settings || []);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not load settings');
    } finally {
      setLoadingSettings(false);
    }
  }

  async function loadDkim(options: { query?: string; next?: string; previous?: string } = {}) {
    setLoadingDkim(true);
    try {
      const response = await getDkimKeys({
        query: options.query ?? dkimQuery,
        next: options.next,
        previous: options.previous,
        limit: 25
      });
      setDkimKeys(response.results || []);
      setDkimTotal(response.total || 0);
      setDkimNextCursor(response.nextCursor);
      setDkimPreviousCursor(response.previousCursor);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not load DKIM keys');
    } finally {
      setLoadingDkim(false);
    }
  }

  async function saveSetting(setting: SettingItem, value: SettingItem['value']) {
    await updateSetting(setting.key, value);
    setSettings(current =>
      current.map(item =>
        item.key === setting.key
          ? {
              ...item,
              value,
              custom: value !== item.default && !settingMatchesDefault({ ...item, value })
            }
          : item
      )
    );
    setNotice(`Updated ${setting.key}`);
    await loadSettings();
  }

  async function selectUser(user: UserListItem) {
    const request = ++userSelectionRequest.current;
    setSelectingUserId(user.id);
    try {
      const [detail, addressResponse] = await Promise.all([
        getUser(user.id),
        getAddresses(user.id)
      ]);
      if (request !== userSelectionRequest.current) {
        return;
      }
      setSelectedUser(detail);
      setAddresses(addressResponse.results || []);
    } catch (err) {
      if (request === userSelectionRequest.current) {
        setNotice(err instanceof Error ? err.message : 'Could not load user');
      }
    } finally {
      if (request === userSelectionRequest.current) {
        setSelectingUserId('');
      }
    }
  }

  async function selectDkimKey(key: DkimKey) {
    try {
      setSelectedDkimKey(await getDkimKey(key.id));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not load DKIM key');
    }
  }

  async function saveDkimKey(input: DkimCreateInput) {
    const response = await createDkimKey(input);
    setSelectedDkimKey(response);
    setNotice(`Saved DKIM key for ${response.domain}`);
    await loadDkim();
  }

  async function removeDkimKey(key: DkimKey) {
    await deleteDkimKey(key.id);
    setNotice(`Deleted DKIM key for ${key.domain}`);
    setSelectedDkimKey(current => (current?.id === key.id ? null : current));
    await loadDkim();
  }

  async function runRefresh(message: string, task: () => Promise<void>) {
    setRefreshingNotice(message);
    try {
      await task();
      setNotice('Refresh loaded');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshingNotice('');
    }
  }

  useEffect(() => {
    const expire = () => {
      setSession(null);
      setSelectedUser(null);
      setAddresses([]);
    };
    const requireTwoFactor = () => {
      getSession().then(setSession).catch(expire);
    };
    window.addEventListener('admin-session-expired', expire);
    window.addEventListener('admin-two-factor-required', requireTwoFactor);
    return () => {
      window.removeEventListener('admin-session-expired', expire);
      window.removeEventListener('admin-two-factor-required', requireTwoFactor);
    };
  }, []);

  useEffect(() => {
    getSession()
      .then(response => {
        if (response.passwordAuthenticated) {
          setSession(response);
        }
      })
      .catch(() => setNotice('Could not reach the admin server. Please sign in again.'))
      .finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    if (!session?.authenticated) {
      return;
    }
    if (view === 'users') {
      loadUsers();
    }
    if (view === 'dkim') {
      loadDkim();
    }
    if (view === 'settings') {
      loadSettings();
    }
  }, [session?.authenticated, view]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (activeUser) {
      setSelectedUser(current =>
        current?.id === activeUser.id ? { ...current, ...activeUser } : current
      );
    }
  }, [activeUser]);

  if (booting) {
    return (
      <main className="grid min-h-screen place-items-center bg-mist text-sm text-slate-500 dark:text-slate-400">
        <RefreshCw className="mb-3 h-6 w-6 animate-spin text-brand-600 dark:text-teal-300" />
        Loading
      </main>
    );
  }

  if (!session) {
    return <LoginScreen onLogin={setSession} />;
  }

  async function handleLogout() {
    await logout().catch(() => undefined);
    setSession(null);
  }

  if (!session.authenticated) {
    return <AdminTwoFactorGate session={session} onSession={setSession} onLogout={handleLogout} />;
  }

  return (
    <Shell session={session} view={view} onView={setView} onLogout={handleLogout}>
      {notice || refreshingNotice ? (
        <div className="pointer-events-none fixed right-4 top-24 z-40 w-[min(calc(100vw-2rem),420px)] space-y-2">
          {refreshingNotice ? (
            <div
              key={refreshingNotice}
              className="toast-active pointer-events-auto flex items-start gap-3 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950 px-4 py-3 text-sm text-sky-800 dark:text-sky-200 shadow-panel"
            >
              <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
              <span className="min-w-0 break-words">{refreshingNotice}</span>
            </div>
          ) : null}
          {notice ? (
            <div
              key={notice}
              role="status"
              aria-live="polite"
              className="toast-notice pointer-events-auto flex items-start justify-between gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 shadow-panel"
            >
              <span className="flex min-w-0 items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-words">{notice}</span>
              </span>
              <Button
                type="button"
                onClick={() => setNotice('')}
                className="shrink-0 font-semibold"
              >
                Dismiss
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {view === 'overview' ? (
        <OverviewView
          session={session}
          onCreateUser={() => {
            setShowCreateUser(true);
            setUserQuery('');
            setView('users');
          }}
          onUsers={() => {
            setUserQuery('');
            setView('users');
          }}
          onDkim={() => setView('dkim')}
          onSettings={() => setView('settings')}
        />
      ) : null}

      {view === 'users' ? (
        <UsersView
          users={users}
          total={total}
          selectedUser={selectedUser}
          addresses={addresses}
          nextCursor={nextCursor}
          previousCursor={previousCursor}
          loading={loadingUsers}
          selectingId={selectingUserId}
          initialQuery={userQuery}
          showCreate={showCreateUser}
          onCreateToggle={setShowCreateUser}
          onSearch={query => {
            setUserQuery(query);
            loadUsers({ query });
          }}
          onNext={() => nextCursor && loadUsers({ next: nextCursor })}
          onPrevious={() => previousCursor && loadUsers({ previous: previousCursor })}
          onRefresh={() => runRefresh('Refreshing users...', () => loadUsers())}
          onSelect={selectUser}
          onSecurity={id => {
            setSecurityUserId(id);
            setView('security');
          }}
          onCreated={id => {
            setShowCreateUser(false);
            setNotice(`Created user ${id}`);
            loadUsers();
          }}
          onChanged={() => {
            setNotice('Updated user');
            loadUsers();
            if (selectedUser) {
              selectUser(selectedUser);
            }
          }}
          onDeleted={user => {
            setNotice(`Deleted user ${user.username}`);
            setSelectedUser(null);
            setAddresses([]);
            loadUsers();
          }}
          onAddressCreated={() => {
            if (selectedUser) {
              selectUser(selectedUser);
            }
          }}
        />
      ) : null}

      {view === 'mailrules' ? <MailRulesView /> : null}

      {view === 'mailboxes' ? <MailboxesView /> : null}

      {view === 'security' ? <SecurityView initialUserId={securityUserId} /> : null}

      {view === 'dkim' ? (
        <DkimView
          keys={dkimKeys}
          total={dkimTotal}
          selectedKey={selectedDkimKey}
          nextCursor={dkimNextCursor}
          previousCursor={dkimPreviousCursor}
          loading={loadingDkim}
          onSearch={query => {
            setDkimQuery(query);
            loadDkim({ query });
          }}
          onNext={() => dkimNextCursor && loadDkim({ next: dkimNextCursor })}
          onPrevious={() => dkimPreviousCursor && loadDkim({ previous: dkimPreviousCursor })}
          onRefresh={() => runRefresh('Refreshing DKIM keys...', () => loadDkim())}
          onSelect={selectDkimKey}
          onCreate={saveDkimKey}
          onDelete={removeDkimKey}
        />
      ) : null}

      {view === 'domainaccess' ? <DomainAccessView /> : null}

      {view === 'domainaliases' ? <DomainAliasesView /> : null}

      {view === 'certs' ? <CertsView /> : null}

      {view === 'storage' ? <StorageView /> : null}

      {view === 'webhooks' ? <WebhooksView /> : null}

      {view === 'settings' ? (
        <div className="space-y-6">
          <AdminSecuritySettings session={session} onSession={setSession} />
          <SettingsView
            settings={settings}
            loading={loadingSettings}
            onRefresh={() => runRefresh('Refreshing settings...', () => loadSettings())}
            onUpdate={saveSetting}
          />
        </div>
      ) : null}
    </Shell>
  );
}
