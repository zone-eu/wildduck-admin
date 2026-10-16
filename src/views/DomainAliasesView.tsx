import {
  CaretLeftIcon as ChevronLeft,
  CaretRightIcon as ChevronRight,
  LinkIcon as Link2,
  PlusIcon as Plus,
  ArrowsClockwiseIcon as RefreshCw,
  MagnifyingGlassIcon as Search,
  TrashIcon as Trash2
} from '@phosphor-icons/react';
import { FormEvent, useEffect, useState } from 'react';
import { createDomainAlias, deleteDomainAlias, getDomainAlias, getDomainAliases } from '../api';
import type { DomainAlias } from '../types';
import { ConfirmDialog, formatDate } from './ui';

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
      className="card border border-base-300 bg-base-100 p-4 shadow-xs"
    >
      <div className="mb-3 flex items-center gap-2">
        <Plus className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Create alias</h3>
      </div>
      <div className="space-y-3">
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">Alias</span>
          <input
            value={alias}
            onChange={event => setAlias(event.target.value)}
            placeholder="alias.example"
            className="input w-full"
          />
        </label>
        <label className="fieldset min-w-0">
          <span className="fieldset-legend">Domain</span>
          <input
            value={domain}
            onChange={event => setDomain(event.target.value)}
            placeholder="example.com"
            className="input w-full"
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
          <Plus className="h-4 w-4" />
          Add alias
        </button>
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
      <div className="card border border-dashed border-base-300 bg-base-100 p-6 text-center text-sm text-base-content/60">
        <Link2 className="mx-auto mb-3 h-8 w-8 text-base-content/30" />
        No alias selected
      </div>
    );
  }

  return (
    <div className="card border border-base-300 bg-base-100 shadow-xs">
      <div className="flex items-start justify-between gap-3 border-b border-base-300 px-4 py-3">
        <div className="min-w-0">
          <h3 className="break-all font-display text-lg font-semibold">{selected.alias}</h3>
          <p className="break-all text-sm text-base-content/60">{selected.domain}</p>
        </div>
        <button
          title="Delete alias"
          onClick={() => setConfirmOpen(true)}
          aria-label="Delete alias"
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
      <div className="space-y-3 p-4 text-sm">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
            ID
          </div>
          <div className="mt-1 break-all font-mono text-xs text-base-content/80">{selected.id}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
            Created
          </div>
          <div className="mt-1 text-base-content/80">{formatDate(selected.created)}</div>
        </div>
        {error ? (
          <div role="alert" className="alert alert-error alert-soft">
            <span className="min-w-0 break-words">{error}</span>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete alias"
        message={
          <>
            Delete alias <strong className="break-all text-base-content">{selected.alias}</strong>?
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
          <p className="text-sm text-base-content/60">{total} aliases</p>
        </div>
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

      {error ? (
        <div role="alert" className="alert alert-error alert-soft">
          <span className="min-w-0 break-words">{error}</span>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="card border border-base-300 bg-base-100 shadow-xs">
          <div className="border-b border-base-300 p-4">
            <form onSubmit={submitSearch} className="flex gap-2">
              <div className="relative flex min-w-0 flex-1 items-center">
                <Search className="pointer-events-none absolute z-10 left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/50" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Alias or domain"
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
            <table className="table table-sm w-full">
              <thead>
                <tr>
                  <th>Alias</th>
                  <th>Domain</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {aliases.map(alias => {
                  const active = selected?.id === alias.id;
                  return (
                    <tr
                      key={alias.id}
                      onClick={() => selectAlias(alias)}
                      className={`cursor-pointer transition ${active ? 'bg-primary/10' : 'hover:bg-base-200'}`}
                    >
                      <td>
                        <div className="break-all font-medium">{alias.alias}</div>
                        <div className="font-mono text-xs text-base-content/60">{alias.id}</div>
                      </td>
                      <td className="break-all text-base-content/70">{alias.domain}</td>
                      <td>
                        <span className="badge badge-sm badge-soft badge-success">Mapped</span>
                      </td>
                    </tr>
                  );
                })}
                {!aliases.length ? (
                  <tr>
                    <td className="text-center text-base-content/60" colSpan={3}>
                      No aliases found
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-base-300 px-4 py-3">
            <div className="text-sm text-base-content/60">{aliases.length} shown</div>
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
          <DomainAliasCreateForm onCreate={addAlias} />
          <DomainAliasDetailPanel selected={selected} onDelete={removeAlias} />
        </aside>
      </div>
    </section>
  );
}
