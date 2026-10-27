import type { ReactNode } from 'react';
export const panel = 'card border border-base-300 bg-base-100 p-5 space-y-4 shadow-xs';
export const splitList = (value: string) =>
  value
    .split(/[,\n]/)
    .map(item => item.trim())
    .filter(Boolean);
export const message = (err: unknown) => (err instanceof Error ? err.message : 'Request failed');
export function Field({
  label,
  value,
  onChange,
  type = 'text',
  multiline = false,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  multiline?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="fieldset min-w-0">
      <span className="fieldset-legend">{label}</span>
      {multiline ? (
        <textarea
          className="textarea w-full font-mono"
          rows={4}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
        />
      ) : (
        <input
          className="input w-full"
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
        />
      )}
    </label>
  );
}
export function Toggle({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        className="checkbox checkbox-sm"
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
export function ErrorAlert({ error }: { error: string }) {
  return error ? (
    <p role="alert" className="alert alert-error alert-soft">
      {error}
    </p>
  ) : null;
}
export function Result({ children }: { children: ReactNode }) {
  return (
    <pre className="whitespace-pre-wrap break-all rounded bg-base-200 p-3 text-sm" role="status">
      {children}
    </pre>
  );
}
export function parseObject(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('Expected a JSON object');
  return parsed as Record<string, unknown>;
}
