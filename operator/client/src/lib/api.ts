// src/lib/api.ts
import { api } from './http';
import { tokens } from '../auth/tokenStore';

/** Register → returns and saves tokens, returns user */
export async function registerUser(input: {
  username: string;
  email?: string;
  phone?: string;
  password: string;
}) {
  const res = await api('/api/auth/register', {
    method: 'POST',
    body: input,
  });

  // persist tokens for future sessions
  tokens.set(res.accessToken, res.refreshToken);
  await tokens.saveToStorage();

  return res.user;
}

/** Login → returns and saves tokens, returns user */
export async function loginWithIdentifier(input: {
  identifier: string;
  password: string;
}) {
  const res = await api('/api/auth/login', {
    method: 'POST',
    body: input,
  });

  tokens.set(res.accessToken, res.refreshToken);
  await tokens.saveToStorage();

  return res.user;
}

/** Fetch current user (requires Authorization header) */
export async function fetchMe() {
  return api('/api/auth/me', { auth: true });
}

/** Load tokens from device storage into memory on app start */
export async function loadToken() {
  await tokens.loadFromStorage();
  return tokens.getAccess();
}
