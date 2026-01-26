// server/src/routes/route.ts
import { Router } from 'express';
import fetch from 'node-fetch';
import { config } from '../config';
import { requireAuth } from '../middleware/jwt';

const router = Router();

/**
 * Proxy to HeiGIT openrouteservice directions.
 * POST /api/route
 * body: { coordinates: [ [lng,lat], [lng,lat], ... ], profile?: string, extra?: object }
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { coordinates, profile = 'driving-car', extra = {} } = req.body || {};

    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return res.status(400).json({ message: 'Need at least two [lng,lat] coordinates' });
    }

    // Forward request to ORS
    const orsUrl = `https://api.openrouteservice.org/v2/directions/${encodeURIComponent(profile)}`;
    const orsRes = await fetch(orsUrl, {
      method: 'POST',
      headers: {
        Authorization: config.orsApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coordinates,
        instructions: true,
        elevation: false,
        ...extra, // allow caller overrides (avoid_features, alternative_routes, etc.)
      }),
    });

    const text = await orsRes.text();
    if (!orsRes.ok) {
      return res.status(orsRes.status).json({
        message: 'ORS error',
        details: text,
      });
    }

    // ORS returns a GeoJSON FeatureCollection
    res.type('application/json').send(text);
  } catch (e: any) {
    res.status(500).json({ message: e?.message || 'Routing failed' });
  }
});

export default router;
