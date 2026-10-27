import { ReactNode, useEffect, useState } from 'react';
import { getUser, getUsers } from '../api';
import type { UserListItem, UsersResponse } from '../types';

export function setAccountUrl(id: string) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('user', id);
  else url.searchParams.delete('user');
  window.history.pushState(null, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function AccountSelector({
  value,
  onChange
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<{ next?: string; previous?: string }>({});
  const [data, setData] = useState<UsersResponse>();
  const [selected, setSelected] = useState<UserListItem>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    setData(undefined);
    setError('');
    setLoading(true);
    const timer = setTimeout(() => {
      getUsers({ query, limit: 25, ...page })
        .then(result => {
          if (current) setData(result);
        })
        .catch(err => {
          if (current) setError(err.message);
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, page]);
  useEffect(() => {
    let current = true;
    setSelected(undefined);
    if (value)
      getUser(value)
        .then(user => {
          if (current) setSelected(user);
        })
        .catch(err => {
          if (current) setError(err.message);
        });
    return () => {
      current = false;
    };
  }, [value]);
  return (
    <div className="card border border-base-300 bg-base-100 p-4 space-y-3">
      <label className="fieldset">
        <span className="fieldset-legend">Search accounts</span>
        <input
          className="input w-full"
          value={query}
          placeholder="Username or email address"
          onChange={event => {
            setQuery(event.target.value);
            setPage({});
          }}
        />
      </label>
      <label className="fieldset">
        <span className="fieldset-legend">Account</span>
        <select
          className="select w-full"
          value={value}
          onChange={event => onChange(event.target.value)}
        >
          <option value="">Select an account</option>
          {value && !data?.results.some(user => user.id === value) ? (
            <option value={value}>
              {selected?.username || value} {selected?.address}
            </option>
          ) : null}
          {data?.results.map(user => (
            <option key={user.id} value={user.id}>
              {user.username} · {user.address}
            </option>
          ))}
        </select>
      </label>
      {loading ? <p role="status">Searching…</p> : null}
      {error ? (
        <p role="alert" className="text-error">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          className="btn btn-sm"
          disabled={loading || !data?.previousCursor}
          onClick={() => setPage({ previous: data?.previousCursor || undefined })}
        >
          Previous accounts
        </button>
        <button
          className="btn btn-sm"
          disabled={loading || !data?.nextCursor}
          onClick={() => setPage({ next: data?.nextCursor || undefined })}
        >
          Next accounts
        </button>
      </div>
    </div>
  );
}

export function AccountWorkspace({ children }: { children: (id: string) => ReactNode }) {
  const read = () => new URL(window.location.href).searchParams.get('user') || '';
  const [id, setId] = useState(read);
  useEffect(() => {
    const pop = () => setId(read());
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  return (
    <div className="space-y-5">
      <AccountSelector value={id} onChange={setAccountUrl} />
      {id ? <div key={id}>{children(id)}</div> : <p>Select an account to continue.</p>}
    </div>
  );
}
