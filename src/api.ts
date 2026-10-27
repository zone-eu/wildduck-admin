import type {
  Page,
  DirectoryAddress,
  ForwardedAddress,
  ForwardedAddressInput,
  RenameResult,
  TaskResult,
  RecoveryInfo,
  ImportResult
} from './types';
import type {
  AdminTwoFactorStatus,
  AutoreplyInput,
  FilterInput,
  FilterItem,
  AddressesResponse,
  AuthLogResponse,
  DomainAccessAction,
  DomainAccessResponse,
  DomainAliasesResponse,
  DomainAlias,
  DkimCreateInput,
  DkimKeyResponse,
  DkimKeysResponse,
  HealthResponse,
  MailboxInput,
  MailboxesResponse,
  ResetPasswordResponse,
  ResetQuotaResponse,
  SessionResponse,
  SettingItem,
  SettingsResponse,
  StoredFilesResponse,
  TlsCertificateInput,
  TlsCertificateResponse,
  TlsCertificatesResponse,
  UserDetails,
  UserUpdateInput,
  WebhooksResponse,
  UsersResponse
} from './types';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON
} from '@simplewebauthn/browser';

const admin2fa = '/api/admin/2fa';
export function getAdminTwoFactor() {
  return apiFetch<AdminTwoFactorStatus>(`${admin2fa}/status`);
}
export function setupAdminTotp(password: string) {
  return apiFetch<{ secret: string; uri: string; qrCode: string }>(`${admin2fa}/totp/setup`, {
    method: 'POST',
    body: JSON.stringify({ password })
  });
}
export function enableAdminTotp(token: string) {
  return apiFetch<SessionResponse>(`${admin2fa}/totp/enable`, {
    method: 'POST',
    body: JSON.stringify({ token })
  });
}
export function verifyAdminTotp(token: string) {
  return apiFetch<SessionResponse>(`${admin2fa}/totp/verify`, {
    method: 'POST',
    body: JSON.stringify({ token })
  });
}
export function removeAdminTotp(password: string) {
  return apiFetch<SessionResponse>(`${admin2fa}/totp`, {
    method: 'DELETE',
    body: JSON.stringify({ password })
  });
}
export function adminRegistrationOptions(name: string, password: string) {
  return apiFetch<PublicKeyCredentialCreationOptionsJSON>(`${admin2fa}/webauthn/register/options`, {
    method: 'POST',
    body: JSON.stringify({ name, password })
  });
}
export function registerAdminPasskey(response: RegistrationResponseJSON) {
  return apiFetch<SessionResponse>(`${admin2fa}/webauthn/register/verify`, {
    method: 'POST',
    body: JSON.stringify({ response })
  });
}
export function adminAuthenticationOptions() {
  return apiFetch<PublicKeyCredentialRequestOptionsJSON>(
    `${admin2fa}/webauthn/authenticate/options`,
    { method: 'POST', body: '{}' }
  );
}
export function authenticateAdminPasskey(response: AuthenticationResponseJSON) {
  return apiFetch<SessionResponse>(`${admin2fa}/webauthn/authenticate/verify`, {
    method: 'POST',
    body: JSON.stringify({ response })
  });
}
export function removeAdminPasskey(id: string, password: string) {
  return apiFetch<SessionResponse>(`${admin2fa}/webauthn/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify({ password })
  });
}

export function getAutoreply(userId: string) {
  return apiFetch<Partial<AutoreplyInput>>(`/api/users/${encodeURIComponent(userId)}/autoreply`);
}

export function saveAutoreply(userId: string, input: AutoreplyInput) {
  return apiFetch<{ success: boolean }>(`/api/users/${encodeURIComponent(userId)}/autoreply`, {
    method: 'PUT',
    body: JSON.stringify(input)
  });
}

export function getFilters(userId: string) {
  return apiFetch<{ results: FilterItem[]; limits?: { used: number; allowed: number } }>(
    `/api/users/${encodeURIComponent(userId)}/filters`
  );
}

export function getFilter(userId: string, id: string) {
  return apiFetch<FilterInput>(
    `/api/users/${encodeURIComponent(userId)}/filters/${encodeURIComponent(id)}`
  );
}

export function saveFilter(userId: string, input: FilterInput, id?: string) {
  return apiFetch<{ success: boolean }>(
    `/api/users/${encodeURIComponent(userId)}/filters${id ? `/${encodeURIComponent(id)}` : ''}`,
    {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(input)
    }
  );
}

export function deleteFilter(userId: string, id: string) {
  return apiFetch<{ success: boolean }>(
    `/api/users/${encodeURIComponent(userId)}/filters/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      'X-Admin-Request': '1',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (response.status === 401 && payload.error === 'Authentication required') {
    window.dispatchEvent(new Event('admin-session-expired'));
  }
  if (payload.code === 'AdminTwoFactorRequired') {
    window.dispatchEvent(new Event('admin-two-factor-required'));
  }
  if (!response.ok || payload.success === false) {
    const error = new Error(
      [
        payload.error || response.statusText,
        payload.code,
        typeof payload.detail === 'string' ? payload.detail : ''
      ]
        .filter(Boolean)
        .join(' · ')
    ) as Error & { status?: number; code?: string; detail?: unknown };
    error.status = response.status;
    error.code = payload.code;
    error.detail = payload.detail;
    throw error;
  }

  return payload as T;
}

export function getSession() {
  return apiFetch<SessionResponse>('/api/session');
}

export function login(username: string, password: string) {
  return apiFetch<SessionResponse>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export function logout() {
  return apiFetch<{ success: boolean }>('/api/logout', { method: 'POST' });
}

export function getHealth() {
  return apiFetch<HealthResponse>('/api/health');
}

export function getUsers(params: {
  query?: string;
  limit?: number;
  next?: string;
  previous?: string;
}) {
  const query = new URLSearchParams();
  if (params.query) {
    query.set('query', params.query);
  }
  if (params.limit) {
    query.set('limit', String(params.limit));
  }
  if (params.next) {
    query.set('next', params.next);
  }
  if (params.previous) {
    query.set('previous', params.previous);
  }
  return apiFetch<UsersResponse>(`/api/users?${query.toString()}`);
}

export function createUser(input: {
  username: string;
  password: string;
  address?: string;
  name?: string;
  quota?: number;
  tags?: string[];
  requirePasswordChange?: boolean;
}) {
  return apiFetch<{ success: boolean; id: string }>('/api/users', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function getUser(userId: string) {
  return apiFetch<UserDetails>(`/api/users/${encodeURIComponent(userId)}`);
}

export function updateUser(userId: string, input: UserUpdateInput) {
  return apiFetch<{ success: boolean }>(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: JSON.stringify(input)
  });
}

export function logoutUser(userId: string, reason?: string) {
  return apiFetch<{ success: boolean }>(`/api/users/${encodeURIComponent(userId)}/logout`, {
    method: 'PUT',
    body: JSON.stringify({ reason })
  });
}

export function resetUserPassword(userId: string) {
  return apiFetch<ResetPasswordResponse>(
    `/api/users/${encodeURIComponent(userId)}/password/reset`,
    {
      method: 'POST'
    }
  );
}

export function resetUserQuota(userId: string) {
  return apiFetch<ResetQuotaResponse>(`/api/users/${encodeURIComponent(userId)}/quota/reset`, {
    method: 'POST'
  });
}

export function deleteUser(userId: string, deleteAfter?: string) {
  return apiFetch<TaskResult>(
    `/api/users/${encodeURIComponent(userId)}${deleteAfter ? `?${new URLSearchParams({ deleteAfter })}` : ''}`,
    {
      method: 'DELETE'
    }
  );
}

export function getAddresses(userId: string) {
  return apiFetch<AddressesResponse>(`/api/users/${encodeURIComponent(userId)}/addresses`);
}

export function createAddress(
  userId: string,
  input: {
    address: string;
    name?: string;
    main?: boolean;
    allowWildcard?: boolean;
    tags?: string[];
  }
) {
  return apiFetch<{ success: boolean; id: string }>(
    `/api/users/${encodeURIComponent(userId)}/addresses`,
    {
      method: 'POST',
      body: JSON.stringify(input)
    }
  );
}

export function updateAddress(
  userId: string,
  addressId: string,
  input: { name?: string; address?: string; main?: boolean; tags?: string[] }
) {
  return apiFetch<{ success: boolean }>(
    `/api/users/${encodeURIComponent(userId)}/addresses/${encodeURIComponent(addressId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(input)
    }
  );
}

export function deleteAddress(userId: string, addressId: string) {
  return apiFetch<{ success: boolean }>(
    `/api/users/${encodeURIComponent(userId)}/addresses/${encodeURIComponent(addressId)}`,
    {
      method: 'DELETE'
    }
  );
}

export function getMailboxes(
  userId: string,
  params: { counters?: boolean; sizes?: boolean; showHidden?: boolean } = {}
) {
  const query = new URLSearchParams();
  if (params.counters) {
    query.set('counters', String(params.counters));
  }
  if (params.sizes) {
    query.set('sizes', String(params.sizes));
  }
  if (params.showHidden) {
    query.set('showHidden', String(params.showHidden));
  }
  return apiFetch<MailboxesResponse>(
    `/api/users/${encodeURIComponent(userId)}/mailboxes?${query.toString()}`
  );
}

export function createMailbox(userId: string, input: MailboxInput & { path: string }) {
  return apiFetch<{ success: boolean; id: string }>(
    `/api/users/${encodeURIComponent(userId)}/mailboxes`,
    {
      method: 'POST',
      body: JSON.stringify(input)
    }
  );
}

export function updateMailbox(userId: string, mailboxId: string, input: MailboxInput) {
  return apiFetch<{ success: boolean }>(
    `/api/users/${encodeURIComponent(userId)}/mailboxes/${encodeURIComponent(mailboxId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(input)
    }
  );
}

export function deleteMailbox(userId: string, mailboxId: string) {
  return apiFetch<{ success: boolean }>(
    `/api/users/${encodeURIComponent(userId)}/mailboxes/${encodeURIComponent(mailboxId)}`,
    {
      method: 'DELETE'
    }
  );
}

export function getAuthLog(
  userId: string,
  params: {
    action?: string;
    filterip?: string;
    limit?: number;
    next?: string;
    previous?: string;
  } = {}
) {
  const query = new URLSearchParams();
  if (params.action) {
    query.set('action', params.action);
  }
  if (params.filterip) {
    query.set('filterip', params.filterip);
  }
  if (params.limit) {
    query.set('limit', String(params.limit));
  }
  if (params.next) {
    query.set('next', params.next);
  }
  if (params.previous) {
    query.set('previous', params.previous);
  }
  return apiFetch<AuthLogResponse>(
    `/api/users/${encodeURIComponent(userId)}/authlog?${query.toString()}`
  );
}

export function getStoredFiles(
  userId: string,
  params: { query?: string; limit?: number; next?: string; previous?: string } = {}
) {
  const query = new URLSearchParams();
  if (params.query) {
    query.set('query', params.query);
  }
  if (params.limit) {
    query.set('limit', String(params.limit));
  }
  if (params.next) {
    query.set('next', params.next);
  }
  if (params.previous) {
    query.set('previous', params.previous);
  }
  return apiFetch<StoredFilesResponse>(
    `/api/users/${encodeURIComponent(userId)}/storage?${query.toString()}`
  );
}

export function deleteStoredFile(userId: string, fileId: string) {
  return apiFetch<{ success: boolean }>(
    `/api/users/${encodeURIComponent(userId)}/storage/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE'
    }
  );
}

export function getSettings(filter?: string) {
  const query = new URLSearchParams();
  if (filter) {
    query.set('filter', filter);
  }
  return apiFetch<SettingsResponse>(`/api/settings?${query.toString()}`);
}

export function updateSetting(key: string, value: SettingItem['value']) {
  return apiFetch<{ success: boolean; key: string }>(`/api/settings/${encodeURIComponent(key)}`, {
    method: 'POST',
    body: JSON.stringify({ value })
  });
}

export function getDkimKeys(params: {
  query?: string;
  limit?: number;
  next?: string;
  previous?: string;
}) {
  const query = new URLSearchParams();
  if (params.query) {
    query.set('query', params.query);
  }
  if (params.limit) {
    query.set('limit', String(params.limit));
  }
  if (params.next) {
    query.set('next', params.next);
  }
  if (params.previous) {
    query.set('previous', params.previous);
  }
  return apiFetch<DkimKeysResponse>(`/api/dkim?${query.toString()}`);
}

export function getDkimKey(id: string) {
  return apiFetch<DkimKeyResponse>(`/api/dkim/${encodeURIComponent(id)}`);
}

export function createDkimKey(input: DkimCreateInput) {
  return apiFetch<DkimKeyResponse>('/api/dkim', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function deleteDkimKey(id: string) {
  return apiFetch<{ success: boolean }>(`/api/dkim/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

export function resolveDkimDomain(domain: string) {
  return apiFetch<{ success: boolean; id: string }>(
    `/api/dkim/resolve/${encodeURIComponent(domain)}`
  );
}

export function getDomainAccess(tag: string, action: DomainAccessAction) {
  return apiFetch<DomainAccessResponse>(`/api/domainaccess/${encodeURIComponent(tag)}/${action}`);
}

export function createDomainAccess(tag: string, action: DomainAccessAction, domain: string) {
  return apiFetch<{ success: boolean; id: string }>(
    `/api/domainaccess/${encodeURIComponent(tag)}/${action}`,
    {
      method: 'POST',
      body: JSON.stringify({ domain })
    }
  );
}

export function deleteDomainAccess(id: string) {
  return apiFetch<{ success: boolean; deleted?: boolean }>(
    `/api/domainaccess/${encodeURIComponent(id)}`,
    {
      method: 'DELETE'
    }
  );
}

export function getDomainAliases(params: {
  query?: string;
  limit?: number;
  next?: string;
  previous?: string;
}) {
  const query = new URLSearchParams();
  if (params.query) {
    query.set('query', params.query);
  }
  if (params.limit) {
    query.set('limit', String(params.limit));
  }
  if (params.next) {
    query.set('next', params.next);
  }
  if (params.previous) {
    query.set('previous', params.previous);
  }
  return apiFetch<DomainAliasesResponse>(`/api/domainaliases?${query.toString()}`);
}

export function getDomainAlias(id: string) {
  return apiFetch<DomainAlias & { success: boolean }>(
    `/api/domainaliases/${encodeURIComponent(id)}`
  );
}

export function createDomainAlias(input: { alias: string; domain: string }) {
  return apiFetch<{ success: boolean; id: string }>('/api/domainaliases', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function deleteDomainAlias(id: string) {
  return apiFetch<{ success: boolean }>(`/api/domainaliases/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

export function getTlsCertificates(params: {
  query?: string;
  altNames?: boolean;
  limit?: number;
  next?: string;
  previous?: string;
}) {
  const query = new URLSearchParams();
  if (params.query) {
    query.set('query', params.query);
  }
  if (params.altNames) {
    query.set('altNames', String(params.altNames));
  }
  if (params.limit) {
    query.set('limit', String(params.limit));
  }
  if (params.next) {
    query.set('next', params.next);
  }
  if (params.previous) {
    query.set('previous', params.previous);
  }
  return apiFetch<TlsCertificatesResponse>(`/api/certs?${query.toString()}`);
}

export function getTlsCertificate(id: string) {
  return apiFetch<TlsCertificateResponse>(`/api/certs/${encodeURIComponent(id)}`);
}

export function saveTlsCertificate(input: TlsCertificateInput) {
  return apiFetch<TlsCertificateResponse>('/api/certs', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function deleteTlsCertificate(id: string) {
  return apiFetch<{ success: boolean }>(`/api/certs/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

export function getWebhooks(
  params: { type?: string; user?: string; limit?: number; next?: string; previous?: string } = {}
) {
  const query = new URLSearchParams();
  if (params.type) {
    query.set('type', params.type);
  }
  if (params.user) {
    query.set('user', params.user);
  }
  if (params.limit) {
    query.set('limit', String(params.limit));
  }
  if (params.next) {
    query.set('next', params.next);
  }
  if (params.previous) {
    query.set('previous', params.previous);
  }
  return apiFetch<WebhooksResponse>(`/api/webhooks?${query.toString()}`);
}

export function createWebhook(input: { type: string[]; user?: string; url: string }) {
  return apiFetch<{ success: boolean; id: string }>('/api/webhooks', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function deleteWebhook(id: string) {
  return apiFetch<{ success: boolean }>(`/api/webhooks/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

function queryString(params: Record<string, string | number | boolean | undefined>) {
  return new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)])
  ).toString();
}
export function getAddressDirectory(params: {
  query?: string;
  forward?: string;
  limit?: number;
  next?: string;
  previous?: string;
}) {
  return apiFetch<Page<DirectoryAddress>>(`/api/addresses?${queryString(params)}`);
}
export function resolveAddress(address: string, allowWildcard: boolean) {
  return apiFetch<ForwardedAddress>(
    `/api/addresses/resolve/${encodeURIComponent(address)}?${queryString({ allowWildcard })}`
  );
}
export function getForwardedAddress(id: string) {
  return apiFetch<ForwardedAddress>(`/api/addresses/forwarded/${encodeURIComponent(id)}`);
}
export function saveForwardedAddress(input: ForwardedAddressInput, id?: string) {
  return apiFetch<{ success: boolean; id?: string }>(
    `/api/addresses/forwarded${id ? `/${encodeURIComponent(id)}` : ''}`,
    { method: id ? 'PUT' : 'POST', body: JSON.stringify(input) }
  );
}
export function deleteForwardedAddress(id: string) {
  return apiFetch<{ success: boolean }>(`/api/addresses/forwarded/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}
export function renameAddressDomain(oldDomain: string, newDomain: string) {
  return apiFetch<RenameResult>('/api/addresses/renameDomain', {
    method: 'PUT',
    body: JSON.stringify({ oldDomain, newDomain })
  });
}
export function getAddressRegister(user: string, query: string) {
  return apiFetch<AddressesResponse>(
    `/api/users/${encodeURIComponent(user)}/addressregister?${queryString({ query, limit: 100 })}`
  );
}
export function updateAddressRegister(
  user: string,
  id: string,
  input: { name?: string; disabled: boolean }
) {
  return apiFetch<{ success: boolean }>(
    `/api/users/${encodeURIComponent(user)}/addressregister/${encodeURIComponent(id)}`,
    { method: 'PUT', body: JSON.stringify(input) }
  );
}
export function getRecoveryInfo(user: string) {
  return apiFetch<RecoveryInfo>(`/api/users/${encodeURIComponent(user)}/restore`);
}
export function restoreUser(user: string) {
  return apiFetch<TaskResult>(`/api/users/${encodeURIComponent(user)}/restore`, { method: 'POST' });
}
export function resetGlobalQuota() {
  return apiFetch<TaskResult>('/api/quota/reset', { method: 'POST' });
}
export function importData(file: File, signal?: AbortSignal) {
  return apiFetch<ImportResult>('/api/data/import', {
    method: 'POST',
    body: file,
    headers: { 'Content-Type': 'application/octet-stream' },
    signal
  });
}
export async function exportData(
  input: { users?: string[]; tags?: string[] },
  signal?: AbortSignal
) {
  const response = await fetch('/api/data/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Request': '1' },
    body: JSON.stringify(input),
    signal
  });
  if (!response.ok || response.headers.get('content-type')?.includes('application/json')) {
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 && payload.error === 'Authentication required')
      window.dispatchEvent(new Event('admin-session-expired'));
    if (payload.code === 'AdminTwoFactorRequired')
      window.dispatchEvent(new Event('admin-two-factor-required'));
    throw new Error(payload.error || response.statusText);
  }
  return response.blob();
}
