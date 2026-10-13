import { ChevronLeft, ChevronRight, Link2, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { createDomainAlias, deleteDomainAlias, getDomainAlias, getDomainAliases } from '../api';
import type { DomainAlias } from '../types';
import {
  Button,
  ConfirmDialog,
  ErrorNotice,
  Field,
  IconButton,
  StatusPill,
  formatDate
} from './ui';

function DomainAliasCreateForm({
  onCreate
}: {
  onCreate: (input: { alias: string; domain: string }) => Promise<void>;
}) {
  const [alias, setAlias] = useState('');
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!alias.trim() || !domain.trim()) {
      setError('Alias and domain are required');
      return;
    }

    setBusy(true);

    try {
      await onCreate({ alias: alias.trim(), domain: domain.trim() });
      setAlias('');
      setDomain('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create alias');
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
        <Plus className="h-4 w-4 text-brand-600 dark:text-teal-300" />
        <h3 className="font-semibold">Create alias</h3>
      </div>
      <div className="space-y-3">
        <Field label="Alias">
          <input
            value={alias}
            onChange={event => setAlias(event.target.value)}
            placeholder="alias.example"
            className="input"
          />
        </Field>
        <Field label="Domain">
          <input
            value={domain}
            onChange={event => setDomain(event.target.value)}
            placeholder="example.com"
            className="input"
          />
        </Field>
        <ErrorNotice message={error} />
        <Button
          loading={busy}
          type="submit"
          disabled={busy}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Add alias
        </Button>
      </div>
    </form>
  );
}

function DomainAliasDetailPanel({
  selected,
  onDelete
}: {
  selected: DomainAlias | null;
  onDelete: (alias: DomainAlias) => Promise<void>;
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
      setError(err instanceof Error ? err.message : 'Could not delete alias');
    } finally {
      setBusy(false);
    }
  }

  if (!selected) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
        <Link2 className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
        No alias selected
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-white dark:bg-slate-900 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h3 className="break-all font-display text-lg font-semibold">{selected.alias}</h3>
          <p className="break-all text-sm text-slate-500 dark:text-slate-400">{selected.domain}</p>
        </div>
        <IconButton
          loading={busy}
          title="Delete alias"
          onClick={() => setConfirmOpen(true)}
          disabled={busy}
        >
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>
      <div className="space-y-3 p-4 text-sm">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            ID
          </div>
          <div className="mt-1 break-all font-mono text-xs text-slate-700 dark:text-slate-200">
            {selected.id}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Created
          </div>
          <div className="mt-1 text-slate-700 dark:text-slate-200">
            {formatDate(selected.created)}
          </div>
        </div>
        <ErrorNotice message={error} />
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete alias"
        message={
          <>
            Delete alias <strong className="break-all text-ink">{selected.alias}</strong>?
          </>
        }
        confirmLabel="Delete alias"
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={remove}
      />
    </div>
  );
}

export function DomainAliasesView() {
  const [aliases, setAliases] = useState<DomainAlias[]>([]);
  const [selected, setSelected] = useState<DomainAlias | null>(null);
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | false>();
  const [previousCursor, setPreviousCursor] = useState<string | false>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(options: { query?: string; next?: string; previous?: string } = {}) {
    const nextQuery = options.query ?? activeQuery;
    setLoading(true);
    setError('');

    try {
      const response = await getDomainAliases({
        query: nextQuery,
        next: options.next,
        previous: options.previous,
        limit: 25
      });
      setAliases(response.results || []);
      setTotal(response.total || 0);
      setNextCursor(response.nextCursor);
      setPreviousCursor(response.previousCursor);
      setActiveQuery(nextQuery);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load domain aliases');
    } finally {
      setLoading(false);
    }
  }

  async function selectAlias(alias: DomainAlias) {
    try {
      setSelected(await getDomainAlias(alias.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load alias');
    }
  }

  async function addAlias(input: { alias: string; domain: string }) {
    if (!input.alias || !input.domain) {
      throw new Error('Alias and domain are required');
    }

    const response = await createDomainAlias(input);
    await load();
    setSelected(await getDomainAlias(response.id));
  }

  async function removeAlias(alias: DomainAlias) {
    await deleteDomainAlias(alias.id);
    setSelected(current => (current?.id === alias.id ? null : current));
    await load();
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    load({ query });
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Domain Aliases</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{total} aliases</p>
        </div>
        <IconButton loading={loading} title="Refresh" onClick={() => load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </IconButton>
      </div>

      <ErrorNotice message={error} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="rounded-lg border border-line bg-white dark:bg-slate-900 shadow-sm">
          <div className="border-b border-line p-4">
            <form onSubmit={submitSearch} className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Alias or domain"
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
                  <th className="px-4 py-3">Alias</th>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {aliases.map(alias => {
                  const active = selected?.id === alias.id;
                  return (
                    <tr
                      key={alias.id}
                      onClick={() => selectAlias(alias)}
                      className={`cursor-pointer transition ${active ? 'bg-brand-50 dark:bg-teal-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="break-all font-medium">{alias.alias}</div>
                        <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                          {alias.id}
                        </div>
                      </td>
                      <td className="break-all px-4 py-3 text-slate-600 dark:text-slate-300">
                        {alias.domain}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill label="Mapped" tone="success" />
                      </td>
                    </tr>
                  );
                })}
                {!aliases.length ? (
                  <tr>
                    <td
                      className="px-4 py-10 text-center text-slate-500 dark:text-slate-400"
                      colSpan={3}
                    >
                      No aliases found
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-line px-4 py-3">
            <div className="text-sm text-slate-500 dark:text-slate-400">{aliases.length} shown</div>
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
          <DomainAliasCreateForm onCreate={addAlias} />
          <DomainAliasDetailPanel selected={selected} onDelete={removeAlias} />
        </aside>
      </div>
    </section>
  );
}
