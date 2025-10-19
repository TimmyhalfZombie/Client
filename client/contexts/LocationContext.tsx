// client/contexts/LocationContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import locationService, { LocationData } from '@/services/locationService';

interface LocationContextType {
  location: LocationData | null;
  loading: boolean;
  error: string | null;
  hasPermission: boolean;
  refreshLocation: () => Promise<void>;
  formatLocationForDisplay: () => string;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  const initializeLocation = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🚀 Initializing location on app startup...');
      await locationService.initialize();
      
      const currentLocation = locationService.getCachedLocation();
      if (currentLocation) {
        setLocation(currentLocation);
        setHasPermission(true);
        console.log('✅ Location initialized:', currentLocation);
      } else {
        // Try to get fresh location
        const freshLocation = await locationService.getCurrentLocation();
        if (freshLocation) {
          setLocation(freshLocation);
          setHasPermission(true);
          console.log('✅ Fresh location obtained:', freshLocation);
        } else {
          setError('Could not get location');
          setHasPermission(false);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setHasPermission(false);
      console.error('❌ Error initializing location:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshLocation = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const newLocation = await locationService.getCurrentLocation();
      if (newLocation) {
        setLocation(newLocation);
        setHasPermission(true);
        console.log('✅ Location refreshed:', newLocation);
      } else {
        setError('Could not get location');
        setHasPermission(false);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setHasPermission(false);
      console.error('❌ Error refreshing location:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatLocationForDisplay = (): string => {
    return locationService.formatLocationForDisplay();
  };

  // Initialize location on app startup
  useEffect(() => {
    initializeLocation();
  }, []);

  const value: LocationContextType = {
    location,
    loading,
    error,
    hasPermission,
    refreshLocation,
    formatLocationForDisplay,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};



