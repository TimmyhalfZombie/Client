// client/src/lib/routing.ts
import { http } from './http';

export type LngLat = [number, number];

export type OrsRouteResponse = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'LineString'; coordinates: LngLat[] };
    properties?: any;
  }>;
};

export async function getRouteORS(
  coordinates: LngLat[],
  profile: string = 'driving-car',
  extra: Record<string, any> = {}
): Promise<OrsRouteResponse | null> {
  try {
    // IMPORTANT: hit /api/route (your server proxy)
    const data = await http.post('/api/route', { coordinates, profile, extra }, { auth: true });
    if (data?.features?.[0]?.geometry?.type === 'LineString') {
      return data as OrsRouteResponse;
    }
  } catch {}
  return null;
}

export function toFeatureCollection(route: OrsRouteResponse | null): OrsRouteResponse | null {
  if (!route?.features?.length) return null;
  return { type: 'FeatureCollection', features: [route.features[0]] };
}
