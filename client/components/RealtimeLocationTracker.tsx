// client/components/RealtimeLocationTracker.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRealtimeLocation } from '@/hooks/useRealtimeLocation';
import { LocationData } from '@/services/locationService';

interface RealtimeLocationTrackerProps {
  assistRequestId?: string;
  isOperator?: boolean;
  onLocationUpdate?: (location: LocationData) => void;
  style?: any;
}

export default function RealtimeLocationTracker({
  assistRequestId,
  isOperator = false,
  onLocationUpdate,
  style
}: RealtimeLocationTrackerProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const {
    isTracking,
    currentLocation,
    error,
    startTracking,
    stopTracking,
    getCurrentLocation
  } = useRealtimeLocation({
    enableBackgroundTracking: isOperator, // Only operators need background tracking
    distanceFilter: 10, // 10 meters
    timeInterval: 5000, // 5 seconds
    assistRequestId,
    isOperator
  });

  // Handle location updates
  useEffect(() => {
    if (currentLocation && onLocationUpdate) {
      onLocationUpdate(currentLocation);
      setLastUpdate(new Date());
    }
  }, [currentLocation, onLocationUpdate]);

  // Handle errors
  useEffect(() => {
    if (error) {
      Alert.alert(
        'Location Error',
        error,
        [{ text: 'OK' }]
      );
    }
  }, [error]);

  const handleToggleTracking = async () => {
    if (isTracking) {
      stopTracking();
      setIsEnabled(false);
    } else {
      if (assistRequestId) {
        const success = await startTracking();
        setIsEnabled(success);
      } else {
        Alert.alert(
          'No Request ID',
          'Cannot start location tracking without an assist request ID.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  const handleGetCurrentLocation = async () => {
    const location = await getCurrentLocation();
    if (location && onLocationUpdate) {
      onLocationUpdate(location);
      setLastUpdate(new Date());
    }
  };

  const formatLastUpdate = () => {
    if (!lastUpdate) return 'Never';
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {isOperator ? 'Operator' : 'Customer'} Location
        </Text>
        <View style={styles.statusContainer}>
          <View style={[
            styles.statusDot,
            { backgroundColor: isTracking ? '#4CAF50' : '#FF5722' }
          ]} />
          <Text style={styles.statusText}>
            {isTracking ? 'Tracking' : 'Stopped'}
          </Text>
        </View>
      </View>

      {currentLocation && (
        <View style={styles.locationInfo}>
          <Text style={styles.coordinates}>
            {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
          </Text>
          {currentLocation.address && (
            <Text style={styles.address} numberOfLines={2}>
              {currentLocation.address}
            </Text>
          )}
          <Text style={styles.lastUpdate}>
            Last update: {formatLastUpdate()}
          </Text>
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleToggleTracking}
          disabled={!assistRequestId}
        >
          <Text style={styles.buttonText}>
            {isTracking ? 'Stop Tracking' : 'Start Tracking'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleGetCurrentLocation}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            Get Location
          </Text>
        </TouchableOpacity>
      </View>

      {error && (
        <Text style={styles.errorText}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
  },
  locationInfo: {
    marginBottom: 16,
  },
  coordinates: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  lastUpdate: {
    fontSize: 12,
    color: '#999',
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#2196F3',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButtonText: {
    color: '#2196F3',
  },
  errorText: {
    fontSize: 12,
    color: '#FF5722',
    marginTop: 8,
    textAlign: 'center',
  },
});
