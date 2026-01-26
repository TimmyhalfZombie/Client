// src/features/assistance/components/RequestInfoBox.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Icons from 'phosphor-react-native';

const BG = '#0E0E0E';
const LIGHT_PILL = '#DFFFEA';

type Props = {
  vehicleType?: string;
  plateNumber?: string;
  phone?: string;
  otherInfo?: string;
  /** Render as an absolute overlay above the bottom card */
  absolute?: boolean;
  /** How far above the bottom to place the box (to clear the Accept/Decline card) */
  bottomOffset?: number;
  style?: StyleProp<ViewStyle>;
};

function RequestInfoBox({
  vehicleType,
  plateNumber,
  phone,
  otherInfo,
  absolute = true,
  bottomOffset = 140, // adjust if it overlaps your RequestBottomCard
  style,
}: Props) {
  const insets = useSafeAreaInsets();

  // Render nothing if no info available
  if (!vehicleType && !plateNumber && !phone && !otherInfo) return null;

  const container = [
    styles.card,
    absolute
      ? {
          position: 'absolute' as const,
          left: 12,
          right: 12,
          bottom: (insets?.bottom || 12) + bottomOffset,
        }
      : null,
    style,
  ] as StyleProp<ViewStyle>;

  const handleCall = () => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  return (
    <View style={container} pointerEvents="box-none">
      <View style={styles.pillsWrap}>
        {vehicleType ? <Pill label="Vehicle Type" value={vehicleType} /> : null}
        {plateNumber ? <Pill label="Plate Number" value={plateNumber} /> : null}
        {phone ? (
          <TouchableOpacity onPress={handleCall} activeOpacity={0.9} style={styles.pillRow}>
            <Icons.Phone size={16} weight="bold" style={{ marginRight: 8 }} />
            <Text style={styles.pillLabel}>Cell No.:</Text>
            <Text style={styles.pillValue}>{phone}</Text>
          </TouchableOpacity>
        ) : null}
        {otherInfo ? <Pill label="Other infos" value={otherInfo} /> : null}
      </View>
    </View>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pillRow}>
      <Text style={styles.pillLabel}>{label}:</Text>
      <Text style={styles.pillValue}>{value}</Text>
    </View>
  );
}

export default React.memo(RequestInfoBox);

const styles = StyleSheet.create({
  card: {
    backgroundColor: BG,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  pillsWrap: { gap: 10 },
  pillRow: {
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
});
