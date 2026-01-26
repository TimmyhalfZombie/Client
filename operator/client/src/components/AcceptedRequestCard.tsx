import * as Icons from 'phosphor-react-native';
import React from 'react';
import {
  Linking,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BG = '#0E0E0E';
const GREEN = '#44ff75';
const DIVIDER = '#2B2B2B';
const DECLINE_BG = '#5F5B60';
const TEXT_MUTED = '#CFCFCF';
const LIGHT_PILL = '#DFFFEA';
const INTER_BLACK = 'Inter-Black';
const INTER_BOLD = 'Inter-Bold';

type Props = {
  clientName: string;
  placeName: string;
  address: string;
  vehicleType?: string;
  plateNumber?: string;
  phone?: string;
  otherInfo?: string;
  onRepaired: () => void;
  onCancelPress: () => void;
  onMessage?: () => void;
  onCallNow?: () => void;
  cardStyle?: StyleProp<ViewStyle>;
  absolute?: boolean;
  bottomOffset?: number;
};

export default function AcceptedRequestCard({
  clientName,
  placeName,
  address,
  vehicleType,
  plateNumber,
  phone,
  otherInfo,
  onRepaired,
  onCancelPress,
  onMessage,
  onCallNow,
  cardStyle,
  absolute = true,
  bottomOffset = 12,
}: Props) {
  const insets = useSafeAreaInsets();

  const containerStyle: StyleProp<ViewStyle> = [
    styles.card,
    absolute && {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: (insets?.bottom || 12) + bottomOffset,
    },
    { zIndex: 9999, elevation: 16 }, // always on top
    cardStyle,
  ];

  const handleCall = () => {
    if (onCallNow) return onCallNow();
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  return (
    <View style={containerStyle}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.clientName}>{clientName}</Text>
          <Text style={styles.title}>{placeName}</Text>
          {!!address && <Text style={styles.address}>{address}</Text>}
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Message customer"
          onPress={onMessage}
          style={styles.messageBtn}
          activeOpacity={0.8}
        >
          <Icons.EnvelopeSimple size={22} weight="bold" color={GREEN} />
        </TouchableOpacity>
      </View>

      <View style={styles.separator} />

      {/* Pills */}
      <View style={styles.pillsWrap}>
        {vehicleType ? <InfoPill label="Vehicle Type" value={vehicleType} /> : null}
        {plateNumber ? <InfoPill label="Plate Number" value={plateNumber} /> : null}
        {phone ? (
          <TouchableOpacity activeOpacity={0.9} onPress={handleCall} style={styles.pill}>
            <Icons.Phone size={16} weight="bold" style={{ marginRight: 8 }} />
            <Text style={styles.pillLabel}>Cell No.:</Text>
            <Text style={styles.pillValue}>{phone}</Text>
          </TouchableOpacity>
        ) : null}
        {otherInfo ? <InfoPill label="Other infos" value={otherInfo} /> : null}
      </View>

      {/* Footer */}
      <View style={styles.footerRow}>
        <TouchableOpacity onPress={onRepaired} activeOpacity={0.9} style={styles.primaryBtn}>
          <Text style={styles.primaryText}>Repaired</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onCancelPress} activeOpacity={0.9} style={styles.powerBtn}>
          <Icons.Power size={26} weight="bold" color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}:</Text>
      <Text style={styles.pillValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BG,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  clientName: { color: GREEN, fontSize: 18, marginBottom: 6, fontFamily: INTER_BLACK },
  title: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 6, fontFamily: INTER_BOLD },
  address: { color: TEXT_MUTED, fontSize: 13 },

  messageBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: DIVIDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  separator: { height: 1, backgroundColor: DIVIDER, marginVertical: 14 },

  pillsWrap: { gap: 10 },
  pill: {
    backgroundColor: LIGHT_PILL,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  pillLabel: { color: '#0E0E0E', opacity: 0.7, marginRight: 6, fontWeight: '600' },
  pillValue: { color: '#0E0E0E', fontWeight: '700' },

  footerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  primaryBtn: {
    flex: 1,
    backgroundColor: GREEN,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#0A0A0A', fontWeight: '800', fontSize: 16 },
  powerBtn: {
    width: 52,
    height: 52,
    marginLeft: 12,
    borderRadius: 26,
    backgroundColor: DECLINE_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
