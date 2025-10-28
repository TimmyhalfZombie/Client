// server/routes/routing.routes.ts
import express from 'express';
import routingService from '../services/routingService';
import { auth } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

/**
 * GET /api/routing/route
 * Get route between two points
 */
router.get('/route', async (req, res) => {
  try {
    const { originLat, originLng, destLat, destLng } = req.query;

    if (!originLat || !originLng || !destLat || !destLng) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: originLat, originLng, destLat, destLng'
      });
    }

    const origin = {
      lat: parseFloat(originLat as string),
      lng: parseFloat(originLng as string)
    };

    const destination = {
      lat: parseFloat(destLat as string),
      lng: parseFloat(destLng as string)
    };

    const result = await routingService.getRoute(origin, destination);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Route endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/routing/route
 * Get route between two points (POST version)
 */
router.post('/route', async (req, res) => {
  try {
    const { origin, destination } = req.body;

    if (!origin || !destination || !origin.lat || !origin.lng || !destination.lat || !destination.lng) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: origin {lat, lng}, destination {lat, lng}'
      });
    }

    const result = await routingService.getRoute(origin, destination);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Route endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/routing/matrix
 * Get ETA matrix for multiple points
 */
router.post('/matrix', async (req, res) => {
  try {
    const { origins, destinations } = req.body;

    if (!origins || !destinations || !Array.isArray(origins) || !Array.isArray(destinations)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: origins[], destinations[]'
      });
    }

    const result = await routingService.getMatrix(origins, destinations);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Matrix endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/routing/eta
 * Get ETA between operator and customer
 */
router.post('/eta', async (req, res) => {
  try {
    const { operatorLocation, customerLocation } = req.body;

    if (!operatorLocation || !customerLocation || 
        !operatorLocation.lat || !operatorLocation.lng || 
        !customerLocation.lat || !customerLocation.lng) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: operatorLocation {lat, lng}, customerLocation {lat, lng}'
      });
    }

    const result = await routingService.getETA(operatorLocation, customerLocation);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('ETA endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
