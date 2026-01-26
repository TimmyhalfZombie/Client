// client/src/features/navigation/api.ts
import { API_URL } from '../../lib/env';

export type LatLng = { lat: number; lng: number };

export async function fetchClientLocation(userId: string): Promise<LatLng> {
  const { tokens } = await import('../../auth/tokenStore');
  const accessToken = await tokens.getAccessAsync();
  const r = await fetch(`${API_URL}/api/users/${encodeURIComponent(userId)}/location`, {
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  if (!r.ok) throw new Error('Client location fetch failed');
  const j = await r.json();
  const lat = Number(j?.lat);
  const lng = Number(j?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Invalid client location');
  return { lat, lng };
}

/** Keep the same return shape used by your screen (points: LatLng[]) */
export async function fetchRoute(
  from: LatLng,
  to: LatLng,
  mode: 'drive' | 'walk' | 'bicycle' | 'transit' = 'drive'
): Promise<{ points: LatLng[] } | null> {
  const m = mode === 'walk' ? 'foot' : mode === 'bicycle' ? 'bike' : 'drive';
  const qs = new URLSearchParams({
    from: `${from.lng},${from.lat}`,
    to: `${to.lng},${to.lat}`,
    mode: m,
  });
  const r = await fetch(`${API_URL}/api/geo/route?${qs.toString()}`);
  if (!r.ok) return null;
  const j = await r.json();
  const coords: [number, number][] | undefined = j?.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coords)) return null;
  return { points: coords.map(([lng, lat]) => ({ lat, lng })) };
}
