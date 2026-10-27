import { useEffect, useRef, useState } from 'react';
import { exportData, getRecoveryInfo, importData, resetGlobalQuota, restoreUser } from '../api';
import type { ImportResult, RecoveryInfo, TaskResult } from '../types';
import { ErrorAlert, Field, Result, message, panel, splitList } from './NativeForms';
import { ConfirmDialog, CopyButton, formatBytes, formatDate } from './ui';

export function OperationsView({ exportTokenConfigured }: { exportTokenConfigured: boolean }) {
  const [mode, setMode] = useState<'all' | 'users' | 'tags'>('all');
  const [selection, setSelection] = useState('');
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState<ImportResult>();
  const [user, setUser] = useState('');
  const [info, setInfo] = useState<RecoveryInfo>();
  const [result, setResult] = useState<TaskResult>();
  const [confirm, setConfirm] = useState<'restore' | 'quota' | 'import' | null>(null);
  const transfer = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      transfer.current?.abort();
    },
    []
  );
  async function run(name: string, action: () => Promise<void>) {
    setError('');
    setBusy(name);
    try {
      await action();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy('');
    }
  }
  return (
    <section className="space-y-5">
      <h2 className="font-display text-2xl font-semibold">Operations</h2>
      <ErrorAlert error={error} />
      <div
        className={`alert alert-soft ${exportTokenConfigured ? 'alert-success' : 'alert-error'}`}
        role="status"
      >
        <div>
          <p className="font-semibold">
            Dedicated import/export token{' '}
            {exportTokenConfigured ? 'is configured' : 'is not configured'}
          </p>
          <p className="text-sm">
            {exportTokenConfigured
              ? 'Only import and export requests use this token.'
              : 'Import and export are unavailable until api.exportAccessToken is configured.'}
          </p>
        </div>
      </div>
      <div className={panel}>
        <h3 className="font-semibold">Export account data</h3>
        <p>
          Native exports contain account structure and settings, including password hashes. They
          exclude emails. Store downloads securely. Import and export require a WildDuck access
          token with the export role.
        </p>
        <label className="fieldset">
          <span className="fieldset-legend">Accounts to export</span>
          <select
            className="select w-full"
            value={mode}
            disabled={!!busy}
            onChange={e => {
              setMode(e.target.value as typeof mode);
              setSelection('');
            }}
          >
            <option value="all">All accounts</option>
            <option value="users">Selected account IDs</option>
            <option value="tags">Accounts matching any selected tag</option>
          </select>
        </label>
        {mode !== 'all' ? (
          <Field
            label={
              mode === 'users'
                ? 'Account IDs (comma or newline separated)'
                : 'Tags (comma or newline separated)'
            }
            value={selection}
            multiline
            onChange={setSelection}
          />
        ) : null}
        <button
          className="btn btn-primary"
          disabled={
            !!busy || !exportTokenConfigured || (mode !== 'all' && !splitList(selection).length)
          }
          onClick={() =>
            run('export', async () => {
              const controller = new AbortController();
              transfer.current = controller;
              const blob = await exportData(
                mode === 'all' ? {} : { [mode]: splitList(selection) },
                controller.signal
              );
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `wildduck-${new Date().toISOString().slice(0, 10)}.dump`;
              document.body.append(link);
              link.click();
              link.remove();
              setTimeout(() => URL.revokeObjectURL(url), 60000);
            })
          }
        >
          {busy === 'export' ? 'Exporting…' : 'Download native dump'}
        </button>
      </div>
      <div className={panel}>
        <h3 className="font-semibold">Import account data</h3>
        <p>
          Upload a native WildDuck dump. Existing entries are preserved. Import counts describe
          individual database entries.
        </p>
        <label className="fieldset">
          <span className="fieldset-legend">Native dump file</span>
          <input
            type="file"
            className="file-input w-full"
            disabled={!!busy || !exportTokenConfigured}
            onChange={e => {
              setFile(e.target.files?.[0]);
              setImportResult(undefined);
            }}
          />
        </label>
        <button
          className="btn btn-primary"
          disabled={!!busy || !exportTokenConfigured || !file}
          onClick={() => setConfirm('import')}
        >
          {busy === 'import' ? 'Importing…' : 'Import dump…'}
        </button>
        {importResult ? (
          <Result>{`Entries: ${importResult.entries}\nImported: ${importResult.imported}\nFailed: ${importResult.failed}\nExisting: ${importResult.existing}`}</Result>
        ) : null}
      </div>
      {busy === 'export' || busy === 'import' ? (
        <button className="btn btn-warning" onClick={() => transfer.current?.abort()}>
          Cancel transfer
        </button>
      ) : null}
      <form
        className={panel}
        onSubmit={event => {
          event.preventDefault();
          setInfo(undefined);
          setResult(undefined);
          run('lookup', async () => setInfo(await getRecoveryInfo(user.trim())));
        }}
      >
        <h3 className="font-semibold">Recover a deleted account</h3>
        <p>
          Look up the retained account by its ID before restoring. Recovery is available only while
          WildDuck still retains its data. Recycled addresses may no longer be available.
        </p>
        <Field
          label="Deleted account ID"
          value={user}
          onChange={value => {
            setUser(value);
            setInfo(undefined);
          }}
          disabled={!!busy}
        />
        <button className="btn" disabled={!!busy || !user.trim()}>
          Look up recovery information
        </button>
        {info ? (
          <div className="space-y-3">
            <p>
              {info.username} · {info.user}
            </p>
            <p>
              Deleted: {formatDate(info.deleted)} · Storage: {formatBytes(info.storageUsed)}
            </p>
            <h4 className="font-semibold">Recoverable addresses</h4>
            {info.recoverableAddresses?.length ? (
              <ul className="list-disc pl-5">
                {info.recoverableAddresses.map(address => (
                  <li key={address}>{address}</li>
                ))}
              </ul>
            ) : (
              <p>No addresses available to restore.</p>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={!!busy}
              onClick={() => setConfirm('restore')}
            >
              Restore account…
            </button>
          </div>
        ) : null}
      </form>
      <div className={panel}>
        <h3 className="font-semibold">Recalculate all account quotas</h3>
        <p>
          Schedule WildDuck’s global quota recalculation. A returned task ID acknowledges
          scheduling; it does not indicate completion.
        </p>
        <button className="btn btn-warning" disabled={!!busy} onClick={() => setConfirm('quota')}>
          Recalculate all quotas…
        </button>
      </div>
      {result ? (
        <div className={panel}>
          <h3 className="font-semibold">WildDuck operation response</h3>
          <Result>{JSON.stringify(result, null, 2)}</Result>
          {result.user ? (
            <div className="flex gap-2 items-center">
              Account ID: <code>{result.user}</code>
              <CopyButton value={result.user} title="Copy account ID" />
            </div>
          ) : null}
          {result.task ? (
            <div className="flex gap-2 items-center">
              Task ID: <code>{result.task}</code>
              <CopyButton value={result.task} title="Copy task ID" />
            </div>
          ) : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={!!confirm}
        title={
          confirm === 'quota'
            ? 'Recalculate global quotas'
            : confirm === 'import'
              ? 'Import native dump'
              : 'Restore account'
        }
        message={
          confirm === 'quota'
            ? 'Schedule quota recalculation for all accounts?'
            : confirm === 'import'
              ? `Import ${file?.name}? Existing entries will be preserved.`
              : `Restore ${info?.username || info?.user} with the available addresses listed above?`
        }
        confirmLabel={
          confirm === 'quota'
            ? 'Schedule recalculation'
            : confirm === 'import'
              ? 'Import dump'
              : 'Restore account'
        }
        busy={!!busy}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const action = confirm;
          setConfirm(null);
          if (action === 'quota')
            await run('quota', async () => {
              setResult(undefined);
              setResult(await resetGlobalQuota());
            });
          if (action === 'restore' && info)
            await run('restore', async () => {
              setResult(undefined);
              setResult(await restoreUser(info.user));
              setInfo(undefined);
            });
          if (action === 'import' && file)
            await run('import', async () => {
              const controller = new AbortController();
              transfer.current = controller;
              setImportResult(undefined);
              setImportResult(await importData(file, controller.signal));
            });
        }}
      />
    </section>
  );
}
