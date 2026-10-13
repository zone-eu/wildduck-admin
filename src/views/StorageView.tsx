import { ChevronLeft, ChevronRight, FileSearch, RefreshCw, Search, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { deleteStoredFile, getStoredFiles } from '../api';
import type { StoredFile } from '../types';
import {
  Button,
  ConfirmDialog,
  ErrorNotice,
  Field,
  IconButton,
  formatBytes,
  formatDate
} from './ui';

export function StorageView() {
  const [userId, setUserId] = useState('');
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
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loadedUserId ? `${total} files for ${loadedUserId}` : 'Select a user'}
          </p>
        </div>
        <IconButton
          loading={loading}
          title="Refresh"
          onClick={() => load()}
          disabled={loading || !loadedUserId}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </IconButton>
      </div>

      <div className="rounded-lg border border-line bg-white dark:bg-slate-900 p-4 shadow-xs">
        <form
          onSubmit={submit}
          noValidate
          className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          <Field label="User ID">
            <input
              value={userId}
              onChange={event => setUserId(event.target.value)}
              className="input"
            />
          </Field>
          <Field label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                className="input pl-9"
                placeholder="Filename or content type"
              />
            </div>
          </Field>
          <Button
            loading={loading}
            type="submit"
            disabled={loading}
            className="mt-0 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white dark:bg-slate-900 px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:border-brand-500 hover:text-brand-700 dark:hover:text-teal-300 disabled:cursor-not-allowed disabled:opacity-60 md:mt-5"
          >
            <FileSearch className="h-4 w-4" />
            Load
          </Button>
        </form>
      </div>

      <ErrorNotice message={error} />

      <div className="rounded-lg border border-line bg-white dark:bg-slate-900 shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {files.map(file => (
                <tr key={file.id}>
                  <td className="px-4 py-3">
                    <div className="break-all font-medium">{file.filename || '-'}</div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {file.id}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {file.contentType || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {formatBytes(file.size)}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {formatDate(file.created)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <IconButton title="Delete stored file" onClick={() => setPendingDelete(file)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </td>
                </tr>
              ))}
              {!files.length ? (
                <tr>
                  <td
                    className="px-4 py-10 text-center text-slate-500 dark:text-slate-400"
                    colSpan={5}
                  >
                    No stored files loaded
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-line px-4 py-3">
          <div className="text-sm text-slate-500 dark:text-slate-400">{files.length} shown</div>
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

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete stored file"
        message={
          pendingDelete ? (
            <>
              Delete{' '}
              <strong className="break-all text-ink">
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
