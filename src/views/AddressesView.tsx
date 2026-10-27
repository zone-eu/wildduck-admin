import { useEffect, useRef, useState } from 'react';
import {
  deleteForwardedAddress,
  getAddressDirectory,
  getAddressRegister,
  getForwardedAddress,
  renameAddressDomain,
  resolveAddress,
  saveForwardedAddress,
  updateAddressRegister
} from '../api';
import type {
  AddressItem,
  DirectoryAddress,
  ForwardedAddress,
  ForwardedAddressInput,
  Page,
  RenameResult
} from '../types';
import { AccountWorkspace } from './AccountSelector';
import {
  ErrorAlert,
  Field,
  Result,
  Toggle,
  message,
  panel,
  parseObject,
  splitList
} from './NativeForms';
import { ConfirmDialog } from './ui';

function forwardedDraft(data?: ForwardedAddress) {
  return {
    address: data?.address || '',
    name: data?.name || '',
    targets: data?.targets?.join('\n') || '',
    forwards: String(data?.limits?.forwards?.allowed || 0),
    forwardedDisabled: !!data?.forwardedDisabled,
    tags: data?.tags?.join(', ') || '',
    metaData: JSON.stringify(data?.metaData || {}, null, 2),
    autoreply: JSON.stringify(data?.autoreply || { status: false }, null, 2)
  };
}
function ForwardedEditor({
  data,
  onSaved,
  onClose
}: {
  data?: ForwardedAddress;
  onSaved: (id?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => forwardedDraft(data));
  const [wildcard, setWildcard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    setDraft(forwardedDraft(data));
    setError('');
    setConfirm(false);
  }, [data]);
  function change<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft(current => ({ ...current, [key]: value }));
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      const forwards = Number(draft.forwards);
      if (!Number.isSafeInteger(forwards) || forwards < 0)
        throw new Error('Forwarding limit must be a nonnegative integer');
      const input: ForwardedAddressInput = {
        address: draft.address,
        name: draft.name,
        targets: splitList(draft.targets),
        forwards,
        tags: splitList(draft.tags),
        metaData: parseObject(draft.metaData),
        autoreply: parseObject(draft.autoreply)
      };
      if (data) {
        input.forwardedDisabled = draft.forwardedDisabled;
        const baseline = forwardedDraft(data);
        for (const key of Object.keys(draft) as (keyof typeof draft)[])
          if (draft[key] === baseline[key]) delete input[key as keyof ForwardedAddressInput];
      } else input.allowWildcard = wildcard;
      const response = await saveForwardedAddress(input, data?.id);
      await onSaved(data?.id || response.id);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className={panel}
      onSubmit={event => {
        event.preventDefault();
        save();
      }}
    >
      <div className="flex justify-between">
        <h3 className="font-semibold">
          {data ? 'Edit forwarded address' : 'Create forwarded address'}
        </h3>
        <button type="button" className="btn btn-sm" onClick={onClose}>
          Close
        </button>
      </div>
      <Field
        label="Address"
        value={draft.address}
        disabled={!!data?.address?.includes('*')}
        onChange={value => change('address', value)}
      />
      <Field label="Name" value={draft.name} onChange={value => change('name', value)} />
      <Field
        label="Targets (one email or relay/webhook URL per line)"
        value={draft.targets}
        multiline
        onChange={value => change('targets', value)}
      />
      {!data ? (
        <Toggle label="Allow wildcard address" checked={wildcard} onChange={setWildcard} />
      ) : (
        <Toggle
          label="Forwarding enabled"
          checked={!draft.forwardedDisabled}
          onChange={value => change('forwardedDisabled', !value)}
        />
      )}
      <Field
        label="Daily forwarding limit (zero uses WildDuck default)"
        type="number"
        value={draft.forwards}
        onChange={value => change('forwards', value)}
      />
      {data ? (
        <p>
          Forwarding usage: {data.limits?.forwards?.used ?? '—'} /{' '}
          {data.limits?.forwards?.allowed ?? '—'}
        </p>
      ) : null}
      <Field
        label="Tags (comma separated)"
        value={draft.tags}
        onChange={value => change('tags', value)}
      />
      <Field
        label="Autoreply (JSON: status, name, subject, text, html, start, end)"
        value={draft.autoreply}
        multiline
        onChange={value => change('autoreply', value)}
      />
      <p className="text-sm text-base-content/60">
        Set status to true to enable autoreply. Start and end accept an ISO date or false.
      </p>
      <Field
        label="Metadata (JSON object)"
        value={draft.metaData}
        multiline
        onChange={value => change('metaData', value)}
      />
      <ErrorAlert error={error} />
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save forwarded address'}
        </button>
        {data ? (
          <button
            type="button"
            className="btn btn-error btn-soft"
            disabled={busy}
            onClick={() => setConfirm(true)}
          >
            Delete
          </button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirm}
        title="Delete forwarded address"
        message={`Delete ${data?.address}?`}
        confirmLabel="Delete"
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          if (!data) return;
          setBusy(true);
          try {
            await deleteForwardedAddress(data.id);
            await onSaved();
            onClose();
          } catch (err) {
            setError(message(err));
          } finally {
            setBusy(false);
            setConfirm(false);
          }
        }}
      />
    </form>
  );
}

export function AddressRegister({ userId }: { userId: string }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<AddressItem[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let current = true;
    setItems([]);
    setError('');
    if (!query.trim()) return;
    setBusy(true);
    const timer = setTimeout(() => {
      getAddressRegister(userId, query)
        .then(data => {
          if (current) setItems(data.results);
        })
        .catch(err => {
          if (current) setError(message(err));
        })
        .finally(() => {
          if (current) setBusy(false);
        });
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, userId, refresh]);
  return (
    <div className={panel}>
      <h3 className="font-semibold">Account address register</h3>
      <p className="text-sm">
        Search a prefix of a name or address. Disabled entries disappear from native search results
        and stop updating on sent or received mail.
      </p>
      <Field label="Search address register" value={query} onChange={setQuery} />
      {busy && query ? <p role="status">Loading…</p> : null}
      <ErrorAlert error={error} />
      {items.map(item => (
        <RegisterEntry
          key={`${refresh}-${item.id}`}
          item={item}
          disabled={busy}
          onSave={async (name, disabled) => {
            setBusy(true);
            setError('');
            try {
              await updateAddressRegister(userId, item.id, {
                ...(name !== item.name ? { name } : {}),
                disabled
              });
              setRefresh(value => value + 1);
            } catch (err) {
              setError(message(err));
            } finally {
              setBusy(false);
            }
          }}
        />
      ))}
      {query && !busy && !items.length ? <p>No matching entries.</p> : null}
    </div>
  );
}
function RegisterEntry({
  item,
  disabled,
  onSave
}: {
  item: AddressItem;
  disabled: boolean;
  onSave: (name: string, disabled: boolean) => Promise<void>;
}) {
  const [name, setName] = useState(item.name || '');
  return (
    <form
      className="border-t border-base-300 py-3 space-y-2"
      onSubmit={e => {
        e.preventDefault();
        onSave(name, false);
      }}
    >
      <p>{item.address}</p>
      <Field label="Name" value={name} onChange={setName} />
      <div className="flex gap-2">
        <button className="btn btn-sm" disabled={disabled}>
          Save name
        </button>
        <button
          type="button"
          className="btn btn-sm btn-warning"
          disabled={disabled}
          onClick={() => onSave(item.name || '', true)}
        >
          Disable entry
        </button>
      </div>
    </form>
  );
}

export function AddressesView() {
  const [tab, setTab] = useState<'directory' | 'register'>('directory');
  const [query, setQuery] = useState('');
  const [forward, setForward] = useState('');
  const [page, setPage] = useState<{ next?: string; previous?: string }>({});
  const [data, setData] = useState<Page<DirectoryAddress>>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editor, setEditor] = useState<ForwardedAddress | 'new' | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const selection = useRef(0);
  const [refresh, setRefresh] = useState(0);
  const [address, setAddress] = useState('');
  const [wildcard, setWildcard] = useState(false);
  const [resolved, setResolved] = useState<ForwardedAddress>();
  const [oldDomain, setOldDomain] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [rename, setRename] = useState(false);
  const [renameResult, setRenameResult] = useState<RenameResult>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setData(undefined);
    setError('');
    const timer = setTimeout(() => {
      getAddressDirectory({ query, forward, limit: 25, ...page })
        .then(result => {
          if (current) setData(result);
        })
        .catch(err => {
          if (current) setError(message(err));
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, forward, page, refresh]);
  async function edit(id: string) {
    const request = ++selection.current;
    setEditor(null);
    setEditorLoading(true);
    setError('');
    try {
      const result = await getForwardedAddress(id);
      if (request === selection.current) setEditor(result);
    } catch (err) {
      if (request === selection.current) setError(message(err));
    } finally {
      if (request === selection.current) setEditorLoading(false);
    }
  }
  function owner(item: DirectoryAddress) {
    return item.user ? (
      <a className="link link-primary" href={`/users?user=${encodeURIComponent(item.user)}`}>
        Account {item.user}
      </a>
    ) : (
      <button className="btn btn-sm" onClick={() => edit(item.id)}>
        Edit forwarding
      </button>
    );
  }
  return (
    <section className="space-y-5">
      <h2 className="font-display text-2xl font-semibold">Addresses</h2>
      <div className="tabs tabs-box">
        {(['directory', 'register'] as const).map(item => (
          <button
            key={item}
            className={`tab ${tab === item ? 'tab-active' : ''}`}
            onClick={() => setTab(item)}
          >
            {item === 'directory' ? 'Global directory' : 'Account address register'}
          </button>
        ))}
      </div>
      {tab === 'register' ? (
        <AccountWorkspace>{id => <AddressRegister userId={id} />}</AccountWorkspace>
      ) : (
        <>
          <div className={panel}>
            <Field
              label="Search address"
              value={query}
              onChange={value => {
                setQuery(value);
                setPage({});
              }}
            />
            <Field
              label="Search forwarding target"
              value={forward}
              onChange={value => {
                setForward(value);
                setPage({});
              }}
            />
            <div className="flex gap-2">
              <button
                className="btn btn-primary"
                onClick={() => {
                  selection.current++;
                  setEditorLoading(false);
                  setEditor('new');
                }}
              >
                Create forwarded address
              </button>
              <button className="btn" onClick={() => setRefresh(value => value + 1)}>
                Refresh
              </button>
            </div>
            <ErrorAlert error={error} />
            {loading ? <p role="status">Loading addresses…</p> : null}
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Type</th>
                    <th>Owner / editor</th>
                    <th>Targets</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.results.map(item => (
                    <tr key={item.id}>
                      <td>
                        {item.address}
                        <p className="text-xs">{item.name}</p>
                      </td>
                      <td>
                        {item.forwarded
                          ? item.forwardedDisabled
                            ? 'Forwarded (disabled)'
                            : 'Forwarded'
                          : 'Account'}
                      </td>
                      <td>{owner(item)}</td>
                      <td>{item.targets?.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data && !data.results.length ? <p>No matching addresses.</p> : null}
            <p>{data?.total ?? '—'} addresses</p>
            <div className="flex gap-2">
              <button
                className="btn btn-sm"
                disabled={loading || !data?.previousCursor}
                onClick={() => setPage({ previous: data?.previousCursor || undefined })}
              >
                Previous
              </button>
              <button
                className="btn btn-sm"
                disabled={loading || !data?.nextCursor}
                onClick={() => setPage({ next: data?.nextCursor || undefined })}
              >
                Next
              </button>
            </div>
          </div>
          {editorLoading ? <p role="status">Loading forwarded address…</p> : null}
          {editor ? (
            <ForwardedEditor
              key={editor === 'new' ? 'new' : editor.id}
              data={editor === 'new' ? undefined : editor}
              onClose={() => {
                selection.current++;
                setEditor(null);
              }}
              onSaved={async id => {
                setRefresh(value => value + 1);
                if (id) await edit(id);
              }}
            />
          ) : null}
          <form
            className={panel}
            onSubmit={async event => {
              event.preventDefault();
              setBusy(true);
              setError('');
              setResolved(undefined);
              try {
                setResolved(await resolveAddress(address, wildcard));
              } catch (err) {
                setError(message(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3 className="font-semibold">Resolve an address</h3>
            <Field label="Email address" value={address} onChange={setAddress} />
            <Toggle label="Allow wildcard matching" checked={wildcard} onChange={setWildcard} />
            <button className="btn" disabled={busy || !address}>
              Resolve
            </button>
            {resolved ? (
              <div>
                <Result>{JSON.stringify(resolved, null, 2)}</Result>
                {owner(resolved)}
              </div>
            ) : null}
          </form>
          <div className={panel}>
            <h3 className="font-semibold">Rename domain</h3>
            <Field label="Source domain" value={oldDomain} onChange={setOldDomain} />
            <Field label="Destination domain" value={newDomain} onChange={setNewDomain} />
            <button
              className="btn btn-warning"
              disabled={busy || !oldDomain.trim() || !newDomain.trim()}
              onClick={() => setRename(true)}
            >
              Rename domain…
            </button>
            {renameResult ? <Result>{JSON.stringify(renameResult, null, 2)}</Result> : null}
          </div>
          <ConfirmDialog
            open={rename}
            title="Rename address domain"
            message={`Rename ${oldDomain} to ${newDomain}? This updates addresses, accounts, DKIM keys and aliases.`}
            confirmLabel="Rename domain"
            busy={busy}
            onCancel={() => setRename(false)}
            onConfirm={async () => {
              setBusy(true);
              setError('');
              try {
                setRenameResult(await renameAddressDomain(oldDomain.trim(), newDomain.trim()));
                setPage({});
                setRefresh(value => value + 1);
                setEditor(null);
                setResolved(undefined);
                setRename(false);
              } catch (err) {
                setError(message(err));
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
    </section>
  );
}
