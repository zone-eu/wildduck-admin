import { CheckIcon, CopyIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

// Keep the controlled dialog lifecycle and native focus handling in one place.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy,
  onConfirm,
  onCancel
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className="modal"
      onCancel={event => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="modal-box max-w-md">
        <h3 id={titleId} className="flex items-center gap-2 text-lg font-semibold">
          <WarningCircleIcon className="size-5 shrink-0 text-error" aria-hidden="true" />
          {title}
        </h3>
        <div className="mt-3 text-sm leading-6 text-base-content/70">{message}</div>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-error"
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={onConfirm}
          >
            {busy ? (
              <span aria-hidden="true" className="loading loading-spinner loading-xs" />
            ) : null}
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
      <form
        method="dialog"
        className="modal-backdrop"
        onSubmit={event => {
          event.preventDefault();
          if (!busy) onCancel();
        }}
      >
        <button disabled={busy}>Close</button>
      </form>
    </dialog>
  );
}

export function CopyButton({ value, title }: { value: string; title: string }) {
  const [state, setState] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timeout.current), []);
  async function copy(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setState('copying');
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    }
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setState('idle'), 2000);
  }
  const label =
    state === 'copied'
      ? 'Copied'
      : state === 'failed'
        ? 'Copy failed — select and copy the text'
        : title;
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <button
        type="button"
        className="btn btn-ghost btn-square btn-sm"
        title={label}
        aria-label={label}
        onClick={copy}
        disabled={state === 'copying'}
        aria-busy={state === 'copying' || undefined}
      >
        {state === 'copying' ? (
          <span className="loading loading-spinner loading-xs" aria-hidden="true" />
        ) : state === 'copied' ? (
          <CheckIcon className="size-4 text-success" />
        ) : (
          <CopyIcon className="size-4" />
        )}
      </button>
      <span role="status" className="sr-only">
        {state === 'copied' || state === 'failed' ? label : ''}
      </span>
    </span>
  );
}

export function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function formatBytes(value?: number) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount >= 10 || unit === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unit]}`;
}
