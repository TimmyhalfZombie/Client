import * as SecureStore from 'expo-secure-store';
import { resolveApiBaseUrl } from '../../../lib/serverDiscovery';

const TOKEN_KEY = 'auth_token';
let inMemoryToken: string | null = null;

export type User = { _id: string; username: string; email: string; phone: string };

export async function saveToken(token: string) {
  inMemoryToken = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}
export async function loadToken() {
  const t = await SecureStore.getItemAsync(TOKEN_KEY);
  inMemoryToken = t;
  return t;
}
export async function clearToken() {
  inMemoryToken = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

function headers(json = true): HeadersInit {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  if (inMemoryToken) h['Authorization'] = `Bearer ${inMemoryToken}`;
  return h;
}

export async function httpPost<T = any>(path: string, body: unknown): Promise<T> {
  const base = await resolveApiBaseUrl();
  const r = await fetch(`${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
  return text ? JSON.parse(text) : ({} as any);
}

export async function httpGet<T = any>(path: string): Promise<T> {
  const base = await resolveApiBaseUrl();
  const r = await fetch(`${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`, { headers: headers(false) });
  const text = await r.text();
  if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
  return text ? JSON.parse(text) : ({} as any);
}
