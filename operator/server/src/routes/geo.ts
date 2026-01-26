// server/src/routes/geo.ts
import { Router } from 'express';
// If you're on Node < 18, uncomment next line and `npm i node-fetch`
// import fetch from 'node-fetch';

const router = Router();
const GEOAPIFY_KEY = process.env.GEOAPIFY_API_KEY || process.env.GEOAPIFY_KEY;

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const attemptFormat = (props: Record<string, any> | null | undefined): string | null => {
      if (!props) return null;

      const pick = (...values: Array<unknown>): string => {
        for (const value of values) {
          if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed.length) return trimmed;
          }
        }
        return '';
      };

      const streetName = pick(props.street, props.road, props.address_line1, props.name);
      const houseNumber = pick(props.housenumber, props.house_number);
      const streetLine = [houseNumber, streetName].filter(Boolean).join(' ').trim();

      const barangay = pick(
        props.barangay,
        props.suburb,
        props.neighbourhood,
        props.quarter,
        props.district
      );

      const municipality = pick(
        props.municipality,
        props.town,
        props.city,
        props.city_district,
        props.state_district
      );

      const city = pick(props.city, props.county);

      const componentsRaw = [streetLine, barangay, municipality || city]
        .filter(Boolean)
        .map((c) => c.replace(/\s+/g, ' '));

      const uniqueComponents = componentsRaw.filter((component, idx, arr) => {
        const lower = component.toLowerCase();
        return idx === arr.findIndex((c) => c.toLowerCase() === lower);
      });

      if (uniqueComponents.length) {
        return uniqueComponents.join(', ');
      }

      const formatted = pick(props.formatted, props.address_line1, props.address_line2);
      return formatted || null;
    };

    const tryGeoapify = async (): Promise<string | null> => {
      if (!GEOAPIFY_KEY) return null;
      const url =
        `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}` +
        `&limit=1&lang=en&apiKey=${GEOAPIFY_KEY}`;

      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();
      const feature = json?.features?.[0];
      return attemptFormat(feature?.properties);
    };

    const tryNominatim = async (): Promise<string | null> => {
      const url =
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}` +
        `&addressdetails=1&zoom=18`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'operator-app/1.0 (reverse-geocode helper)'
        }
      });
      if (!res.ok) return null;
      const json = await res.json();
      const address = json?.address || {};
      return attemptFormat({
        street: address.road,
        housenumber: address.house_number,
        barangay: address.suburb || address.neighbourhood || address.village,
        municipality:
          address.municipality ||
          address.town ||
          address.city_district ||
          address.county,
        city: address.city || address.town || address.county,
        formatted: json?.display_name,
      });
    };

    const strategies = [tryGeoapify, tryNominatim];
    for (const strategy of strategies) {
      try {
        const result = await strategy();
        if (result) return result;
      } catch (err) {
        console.warn('[reverseGeocode] strategy failed:', (err as Error)?.message ?? err);
      }
    }

    return null;
  } catch (err) {
    console.warn('[reverseGeocode] failed:', (err as Error)?.message ?? err);
    return null;
  }
}

/**
 * GET /api/geo/route?from=lng,lat&to=lng,lat&mode=drive|walk|bicycle
 * Returns a GeoJSON FeatureCollection (LineString), similar to Geoapify.
 */
router.get('/route', async (req, res) => {
  try {
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    const mode = String(req.query.mode || 'drive');

    const parse = (s: string) => {
      const [lngStr, latStr] = s.split(',');
      const lng = Number(lngStr);
      const lat = Number(latStr);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
      return { lng, lat };
    };

    const a = parse(from);
    const b = parse(to);
    if (!a || !b) return res.status(400).json({ error: 'Invalid from/to' });

    const profile =
      mode === 'walk' || mode === 'foot' ? 'foot'
      : mode === 'bicycle' || mode === 'bike' ? 'bike'
      : 'driving';

    const url =
      `https://router.project-osrm.org/route/v1/${profile}/` +
      `${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;

    const r = await fetch(url);
    if (!r.ok) {
      const t = await r.text();
      return res.status(502).json({ error: 'Routing upstream error', detail: t });
    }

    const j = await r.json();
    const route = j?.routes?.[0];
    if (!route?.geometry) return res.status(404).json({ error: 'No route' });

    const feature = {
      type: 'Feature',
      geometry: route.geometry, // GeoJSON LineString
      properties: { distance: route.distance, duration: route.duration },
    };

    return res.json({ type: 'FeatureCollection', features: [feature] });
  } catch (e: any) {
    return res.status(500).json({ error: 'Route failed', detail: e?.message || String(e) });
  }
});

export default router;
