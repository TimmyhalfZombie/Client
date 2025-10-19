// client/services/locationService.ts
import * as Location from "expo-location";
import { Alert } from "react-native";
import { GEOAPIFY_KEY } from "../constants/map";

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  street?: string;
  barangay?: string;
  city?: string;
}

export interface LocationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: Location.LocationPermissionResponse["status"];
}

class LocationService {
  private static instance: LocationService;
  private currentLocation: LocationData | null = null;
  private isInitialized = false;

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  /**
   * Initialize location service on app startup
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log("📍 Location service already initialized");
      return;
    }

    try {
      console.log("🚀 Initializing location service...");

      // Check if location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        console.warn("⚠️ Location services are disabled");
        return;
      }

      // Request permissions
      const permissionStatus = await this.requestPermissions();
      if (!permissionStatus.granted) {
        console.warn("⚠️ Location permission not granted");
        return;
      }

      // Get initial location
      await this.getCurrentLocation();
      this.isInitialized = true;
      console.log("✅ Location service initialized successfully");
    } catch (error) {
      console.error("❌ Error initializing location service:", error);
    }
  }

  /**
   * Request location permissions
   */
  async requestPermissions(): Promise<LocationPermissionStatus> {
    try {
      console.log("📍 Requesting location permissions...");

      // Check if location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        return {
          granted: false,
          canAskAgain: false,
          status: "denied" as Location.LocationPermissionResponse["status"],
        };
      }

      // Request foreground location permission
      const foregroundPermission =
        await Location.requestForegroundPermissionsAsync();

      if (foregroundPermission.status !== "granted") {
        return {
          granted: false,
          canAskAgain: foregroundPermission.canAskAgain,
          status: foregroundPermission.status,
        };
      }

      console.log("✅ Location permissions granted");
      return {
        granted: true,
        canAskAgain: foregroundPermission.canAskAgain,
        status: foregroundPermission.status,
      };
    } catch (error) {
      console.error("❌ Error requesting location permissions:", error);
      return {
        granted: false,
        canAskAgain: false,
        status: "denied" as Location.LocationPermissionResponse["status"],
      };
    }
  }

  /**
   * Get current location with high accuracy
   */
  async getCurrentLocation(): Promise<LocationData | null> {
    try {
      console.log("📍 Getting current location...");

      // Check permissions first
      const permissionStatus = await this.requestPermissions();
      if (!permissionStatus.granted) {
        console.warn("⚠️ Location permission not granted");
        return null;
      }

      // Get current position with high accuracy
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
      };

      // Get address from coordinates. Prefer native reverseGeocodeAsync;
      // if it fails or times out, fallback to Geoapify reverse geocoding.
      try {
        const addresses = await this.reverseGeocodeWithTimeout(
          {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
          },
          6000 // timeout ms
        );

        if (addresses && addresses.length > 0) {
          const address = addresses[0];
          locationData.address = this.formatAddress(address);
          locationData.street = address.street || undefined;
          locationData.barangay = this.extractBarangay(address);
          locationData.city = address.city || address.subregion || undefined;
        }
      } catch (reverseGeocodeError) {
        console.warn(
          "⚠️ Could not get address from coordinates (native). Falling back to Geoapify",
          reverseGeocodeError
        );
        try {
          const geo = await this.reverseGeocodeGeoapify(
            locationData.latitude,
            locationData.longitude
          );
          if (geo) {
            // geo is a simplified address-like object
            locationData.address = geo.formatted || undefined;
            locationData.street = geo.street || undefined;
            locationData.barangay = geo.barangay || undefined;
            locationData.city = geo.city || geo.county || undefined;
          }
        } catch (geoError) {
          console.warn("⚠️ Geoapify reverse geocode also failed:", geoError);
        }
      }

      this.currentLocation = locationData;
      console.log("✅ Location obtained:", locationData);
      return locationData;
    } catch (error) {
      console.error("❌ Error getting current location:", error);
      return null;
    }
  }

  /**
   * Get cached location if available
   */
  getCachedLocation(): LocationData | null {
    return this.currentLocation;
  }

  /**
   * Check if location is available
   */
  hasLocation(): boolean {
    return this.currentLocation !== null;
  }

  /**
   * Format location for display
   */
  formatLocationForDisplay(): string {
    if (!this.currentLocation) {
      return "Location not available";
    }

    const { street, barangay, city } = this.currentLocation;
    const parts = [];

    if (street) parts.push(street);
    if (barangay) parts.push(barangay);
    if (city) parts.push(city);

    return parts.length > 0 ? parts.join(", ") : "Location obtained";
  }

  /**
   * Format address from location data
   */
  private formatAddress(address: Location.LocationGeocodedAddress): string {
    const parts = [];

    if (address.street) parts.push(address.street);
    if (address.streetNumber) parts.push(address.streetNumber);

    const barangay = this.extractBarangay(address);
    if (barangay) parts.push(barangay);

    if (address.city) parts.push(address.city);
    if (address.region) parts.push(address.region);

    return parts.join(", ");
  }

  /**
   * Extract barangay from address
   */
  private extractBarangay(
    address: Location.LocationGeocodedAddress
  ): string | undefined {
    // Try different fields that might contain barangay info
    if (address.district) return address.district;
    if (address.subregion) return address.subregion;
    if (address.name && address.name.includes("Barangay")) return address.name;
    return undefined;
  }

  /**
   * Wrap Location.reverseGeocodeAsync with a timeout so callers don't hang.
   */
  private reverseGeocodeWithTimeout(
    coords: { latitude: number; longitude: number },
    timeoutMs: number
  ): Promise<Location.LocationGeocodedAddress[]> {
    return new Promise(async (resolve, reject) => {
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        reject(new Error("reverseGeocodeAsync timed out"));
      }, timeoutMs);

      try {
        const res = await Location.reverseGeocodeAsync({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        if (!timedOut) {
          clearTimeout(timer);
          resolve(res);
        }
      } catch (err) {
        if (!timedOut) {
          clearTimeout(timer);
          reject(err);
        }
      }
    });
  }

  /**
   * Call Geoapify reverse geocoding HTTP API as a fallback and normalize result.
   */
  private async reverseGeocodeGeoapify(
    lat: number,
    lon: number
  ): Promise<any | null> {
    if (!GEOAPIFY_KEY) return null;

    const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lon)}&format=json&apiKey=${GEOAPIFY_KEY}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    try {
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!resp.ok) throw new Error(`Geoapify error ${resp.status}`);
      const body = await resp.json();
      if (!body || !body.features || body.features.length === 0) return null;
      const props = body.features[0].properties || {};
      // Normalize to fields the app expects
      return {
        formatted: props.formatted || props.name || undefined,
        street: props.street || undefined,
        barangay: props.suburb || props.neighbourhood || undefined,
        city: props.city || props.county || undefined,
        region: props.state || undefined,
      };
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

export default LocationService.getInstance();
