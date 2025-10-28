// server/services/routingService.ts
import axios from 'axios';

const ORS_API_KEY = process.env.ORS_API_KEY || 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImUwNDdmMzMxYzM2ZjQ4MGJiYmQzYzA3NTRkMzBiMzI0IiwiaCI6Im11cm11cjY0In0=';
const ORS_BASE_URL = 'https://api.openrouteservice.org/v2';

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface RouteResponse {
  success: boolean;
  data?: {
    geometry: {
      type: string;
      coordinates: number[][];
    };
    properties: {
      summary: {
        distance: number;
        duration: number;
      };
      segments: Array<{
        distance: number;
        duration: number;
        steps: Array<{
          instruction: string;
          distance: number;
          duration: number;
        }>;
      }>;
    };
  };
  error?: string;
}

export interface MatrixResponse {
  success: boolean;
  data?: {
    durations: number[][];
    distances: number[][];
  };
  error?: string;
}

class RoutingService {
  private static instance: RoutingService;

  static getInstance(): RoutingService {
    if (!RoutingService.instance) {
      RoutingService.instance = new RoutingService();
    }
    return RoutingService.instance;
  }

  /**
   * Get route between two points using OpenRouteService Directions API
   */
  async getRoute(origin: RoutePoint, destination: RoutePoint): Promise<RouteResponse> {
    try {
      console.log('🗺️ Fetching route from OpenRouteService:', { origin, destination });

      const response = await axios.post(
        `${ORS_BASE_URL}/directions/driving-car/geojson`,
        {
          coordinates: [[origin.lng, origin.lat], [destination.lng, destination.lat]],
          instructions: true,
          geometry: true,
          format: 'geojson'
        },
        {
          headers: {
            'Authorization': ORS_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.data?.features?.length > 0) {
        const feature = response.data.features[0];
        return {
          success: true,
          data: {
            geometry: feature.geometry,
            properties: feature.properties
          }
        };
      }

      return {
        success: false,
        error: 'No route found'
      };
    } catch (error: any) {
      console.error('❌ Error fetching route:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to fetch route'
      };
    }
  }

  /**
   * Get ETA matrix for multiple points using OpenRouteService Matrix API
   */
  async getMatrix(origins: RoutePoint[], destinations: RoutePoint[]): Promise<MatrixResponse> {
    try {
      console.log('⏱️ Fetching ETA matrix from OpenRouteService:', { origins, destinations });

      const response = await axios.post(
        `${ORS_BASE_URL}/matrix/driving-car`,
        {
          locations: [...origins, ...destinations].map(point => [point.lng, point.lat]),
          sources: Array.from({ length: origins.length }, (_, i) => i),
          destinations: Array.from({ length: destinations.length }, (_, i) => origins.length + i),
          metrics: ['duration', 'distance']
        },
        {
          headers: {
            'Authorization': ORS_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      return {
        success: true,
        data: {
          durations: response.data.durations,
          distances: response.data.distances
        }
      };
    } catch (error: any) {
      console.error('❌ Error fetching matrix:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Failed to fetch matrix'
      };
    }
  }

  /**
   * Get ETA between operator and customer
   */
  async getETA(operatorLocation: RoutePoint, customerLocation: RoutePoint): Promise<{
    success: boolean;
    data?: {
      duration: number;
      distance: number;
      eta: string;
    };
    error?: string;
  }> {
    try {
      const matrixResult = await this.getMatrix([operatorLocation], [customerLocation]);
      
      if (!matrixResult.success || !matrixResult.data) {
        return {
          success: false,
          error: matrixResult.error || 'Failed to get ETA'
        };
      }

      const duration = matrixResult.data.durations[0][0]; // seconds
      const distance = matrixResult.data.distances[0][0]; // meters
      
      // Calculate ETA
      const now = new Date();
      const eta = new Date(now.getTime() + duration * 1000);
      
      return {
        success: true,
        data: {
          duration,
          distance,
          eta: eta.toISOString()
        }
      };
    } catch (error: any) {
      console.error('❌ Error calculating ETA:', error);
      return {
        success: false,
        error: 'Failed to calculate ETA'
      };
    }
  }

  /**
   * Format duration in human-readable format
   */
  formatDuration(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  /**
   * Format distance in human-readable format
   */
  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  }
}

export default RoutingService.getInstance();
