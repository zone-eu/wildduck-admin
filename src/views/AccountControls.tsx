import { useEffect, useState } from 'react';
import { updateUser } from '../api';
import type { UserDetails, UserUpdateInput } from '../types';
import { ErrorAlert, Field, Toggle, message, panel, splitList } from './NativeForms';

const protocolScopes = ['imap', 'pop3', 'smtp', 'mcp'];

function initial(user: UserDetails) {
  return {
    disabledScopes: user.disabledScopes || [],
    targets: (user.targets || []).join('\n'),
    encryptMessages: !!user.encryptMessages,
    encryptForwarded: !!user.encryptForwarded,
    pubKey: user.pubKey || '',
    smimeCerts: (user.smimeCerts || []).join('\n'),
    smimeCipher: user.smimeCipher || '',
    smimeKeyTransport: user.smimeKeyTransport || '',
    recipients: user.limits?.recipients?.allowed || 0,
    forwards: user.limits?.forwards?.allowed || 0
  };
}
export function AccountControls({ user, onChanged }: { user: UserDetails; onChanged: () => void }) {
  const [draft, setDraft] = useState(() => initial(user));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setDraft(initial(user));
    setError('');
  }, [user]);
  function change<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft(current => ({ ...current, [key]: value }));
  }
  return (
    <form
      className={panel}
      onSubmit={async event => {
        event.preventDefault();
        setError('');
        setBusy(true);
        try {
          if (
            ![draft.recipients, draft.forwards].every(
              value => Number.isSafeInteger(value) && value >= 0
            )
          )
            throw new Error('Daily limits must be nonnegative integers');
          if (draft.pubKey.trim() && draft.smimeCerts.trim())
            throw new Error('Choose PGP or S/MIME certificates; remove the other key first.');
          const baseline = initial(user);
          const values: UserUpdateInput = {
            ...draft,
            targets: splitList(draft.targets),
            smimeCerts:
              draft.smimeCerts.match(
                /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g
              ) || (draft.smimeCerts.trim() ? [draft.smimeCerts] : [])
          };
          const input = Object.fromEntries(
            Object.entries(values).filter(([key]) => {
              const field = key as keyof typeof draft;
              return JSON.stringify(draft[field]) !== JSON.stringify(baseline[field]);
            })
          ) as UserUpdateInput;
          if (Object.keys(input).length) {
            await updateUser(user.id, input);
            onChanged();
          }
        } catch (err) {
          setError(message(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 className="font-semibold">Protocols, forwarding and encryption</h3>
      <p className="text-sm text-base-content/60">
        Uncheck protocols to restrict access. Other disabled scopes are preserved.
      </p>
      <div className="flex flex-wrap gap-3">
        {protocolScopes.map(scope => (
          <Toggle
            key={scope}
            label={scope.toUpperCase()}
            checked={!draft.disabledScopes.includes(scope)}
            onChange={enabled =>
              change(
                'disabledScopes',
                enabled
                  ? draft.disabledScopes.filter(item => item !== scope)
                  : [...draft.disabledScopes, scope]
              )
            }
          />
        ))}
      </div>
      {draft.disabledScopes.filter(scope => !protocolScopes.includes(scope)).length ? (
        <p>
          Other disabled scopes:{' '}
          {draft.disabledScopes.filter(scope => !protocolScopes.includes(scope)).join(', ')}
        </p>
      ) : null}
      <Field
        label="Forwarding targets (one email or URL per line; empty clears targets)"
        value={draft.targets}
        multiline
        onChange={value => change('targets', value)}
      />
      <p className="text-sm">
        Daily limits: zero selects WildDuck’s default. Current effective usage: sending{' '}
        {user.limits?.recipients?.used ?? '—'} / {user.limits?.recipients?.allowed ?? '—'};
        forwarding {user.limits?.forwards?.used ?? '—'} / {user.limits?.forwards?.allowed ?? '—'}.
        Unchanged limits keep their existing default or override.
      </p>
      <Field
        label="Daily sending limit"
        type="number"
        value={String(draft.recipients)}
        onChange={value => change('recipients', Number(value))}
      />
      <Field
        label="Daily forwarding limit"
        type="number"
        value={String(draft.forwards)}
        onChange={value => change('forwards', Number(value))}
      />
      <Toggle
        label="Encrypt received messages"
        checked={draft.encryptMessages}
        onChange={value => change('encryptMessages', value)}
      />
      <Toggle
        label="Encrypt forwarded messages"
        checked={draft.encryptForwarded}
        onChange={value => change('encryptForwarded', value)}
      />
      <Field
        label="PGP public key (empty removes key)"
        value={draft.pubKey}
        multiline
        onChange={value => change('pubKey', value)}
      />
      <Field
        label="S/MIME recipient certificates (PEM; empty removes certificates)"
        value={draft.smimeCerts}
        multiline
        onChange={value => change('smimeCerts', value)}
      />
      <Field
        label="S/MIME cipher (AES-CBC or AES-GCM)"
        value={draft.smimeCipher}
        onChange={value => change('smimeCipher', value)}
      />
      <Field
        label="S/MIME key transport (PKCS#1 v1.5 or OAEP)"
        value={draft.smimeKeyTransport}
        onChange={value => change('smimeKeyTransport', value)}
      />
      <ErrorAlert error={error} />
      <button className="btn btn-primary" disabled={busy}>
        {busy ? 'Saving…' : 'Save protocols, forwarding and encryption'}
      </button>
    </form>
  );
}
