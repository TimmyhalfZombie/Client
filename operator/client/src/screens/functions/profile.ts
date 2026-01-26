import type { Router } from 'expo-router';
import { tokens } from '../../auth/tokenStore';
import { api } from '../../lib/http';

export type ProfileData = { username: string; phone: string; email: string };

export async function fetchProfile(): Promise<ProfileData> {
  const me = await api('/api/auth/me', { method: 'GET', auth: true });
  return {
    username: me?.username ?? me?.name ?? me?.email ?? '',
    phone: me?.phone ?? me?.phoneNumber ?? me?.customerPhone ?? me?.contactPhone ?? me?.mobile ?? me?.tel ?? '',
    email: me?.email ?? me?.contactEmail ?? me?.username ?? '',
  };
}

export async function doLogout(router: Router) {
  tokens.clear();
  await tokens.clearStorage();         // ensure SecureStore is cleared
  router.replace('/(auth)/login');
}
