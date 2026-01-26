import { router } from 'expo-router';
import * as Icons from 'phosphor-react-native';
import React from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import GeoapifyMap from '../components/GeoapifyMap';
import { completeAssist } from '../features/assistance/api';
import useAcceptedJobUI from '../features/useAcceptedJobUI';
import { useActivityDetail } from './functions/activityDetail';

const INTER_BLACK = 'Inter-Black';
const INTER_MEDIUM = 'Inter-Medium';

const BG = '#0E0E0E';
const BORDER = '#262626';
const GREEN = '#6EFF87';
const DECLINE_BG = '#5F5B60';
const LIGHT_PILL = '#DFFFEA';

export default function ActivityDetailScreen() {
  // ----- 1) Data hook (always called, first) -----
  const {
    loading,
    err,
    doc,
    msgBusy,
    customer,
    contactName,
    customerPhone,
    endName,
    endAddr,
    status,
    timeRepaired,
    rating,
    timeRange,
    clientAvatar,
    handleMessagePress,
  } = useActivityDetail();

  // ----- 2) Keep this for your “en route” UI side-effects (never conditional) -----
  useAcceptedJobUI();

  // ----- 3) Freeze map center exactly once (no auto zoom/recenter after) -----
  const frozenLatRef = React.useRef<number | null>(null);
  const frozenLngRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    // compute client coords from doc once when available
    const lat =
      (typeof doc?.coords?.lat === 'number' ? doc?.coords?.lat : null) ??
      (Array.isArray(doc?.location?.coordinates) && typeof doc?.location?.coordinates?.[1] === 'number'
        ? (doc?.location?.coordinates?.[1] as number)
        : null);

    const lng =
      (typeof doc?.coords?.lng === 'number' ? doc?.coords?.lng : null) ??
      (Array.isArray(doc?.location?.coordinates) && typeof doc?.location?.coordinates?.[0] === 'number'
        ? (doc?.location?.coordinates?.[0] as number)
        : null);

    if (frozenLatRef.current == null && typeof lat === 'number' && Number.isFinite(lat)) {
      frozenLatRef.current = lat;
    }
    if (frozenLngRef.current == null && typeof lng === 'number' && Number.isFinite(lng)) {
      frozenLngRef.current = lng;
    }
  }, [doc]);

  // ----- 4) Simple flags/values (no hooks) -----
  const repairedAtText =
    timeRepaired || (doc?.completedAt ? new Date(doc.completedAt).toLocaleString() : null);
  const isAcceptedJob = Boolean(doc && status === 'accepted' && !repairedAtText);

  // ----- 5) Early returns (AFTER all hooks above) -----
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

  // ----- 6) Actions (plain functions) -----
  const handleRepaired = async () => {
    try {
      const completed = await completeAssist(doc.id);
      const detailId = completed?.id || doc.id;
      router.push(`/activity-detail?id=${encodeURIComponent(String(detailId))}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to complete request');
    }
  };

  const handleTerminate = () => {
    Alert.alert('Terminate Job', 'Are you sure you want to terminate this job?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Terminate', style: 'destructive', onPress: () => router.push('/activity') },
    ]);
  };

  const handleCall = () => {
    if (customerPhone) Linking.openURL(`tel:${customerPhone}`).catch(() => {});
  };

  // ----- 7) Reusable render block (no hooks inside) -----
  const renderMapAndClientCard = (showOperator: boolean) => {
    // showOperator ignored: operator pin/location removed as requested
    return (
      <>
        <GeoapifyMap
          lat={frozenLatRef.current}
          lng={frozenLngRef.current}
          showOperator={false}
          style={styles.mapContainer}
        />

        {/* Card: ONLY CLIENT’S vehicle model + location (no operator row) */}
        <View style={styles.locationCard}>
          <View style={styles.locationRow}>
            <View style={styles.redDot} />
            <View style={styles.locationTextWrap}>
              <Text style={styles.locationTitle}>{endName || 'Client Location'}</Text>
              <Text style={styles.locationAddress}>{endAddr || 'Loading...'}</Text>
            </View>
          </View>
        </View>
      </>
    );
  };

  // ----- 8) Screens -----
  if (isAcceptedJob) {
    return (
      <View style={styles.container}>
        {/* Back */}
        <View style={styles.backButtonContainer}>
          <TouchableOpacity onPress={() => router.push('/activity')} style={styles.backButton} hitSlop={12}>
            <Icons.ArrowLeft size={20} color="#FFFFFF" weight="bold" />
          </TouchableOpacity>
        </View>

        {renderMapAndClientCard(false)}

        {/* Client info + actions */}
        <View style={styles.clientCard}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.clientName}>{customer}</Text>
              <Text style={styles.vehicleName}>{endName}</Text>
              <Text style={styles.address}>{endAddr}</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Message customer"
              onPress={handleMessagePress}
              style={styles.messageBtn}
              activeOpacity={0.8}
            >
              <Icons.EnvelopeSimple size={22} weight="bold" color="#000000" />
            </TouchableOpacity>
          </View>

          <View style={styles.separator} />

          <View style={styles.pillsWrap}>
            {doc.vehicleType && (
              <View style={styles.pill}>
                <Text style={styles.pillLabel}>Vehicle Type:</Text>
                <Text style={styles.pillValue}>{doc.vehicleType}</Text>
              </View>
            )}
            {doc.plateNumber && (
              <View style={styles.pill}>
                <Text style={styles.pillLabel}>Plate Number:</Text>
                <Text style={styles.pillValue}>{doc.plateNumber}</Text>
              </View>
            )}
            {customerPhone && (
              <TouchableOpacity activeOpacity={0.9} onPress={handleCall} style={styles.pill}>
                <Icons.Phone size={16} weight="bold" style={{ marginRight: 8 }} />
                <Text style={styles.pillLabel}>Cell No.:</Text>
                <Text style={styles.pillValue}>{customerPhone}</Text>
              </TouchableOpacity>
            )}
            {doc.otherInfo && (
              <View style={styles.pill}>
                <Text style={styles.pillLabel}>Other infos:</Text>
                <Text style={styles.pillValue}>{doc.otherInfo}</Text>
              </View>
            )}
          </View>

          <View style={styles.footerRow}>
            <TouchableOpacity onPress={handleRepaired} activeOpacity={0.9} style={styles.primaryBtn}>
              <Text style={styles.primaryText}>Repaired</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleTerminate} activeOpacity={0.9} style={styles.powerBtn}>
              <Icons.Power size={26} weight="bold" color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Completed or fallback (no operator, no auto-zoom)
  return (
    <View style={styles.container}>
      {/* Back */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity onPress={() => router.push('/activity')} style={styles.backButton} hitSlop={12}>
          <Icons.ArrowLeft size={20} color="#FFFFFF" weight="bold" />
        </TouchableOpacity>
      </View>

      {renderMapAndClientCard(false)}

      <View style={styles.completedInfoCard}>
        <Text style={styles.timeText}>{timeRange}</Text>
        {repairedAtText && <Text style={styles.timeRepairedText}>Repaired at: {repairedAtText}</Text>}
        <Text style={styles.statusText}>{status}</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            {clientAvatar ? (
              <Image source={{ uri: clientAvatar }} style={styles.avatar} onError={() => {}} onLoad={() => {}} />
            ) : (
              <View style={styles.avatar}>
                <Text style={{ color: 'white', fontSize: 10 }}>No Avatar</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.customerName}>{customer}</Text>
              {contactName && <Text style={styles.customerContact}>Contact: {contactName}</Text>}
              {customerPhone && <Text style={styles.customerPhone}>Phone: {customerPhone}</Text>}
            </View>
            <TouchableOpacity hitSlop={10} style={styles.iconBtn} onPress={handleMessagePress} disabled={msgBusy}>
              <Icons.EnvelopeSimple size={22} color="#000000" weight="bold" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.ratingTitle}>Customer rating</Text>
          <View style={styles.starsRow}>
            {Array.from({ length: 5 }).map((_, i) => {
              const filled = i < rating;
              return (
                <Icons.Star key={i} size={22} weight={filled ? 'fill' : 'regular'} color={filled ? GREEN : '#6b6b6b'} style={{ marginHorizontal: 4 }} />
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  backButtonContainer: { position: 'absolute', top: 40, left: 20, zIndex: 10000 },
  backButton: { width: 52, height: 30, borderRadius: 15, backgroundColor: '#000000ff', alignItems: 'center', justifyContent: 'center' },

  mapContainer: { flex: 1, width: '100%' },

  // Card shows ONLY client's vehicle/location (no operator row)
  locationCard: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: '#C4F5D7',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    zIndex: 1000,
  },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 0 },
  redDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF3B30', marginRight: 12, marginTop: 6 },
  locationTextWrap: { flex: 1 },
  locationTitle: { color: '#000000', fontSize: 16, fontFamily: INTER_BLACK, marginBottom: 4 },
  locationAddress: { color: '#333333', fontSize: 13, fontFamily: INTER_BLACK, lineHeight: 18 },

  completedInfoCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: '#C4F5D7',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    zIndex: 9999,
    elevation: 16,
  },

  clientCard: {
    backgroundColor: '#C4F5D7',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    zIndex: 9999,
    elevation: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  clientName: { color: GREEN, fontWeight: '800', fontSize: 18, marginBottom: 6 },
  vehicleName: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  address: { color: '#CFCFCF', fontSize: 13 },
  messageBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  separator: { height: 1, backgroundColor: BORDER, marginVertical: 14 },
  pillsWrap: { gap: 10 },
  pill: { backgroundColor: LIGHT_PILL, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  pillLabel: { color: '#0E0E0E', opacity: 0.7, marginRight: 6, fontWeight: '600' },
  pillValue: { color: '#0E0E0E', fontWeight: '700' },
  footerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  primaryBtn: { flex: 1, backgroundColor: GREEN, paddingVertical: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#0A0A0A', fontWeight: '800', fontSize: 16 },
  powerBtn: { width: 52, height: 52, marginLeft: 12, borderRadius: 26, backgroundColor: DECLINE_BG, alignItems: 'center', justifyContent: 'center' },

  timeText: { color: '#000000', opacity: 0.85, fontSize: 13, marginBottom: 2, fontFamily: INTER_BLACK },
  statusText: { color: '#000000', fontSize: 18, marginBottom: 12, fontFamily: INTER_BLACK },
  timeRepairedText: { color: '#333333', fontSize: 14, marginBottom: 8, fontFamily: INTER_BLACK },

  card: {
    backgroundColor: '#000000ff',
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    marginVertical: 10,
    minHeight: 80,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#d9d9d9', marginRight: 12 },
  customerName: { color: '#44ff75', fontFamily: INTER_BLACK, fontSize: 20, marginBottom: 4 },
  customerContact: { color: '#ffffffff', fontSize: 14, fontFamily: INTER_BLACK, marginBottom: 2 },
  customerPhone: { color: '#ffffffff', fontSize: 14, fontFamily: INTER_BLACK },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#44ff75',
  },
  ratingTitle: { color: '#ffffffff', opacity: 0.9, marginBottom: 10, textAlign: 'center', fontFamily: INTER_BLACK },
  starsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
