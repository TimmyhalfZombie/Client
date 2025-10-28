// client/services/locationService.ts
import * as Location from "expo-location";
import { MAPTILER_KEY } from "../constants/map";

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

export interface BackgroundLocationOptions {
  enableBackgroundLocation?: boolean;
  enableHighAccuracy?: boolean;
  distanceFilter?: number;
  timeInterval?: number;
}

class LocationService {
  private static instance: LocationService;
  private currentLocation: LocationData | null = null;
  private isInitialized = false;
  private backgroundLocationSubscription: Location.LocationSubscription | null = null;
  private locationUpdateCallback: ((location: LocationData) => void) | null = null;

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
   * Request location permissions (foreground and background)
   */
  async requestPermissions(enableBackground = false): Promise<LocationPermissionStatus> {
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

      // Request background location permission if needed
      if (enableBackground) {
        const backgroundPermission =
          await Location.requestBackgroundPermissionsAsync();

        if (backgroundPermission.status !== "granted") {
          console.warn("⚠️ Background location permission not granted");
          // Still return success for foreground permission
        } else {
          console.log("✅ Background location permission granted");
        }
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
      // if it fails or times out, fallback to MapTiler reverse geocoding.
      try {
        const addresses = await this.reverseGeocodeWithTimeout(
          {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
          },
          6000 // timeout ms
        );

        const address = addresses?.[0];
        if (address) {
          locationData.address = this.formatAddress(address);
          locationData.street = address.street || undefined;
          locationData.barangay = this.extractBarangay(address);
          locationData.city = address.city || address.subregion || undefined;
        }
      } catch (reverseGeocodeError) {
        console.warn(
          "⚠️ Could not get address from coordinates (native). Falling back to MapTiler",
          reverseGeocodeError
        );
        try {
          const geo = await this.reverseGeocodeMapTiler(
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
          console.warn("⚠️ MapTiler reverse geocode also failed:", geoError);
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
   * Start background location tracking
   */
  async startBackgroundLocationTracking(
    options: BackgroundLocationOptions = {},
    callback?: (location: LocationData) => void
  ): Promise<boolean> {
    try {
      console.log("🔄 Starting background location tracking...");

      // Request background permissions
      const permissionStatus = await this.requestPermissions(true);
      if (!permissionStatus.granted) {
        console.warn("⚠️ Location permission not granted for background tracking");
        return false;
      }

      // Stop existing subscription if any
      if (this.backgroundLocationSubscription) {
        this.backgroundLocationSubscription.remove();
      }

      // Set callback
      this.locationUpdateCallback = callback || null;

      // Start background location updates
      this.backgroundLocationSubscription = await Location.watchPositionAsync(
        {
          accuracy: options.enableHighAccuracy !== false ? Location.Accuracy.High : Location.Accuracy.Balanced,
          timeInterval: options.timeInterval || 5000, // 5 seconds default
          distanceInterval: options.distanceFilter || 10, // 10 meters default
        },
        (location) => {
          const locationData: LocationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
          };

          // Update current location
          this.currentLocation = locationData;

          // Call callback if provided
          if (this.locationUpdateCallback) {
            this.locationUpdateCallback(locationData);
          }

          console.log("📍 Background location update:", locationData);
        }
      );

      console.log("✅ Background location tracking started");
      return true;
    } catch (error) {
      console.error("❌ Error starting background location tracking:", error);
      return false;
    }
  }

  /**
   * Stop background location tracking
   */
  stopBackgroundLocationTracking(): void {
    if (this.backgroundLocationSubscription) {
      this.backgroundLocationSubscription.remove();
      this.backgroundLocationSubscription = null;
      this.locationUpdateCallback = null;
      console.log("🛑 Background location tracking stopped");
    }
  }

  /**
   * Check if background location tracking is active
   */
  isBackgroundTrackingActive(): boolean {
    return this.backgroundLocationSubscription !== null;
  }

  /**
   * Format location for display
   */
  formatLocationForDisplay(): string {
    if (!this.currentLocation) {
      return "Location not available";
    }

    const { street, barangay, city } = this.currentLocation;
    const parts: string[] = [];

    if (street) parts.push(street);
    if (barangay) parts.push(barangay);
    if (city) parts.push(city);

    return parts.length > 0 ? parts.join(", ") : "Location obtained";
  }

  /**
   * Format address from location data
   */
  private formatAddress(address: Location.LocationGeocodedAddress): string {
    const parts: string[] = [];

    // Filter out unnamed roads from native geocoding
    const street = address.street && 
      !address.street.toLowerCase().includes('unnamed') && 
      !address.street.toLowerCase().includes('unamed') &&
      !address.street.toLowerCase().includes('unnamed road') &&
      !address.street.toLowerCase().includes('unnamed street') &&
      !address.street.toLowerCase().includes('unnamed avenue') &&
      !address.street.toLowerCase().includes('unnamed lane') &&
      address.street.trim() !== 'Road' &&
      address.street.trim() !== 'Street' &&
      address.street.trim() !== 'Avenue' &&
      address.street.trim() !== 'Lane'
      ? address.street
      : undefined;

    if (street) parts.push(street);
    if ((address as any).streetNumber) parts.push((address as any).streetNumber);

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
    if ((address as any).district) return (address as any).district;
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
      const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
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
   * Call MapTiler reverse geocoding HTTP API as a fallback and normalize result.
   */
  private async reverseGeocodeMapTiler(
    lat: number,
    lon: number
  ): Promise<
    | {
        formatted?: string;
        street?: string;
        barangay?: string;
        city?: string;
        county?: string;
        state?: string;
        region?: string;
      }
    | null
  > {
    if (!MAPTILER_KEY) return null;

    const url = `https://api.maptiler.com/geocoding/${lon},${lat}.json?key=${MAPTILER_KEY}&limit=1`;

    const controller = new AbortController();
    const timeout: ReturnType<typeof setTimeout> = setTimeout(
      () => controller.abort(),
      7000
    );

    try {
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!resp.ok) throw new Error(`MapTiler error ${resp.status}`);
      const body = await resp.json();

      // MapTiler returns { features: [{ properties: {...} }] }
      const feature = body?.features?.[0];
      if (!feature?.properties) return null;

      const props = feature.properties;

      // Normalize to fields the app expects
      const street = props.street || props.house_number ? `${props.house_number || ''} ${props.street || ''}`.trim() : undefined;
      
      // Filter out "unnamed" roads and generic placeholders
      const cleanStreet = street && 
        !street.toLowerCase().includes('unnamed') && 
        !street.toLowerCase().includes('unamed') &&
        !street.toLowerCase().includes('unnamed road') &&
        !street.toLowerCase().includes('unnamed street') &&
        !street.toLowerCase().includes('unnamed avenue') &&
        !street.toLowerCase().includes('unnamed lane') &&
        street.trim() !== 'Road' &&
        street.trim() !== 'Street' &&
        street.trim() !== 'Avenue' &&
        street.trim() !== 'Lane'
        ? street 
        : undefined;
      
      return {
        formatted: props.label || props.formatted || undefined,
        street: cleanStreet,
        barangay: props.suburb || props.neighbourhood || props.neighborhood || undefined,
        city: props.city || props.town || props.village || undefined,
        county: props.county || undefined,
        state: props.state || props.region || undefined,
        region: props.state || props.region || undefined,
      };
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

export default LocationService.getInstance();
