import { api } from '../../../lib/http';
import { tokens } from '../../../auth/tokenStore';

type LoginReq = { identifier: string; password: string };
type RegisterReq = {
  username: string;
  password: string;
  phone: string;
  email?: string;
  lat?: number;
  lng?: number;
};

type AuthResp = {
  user: { id: string; email?: string; username?: string; phone?: string };
  accessToken: string;
  refreshToken: string;
};

export async function loginWithIdentifier(body: LoginReq): Promise<AuthResp> {
  const res = await api('/api/auth/login', { method: 'POST', body });
  const { accessToken, refreshToken } = res as AuthResp;
  tokens.set(accessToken, refreshToken);
  await tokens.saveToStorage();
  return res as AuthResp;
}

export async function registerUser(body: RegisterReq): Promise<AuthResp> {
  const res = await api('/api/auth/register', { method: 'POST', body });
  const { accessToken, refreshToken } = res as AuthResp;
  tokens.set(accessToken, refreshToken);
  await tokens.saveToStorage();
  return res as AuthResp;
}

export async function fetchMe() {
  return api('/api/auth/me', { auth: true, method: 'GET' });
}

export async function logout() {
  tokens.clear();
  await tokens.clearStorage();
}
