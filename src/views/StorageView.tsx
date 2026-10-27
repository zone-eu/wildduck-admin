import {
  CaretLeftIcon as ChevronLeft,
  CaretRightIcon as ChevronRight,
  FileMagnifyingGlassIcon as FileSearch,
  ArrowsClockwiseIcon as RefreshCw,
  MagnifyingGlassIcon as Search,
  TrashIcon as Trash2
} from '@phosphor-icons/react';
import { FormEvent, useEffect, useState } from 'react';
import { deleteStoredFile, getStoredFiles } from '../api';
import type { StoredFile } from '../types';
import { ConfirmDialog, formatBytes, formatDate } from './ui';

export function StorageView({ accountId }: { accountId: string }) {
  const [userId, setUserId] = useState(accountId);
  const [loadedUserId, setLoadedUserId] = useState('');
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | false>();
  const [previousCursor, setPreviousCursor] = useState<string | false>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<StoredFile | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    load({ user: accountId });
  }, [accountId]);

  async function load(
    options: { user?: string; query?: string; next?: string; previous?: string } = {}
  ) {
    const id = (options.user ?? (loadedUserId || userId)).trim();
    const nextQuery = options.query ?? activeQuery;
    setError('');

    if (!id) {
      setError('User ID is required');
      return;
    }

    setLoading(true);
    try {
      const response = await getStoredFiles(id, {
        query: nextQuery,
        next: options.next,
        previous: options.previous,
        limit: 25
      });
      setFiles(response.results || []);
      setTotal(response.total || 0);
      setNextCursor(response.nextCursor);
      setPreviousCursor(response.previousCursor);
      setLoadedUserId(id);
      setUserId(id);
      setActiveQuery(nextQuery);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load stored files');
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    load({ user: userId, query });
  }

  async function removeFile() {
    if (!pendingDelete || !loadedUserId) {
      return;
    }

    setDeleting(true);
    setError('');
    try {
      await deleteStoredFile(loadedUserId, pendingDelete.id);
      setPendingDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete stored file');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Storage</h2>
          <p className="text-sm text-base-content/60">
            {loadedUserId ? `${total} files for ${loadedUserId}` : 'Select a user'}
          </p>
        </div>
        <button
          title="Refresh"
          onClick={() => load()}
          aria-label="Refresh"
          type="button"
          className="btn btn-square btn-sm btn-ghost"
          disabled={loading || !loadedUserId || loading}
          aria-busy={Boolean(loading) || undefined}
        >
          {loading ? (
            <span aria-hidden="true" className="loading loading-spinner loading-xs" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="card border border-base-300 bg-base-100 p-4 shadow-xs">
        <form
          onSubmit={submit}
          noValidate
          className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
        >
          <label className="fieldset min-w-0 py-0">
            <span className="fieldset-legend">Search</span>
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute z-10 left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/50" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                className="input w-full pl-9"
                placeholder="Filename or content type"
              />
            </div>
          </label>
          <button
            type="submit"
            className="btn btn-outline mt-0"
            disabled={loading}
            aria-busy={Boolean(loading) || undefined}
          >
            {loading ? (
              <span aria-hidden="true" className="loading loading-spinner loading-xs" />
            ) : null}
            <FileSearch className="h-4 w-4" />
            Load
          </button>
        </form>
      </div>

      {error ? (
        <div role="alert" className="alert alert-error alert-soft">
          <span className="min-w-0 break-words">{error}</span>
        </div>
      ) : null}

      <div className="card border border-base-300 bg-base-100 shadow-xs">
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr>
                <th>File</th>
                <th>Type</th>
                <th>Size</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {files.map(file => (
                <tr key={file.id}>
                  <td>
                    <div className="break-all font-medium">{file.filename || '-'}</div>
                    <div className="font-mono text-xs text-base-content/60">{file.id}</div>
                  </td>
                  <td className="text-base-content/70">{file.contentType || '-'}</td>
                  <td className="text-base-content/70">{formatBytes(file.size)}</td>
                  <td className="text-base-content/70">{formatDate(file.created)}</td>
                  <td className="text-right">
                    <button
                      title="Delete stored file"
                      onClick={() => setPendingDelete(file)}
                      aria-label="Delete stored file"
                      type="button"
                      className="btn btn-square btn-sm btn-error btn-soft"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {!files.length ? (
                <tr>
                  <td className="text-center text-base-content/60" colSpan={5}>
                    No stored files loaded
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-base-300 px-4 py-3">
          <div className="text-sm text-base-content/60">{files.length} shown</div>
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

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete stored file"
        message={
          pendingDelete ? (
            <>
              Delete{' '}
              <strong className="break-all text-base-content">
                {pendingDelete.filename || pendingDelete.id}
              </strong>
              ?
            </>
          ) : null
        }
        confirmLabel="Delete file"
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={removeFile}
      />
    </section>
  );
}
