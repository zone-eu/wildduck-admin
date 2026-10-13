import { FormEvent, useState } from 'react';
import { Fingerprint, KeyRound, LogOut, ShieldCheck, Trash2 } from 'lucide-react';
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration
} from '@simplewebauthn/browser';
import {
  adminAuthenticationOptions,
  adminRegistrationOptions,
  authenticateAdminPasskey,
  enableAdminTotp,
  registerAdminPasskey,
  removeAdminPasskey,
  removeAdminTotp,
  setupAdminTotp,
  verifyAdminTotp
} from '../api';
import { ThemeToggle } from './ThemeToggle';
import type { SessionResponse } from '../types';
import {
  Button,
  ConfirmDialog,
  CopyButton,
  ErrorNotice,
  Field,
  StatusPill,
  formatDate
} from './ui';

const primaryButton =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50';
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Authentication failed';

function webauthnAvailability() {
  const hostname = window.location.hostname;
  const ipAddress = /^\d+(\.\d+){3}$/.test(hostname) || hostname.includes(':');
  const localhostUrl = new URL(window.location.href);
  localhostUrl.hostname = 'localhost';
  return {
    supported: !ipAddress && window.isSecureContext && browserSupportsWebAuthn(),
    ipAddress,
    localhostUrl: ['127.0.0.1', '[::1]', '::1'].includes(hostname) ? localhostUrl.href : null
  };
}

function WebAuthnUnavailableNotice() {
  const availability = webauthnAvailability();
  if (availability.supported) {
    return null;
  }
  return (
    <div className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
      <p>
        {availability.ipAddress
          ? 'Passkeys require a domain name. WebAuthn cannot use an IP address such as 127.0.0.1.'
          : 'Passkeys need a browser with WebAuthn support on HTTPS or localhost.'}
      </p>
      {availability.localhostUrl ? (
        <p>
          <a href={availability.localhostUrl} className="font-semibold underline">
            Open this panel on localhost
          </a>
          . You will need to sign in again.
        </p>
      ) : availability.ipAddress ? (
        <p>Open the panel using its configured HTTPS domain name.</p>
      ) : null}
    </div>
  );
}

export function AdminTwoFactorGate({
  session,
  onSession,
  onLogout
}: {
  session: SessionResponse;
  onSession: (session: SessionResponse) => void;
  onLogout: () => void;
}) {
  const status = session.twoFactor;
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function verifyTotp(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSession(await verifyAdminTotp(token));
    } catch (err) {
      setError(errorMessage(err));
      setToken('');
    } finally {
      setBusy(false);
    }
  }

  async function verifyPasskey() {
    setBusy(true);
    setError('');
    try {
      const optionsJSON = await adminAuthenticationOptions();
      const response = await startAuthentication({ optionsJSON });
      onSession(await authenticateAdminPasskey(response));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-mist px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/duck.png"
              alt=""
              className="h-11 w-11 rounded-xl bg-brand-50 dark:bg-teal-950 p-1"
            />
            <div>
              <h1 className="font-display text-xl font-semibold">Administrator verification</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Signed in as {session.user}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button type="button" className={secondaryButton} onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
        {status.setupRequired ? (
          <>
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-4 text-sm text-amber-900 dark:text-amber-200">
              Two-factor authentication is required. Add an available authentication method to
              continue to the admin panel.
            </div>
            <AdminSecuritySettings session={session} onSession={onSession} enrollment />
          </>
        ) : (
          <section className="space-y-5 rounded-xl border border-line bg-white dark:bg-slate-900 p-6 shadow-panel">
            <div>
              <h2 className="font-display text-xl font-semibold">
                Complete two-factor authentication
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Verify with one of your enrolled methods to access the panel.
              </p>
            </div>
            <ErrorNotice message={error} />
            {status.methods.includes('totp') ? (
              <form onSubmit={verifyTotp} className="space-y-3">
                <Field label="Authenticator code">
                  <input
                    autoFocus
                    className="input text-lg tracking-widest"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={token}
                    onChange={event => setToken(event.target.value.replace(/\D/g, ''))}
                    required
                    disabled={busy}
                  />
                </Field>
                <Button
                  loading={busy}
                  className={`${primaryButton} w-full`}
                  disabled={busy}
                  type="submit"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {busy ? 'Verifying…' : 'Verify code'}
                </Button>
              </form>
            ) : null}
            {status.methods.includes('webauthn') ? (
              <div className="space-y-2">
                <Button
                  loading={busy}
                  className={`${secondaryButton} w-full`}
                  type="button"
                  disabled={busy || !webauthnAvailability().supported}
                  onClick={verifyPasskey}
                >
                  <Fingerprint className="h-4 w-4" />
                  Use a passkey or security key
                </Button>
                <WebAuthnUnavailableNotice />
              </div>
            ) : null}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This sign-in step expires after ten minutes. Sign out and sign in again if it expires.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

export function AdminSecuritySettings({
  session,
  onSession,
  enrollment = false
}: {
  session: SessionResponse;
  onSession: (session: SessionResponse) => void;
  enrollment?: boolean;
}) {
  const status = session.twoFactor;
  const [password, setPassword] = useState('');
  const [name, setName] = useState('My security key');
  const [setup, setSetup] = useState<{ secret: string; uri: string; qrCode: string } | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [removing, setRemoving] = useState<{
    type: 'totp' | 'webauthn';
    id?: string;
    name: string;
  } | null>(null);
  const webauthnSupported = webauthnAvailability().supported;

  async function run(action: string, task: () => Promise<void>) {
    setBusy(action);
    setError('');
    setNotice('');
    try {
      await task();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  }

  async function beginTotp() {
    await run('setup', async () => {
      setSetup(await setupAdminTotp(password));
      setToken('');
      setPassword('');
    });
  }

  async function confirmTotp(event: FormEvent) {
    event.preventDefault();
    await run('enable', async () => {
      onSession(await enableAdminTotp(token));
      setSetup(null);
      setToken('');
      setNotice('Authenticator app added. Other admin sessions have been signed out.');
    });
  }

  async function addPasskey(event: FormEvent) {
    event.preventDefault();
    await run('register', async () => {
      const optionsJSON = await adminRegistrationOptions(name, password);
      const response = await startRegistration({ optionsJSON });
      onSession(await registerAdminPasskey(response));
      setPassword('');
      setSetup(null);
      setNotice('Passkey added. Other admin sessions have been signed out.');
    });
  }

  async function remove() {
    if (!removing) {
      return;
    }
    const target = removing;
    setRemoving(null);
    await run(target.type === 'totp' ? 'remove-totp' : `remove-${target.id}`, async () => {
      const response =
        target.type === 'totp'
          ? await removeAdminTotp(password)
          : await removeAdminPasskey(target.id!, password);
      onSession(response);
      setPassword('');
      setSetup(null);
      setNotice('Authentication method removed. Other admin sessions have been signed out.');
    });
  }

  const lastTotp = status.strict && status.methods.length === 1 && status.methods.includes('totp');
  const lastPasskey =
    status.strict &&
    status.methods.length === 1 &&
    status.methods.includes('webauthn') &&
    status.credentials.length === 1;

  return (
    <section className="space-y-5 rounded-xl border border-line bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">
            {enrollment ? 'Set up two-factor authentication' : 'Administrator security'}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Protect your local admin account with an authenticator app or a passkey.
          </p>
        </div>
        <StatusPill
          label={
            status.strict ? '2FA required' : status.methods.length ? '2FA enabled' : '2FA optional'
          }
          tone={status.methods.length ? 'success' : status.strict ? 'warning' : 'muted'}
        />
      </div>
      <ErrorNotice message={error} />
      {notice ? (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
          {notice}
        </p>
      ) : null}
      {!enrollment ? (
        <div className="max-w-md space-y-2">
          <Field label="Current administrator password">
            <input
              type="password"
              className="input"
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              disabled={Boolean(busy)}
            />
          </Field>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter your password before adding or removing a method.
          </p>
        </div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-line p-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-brand-600 dark:text-teal-300" />
            <h3 className="font-semibold">Authenticator app</h3>
          </div>
          {!status.totpAllowed ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Authenticator apps are disabled by the administrator configuration.
            </p>
          ) : status.totpEnrolled ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Your authenticator app is enrolled. Enter its six-digit code at sign-in.
              </p>
              <Button
                loading={busy === 'remove-totp'}
                danger
                className={secondaryButton}
                type="button"
                disabled={Boolean(busy) || lastTotp || !password}
                onClick={() => setRemoving({ type: 'totp', name: 'your authenticator app' })}
              >
                <Trash2 className="h-4 w-4" />
                Remove authenticator
              </Button>
              {lastTotp ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Add a passkey before removing your last required method.
                </p>
              ) : null}
            </div>
          ) : setup ? (
            <form onSubmit={confirmTotp} className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Scan this code in your authenticator app, then enter the code it generates. Setup
                expires after five minutes.
              </p>
              <img
                src={setup.qrCode}
                alt="Authenticator app setup QR code"
                className="mx-auto h-60 w-60 max-w-full"
              />
              <Field label="Manual setup key">
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-sm">
                    {setup.secret}
                  </code>
                  <CopyButton value={setup.secret} title="Copy setup key" />
                </div>
              </Field>
              <Field label="Authenticator code">
                <input
                  className="input"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={token}
                  onChange={event => setToken(event.target.value.replace(/\D/g, ''))}
                  required
                  disabled={Boolean(busy)}
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  loading={busy === 'enable'}
                  type="submit"
                  className={primaryButton}
                  disabled={Boolean(busy)}
                >
                  {busy === 'enable' ? 'Verifying…' : 'Verify and enable'}
                </Button>
                <Button
                  className={secondaryButton}
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    setSetup(null);
                    setToken('');
                  }}
                >
                  Cancel setup
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Use an authenticator app such as Google Authenticator, 1Password, or another TOTP
                app.
              </p>
              <Button
                loading={busy === 'setup'}
                type="button"
                className={primaryButton}
                disabled={Boolean(busy) || (!enrollment && !password)}
                onClick={beginTotp}
              >
                {busy === 'setup' ? 'Preparing…' : 'Set up authenticator'}
              </Button>
            </div>
          )}
        </div>
        <div className="space-y-4 rounded-xl border border-line p-4">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-brand-600 dark:text-teal-300" />
            <h3 className="font-semibold">Passkeys and security keys</h3>
          </div>
          {!status.webauthnAllowed ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Passkeys are disabled by the administrator configuration.
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Use your device, password manager, or a physical security key as your second sign-in
                step.
              </p>
              {status.credentials.length ? (
                <ul className="space-y-2">
                  {status.credentials.map(credential => (
                    <li
                      key={credential.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 dark:bg-slate-800 p-3"
                    >
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold">{credential.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Added {formatDate(credential.created)}
                        </p>
                      </div>
                      <Button
                        loading={busy === `remove-${credential.id}`}
                        danger
                        type="button"
                        aria-label={`Remove ${credential.name}`}
                        title={
                          lastPasskey
                            ? 'Add another method before removing your last required passkey'
                            : `Remove ${credential.name}`
                        }
                        className="rounded-lg p-2 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950 disabled:opacity-40"
                        disabled={Boolean(busy) || lastPasskey || !password}
                        onClick={() =>
                          setRemoving({
                            type: 'webauthn',
                            id: credential.id,
                            name: credential.name
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <form className="space-y-3" onSubmit={addPasskey}>
                <Field label="Passkey name">
                  <input
                    className="input"
                    value={name}
                    onChange={event => setName(event.target.value)}
                    maxLength={128}
                    required
                    disabled={Boolean(busy)}
                    placeholder="Laptop or security key"
                  />
                </Field>
                <Button
                  loading={busy === 'register'}
                  type="submit"
                  className={primaryButton}
                  disabled={
                    Boolean(busy) ||
                    !webauthnSupported ||
                    Boolean(setup) ||
                    (!enrollment && !password)
                  }
                >
                  <Fingerprint className="h-4 w-4" />
                  {busy === 'register' ? 'Waiting for your device…' : 'Add passkey'}
                </Button>
              </form>
              <WebAuthnUnavailableNotice />
              {lastPasskey ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Add another passkey or an authenticator app before removing the last method.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove authentication method?"
        message={`Remove ${removing?.name || 'this method'} from your administrator account? Other admin sessions will be signed out.`}
        confirmLabel="Remove method"
        busy={Boolean(busy)}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </section>
  );
}
