import { AlertCircle, Check, Copy, LoaderCircle } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes
} from 'react';

export function StatusPill({
  label,
  tone
}: {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'muted';
}) {
  const className =
    tone === 'success'
      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
      : tone === 'warning'
        ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
        : tone === 'danger'
          ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300';

  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-2 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

export function Button({
  loading = false,
  danger = false,
  align = 'center',
  disabled,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  danger?: boolean;
  align?: 'start' | 'center';
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-danger={danger || undefined}
      className={`inline-flex items-center ${align === 'start' ? 'justify-start' : 'justify-center'} gap-2 rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${loading ? 'button-loading' : ''} ${className}`}
    >
      {loading ? (
        <LoaderCircle aria-hidden="true" className="button-spinner h-4 w-4 shrink-0 animate-spin" />
      ) : null}
      {children}
    </button>
  );
}

export function IconButton({
  title,
  onClick,
  children,
  disabled,
  loading = false,
  danger = /^(delete|remove)\b/i.test(title)
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  danger?: boolean;
}) {
  return (
    <Button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      danger={danger}
      className="h-9 w-9 border border-line bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 shadow-xs hover:border-brand-500 hover:text-brand-700 dark:hover:text-teal-300"
    >
      {children}
    </Button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950 px-3 py-2 text-sm text-rose-700 dark:text-rose-300"
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span className="min-w-0 break-words">{message}</span>
    </div>
  );
}

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
    if (!element) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
    }
    if (!open && element.open) {
      element.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={event => {
        event.preventDefault();
        if (!busy) {
          onCancel();
        }
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl bg-transparent p-0 backdrop:bg-slate-950/60 backdrop:backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-lg border border-line bg-white dark:bg-slate-900 shadow-panel">
        <div className="flex items-start gap-3 border-b border-line px-4 py-4">
          <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 id={titleId} className="font-display text-lg font-semibold text-ink">
              {title}
            </h3>
            <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {message}
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 px-4 py-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-white dark:bg-slate-900 px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:border-brand-500 hover:text-brand-700 dark:hover:text-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <Button
            type="button"
            onClick={onConfirm}
            danger
            loading={busy}
            disabled={busy}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
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
      <Button
        type="button"
        title={label}
        aria-label={label}
        onClick={copy}
        loading={state === 'copying'}
        className="h-8 w-8 border border-line bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-brand-500 hover:text-brand-700 dark:hover:text-teal-300"
      >
        {state === 'copied' ? (
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
      <span role="status" className="sr-only">
        {state === 'copied' || state === 'failed' ? label : ''}
      </span>
    </span>
  );
}

export function formatDate(value?: string) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export function formatBytes(value?: number) {
  if (!value) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount >= 10 || unit === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unit]}`;
}
