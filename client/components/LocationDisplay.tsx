// client/components/LocationDisplay.tsx
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Typo from './Typo';
import { colors, spacingX, spacingY, radius } from '@/constants/theme';
import { useLocation } from '@/contexts/LocationContext';
import * as Icons from 'phosphor-react-native';

interface LocationDisplayProps {
  style?: any;
  showRefreshButton?: boolean;
}

const LocationDisplay: React.FC<LocationDisplayProps> = ({
  style,
  showRefreshButton = true,
}) => {
  const { location, loading, error, hasPermission, refreshLocation, formatLocationForDisplay } = useLocation();

  if (!hasPermission) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.locationRow}>
          <Icons.MapPin size={16} color={colors.neutral400} />
          <Typo size={14} color={colors.neutral400} fontFamily="InterLight">
            Location permission required
          </Typo>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.locationRow}>
          <Icons.MapPin size={16} color={colors.primary} />
          <Typo size={14} color={colors.primary} fontFamily="InterLight">
            Getting location...
          </Typo>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.locationRow}>
          <Icons.Warning size={16} color="#FF5A5A" />
          <Typo size={14} color="#FF5A5A" fontFamily="InterLight">
            {error}
          </Typo>
        </View>
        {showRefreshButton && (
          <Pressable onPress={refreshLocation} style={styles.refreshButton}>
            <Icons.ArrowClockwise size={14} color={colors.primary} />
            <Typo size={12} color={colors.primary} fontFamily="InterLight">
              Retry
            </Typo>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.locationRow}>
        <Icons.MapPin size={16} color={colors.green} />
        <Typo size={14} color={colors.white} fontFamily="InterLight" style={{ flex: 1 }}>
          {formatLocationForDisplay()}
        </Typo>
      </View>
      
      {location && (
        <View style={styles.detailsRow}>
          <Typo size={12} color={colors.neutral400} fontFamily="InterLight">
            Lat: {location.latitude.toFixed(6)}, Lng: {location.longitude.toFixed(6)}
          </Typo>
          {location.accuracy && (
            <Typo size={12} color={colors.neutral400} fontFamily="InterLight">
              Accuracy: {Math.round(location.accuracy)}m
            </Typo>
          )}
        </View>
      )}
      
      {showRefreshButton && (
        <Pressable onPress={refreshLocation} style={styles.refreshButton}>
          <Icons.ArrowClockwise size={14} color={colors.primary} />
          <Typo size={12} color={colors.primary} fontFamily="InterLight">
            Refresh
          </Typo>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: radius._12 || 12,
    padding: spacingX._12,
    marginVertical: spacingY._5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX._8,
  },
  detailsRow: {
    marginTop: spacingY._5,
    gap: 2,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX._5,
    marginTop: spacingY._8,
    alignSelf: 'flex-start',
  },
});

export default LocationDisplay;



