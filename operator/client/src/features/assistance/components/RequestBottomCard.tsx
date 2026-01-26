  import React, { useMemo, useState } from 'react';
  import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    ViewStyle,
    StyleProp,
  } from 'react-native';
  import { useSafeAreaInsets } from 'react-native-safe-area-context';
  import * as Icons from 'phosphor-react-native';

  const BG = '#0E0E0E';
  const GREEN = '#44ff75';
  const DIVIDER = '#2B2B2B';
  const DECLINE_BG = '#5F5B60';

  type Stage = 'preview' | 'details';

  type Props = {
    /** Common */
    clientName: string;
    placeName: string;
    address: string;

    /** Actions */
    onAccept?: () => void;
    onDecline?: () => void;
    onMessage?: () => void;

    /** Style */
    cardStyle?: StyleProp<ViewStyle>;
    /** Render overlay pinned to the bottom above the gesture bar */
    absolute?: boolean;
    /** Extra bottom padding to lift the card upwards */
    bottomOffset?: number;

    /** Details (shown after Accept) */
    vehicleType?: string;
    plate?: string;
    phone?: string;

    /** Controlled mode (optional). If omitted, the component manages its own stage. */
    stage?: Stage;
    /** When in controlled mode, you can change stage in parent; this is just for TS clarity */
    onStageChange?: (stage: Stage) => void;

    /** Optional Close handler for details view */
    onCloseDetails?: () => void;
  };

  export default function RequestBottomCard({
    clientName,
    placeName,
    address,
    onAccept,
    onDecline,
    onMessage,
    cardStyle,
    absolute = true,
    bottomOffset = 0,

    vehicleType = '—',
    plate = '—',
    phone = '—',

    stage,
    onStageChange,
    onCloseDetails,
  }: Props) {
    const insets = useSafeAreaInsets();

    // Controlled/uncontrolled logic
    const [internalStage, setInternalStage] = useState<Stage>('preview');
    const isControlled = stage !== undefined;
    const currentStage = (isControlled ? stage : internalStage) as Stage;

    const Container = absolute ? View : React.Fragment;
    const containerProps = absolute
      ? ({
          style: [
            styles.overlay,
            { paddingBottom: Math.max(8, insets.bottom + 6) + bottomOffset },
          ],
          // allow touches to pass through the rest of the screen except the card
          pointerEvents: 'box-none' as const,
        } as any)
      : {};

    const goDetails = () => {
      if (isControlled) {
        onStageChange?.('details');
      } else {
        setInternalStage('details');
      }
    };

    const closeAll = () => {
      if (isControlled) {
        onStageChange?.('preview');
      } else {
        setInternalStage('preview');
      }
      onCloseDetails?.();
    };

    // @ts-ignore — View when absolute, Fragment when not
    return (
      <Container {...containerProps}>
        <View style={[styles.card, cardStyle]}>
          {currentStage === 'preview' ? (
            <>
              {/* Header */}
              <View style={styles.headerBlock}>
                <View style={styles.row}>
                  <Text style={styles.name} numberOfLines={1}>
                    {clientName}
                  </Text>

                  <TouchableOpacity
                    onPress={onMessage}
                    disabled={!onMessage}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    accessibilityRole="button"
                    accessibilityLabel="Message client"
                  >
                    <Icons.EnvelopeSimple size={27} color={GREEN} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.place} numberOfLines={2}>
                  {placeName}
                </Text>
                <Text style={styles.addr} numberOfLines={3}>
                  {address}
                </Text>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, styles.accept]}
                  onPress={() => {
                    onAccept?.();
                    // switch to details AFTER accept
                    goDetails();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Accept request"
                  activeOpacity={0.9}
                >
                  <Text style={styles.acceptText}>Accept</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.decline]}
                  onPress={onDecline}
                  accessibilityRole="button"
                  accessibilityLabel="Decline request"
                  activeOpacity={0.9}
                >
                  <Text style={styles.declineText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {/* DETAILS (boxes) */}
              <View style={styles.headerBlock}>
                <Text style={styles.name} numberOfLines={1}>
                  {clientName}
                </Text>
                <Text style={[styles.addr, { marginTop: 6 }]} numberOfLines={3}>
                  {address}
                </Text>
              </View>

              <BoxField label="Vehicle Type" value={vehicleType} />
              <BoxField label="Plate Number" value={plate} />
              <BoxField label="Cell No." value={phone} />

              <View style={{ height: 10 }} />

              {/* Actions for details (message / close) */}
              <View style={[styles.actions, { paddingTop: 0 }]}>
                <TouchableOpacity
                  style={[styles.btn, styles.accept]}
                  onPress={onMessage}
                  activeOpacity={0.9}
                >
                  <Text style={styles.acceptText}>Message</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.decline]}
                  onPress={closeAll}
                  activeOpacity={0.9}
                >
                  <Text style={styles.declineText}>Close</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Container>
    );
  }

  /** Small field “box” used in details */
  function BoxField({ label, value }: { label: string; value: string }) {
    return (
      <View style={styles.boxField}>
        <Text style={styles.boxText}>
          <Text style={{ fontWeight: '800' }}>{label}: </Text>
          {value}
        </Text>
      </View>
    );
  }

  const styles = StyleSheet.create({
    // Full-screen overlay so the map stays visible behind, but the card sits on top.
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
      zIndex: 9998, // <-- keep above map
      elevation: 30, // <-- Android
    },

    // The black sheet
    card: {
      marginHorizontal: 12,
      backgroundColor: BG,
      borderRadius: 16,
      overflow: 'hidden',
      zIndex: 9999, // ensure the card itself is above everything
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 8 },
        },
        android: { elevation: 32 },
      }),
    },

    headerBlock: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
    },

    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    // Green name
    name: {
      color: GREEN,
      fontSize: 25,
      fontWeight: '800',
    },

    // White bold place
    place: {
      marginTop: 6,
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '800',
    },

    // Grey address
    addr: {
      marginTop: 4,
      color: '#B9B9B9',
      fontSize: 14,
      lineHeight: 16,
      fontWeight: '500',
    },

    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: DIVIDER,
      marginHorizontal: 16,
      marginTop: 6,
      marginBottom: 10,
    },

    actions: {
      flexDirection: 'row',
      // @ts-ignore RN pre-0.73 may need ignore
      gap: 14,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },

    btn: {
      flex: 1,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },

    accept: { backgroundColor: GREEN },
    decline: { backgroundColor: DECLINE_BG },

    acceptText: { color: '#0E0E0E', fontWeight: '800', fontSize: 16 },
    declineText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },

    // Field “box” used in details screen
    boxField: {
      backgroundColor: '#DFFFE9',
      borderRadius: 14,
      marginHorizontal: 16,
      marginBottom: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    boxText: { color: '#1a1a1a', fontSize: 14, fontWeight: '600' },
  });
