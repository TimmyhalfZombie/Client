// client/src/lib/operator.api.ts
import { http } from './http';

export type OperatorLocation = {
  lat: number;
  lng: number;
  updated_at?: string;
  heading?: number;
  speed?: number;
  address?: string | null;
};

export async function fetchMyLocationFromServer(): Promise<OperatorLocation | undefined> {
  try {
    const data = await http.get('/users/me/location', { auth: true });
    if (typeof (data as any)?.lat === 'number' && typeof (data as any)?.lng === 'number') {
      return {
        lat: Number((data as any).lat),
        lng: Number((data as any).lng),
        updated_at: (data as any).updated_at ?? undefined,
        heading: (data as any).heading ?? undefined,
        speed: (data as any).speed ?? undefined,
        address: (data as any).address ?? null,
      };
    }
  } catch {}
  return undefined;
}

export async function postMyLocationToServer(loc: {
  lat: number;
  lng: number;
  address?: string | null;
}): Promise<void> {
  await http.post('/users/me/location', loc, { auth: true });
}
