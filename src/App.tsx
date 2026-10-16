import {
  PulseIcon as Activity,
  WarningCircleIcon as AlertCircle,
  ArchiveIcon as Archive,
  CheckCircleIcon as CheckCircle2,
  CaretLeftIcon as ChevronLeft,
  CaretRightIcon as ChevronRight,
  HardDriveIcon as HardDrive,
  KeyIcon as KeyRound,
  ListIcon as List,
  SpinnerGapIcon as LoaderCircle,
  SignOutIcon as LogOut,
  EnvelopeIcon as Mail,
  PlusIcon as Plus,
  ArrowsClockwiseIcon as RefreshCw,
  ArrowCounterClockwiseIcon as RotateCcw,
  FloppyDiskIcon as Save,
  MagnifyingGlassIcon as Search,
  HardDrivesIcon as Server,
  GearIcon as Settings,
  ShieldIcon as Shield,
  TrashIcon as Trash2,
  UserPlusIcon as UserPlus,
  UsersIcon as Users,
  WebhooksLogoIcon as Webhook
} from '@phosphor-icons/react';
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
import { ConfirmDialog, CopyButton, formatBytes, formatDate } from './views/ui';
import { ThemeToggle } from './views/ThemeToggle';

import { readView, viewUrl, type View } from './navigation';

const quotaChoices = [
  { label: 'Default', value: 0 },
  { label: '1 GB', value: 1024 ** 3 },
  { label: '5 GB', value: 5 * 1024 ** 3 },
  { label: '10 GB', value: 10 * 1024 ** 3 }
];

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
    <main className="relative grid min-h-screen place-items-center bg-base-200 px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm card border border-base-300 bg-base-100 p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <img src="/duck.png" alt="" className="h-11 w-11 rounded-lg bg-primary/10 p-1" />
          <div>
            <h1 className="font-display text-xl font-semibold text-base-content">WildDuck Admin</h1>
            <p className="text-sm text-base-content/60">Configured administrator</p>
          </div>
        </div>

        <form onSubmit={submit} noValidate className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-base-content/80">Username</span>
            <input
              value={username}
              onChange={event => setUsername(event.target.value)}
              className="input w-full"
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-base-content/80">Password</span>
            <input
              value={password}
              onChange={event => setPassword(event.target.value)}
              type="password"
              className="input w-full"
              autoComplete="current-password"
            />
          </label>
          {error ? (
            <div className="alert alert-error alert-soft">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={busy}
            aria-busy={Boolean(busy) || undefined}
          >
            {busy ? (
              <span aria-hidden="true" className="loading loading-spinner loading-xs" />
            ) : null}
            <Shield className="h-4 w-4" />
            Sign in
          </button>
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
  const [drawerOpen, setDrawerOpen] = useState(false);
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
          <li key={item.id}>
            <button
              type="button"
              aria-current={view === item.id ? 'page' : undefined}
              className={`py-2 ${view === item.id ? 'menu-active' : ''}`}
              onClick={() => {
                setDrawerOpen(false);
                onView(item.id);
              }}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          </li>
        );
      });
  }

  return (
    <div className="drawer min-h-screen bg-base-200 text-base-content lg:drawer-open">
      <input
        id="admin-navigation-drawer"
        type="checkbox"
        className="drawer-toggle"
        checked={drawerOpen}
        onChange={event => setDrawerOpen(event.target.checked)}
      />
      <div className="drawer-content min-w-0">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-box focus:bg-base-100 focus:p-3"
        >
          Skip to content
        </a>
        <header className="navbar sticky top-0 z-20 min-h-16 justify-between gap-3 border-b border-base-300 bg-base-100/95 px-3 backdrop-blur-sm sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <label
              htmlFor="admin-navigation-drawer"
              className="btn btn-square btn-ghost drawer-button lg:hidden"
              aria-label="Open navigation menu"
            >
              <List className="size-5" aria-hidden="true" />
            </label>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="dropdown dropdown-end">
              <button type="button" tabIndex={0} className="btn btn-ghost btn-sm">
                <span className="hidden sm:inline">API endpoint</span>
                <span className="sm:hidden">API</span>
              </button>
              <div
                tabIndex={0}
                className="dropdown-content card card-border z-30 mt-3 w-72 rounded-box bg-base-100 p-4 shadow-lg"
              >
                <p className="font-semibold">WildDuck API</p>
                <p className="mt-2 break-all text-xs text-base-content/60">{session.api?.url}</p>
              </div>
            </div>
            <ThemeToggle />
            <span className="hidden text-sm text-base-content/60 sm:inline">{session.user}</span>
            <span
              className={`badge badge-sm badge-soft ${session.api?.tokenConfigured ? 'badge-success' : 'badge-warning'}`}
            >
              {session.api?.tokenConfigured ? 'API configured' : 'No API token'}
            </span>
            <button
              title="Sign out"
              onClick={onLogout}
              aria-label="Sign out"
              type="button"
              className="btn btn-square btn-ghost"
            >
              <LogOut className="size-5" aria-hidden="true" />
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="min-w-0 px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
      <div className="drawer-side z-30">
        <label
          htmlFor="admin-navigation-drawer"
          aria-label="Close navigation menu"
          className="drawer-overlay"
        />
        <aside className="flex min-h-full w-72 flex-col gap-5 border-r border-base-300 bg-base-100 p-4 pt-6">
          <a href="#main-content" className="flex items-center gap-3 rounded-box px-3 py-2">
            <img src="/duck.png" alt="" className="size-11 rounded-box bg-primary/10 p-1" />
            <span className="min-w-0">
              <span className="block truncate font-display font-semibold">
                {session.service?.name || 'WildDuck Admin'}
              </span>
              <span className="block text-xs text-base-content/60">Administration</span>
            </span>
          </a>
          <nav aria-label="Main navigation" className="min-h-0 flex-1 overflow-y-auto">
            {groups.map(group => (
              <ul
                key={group.label}
                className="menu menu-md mb-3 w-full gap-1 rounded-box bg-base-100 p-2"
              >
                <li className="menu-title px-3 uppercase tracking-wider">{group.label}</li>
                {navigation(group.ids)}
              </ul>
            ))}
          </nav>
        </aside>
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
          <p className="text-sm text-base-content/60">{total} accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            title="Refresh"
            onClick={onRefresh}
            aria-label="Refresh"
            type="button"
            className="btn btn-square btn-sm btn-ghost"
            disabled={loading}
            aria-busy={Boolean(loading) || undefined}
          >
            {loading ? (
              <span aria-hidden="true" className="loading loading-spinner loading-xs" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onCreateToggle(!showCreate)}
            className="btn btn-primary"
          >
            <UserPlus className="h-4 w-4" />
            New user
          </button>
        </div>
      </div>

      {showCreate ? <CreateUserForm onCreated={onCreated} /> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="card border border-base-300 bg-base-100 shadow-xs">
          <div className="border-b border-base-300 p-4">
            <form onSubmit={submitSearch} className="flex items-center gap-2">
              <div className="relative flex min-w-0 flex-1 items-center">
                <Search className="pointer-events-none absolute z-10 left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/50" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Username or address"
                  className="input w-full pl-9 pr-3"
                />
              </div>
              <button
                type="submit"
                className="btn btn-outline"
                disabled={loading}
                aria-busy={Boolean(loading) || undefined}
              >
                {loading ? (
                  <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                ) : null}
                <Search className="h-4 w-4" />
                Search
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-sm table-zebra w-full">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Address</th>
                  <th>Quota</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const status = userStatus(user);
                  const active = selectedUser?.id === user.id;
                  return (
                    <tr
                      key={user.id}
                      onClick={() => onSelect(user)}
                      className={`cursor-pointer transition ${active ? 'bg-primary/10' : 'hover:bg-base-200'}`}
                    >
                      <td>
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            onSelect(user);
                          }}
                          className="btn btn-sm btn-outline"
                        >
                          {selectingId === user.id ? (
                            <span aria-hidden="true" className="loading loading-spinner size-4" />
                          ) : null}
                          {user.username}
                        </button>
                        <div className="text-xs text-base-content/60">{user.name || '-'}</div>
                        <div className="mt-1 flex items-center gap-1">
                          <code className="select-all text-[11px] text-base-content/60">
                            {user.id}
                          </code>
                          <CopyButton value={user.id} title={`Copy ${user.username} user ID`} />
                        </div>
                      </td>
                      <td className="text-base-content/70">{user.address || '-'}</td>
                      <td className="text-base-content/70">
                        {formatBytes(user.quota?.used)} / {formatBytes(user.quota?.allowed)}
                      </td>
                      <td>
                        <span
                          className={`badge badge-sm badge-soft ${{ success: 'badge-success', warning: 'badge-warning', danger: 'badge-error', muted: 'badge-ghost' }[status.tone]}`}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!users.length ? (
                  <tr>
                    <td className="text-center text-base-content/60" colSpan={4}>
                      {loading ? (
                        <span role="status" className="inline-flex items-center gap-2">
                          <span aria-hidden="true" className="loading loading-spinner size-4" />
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

          <div className="flex items-center justify-between border-t border-base-300 px-4 py-3">
            <div className="text-sm text-base-content/60">{users.length} shown</div>
            <div className="flex gap-2">
              <button
                title="Previous page"
                onClick={onPrevious}
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
                onClick={onNext}
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

        {selectingId ? (
          <aside className="card border border-base-300 bg-base-100 p-6">
            <div
              role="status"
              className="flex items-center justify-center gap-2 text-sm text-base-content/60"
            >
              <span aria-hidden="true" className="loading loading-spinner size-4" />
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
      className="card border border-base-300 bg-base-100 p-4 shadow-xs"
    >
      <div className="grid gap-3 md:grid-cols-5">
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">Username</span>
          <input
            value={username}
            onChange={event => setUsername(event.target.value)}
            className="input w-full"
          />
        </label>
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">Password</span>
          <input
            value={password}
            onChange={event => setPassword(event.target.value)}
            type="password"
            className="input w-full"
          />
        </label>
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">Address</span>
          <input
            value={address}
            onChange={event => setAddress(event.target.value)}
            type="email"
            className="input w-full"
          />
        </label>
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">Name</span>
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            className="input w-full"
          />
        </label>
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">Quota</span>
          <select
            value={quota}
            onChange={event => setQuota(Number(event.target.value))}
            className="select w-full"
          >
            {quotaChoices.map(choice => (
              <option key={choice.label} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-base-content/80">
          <input
            type="checkbox"
            checked={requirePasswordChange}
            onChange={event => setRequirePasswordChange(event.target.checked)}
            className="checkbox checkbox-primary checkbox-sm"
          />
          Require password change
        </label>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy}
          aria-busy={Boolean(busy) || undefined}
        >
          {busy ? <span aria-hidden="true" className="loading loading-spinner loading-xs" /> : null}
          <Plus className="h-4 w-4" />
          Create
        </button>
      </div>
      {error ? (
        <div className="alert alert-error alert-soft mt-3">
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
      <aside className="card border border-dashed border-base-300 bg-base-100 p-6 text-center text-sm text-base-content/60">
        <Users className="mx-auto mb-3 h-8 w-8 text-base-content/30" />
        No user selected
      </aside>
    );
  }

  return (
    <aside className="space-y-4">
      <div className="card border border-base-300 bg-base-100 p-4 shadow-xs">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold">{user.username}</h3>
            <p className="truncate text-sm text-base-content/60">
              {user.address || user.name || user.id}
            </p>
          </div>
          <span
            className={`badge badge-sm badge-soft ${{ success: 'badge-success', warning: 'badge-warning', danger: 'badge-error', muted: 'badge-ghost' }[status.tone]}`}
          >
            {status.label}
          </span>
        </div>

        <div className="mb-4 card card-border rounded-box bg-base-200 p-3">
          <p className="mb-1 text-xs font-semibold text-base-content/60">User ID</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 select-all break-all text-xs">{user.id}</code>
            <CopyButton value={user.id} title="Copy user ID" />
          </div>
          <button type="button" className="btn btn-ghost mt-2" onClick={() => onSecurity(user.id)}>
            <Shield className="h-4 w-4" />
            Open security log
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              {'Name'}
            </dt>
            <dd className="mt-1 break-words font-medium">{user.name || '-'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              {'Password'}
            </dt>
            <dd className="mt-1 break-words font-medium">
              {user.hasPasswordSet ? 'Set' : 'Not set'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              {'2FA'}
            </dt>
            <dd className="mt-1 break-words font-medium">
              {user.enabled2fa?.length ? user.enabled2fa.join(', ') : '-'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              {'Spam level'}
            </dt>
            <dd className="mt-1 break-words font-medium">
              {user.spamLevel === undefined ? '-' : String(user.spamLevel)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              {'Quota'}
            </dt>
            <dd className="mt-1 break-words font-medium">{`${formatBytes(quota?.used)} / ${formatBytes(quota?.allowed)}`}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              {'Tags'}
            </dt>
            <dd className="mt-1 break-words font-medium">
              {user.tags?.length ? user.tags.join(', ') : '-'}
            </dd>
          </div>
        </dl>
      </div>

      <form
        onSubmit={saveUser}
        noValidate
        className="card border border-base-300 bg-base-100 p-4 shadow-xs"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Account</h3>
          </div>
          <button
            title="Delete user"
            onClick={() => setPendingUserDelete(true)}
            aria-label="Delete user"
            type="button"
            className="btn btn-square btn-sm btn-error btn-soft"
            disabled={savingUser || deletingUser || deletingUser}
            aria-busy={Boolean(deletingUser) || undefined}
          >
            {deletingUser ? (
              <span aria-hidden="true" className="loading loading-spinner loading-xs" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="space-y-3">
          <label className="fieldset min-w-0">
            <span className="fieldset-legend">Name</span>
            <input
              value={nameDraft}
              onChange={event => setNameDraft(event.target.value)}
              className="input w-full"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="fieldset min-w-0">
              <span className="fieldset-legend">Quota bytes</span>
              <input
                value={quotaDraft}
                onChange={event => setQuotaDraft(event.target.value)}
                type="number"
                min="0"
                className="input w-full"
              />
            </label>
            <label className="fieldset min-w-0">
              <span className="fieldset-legend">Spam level</span>
              <input
                value={spamLevelDraft}
                onChange={event => setSpamLevelDraft(event.target.value)}
                type="number"
                className="input w-full"
              />
            </label>
          </div>
          <label className="fieldset min-w-0">
            <span className="fieldset-legend">Tags</span>
            <input
              value={tagsDraft}
              onChange={event => setTagsDraft(event.target.value)}
              className="input w-full"
              placeholder="vip, internal"
            />
          </label>
          <label className="fieldset min-w-0">
            <span className="fieldset-legend">Custom metadata (JSON)</span>
            <textarea
              value={metadataDraft}
              onChange={event => setMetadataDraft(event.target.value)}
              rows={6}
              spellCheck={false}
              className="textarea w-full font-mono text-xs"
              aria-describedby="user-metadata-help"
            />
          </label>
          <p id="user-metadata-help" className="text-xs text-base-content/60">
            Add custom fields as a JSON object, for example {'{"department": "Sales"}'}. Saving
            replaces the metadata object; use {'{}'} to clear it.
          </p>
          <div className="grid gap-2 text-sm text-base-content/80">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={disabledDraft}
                onChange={event => setDisabledDraft(event.target.checked)}
                className="checkbox checkbox-primary checkbox-sm"
              />
              Disabled
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={suspendedDraft}
                onChange={event => setSuspendedDraft(event.target.checked)}
                className="checkbox checkbox-primary checkbox-sm"
              />
              Suspended
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={require2faDraft}
                onChange={event => setRequire2faDraft(event.target.checked)}
                className="checkbox checkbox-primary checkbox-sm"
              />
              Require 2FA
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={disable2faDraft}
                onChange={event => setDisable2faDraft(event.target.checked)}
                className="checkbox checkbox-primary checkbox-sm"
              />
              Disable current 2FA
            </label>
          </div>
          {userError ? (
            <div className="alert alert-error alert-soft">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="min-w-0 break-words">{userError}</span>
            </div>
          ) : null}
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={savingUser}
            aria-busy={Boolean(savingUser) || undefined}
          >
            {savingUser ? (
              <span aria-hidden="true" className="loading loading-spinner loading-xs" />
            ) : null}
            <Save className="h-4 w-4" />
            Save user
          </button>
        </div>
      </form>

      <div className="card border border-base-300 bg-base-100 shadow-xs">
        <div className="flex items-center gap-2 border-b border-base-300 px-4 py-3">
          <Mail className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Addresses</h3>
        </div>
        <div className="divide-y divide-base-300">
          {addresses.map(item => (
            <div key={item.id} className="px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 break-all font-medium">{item.address || item.id}</span>
                <div className="flex shrink-0 items-center gap-2">
                  {item.main ? (
                    <span className="badge badge-sm badge-soft badge-success">Main</span>
                  ) : null}
                  {!item.main ? (
                    <button
                      title="Set as main address"
                      onClick={() => makeAddressMain(item)}
                      aria-label="Set as main address"
                      type="button"
                      className="btn btn-square btn-sm btn-ghost"
                      disabled={Boolean(addressBusy) || addressBusy === item.id}
                      aria-busy={Boolean(addressBusy === item.id) || undefined}
                    >
                      {addressBusy === item.id ? (
                        <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                    </button>
                  ) : null}
                  <button
                    title="Delete address"
                    onClick={() => setPendingAddressDelete(item)}
                    aria-label="Delete address"
                    type="button"
                    className="btn btn-square btn-sm btn-error btn-soft"
                    disabled={Boolean(addressBusy) || addressBusy === item.id}
                    aria-busy={Boolean(addressBusy === item.id) || undefined}
                  >
                    {addressBusy === item.id ? (
                      <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="text-base-content/60">{item.name || '-'}</div>
              {item.targets?.length ? (
                <div className="mt-1 break-all text-xs text-base-content/60">
                  {item.targets.join(', ')}
                </div>
              ) : null}
            </div>
          ))}
          {!addresses.length ? (
            <div className="px-4 py-6 text-center text-sm text-base-content/60">No addresses</div>
          ) : null}
        </div>
        {addressError ? (
          <div className="alert alert-error alert-soft mx-4 mt-4">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words">{addressError}</span>
          </div>
        ) : null}
        <form onSubmit={submit} noValidate className="space-y-3 border-t border-base-300 p-4">
          <label className="fieldset min-w-0">
            <span className="fieldset-legend">Address</span>
            <input
              value={address}
              onChange={event => setAddress(event.target.value)}
              className="input w-full"
            />
          </label>
          <label className="fieldset min-w-0">
            <span className="fieldset-legend">Name</span>
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              className="input w-full"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-base-content/80">
              <input
                type="checkbox"
                checked={main}
                onChange={event => setMain(event.target.checked)}
                className="checkbox checkbox-primary checkbox-sm"
              />
              Main
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-base-content/80">
              <input
                type="checkbox"
                checked={allowWildcard}
                onChange={event => setAllowWildcard(event.target.checked)}
                className="checkbox checkbox-primary checkbox-sm"
              />
              Wildcard
            </label>
          </div>
          {error ? (
            <div className="alert alert-error alert-soft">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            className="btn btn-outline btn-primary w-full"
            disabled={busy}
            aria-busy={Boolean(busy) || undefined}
          >
            {busy ? (
              <span aria-hidden="true" className="loading loading-spinner loading-xs" />
            ) : null}
            <Plus className="h-4 w-4" />
            Add address
          </button>
        </form>
      </div>

      <ConfirmDialog
        open={Boolean(pendingAddressDelete)}
        title="Delete address"
        message={
          pendingAddressDelete ? (
            <>
              Delete{' '}
              <strong className="break-all text-base-content">
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
            Delete <strong className="break-all text-base-content">{user.username}</strong> and its
            mailbox data?
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
          <p className="text-sm text-base-content/60">{total} keys</p>
        </div>
        <button
          title="Refresh"
          onClick={onRefresh}
          aria-label="Refresh"
          type="button"
          className="btn btn-square btn-sm btn-ghost"
          disabled={loading}
          aria-busy={Boolean(loading) || undefined}
        >
          {loading ? (
            <span aria-hidden="true" className="loading loading-spinner loading-xs" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="card border border-base-300 bg-base-100 shadow-xs">
          <div className="border-b border-base-300 p-4">
            <form onSubmit={submitSearch} className="flex gap-2">
              <div className="relative flex min-w-0 flex-1 items-center">
                <Search className="pointer-events-none absolute z-10 left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/50" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Domain"
                  className="input w-full pl-9 pr-3"
                />
              </div>
              <button
                type="submit"
                className="btn btn-outline"
                disabled={loading}
                aria-busy={Boolean(loading) || undefined}
              >
                {loading ? (
                  <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                ) : null}
                <Search className="h-4 w-4" />
                Search
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-sm table-zebra w-full">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Selector</th>
                  <th>Fingerprint</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {keys.map(key => {
                  const active = selectedKey?.id === key.id;
                  return (
                    <tr
                      key={key.id}
                      onClick={() => onSelect(key)}
                      className={`cursor-pointer transition ${active ? 'bg-primary/10' : 'hover:bg-base-200'}`}
                    >
                      <td>
                        <div className="font-medium">{key.domain}</div>
                        <div className="text-xs text-base-content/60">{key.description || '-'}</div>
                      </td>
                      <td className="text-base-content/70">{key.selector}</td>
                      <td className="font-mono text-xs text-base-content/70">{key.fingerprint}</td>
                      <td className="text-base-content/70">{formatDate(key.created)}</td>
                    </tr>
                  );
                })}
                {!keys.length ? (
                  <tr>
                    <td className="text-center text-base-content/60" colSpan={4}>
                      No DKIM keys found
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-base-300 px-4 py-3">
            <div className="text-sm text-base-content/60">{keys.length} shown</div>
            <div className="flex gap-2">
              <button
                title="Previous page"
                onClick={onPrevious}
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
                onClick={onNext}
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
      className="card border border-base-300 bg-base-100 p-4 shadow-xs"
    >
      <div className="mb-3 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Create or update key</h3>
      </div>
      <div className="space-y-3">
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">Domain</span>
          <input
            value={domain}
            onChange={event => setDomain(event.target.value)}
            className="input w-full"
            placeholder="mail domain, for example example.com"
          />
        </label>
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">Selector</span>
          <input
            value={selector}
            onChange={event => setSelector(event.target.value)}
            className="input w-full"
          />
        </label>
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">Description</span>
          <input
            value={description}
            onChange={event => setDescription(event.target.value)}
            className="input w-full"
          />
        </label>
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">Private key</span>
          <textarea
            value={privateKey}
            onChange={event => setPrivateKey(event.target.value)}
            aria-describedby="dkim-private-key-help"
            className="textarea w-full min-h-28 font-mono text-xs"
          />
          <span id="dkim-private-key-help" className="mt-1 block text-xs text-base-content/60">
            Leave blank to automatically generate a 2048-bit RSA key.
          </span>
        </label>
      </div>
      {error ? (
        <div className="alert alert-error alert-soft mt-3">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : null}
      <button
        type="submit"
        className="btn btn-primary mt-3 w-full"
        disabled={busy}
        aria-busy={Boolean(busy) || undefined}
      >
        {busy ? <span aria-hidden="true" className="loading loading-spinner loading-xs" /> : null}
        <Save className="h-4 w-4" />
        Save DKIM key
      </button>
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
      <div className="card border border-dashed border-base-300 bg-base-100 p-6 text-center text-sm text-base-content/60">
        <KeyRound className="mx-auto mb-3 h-8 w-8 text-base-content/30" />
        No DKIM key selected
      </div>
    );
  }

  return (
    <div className="card border border-base-300 bg-base-100 shadow-xs">
      <div className="flex items-start justify-between gap-3 border-b border-base-300 px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-semibold">{selectedKey.domain}</h3>
          <p className="truncate text-sm text-base-content/60">{selectedKey.selector}</p>
        </div>
        <button
          title="Delete DKIM key"
          onClick={() => setConfirmOpen(true)}
          aria-label="Delete DKIM key"
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

      <div className="space-y-4 p-4 text-sm">
        <dl className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              {'Fingerprint'}
            </dt>
            <dd className="mt-1 break-words font-medium">{selectedKey.fingerprint}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              {'Created'}
            </dt>
            <dd className="mt-1 break-words font-medium">{formatDate(selectedKey.created)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              {'Description'}
            </dt>
            <dd className="mt-1 break-words font-medium">{selectedKey.description || '-'}</dd>
          </div>
        </dl>

        {selectedKey.dnsTxt ? (
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-base-content/60">
                TXT name
              </div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-base-200 px-3 py-2 text-xs">
                  {selectedKey.dnsTxt.name}
                </code>
                <CopyButton value={selectedKey.dnsTxt.name} title="Copy TXT name" />
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-base-content/60">
                TXT value
              </div>
              <div className="flex items-start gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-base-200 px-3 py-2 text-xs">
                  {selectedKey.dnsTxt.value}
                </code>
                <CopyButton value={selectedKey.dnsTxt.value} title="Copy TXT value" />
              </div>
            </div>
          </div>
        ) : (
          <div className="card card-border rounded-box bg-base-200 px-3 py-2 text-base-content/60">
            DNS TXT data is loaded when opening key details.
          </div>
        )}

        {selectedKey.publicKey ? (
          <details className="collapse collapse-arrow border border-base-300 bg-base-200">
            <summary className="collapse-title text-sm font-semibold">Public key</summary>
            <code className="collapse-content block break-all text-xs text-base-content/70">
              {selectedKey.publicKey}
            </code>
          </details>
        ) : null}

        {error ? (
          <div className="alert alert-error alert-soft">
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
            Delete DKIM key for{' '}
            <strong className="break-all text-base-content">{selectedKey.domain}</strong>?
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
            className="select w-full"
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input
            value={draft}
            onChange={event => setDraft(event.target.value)}
            type={numericSetting ? 'number' : 'text'}
            className="input w-full"
            aria-label={`${setting.key} value`}
          />
        )}
        <button
          type="submit"
          title="Save setting"
          aria-label={`Save ${setting.key}`}
          className="btn btn-outline w-9 btn-square btn-sm"
          disabled={!dirty || saving || saving}
          aria-busy={Boolean(saving) || undefined}
        >
          {saving ? (
            <span aria-hidden="true" className="loading loading-spinner loading-xs" />
          ) : null}
          <Save className="h-4 w-4" />
        </button>
        <button
          title="Discard edits"
          onClick={() => setDraft(String(setting.value))}
          disabled={!dirty || saving}
          aria-label="Discard edits"
          type="button"
          className="btn btn-square btn-sm btn-ghost"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
      {error ? <div className="text-xs font-medium text-error">{error}</div> : null}
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
          <p className="text-sm text-base-content/60">
            {visibleSettings.length} of {settings.length} settings
          </p>
        </div>
        <button
          title="Refresh"
          onClick={onRefresh}
          aria-label="Refresh"
          type="button"
          className="btn btn-square btn-sm btn-ghost"
          disabled={loading}
          aria-busy={Boolean(loading) || undefined}
        >
          {loading ? (
            <span aria-hidden="true" className="loading loading-spinner loading-xs" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="card border border-base-300 bg-base-100 shadow-xs">
        <div className="border-b border-base-300 p-4">
          <div className="flex gap-2">
            <div className="relative flex min-w-0 flex-1 items-center">
              <Search className="pointer-events-none absolute z-10 left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/50" />
              <input
                value={filter}
                onChange={event => setFilter(event.target.value)}
                placeholder="Search settings by key or description"
                aria-label="Search settings"
                className="input w-full pl-9 pr-3"
              />
            </div>
            {filter ? (
              <button type="button" onClick={() => setFilter('')} className="btn btn-outline">
                Clear
              </button>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories
              .filter(item => !item.value || item.count > 0)
              .map(item => (
                <button
                  key={item.label}
                  type="button"
                  aria-pressed={category === item.value}
                  onClick={() => setCategory(item.value)}
                  className={`btn btn-sm ${category === item.value ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {item.label} <span className="ml-1 opacity-70">{item.count}</span>
                </button>
              ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table table-sm table-zebra w-full">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th>Default</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {visibleSettings.map(setting => (
                <tr key={setting.key}>
                  <td>
                    <div className="font-medium">{setting.key}</div>
                    <div className="max-w-xl text-xs text-base-content/60">
                      {setting.description || setting.name || '-'}
                    </div>
                  </td>
                  <td className="text-base-content/80">
                    <EditableSettingValue setting={setting} onUpdate={onUpdate} />
                  </td>
                  <td className="text-base-content/60">{String(setting.default ?? '-')}</td>
                  <td>
                    <span
                      className={`badge badge-sm badge-soft ${settingIsCustom(setting) ? 'badge-success' : 'badge-ghost'}`}
                    >
                      {settingIsCustom(setting) ? 'Custom' : setting.type || 'Default'}
                    </span>
                  </td>
                </tr>
              ))}
              {loading ? (
                <tr>
                  <td colSpan={4}>
                    <div
                      role="status"
                      className="flex items-center justify-center gap-2 text-base-content/60"
                    >
                      <span aria-hidden="true" className="loading loading-spinner size-4" />
                      Loading settings…
                    </div>
                  </td>
                </tr>
              ) : !visibleSettings.length ? (
                <tr>
                  <td colSpan={4} className="text-center text-base-content/60">
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
  const [view, setActiveView] = useState<View>(() => readView(window.location.href));

  function setView(next: View) {
    if (next === view) {
      return;
    }
    window.history.pushState(null, '', viewUrl(window.location.href, next));
    setActiveView(next);
  }

  useEffect(() => {
    const onPopState = () => setActiveView(readView(window.location.href));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
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
  const [noticeState, setNoticeState] = useState({ message: '', tone: 'warning' });
  const { message: notice, tone: noticeTone } = noticeState;

  function setNotice(message: string, tone: 'warning' | 'success' = 'warning') {
    setNoticeState({ message, tone });
  }
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
    setNotice(`Updated ${setting.key}`, 'success');
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
    setNotice(`Saved DKIM key for ${response.domain}`, 'success');
    await loadDkim();
  }

  async function removeDkimKey(key: DkimKey) {
    await deleteDkimKey(key.id);
    setNotice(`Deleted DKIM key for ${key.domain}`, 'success');
    setSelectedDkimKey(current => (current?.id === key.id ? null : current));
    await loadDkim();
  }

  async function runRefresh(message: string, task: () => Promise<void>) {
    setRefreshingNotice(message);
    try {
      await task();
      setNotice('Refresh loaded', 'success');
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
      <main className="grid min-h-screen place-items-center bg-base-200 text-sm text-base-content/60">
        <RefreshCw className="mb-3 h-6 w-6 animate-spin text-primary" />
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
        <div className="toast toast-top toast-end pointer-events-none top-24 z-40 max-w-[calc(100vw-2rem)]">
          {refreshingNotice ? (
            <div key={refreshingNotice} className="alert alert-info alert-soft pointer-events-auto">
              <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
              <span className="min-w-0 break-words">{refreshingNotice}</span>
            </div>
          ) : null}
          {notice ? (
            <div
              key={notice}
              role="status"
              aria-live="polite"
              className={`alert alert-soft pointer-events-auto ${noticeTone === 'success' ? 'alert-success' : 'alert-warning'}`}
            >
              <span className="flex min-w-0 items-start gap-2">
                {noticeTone === 'success' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span className="break-words">{notice}</span>
              </span>
              <button
                type="button"
                onClick={() => setNotice('')}
                className="btn btn-ghost btn-sm shrink-0"
              >
                Dismiss
              </button>
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
            setNotice(`Created user ${id}`, 'success');
            loadUsers();
          }}
          onChanged={() => {
            setNotice('Updated user', 'success');
            loadUsers();
            if (selectedUser) {
              selectUser(selectedUser);
            }
          }}
          onDeleted={user => {
            setNotice(`Deleted user ${user.username}`, 'success');
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
