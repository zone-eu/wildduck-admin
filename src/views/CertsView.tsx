import {
  CaretLeftIcon as ChevronLeft,
  CaretRightIcon as ChevronRight,
  KeyIcon as KeyRound,
  PlusIcon as Plus,
  ArrowsClockwiseIcon as RefreshCw,
  FloppyDiskIcon as Save,
  MagnifyingGlassIcon as Search,
  HardDrivesIcon as Server,
  TrashIcon as Trash2
} from '@phosphor-icons/react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  deleteTlsCertificate,
  getTlsCertificate,
  getTlsCertificates,
  saveTlsCertificate
} from '../api';
import type { TlsCertificate, TlsCertificateInput } from '../types';
import { ConfirmDialog, formatDate } from './ui';

function certTone(cert: TlsCertificate) {
  if (!cert.expires) {
    return cert.acme ? 'success' : 'muted';
  }

  const expires = new Date(cert.expires).getTime();
  if (Number.isNaN(expires)) {
    return 'muted';
  }

  return expires < Date.now() ? 'danger' : 'success';
}

function certStatus(cert: TlsCertificate) {
  if (cert.expires) {
    const expires = new Date(cert.expires).getTime();
    if (!Number.isNaN(expires) && expires < Date.now()) {
      return 'Expired';
    }
  }

  return cert.acme ? 'ACME' : 'Manual';
}

function parseCaChain(value: string) {
  const trimmed = value.trim();
  return trimmed ? [trimmed] : undefined;
}

function CertCreateForm({ onSave }: { onSave: (input: TlsCertificateInput) => Promise<void> }) {
  const [servername, setServername] = useState('');
  const [description, setDescription] = useState('');
  const [acme, setAcme] = useState(false);
  const [privateKey, setPrivateKey] = useState('');
  const [cert, setCert] = useState('');
  const [ca, setCa] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!servername.trim()) {
      setError('Server name is required');
      return;
    }

    setBusy(true);

    try {
      await onSave({
        servername: servername.trim(),
        description: description.trim() || undefined,
        acme,
        privateKey: privateKey.trim() || undefined,
        cert: cert.trim() || undefined,
        ca: parseCaChain(ca)
      });
      setDescription('');
      setPrivateKey('');
      setCert('');
      setCa('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save certificate');
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
        <h3 className="font-semibold">Create or update cert</h3>
      </div>
      <div className="space-y-3">
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">Server name</span>
          <input
            value={servername}
            onChange={event => setServername(event.target.value)}
            placeholder="imap.example.com"
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
        <label className="inline-flex items-center gap-2 text-sm text-base-content/80">
          <input
            type="checkbox"
            checked={acme}
            onChange={event => setAcme(event.target.checked)}
            className="checkbox checkbox-primary checkbox-sm"
          />
          Managed by ACME
        </label>
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">Private key</span>
          <textarea
            value={privateKey}
            onChange={event => setPrivateKey(event.target.value)}
            className="textarea w-full min-h-24 font-mono text-xs"
          />
        </label>
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">Certificate</span>
          <textarea
            value={cert}
            onChange={event => setCert(event.target.value)}
            className="textarea w-full min-h-24 font-mono text-xs"
          />
        </label>
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">CA chain</span>
          <textarea
            value={ca}
            onChange={event => setCa(event.target.value)}
            className="textarea w-full min-h-20 font-mono text-xs"
          />
        </label>
        {error ? (
          <div role="alert" className="alert alert-error alert-soft">
            <span className="min-w-0 break-words">{error}</span>
          </div>
        ) : null}
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={busy}
          aria-busy={Boolean(busy) || undefined}
        >
          {busy ? <span aria-hidden="true" className="loading loading-spinner loading-xs" /> : null}
          <Save className="h-4 w-4" />
          Save cert
        </button>
      </div>
    </form>
  );
}

function CertDetailPanel({
  selected,
  onDelete
}: {
  selected: TlsCertificate | null;
  onDelete: (cert: TlsCertificate) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function remove() {
    if (!selected) {
      return;
    }

    setBusy(true);
    setError('');
    try {
      await onDelete(selected);
      setConfirmOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete certificate');
    } finally {
      setBusy(false);
    }
  }

  if (!selected) {
    return (
      <div className="card border border-dashed border-base-300 bg-base-100 p-6 text-center text-sm text-base-content/60">
        <KeyRound className="mx-auto mb-3 h-8 w-8 text-base-content/30" />
        No certificate selected
      </div>
    );
  }

  return (
    <div className="card border border-base-300 bg-base-100 shadow-xs">
      <div className="flex items-start justify-between gap-3 border-b border-base-300 px-4 py-3">
        <div className="min-w-0">
          <h3 className="break-all font-display text-lg font-semibold">{selected.servername}</h3>
          <p className="break-all text-sm text-base-content/60">
            {selected.description || selected.id}
          </p>
        </div>
        <button
          title="Delete certificate"
          onClick={() => setConfirmOpen(true)}
          aria-label="Delete certificate"
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
        <div className="flex flex-wrap gap-2">
          <span
            className={`badge badge-sm badge-soft ${{ success: 'badge-success', warning: 'badge-warning', danger: 'badge-error', muted: 'badge-ghost' }[certTone(selected)]}`}
          >
            {certStatus(selected)}
          </span>
          {selected.hasCert === false ? (
            <span className="badge badge-sm badge-soft badge-warning">No cert material</span>
          ) : null}
          {selected.autogenerated ? (
            <span className="badge badge-sm badge-soft badge-ghost">Autogenerated</span>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              ID
            </dt>
            <dd className="mt-1 break-all font-mono text-xs text-base-content/80">{selected.id}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              Fingerprint
            </dt>
            <dd className="mt-1 break-all font-mono text-xs text-base-content/80">
              {selected.fingerprint || '-'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              Created
            </dt>
            <dd className="mt-1 text-base-content/80">{formatDate(selected.created)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              Expires
            </dt>
            <dd className="mt-1 text-base-content/80">{formatDate(selected.expires)}</dd>
          </div>
        </dl>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/60">
            Alt names
          </div>
          <div className="flex flex-wrap gap-2">
            {selected.altNames?.length ? (
              selected.altNames.map(name => (
                <span
                  key={name}
                  className="break-all rounded-lg bg-base-200 px-2 py-1 text-xs font-medium text-base-content/80"
                >
                  {name}
                </span>
              ))
            ) : (
              <span className="text-base-content/60">-</span>
            )}
          </div>
        </div>

        {error ? (
          <div role="alert" className="alert alert-error alert-soft">
            <span className="min-w-0 break-words">{error}</span>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete certificate"
        message={
          <>
            Delete certificate for{' '}
            <strong className="break-all text-base-content">{selected.servername}</strong>?
          </>
        }
        confirmLabel="Delete cert"
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={remove}
      />
    </div>
  );
}

export function CertsView() {
  const [certs, setCerts] = useState<TlsCertificate[]>([]);
  const [selected, setSelected] = useState<TlsCertificate | null>(null);
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [altNames, setAltNames] = useState(true);
  const [activeAltNames, setActiveAltNames] = useState(true);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | false>();
  const [previousCursor, setPreviousCursor] = useState<string | false>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const expiringSoon = useMemo(
    () =>
      certs.filter(cert => {
        if (!cert.expires) {
          return false;
        }
        const expires = new Date(cert.expires).getTime();
        return (
          Number.isFinite(expires) &&
          expires > Date.now() &&
          expires < Date.now() + 30 * 24 * 60 * 60 * 1000
        );
      }).length,
    [certs]
  );

  async function load(
    options: { query?: string; altNames?: boolean; next?: string; previous?: string } = {}
  ) {
    const nextQuery = options.query ?? activeQuery;
    const nextAltNames = options.altNames ?? activeAltNames;
    setLoading(true);
    setError('');

    try {
      const response = await getTlsCertificates({
        query: nextQuery,
        altNames: nextAltNames,
        next: options.next,
        previous: options.previous,
        limit: 25
      });
      setCerts(response.results || []);
      setTotal(response.total || 0);
      setNextCursor(response.nextCursor);
      setPreviousCursor(response.previousCursor);
      setActiveQuery(nextQuery);
      setActiveAltNames(nextAltNames);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load certificates');
    } finally {
      setLoading(false);
    }
  }

  async function selectCert(cert: TlsCertificate) {
    try {
      setSelected(await getTlsCertificate(cert.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load certificate');
    }
  }

  async function saveCert(input: TlsCertificateInput) {
    if (!input.servername) {
      throw new Error('Server name is required');
    }

    const response = await saveTlsCertificate(input);
    setSelected(response);
    await load();
  }

  async function removeCert(cert: TlsCertificate) {
    await deleteTlsCertificate(cert.id);
    setSelected(current => (current?.id === cert.id ? null : current));
    await load();
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    load({ query, altNames });
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Certs</h2>
          <p className="text-sm text-base-content/60">{total} certificates</p>
        </div>
        <div className="flex items-center gap-2">
          {expiringSoon ? (
            <span className="badge badge-sm badge-soft badge-warning">{`${expiringSoon} expiring`}</span>
          ) : null}
          <button
            title="Refresh"
            onClick={() => load()}
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
      </div>

      {error ? (
        <div role="alert" className="alert alert-error alert-soft">
          <span className="min-w-0 break-words">{error}</span>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="card border border-base-300 bg-base-100 shadow-xs">
          <div className="border-b border-base-300 p-4">
            <form onSubmit={submitSearch} className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex min-w-0 flex-1 items-center">
                  <Search className="pointer-events-none absolute z-10 left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/50" />
                  <input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Server name"
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
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-base-content/80">
                <input
                  type="checkbox"
                  checked={altNames}
                  onChange={event => setAltNames(event.target.checked)}
                  className="checkbox checkbox-primary checkbox-sm"
                />
                Match SAN names
              </label>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr>
                  <th>Server name</th>
                  <th>Mode</th>
                  <th>Expires</th>
                  <th>Alt names</th>
                </tr>
              </thead>
              <tbody>
                {certs.map(cert => {
                  const active = selected?.id === cert.id;
                  return (
                    <tr
                      key={cert.id}
                      onClick={() => selectCert(cert)}
                      className={`cursor-pointer transition ${active ? 'bg-primary/10' : 'hover:bg-base-200'}`}
                    >
                      <td>
                        <div className="break-all font-medium">{cert.servername}</div>
                        <div className="break-all text-xs text-base-content/60">
                          {cert.description || cert.id}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge badge-sm badge-soft ${{ success: 'badge-success', warning: 'badge-warning', danger: 'badge-error', muted: 'badge-ghost' }[certTone(cert)]}`}
                        >
                          {certStatus(cert)}
                        </span>
                      </td>
                      <td className="text-base-content/70">{formatDate(cert.expires)}</td>
                      <td className="text-base-content/70">{cert.altNames?.length || 0}</td>
                    </tr>
                  );
                })}
                {!certs.length ? (
                  <tr>
                    <td className="text-center text-base-content/60" colSpan={4}>
                      No certificates found
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-base-300 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-base-content/60">
              <Server className="h-4 w-4" />
              {certs.length} shown
            </div>
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

        <aside className="space-y-4">
          <CertCreateForm onSave={saveCert} />
          <CertDetailPanel selected={selected} onDelete={removeCert} />
        </aside>
      </div>
    </section>
  );
}
