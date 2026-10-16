import { FormEvent, useState } from 'react';
import {
  FingerprintIcon as Fingerprint,
  KeyIcon as KeyRound,
  SignOutIcon as LogOut,
  ShieldCheckIcon as ShieldCheck,
  TrashIcon as Trash2
} from '@phosphor-icons/react';
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
import { ConfirmDialog, CopyButton, formatDate } from './ui';

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
    <div className="space-y-2 text-sm text-warning">
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
    <main className="min-h-screen bg-base-200 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/duck.png" alt="" className="h-11 w-11 rounded-xl bg-primary/10 p-1" />
            <div>
              <h1 className="font-display text-xl font-semibold">Administrator verification</h1>
              <p className="text-sm text-base-content/60">Signed in as {session.user}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button type="button" className="btn btn-outline" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
        {status.setupRequired ? (
          <>
            <div className="alert alert-warning alert-soft block text-sm">
              Two-factor authentication is required. Add an available authentication method to
              continue to the admin panel.
            </div>
            <AdminSecuritySettings session={session} onSession={onSession} enrollment />
          </>
        ) : (
          <section className="space-y-5 card border border-base-300 bg-base-100 p-6 shadow-sm">
            <div>
              <h2 className="font-display text-xl font-semibold">
                Complete two-factor authentication
              </h2>
              <p className="mt-1 text-sm text-base-content/60">
                Verify with one of your enrolled methods to access the panel.
              </p>
            </div>
            {error ? (
              <div role="alert" className="alert alert-error alert-soft">
                <span className="min-w-0 break-words">{error}</span>
              </div>
            ) : null}
            {status.methods.includes('totp') ? (
              <form onSubmit={verifyTotp} className="space-y-3">
                <label className="fieldset min-w-0">
                  <span className="fieldset-legend">Authenticator code</span>
                  <input
                    autoFocus
                    className="input w-full text-lg tracking-widest"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={token}
                    onChange={event => setToken(event.target.value.replace(/\D/g, ''))}
                    required
                    disabled={busy}
                  />
                </label>
                <button
                  className="btn btn-primary w-full"
                  type="submit"
                  disabled={busy}
                  aria-busy={Boolean(busy) || undefined}
                >
                  {busy ? (
                    <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                  ) : null}
                  <ShieldCheck className="h-4 w-4" />
                  {busy ? 'Verifying…' : 'Verify code'}
                </button>
              </form>
            ) : null}
            {status.methods.includes('webauthn') ? (
              <div className="space-y-2">
                <button
                  className="btn btn-outline w-full"
                  type="button"
                  onClick={verifyPasskey}
                  disabled={busy || !webauthnAvailability().supported || busy}
                  aria-busy={Boolean(busy) || undefined}
                >
                  {busy ? (
                    <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                  ) : null}
                  <Fingerprint className="h-4 w-4" />
                  Use a passkey or security key
                </button>
                <WebAuthnUnavailableNotice />
              </div>
            ) : null}
            <p className="text-xs text-base-content/60">
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
    <section className="space-y-5 card border border-base-300 bg-base-100 p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">
            {enrollment ? 'Set up two-factor authentication' : 'Administrator security'}
          </h2>
          <p className="mt-1 text-sm text-base-content/60">
            Protect your local admin account with an authenticator app or a passkey.
          </p>
        </div>
        <span
          className={`badge badge-sm badge-soft ${status.methods.length ? 'badge-success' : status.strict ? 'badge-warning' : 'badge-ghost'}`}
        >
          {status.strict ? '2FA required' : status.methods.length ? '2FA enabled' : '2FA optional'}
        </span>
      </div>
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
      {!enrollment ? (
        <div className="max-w-md space-y-2">
          <label className="fieldset min-w-0">
            <span className="fieldset-legend">Current administrator password</span>
            <input
              type="password"
              className="input w-full"
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              disabled={Boolean(busy)}
            />
          </label>
          <p className="text-xs text-base-content/60">
            Enter your password before adding or removing a method.
          </p>
        </div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-base-300 p-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Authenticator app</h3>
          </div>
          {!status.totpAllowed ? (
            <p className="text-sm text-base-content/60">
              Authenticator apps are disabled by the administrator configuration.
            </p>
          ) : status.totpEnrolled ? (
            <div className="space-y-3">
              <p className="text-sm text-base-content/70">
                Your authenticator app is enrolled. Enter its six-digit code at sign-in.
              </p>
              <button
                className="btn btn-error btn-soft"
                type="button"
                onClick={() => setRemoving({ type: 'totp', name: 'your authenticator app' })}
                disabled={Boolean(busy) || lastTotp || !password || busy === 'remove-totp'}
                aria-busy={Boolean(busy === 'remove-totp') || undefined}
              >
                {busy === 'remove-totp' ? (
                  <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                ) : null}
                <Trash2 className="h-4 w-4" />
                Remove authenticator
              </button>
              {lastTotp ? (
                <p className="text-xs text-base-content/60">
                  Add a passkey before removing your last required method.
                </p>
              ) : null}
            </div>
          ) : setup ? (
            <form onSubmit={confirmTotp} className="space-y-3">
              <p className="text-sm text-base-content/70">
                Scan this code in your authenticator app, then enter the code it generates. Setup
                expires after five minutes.
              </p>
              <img
                src={setup.qrCode}
                alt="Authenticator app setup QR code"
                className="mx-auto h-60 w-60 max-w-full"
              />
              <label className="fieldset min-w-0">
                <span className="fieldset-legend">Manual setup key</span>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-lg bg-base-200 p-3 text-sm">
                    {setup.secret}
                  </code>
                  <CopyButton value={setup.secret} title="Copy setup key" />
                </div>
              </label>
              <label className="fieldset min-w-0">
                <span className="fieldset-legend">Authenticator code</span>
                <input
                  className="input w-full"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={token}
                  onChange={event => setToken(event.target.value.replace(/\D/g, ''))}
                  required
                  disabled={Boolean(busy)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={Boolean(busy) || busy === 'enable'}
                  aria-busy={Boolean(busy === 'enable') || undefined}
                >
                  {busy === 'enable' ? (
                    <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                  ) : null}
                  {busy === 'enable' ? 'Verifying…' : 'Verify and enable'}
                </button>
                <button
                  className="btn btn-outline"
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    setSetup(null);
                    setToken('');
                  }}
                >
                  Cancel setup
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-base-content/70">
                Use an authenticator app such as Google Authenticator, 1Password, or another TOTP
                app.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={beginTotp}
                disabled={Boolean(busy) || (!enrollment && !password) || busy === 'setup'}
                aria-busy={Boolean(busy === 'setup') || undefined}
              >
                {busy === 'setup' ? (
                  <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                ) : null}
                {busy === 'setup' ? 'Preparing…' : 'Set up authenticator'}
              </button>
            </div>
          )}
        </div>
        <div className="space-y-4 rounded-xl border border-base-300 p-4">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Passkeys and security keys</h3>
          </div>
          {!status.webauthnAllowed ? (
            <p className="text-sm text-base-content/60">
              Passkeys are disabled by the administrator configuration.
            </p>
          ) : (
            <>
              <p className="text-sm text-base-content/70">
                Use your device, password manager, or a physical security key as your second sign-in
                step.
              </p>
              {status.credentials.length ? (
                <ul className="space-y-2">
                  {status.credentials.map(credential => (
                    <li
                      key={credential.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-base-200 p-3"
                    >
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold">{credential.name}</p>
                        <p className="text-xs text-base-content/60">
                          Added {formatDate(credential.created)}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${credential.name}`}
                        title={
                          lastPasskey
                            ? 'Add another method before removing your last required passkey'
                            : `Remove ${credential.name}`
                        }
                        className="btn btn-error btn-soft"
                        onClick={() =>
                          setRemoving({
                            type: 'webauthn',
                            id: credential.id,
                            name: credential.name
                          })
                        }
                        disabled={
                          Boolean(busy) ||
                          lastPasskey ||
                          !password ||
                          busy === `remove-${credential.id}`
                        }
                        aria-busy={Boolean(busy === `remove-${credential.id}`) || undefined}
                      >
                        {busy === `remove-${credential.id}` ? (
                          <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                        ) : null}
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <form className="space-y-3" onSubmit={addPasskey}>
                <label className="fieldset min-w-0">
                  <span className="fieldset-legend">Passkey name</span>
                  <input
                    className="input w-full"
                    value={name}
                    onChange={event => setName(event.target.value)}
                    maxLength={128}
                    required
                    disabled={Boolean(busy)}
                    placeholder="Laptop or security key"
                  />
                </label>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    Boolean(busy) ||
                    !webauthnSupported ||
                    Boolean(setup) ||
                    (!enrollment && !password) ||
                    busy === 'register'
                  }
                  aria-busy={Boolean(busy === 'register') || undefined}
                >
                  {busy === 'register' ? (
                    <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                  ) : null}
                  <Fingerprint className="h-4 w-4" />
                  {busy === 'register' ? 'Waiting for your device…' : 'Add passkey'}
                </button>
              </form>
              <WebAuthnUnavailableNotice />
              {lastPasskey ? (
                <p className="text-xs text-base-content/60">
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
