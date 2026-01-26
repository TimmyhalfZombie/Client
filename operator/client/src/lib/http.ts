import { tokens } from '../auth/tokenStore';
import { resolveApiBaseUrl } from './serverDiscovery';

type FetchOptions = Omit<RequestInit, 'body' | 'headers'> & {
  body?: any;
  headers?: Record<string, string>;
  auth?: boolean;
  _retry?: boolean;
};

let refreshInFlight: Promise<void> | null = null;

async function refreshTokensOnce(baseUrl?: string) {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const base = baseUrl ?? (await resolveApiBaseUrl());
      const refresh = await tokens.getRefreshAsync();
      if (!refresh) throw new Error('No refresh token');

      const res = await fetch(`${base.replace(/\/+$/, '')}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });

      if (!res.ok) {
        await tokens.clear({ persist: true });
        const msg = await safeReadMessage(res);
        throw new Error(msg || `Refresh failed (${res.status})`);
      }

      const data = await safeReadJson(res);
      const newAccess  = data?.accessToken ?? data?.access ?? data?.token;
      const newRefresh = data?.refreshToken ?? data?.refresh ?? refresh;
      await tokens.set(newAccess, newRefresh, { persist: true });
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

function isFormData(v: any): v is FormData {
  return typeof FormData !== 'undefined' && v instanceof FormData;
}

function cleanJoin(base: string, path: string) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base.replace(/\/+$/, '')}${p}`;
}

async function safeReadJson(res: Response) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : null; } catch { return { message: text }; }
}

async function safeReadMessage(res: Response) {
  const body = await safeReadJson(res);
  return (body && (body.message || body.error)) || '';
}

export async function api(path: string, opts: FetchOptions = {}) {
  const base = await resolveApiBaseUrl();
  const url  = cleanJoin(base, path);

  const headers: Record<string, string> = { ...(opts.headers || {}) };

  if (opts.body !== undefined && !isFormData(opts.body)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  if (opts.auth) {
    await tokens.waitUntilReady?.();
    const t = tokens.getAccess();
    if (t) headers.Authorization = `Bearer ${t}`;
  }

  const reqInit: RequestInit = {
    ...opts,
    headers,
    body:
      opts.body === undefined
        ? undefined
        : isFormData(opts.body)
          ? opts.body
          : typeof opts.body === 'string'
            ? opts.body
            : JSON.stringify(opts.body),
  };

  let res = await fetch(url, reqInit);

  if (opts.auth && res.status === 401 && !opts._retry) {
    try {
      await refreshTokensOnce(base);
      const freshAccess = await tokens.getAccessAsync();
      const retryHeaders = { ...(headers || {}) };
      if (freshAccess) retryHeaders.Authorization = `Bearer ${freshAccess}`;

      res = await fetch(url, { ...reqInit, headers: retryHeaders } as RequestInit);
      (opts as any)._retry = true;
    } catch {
      const msg = await safeReadMessage(res);
      const err = new Error(msg || 'Unauthorized') as any;
      err.status = 401;
      throw err;
    }
  }

  if (!res.ok) {
    const status = res.status;
    const serverMsg = await safeReadMessage(res);
    const err = new Error(serverMsg || `HTTP ${status}`) as any;
    err.status = status;
    err.data = serverMsg;
    throw err;
  }

  return safeReadJson(res);
}

export const http = {
  get:  (p: string, o: FetchOptions = {}) => api(p, { ...o, method: 'GET' }),
  post: (p: string, body?: any, o: FetchOptions = {}) => api(p, { ...o, method: 'POST', body }),
  put:  (p: string, body?: any, o: FetchOptions = {}) => api(p, { ...o, method: 'PUT', body }),
  del:  (p: string, o: FetchOptions = {}) => api(p, { ...o, method: 'DELETE' }),
};