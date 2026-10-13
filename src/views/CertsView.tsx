import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  Search,
  Server,
  Trash2
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  deleteTlsCertificate,
  getTlsCertificate,
  getTlsCertificates,
  saveTlsCertificate
} from '../api';
import type { TlsCertificate, TlsCertificateInput } from '../types';
import {
  Button,
  ConfirmDialog,
  ErrorNotice,
  Field,
  IconButton,
  StatusPill,
  formatDate
} from './ui';

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
      className="rounded-lg border border-line bg-white dark:bg-slate-900 p-4 shadow-xs"
    >
      <div className="mb-3 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-brand-600 dark:text-teal-300" />
        <h3 className="font-semibold">Create or update cert</h3>
      </div>
      <div className="space-y-3">
        <Field label="Server name">
          <input
            value={servername}
            onChange={event => setServername(event.target.value)}
            placeholder="imap.example.com"
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
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={acme}
            onChange={event => setAcme(event.target.checked)}
            className="checkbox"
          />
          Managed by ACME
        </label>
        <Field label="Private key">
          <textarea
            value={privateKey}
            onChange={event => setPrivateKey(event.target.value)}
            className="min-h-24 w-full rounded-lg border border-line bg-white dark:bg-slate-900 px-3 py-2 font-mono text-xs outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-teal-900"
          />
        </Field>
        <Field label="Certificate">
          <textarea
            value={cert}
            onChange={event => setCert(event.target.value)}
            className="min-h-24 w-full rounded-lg border border-line bg-white dark:bg-slate-900 px-3 py-2 font-mono text-xs outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-teal-900"
          />
        </Field>
        <Field label="CA chain">
          <textarea
            value={ca}
            onChange={event => setCa(event.target.value)}
            className="min-h-20 w-full rounded-lg border border-line bg-white dark:bg-slate-900 px-3 py-2 font-mono text-xs outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-teal-900"
          />
        </Field>
        <ErrorNotice message={error} />
        <Button
          loading={busy}
          type="submit"
          disabled={busy}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          Save cert
        </Button>
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
      <div className="rounded-lg border border-dashed border-line bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
        <KeyRound className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
        No certificate selected
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-white dark:bg-slate-900 shadow-xs">
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h3 className="break-all font-display text-lg font-semibold">{selected.servername}</h3>
          <p className="break-all text-sm text-slate-500 dark:text-slate-400">
            {selected.description || selected.id}
          </p>
        </div>
        <IconButton
          loading={busy}
          title="Delete certificate"
          onClick={() => setConfirmOpen(true)}
          disabled={busy}
        >
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="space-y-4 p-4 text-sm">
        <div className="flex flex-wrap gap-2">
          <StatusPill label={certStatus(selected)} tone={certTone(selected)} />
          {selected.hasCert === false ? (
            <StatusPill label="No cert material" tone="warning" />
          ) : null}
          {selected.autogenerated ? <StatusPill label="Autogenerated" tone="muted" /> : null}
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              ID
            </dt>
            <dd className="mt-1 break-all font-mono text-xs text-slate-700 dark:text-slate-200">
              {selected.id}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Fingerprint
            </dt>
            <dd className="mt-1 break-all font-mono text-xs text-slate-700 dark:text-slate-200">
              {selected.fingerprint || '-'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Created
            </dt>
            <dd className="mt-1 text-slate-700 dark:text-slate-200">
              {formatDate(selected.created)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Expires
            </dt>
            <dd className="mt-1 text-slate-700 dark:text-slate-200">
              {formatDate(selected.expires)}
            </dd>
          </div>
        </dl>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Alt names
          </div>
          <div className="flex flex-wrap gap-2">
            {selected.altNames?.length ? (
              selected.altNames.map(name => (
                <span
                  key={name}
                  className="break-all rounded-lg bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  {name}
                </span>
              ))
            ) : (
              <span className="text-slate-500 dark:text-slate-400">-</span>
            )}
          </div>
        </div>

        <ErrorNotice message={error} />
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete certificate"
        message={
          <>
            Delete certificate for{' '}
            <strong className="break-all text-ink">{selected.servername}</strong>?
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
          <p className="text-sm text-slate-500 dark:text-slate-400">{total} certificates</p>
        </div>
        <div className="flex items-center gap-2">
          {expiringSoon ? <StatusPill label={`${expiringSoon} expiring`} tone="warning" /> : null}
          <IconButton loading={loading} title="Refresh" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </IconButton>
        </div>
      </div>

      <ErrorNotice message={error} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="rounded-lg border border-line bg-white dark:bg-slate-900 shadow-xs">
          <div className="border-b border-line p-4">
            <form onSubmit={submitSearch} className="space-y-3">
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Server name"
                    className="h-10 w-full rounded-lg border border-line pl-9 pr-3 text-sm outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-teal-900"
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
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={altNames}
                  onChange={event => setAltNames(event.target.checked)}
                  className="checkbox"
                />
                Match SAN names
              </label>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Server name</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Alt names</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {certs.map(cert => {
                  const active = selected?.id === cert.id;
                  return (
                    <tr
                      key={cert.id}
                      onClick={() => selectCert(cert)}
                      className={`cursor-pointer transition ${active ? 'bg-brand-50 dark:bg-teal-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="break-all font-medium">{cert.servername}</div>
                        <div className="break-all text-xs text-slate-500 dark:text-slate-400">
                          {cert.description || cert.id}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill label={certStatus(cert)} tone={certTone(cert)} />
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {formatDate(cert.expires)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {cert.altNames?.length || 0}
                      </td>
                    </tr>
                  );
                })}
                {!certs.length ? (
                  <tr>
                    <td
                      className="px-4 py-10 text-center text-slate-500 dark:text-slate-400"
                      colSpan={4}
                    >
                      No certificates found
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-line px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Server className="h-4 w-4" />
              {certs.length} shown
            </div>
            <div className="flex gap-2">
              <IconButton
                loading={loading}
                title="Previous page"
                onClick={() => previousCursor && load({ previous: previousCursor })}
                disabled={!previousCursor}
              >
                <ChevronLeft className="h-4 w-4" />
              </IconButton>
              <IconButton
                loading={loading}
                title="Next page"
                onClick={() => nextCursor && load({ next: nextCursor })}
                disabled={!nextCursor}
              >
                <ChevronRight className="h-4 w-4" />
              </IconButton>
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
