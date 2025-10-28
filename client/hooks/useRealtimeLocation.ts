// client/hooks/useRealtimeLocation.ts
import { useEffect, useRef, useState } from 'react';
import { getSocket } from '@/socket/socket';
import locationService, { LocationData } from '@/services/locationService';

interface RealtimeLocationOptions {
  enableBackgroundTracking?: boolean;
  distanceFilter?: number;
  timeInterval?: number;
  assistRequestId?: string;
  isOperator?: boolean;
}

export function useRealtimeLocation(options: RealtimeLocationOptions = {}) {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSentLocation = useRef<LocationData | null>(null);
  const socket = getSocket();

  const {
    enableBackgroundTracking = false,
    distanceFilter = 10, // meters
    timeInterval = 5000, // 5 seconds
    assistRequestId,
    isOperator = false
  } = options;

  // Check if location has moved significantly
  const hasLocationChanged = (newLocation: LocationData, lastLocation: LocationData | null): boolean => {
    if (!lastLocation) return true;

    // Calculate distance using Haversine formula
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lastLocation.latitude * Math.PI) / 180;
    const φ2 = (newLocation.latitude * Math.PI) / 180;
    const Δφ = ((newLocation.latitude - lastLocation.latitude) * Math.PI) / 180;
    const Δλ = ((newLocation.longitude - lastLocation.longitude) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // Distance in meters
    return distance >= distanceFilter;
  };

  // Send location update via socket
  const sendLocationUpdate = (location: LocationData) => {
    if (!socket || !assistRequestId) return;

    const locationData = {
      assistRequestId,
      lat: location.latitude,
      lng: location.longitude,
      address: location.address,
    };

    if (isOperator) {
      socket.emit('operator:locationUpdate', locationData);
    } else {
      socket.emit('customer:locationUpdate', locationData);
    }

    console.log(`📍 Sent ${isOperator ? 'operator' : 'customer'} location update:`, locationData);
  };

  // Start location tracking
  const startTracking = async () => {
    try {
      setError(null);
      console.log('🔄 Starting real-time location tracking...');

      // Request permissions
      const permissionStatus = await locationService.requestPermissions(enableBackgroundTracking);
      if (!permissionStatus.granted) {
        setError('Location permission not granted');
        return false;
      }

      // Start background location tracking
      const success = await locationService.startBackgroundLocationTracking(
        {
          enableBackgroundLocation: enableBackgroundTracking,
          enableHighAccuracy: true,
          distanceFilter,
          timeInterval,
        },
        (location) => {
          setCurrentLocation(location);

          // Only send update if location has changed significantly
          if (hasLocationChanged(location, lastSentLocation.current)) {
            sendLocationUpdate(location);
            lastSentLocation.current = location;
          }
        }
      );

      if (success) {
        setIsTracking(true);
        console.log('✅ Real-time location tracking started');
        return true;
      } else {
        setError('Failed to start location tracking');
        return false;
      }
    } catch (err) {
      console.error('❌ Error starting location tracking:', err);
      setError('Failed to start location tracking');
      return false;
    }
  };

  // Stop location tracking
  const stopTracking = () => {
    locationService.stopBackgroundLocationTracking();
    setIsTracking(false);
    setCurrentLocation(null);
    lastSentLocation.current = null;
    console.log('🛑 Real-time location tracking stopped');
  };

  // Get current location once
  const getCurrentLocation = async () => {
    try {
      setError(null);
      const location = await locationService.getCurrentLocation();
      if (location) {
        setCurrentLocation(location);
        return location;
      } else {
        setError('Failed to get current location');
        return null;
      }
    } catch (err) {
      console.error('❌ Error getting current location:', err);
      setError('Failed to get current location');
      return null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isTracking) {
        stopTracking();
      }
    };
  }, []);

  return {
    isTracking,
    currentLocation,
    error,
    startTracking,
    stopTracking,
    getCurrentLocation,
  };
}
