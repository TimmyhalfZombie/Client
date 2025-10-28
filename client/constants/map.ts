// client/constants/map.ts
import Constants from "expo-constants";

/** Keys from app.json -> expo.extra */
export const MAPTILER_KEY: string =
  (Constants.expoConfig?.extra as any)?.MAPTILER_KEY || "iNtS1QIPq27RGWxB2TSX";

/** Iloilo City (lng, lat) */
export const ILOILO_CENTER: [number, number] = [122.564, 10.72];

/** Default zoom for the city */
export const DEFAULT_ZOOM = 13;

/** Keep bounds (Panay) if you want to avoid accidental "world view" */
export const PANAY_MAX_BOUNDS = {
  sw: [121.7, 10.1] as [number, number],
  ne: [123.3, 11.9] as [number, number],
};

/**
 * ✅ MapTiler style (MapLibre compatible)
 * Source: MapTiler tiles with proper attribution
 */

export const MAPTILER_STYLE: any = {
  version: 8,
  name: "maptiler-streets",
  sources: {
    "maptiler-tiles": {
      type: "raster",
      tiles: [
        `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
      ],
      tileSize: 256,
      attribution: "© MapTiler © OpenStreetMap contributors",
      maxzoom: 20,
    },
  },
  layers: [
    {
      id: "maptiler-tiles",
      type: "raster",
      source: "maptiler-tiles",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

/**
 * MapTiler style URL for direct use with MapLibre
 */
export const MAPTILER_STYLE_URL = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;

/** AOI overlay: disabled (no dataset). Put your own GeoJSON URL to re-enable. */
export const AOI_GEOJSON_URL = ""; // ""
