// client/src/screens/OngoingDetailScreen.tsx
import { router } from 'expo-router';
import * as Icons from 'phosphor-react-native';
import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Text as RNText,
  StyleSheet,
  TouchableOpacity,
  View,
  type TextProps,
} from 'react-native';
import GeoapifyMap from '../components/GeoapifyMap';
import useAcceptedJobUI from '../features/useAcceptedJobUI';
import { useActivityDetail } from './functions/activityDetail';

const INTER_BLACK = 'Inter-Black';
const INTER_MEDIUM = 'Inter-Medium';

const BG = '#0E0E0E';
const CARD = '#0E0E0E';
const BORDER = '#262626';
const GREEN = '#6EFF87';
const GREEN_DIM = '#9EF29E';
const SUB = '#B9B9B9';
const WHITE = '#FFFFFF';
const RED = '#ff5f5f';
const BLUE = '#4ea7ff';
const TEXT_DARK = '#0C0C0C';
const TEXT_LIGHT = '#EDEDED';
const DECLINE_BG = '#5F5B60';
const LIGHT_PILL = '#DFFFEA';

type Params = {
  id?: string | string[];
  activityId?: string | string[];
  startName?: string;
  startAddr?: string;
  endName?: string;
  endAddr?: string;
  customer?: string;
  timeRange?: string;
  status?: string;
  rating?: string;
};

function Text(props: TextProps) {
  return <RNText {...props} style={[{ fontFamily: INTER_BLACK }, props.style]} />;
}

export default function OngoingDetailScreen() {
  const {
    loading,
    err,
    doc,
    msgBusy,
    customer,
    contactName,
    customerPhone,
    startName,
    startAddr,
    endName,
    endAddr,
    status,
    timeRepaired,
    rating,
    timeRange,
    clientAvatar,
    handleMessagePress,
  } = useActivityDetail();

  const acceptedJobUI = useAcceptedJobUI();

  // Open the accepted job UI when component mounts
  React.useEffect(() => {
    if (doc && !loading) {
      acceptedJobUI.openFromRequest(doc, {
        onRepaired: () => {
          // Navigate to completed job detail screen
          router.push(`/activity-detail?id=${encodeURIComponent(String(doc.id))}`);
        },
        onCancel: () => {
          // Navigate back to activity screen
          router.push('/activity');
        }
      });
    }
  }, [doc, loading]);

  const handleCall = () => {
    if (customerPhone) {
      Linking.openURL(`tel:${customerPhone}`).catch(() => {});
    }
  };

  if (loading && !doc) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!doc) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG }}>
        <Text style={{ color: '#ff9d9d', fontFamily: INTER_MEDIUM }}>{err || 'No data available'}</Text>
      </View>
    );
  }

  // Show the exact same interface as the accepted job screen using useAcceptedJobUI
  return (
    <View style={styles.container}>
      {/* Back Button */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity 
          onPress={() => router.push('/activity')} 
          style={styles.backButton}
          hitSlop={12}
        >
          <Icons.ArrowLeft size={24} color="#FFFFFF" weight="bold" />
        </TouchableOpacity>
      </View>

      {/* Map Background */}
      <GeoapifyMap
        lat={coerceLat(doc)}
        lng={coerceLng(doc)}
        showOperator={true}
        autoUseDeviceLocation={true}
        style={styles.mapContainer}
      />

      {/* Render the accepted job UI overlay */}
      {acceptedJobUI.element}
    </View>
  );
}

const styles = StyleSheet.create({
  // Main container
  container: { 
    flex: 1, 
    backgroundColor: BG 
  },

  backButtonContainer: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10000,
  },

  backButton: {
    width: 64,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000000ff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Map container
  mapContainer: {
    flex: 1,
    width: '100%',
  },
});

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function coerceLat(doc: any): number | null {
  if (!doc) return null;
  const direct = toNum(doc?.coords?.lat);
  if (direct != null) return direct;
  const locLat = toNum(doc?.location?.lat ?? doc?.address?.lat);
  if (locLat != null) return locLat;
  const coords = doc?.location?.coordinates ?? doc?.location?.coordinate ?? doc?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    const fromArray = toNum(coords[1]);
    if (fromArray != null) return fromArray;
  }
  const geoPoint = doc?.location?.geometry?.coordinates;
  if (Array.isArray(geoPoint) && geoPoint.length >= 2) {
    const fromGeometry = toNum(geoPoint[1]);
    if (fromGeometry != null) return fromGeometry;
  }
  return null;
}

function coerceLng(doc: any): number | null {
  if (!doc) return null;
  const direct = toNum(doc?.coords?.lng ?? doc?.coords?.lon ?? doc?.coords?.longitude);
  if (direct != null) return direct;
  const locLng = toNum(doc?.location?.lng ?? doc?.location?.lon ?? doc?.location?.longitude ?? doc?.address?.lng);
  if (locLng != null) return locLng;
  const coords = doc?.location?.coordinates ?? doc?.location?.coordinate ?? doc?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    const fromArray = toNum(coords[0]);
    if (fromArray != null) return fromArray;
  }
  const geoPoint = doc?.location?.geometry?.coordinates;
  if (Array.isArray(geoPoint) && geoPoint.length >= 2) {
    const fromGeometry = toNum(geoPoint[0]);
    if (fromGeometry != null) return fromGeometry;
  }
  return null;
}
