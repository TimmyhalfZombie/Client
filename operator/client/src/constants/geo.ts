// client/src/constants/geo.ts
import Constants from 'expo-constants';
import { API_URL } from '../lib/env';

type Extra = {
  MAPTILER_KEY?: string;
  MAPTILER_MAP_ID?: string; // e.g., 'streets-v4'
};

const extra: Extra =
  ((Constants as any)?.expoConfig?.extra ??
    (Constants as any)?.manifest?.extra ??
    {}) as Extra;

// 🔑 Your MapTiler key
export const MAPTILER_KEY: string =
  (process.env.EXPO_PUBLIC_MAPTILER_KEY as string) ||
  extra.MAPTILER_KEY ||
  '';

// 🗺️ Default to Streets v4 unless env/extra overrides
export const MAPTILER_MAP_ID: string =
  (process.env.EXPO_PUBLIC_MAPTILER_MAP_ID as string) ||
  extra.MAPTILER_MAP_ID ||
  'streets-v4';

// ✅ Vector style (MapLibre style.json) — this is what your MapView should use in vector mode
export const MAPTILER_STYLE_URL = `https://api.maptiler.com/maps/${MAPTILER_MAP_ID}/style.json?key=${MAPTILER_KEY}`;

// ✅ Raster tiles
// NOTE: 512px is the RECOMMENDED default and there is NO `/512/` path segment.
// Use tileSize={512} when consuming this template.
export const MAPTILER_RASTER_TILES_512 = [
  `https://api.maptiler.com/maps/${MAPTILER_MAP_ID}/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
];

// 256px compatibility template (use tileSize={256})
export const MAPTILER_RASTER_TILES_256 = [
  `https://api.maptiler.com/maps/${MAPTILER_MAP_ID}/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
];

// Last-ditch public fallback (no key)
export const OSM_RASTER_TILES_256 = ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'];

// 🧭 Back-compat aliases (so older imports keep working)
export const GEOAPIFY_KEY = MAPTILER_KEY;
export const GEOAPIFY_STYLE_URL = MAPTILER_STYLE_URL;

/**
 * Keep the same client-side API: build a URL to your server route.
 * Server responds with a GeoJSON FeatureCollection LineString.
 */
export function geoapifyRouteURL(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  mode: 'drive' | 'walk' | 'bicycle' = 'drive'
): string {
  // Map our modes to OSRM profiles on the server (done there)
  const qs = new URLSearchParams({
    from: `${fromLng},${fromLat}`,
    to: `${toLng},${toLat}`,
    mode,
  });
  return `${API_URL}/api/geo/route?${qs.toString()}`;
}

if (!MAPTILER_KEY) {
  // eslint-disable-next-line no-console
  console.warn('⚠️ MAPTILER_KEY missing. Set EXPO_PUBLIC_MAPTILER_KEY or extra.MAPTILER_KEY in app.config.js');
}
  