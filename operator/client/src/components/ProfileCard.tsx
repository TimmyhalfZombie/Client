import * as Icons from 'phosphor-react-native';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { ProfileData } from '../screens/functions/profile';

const colors = {
  bg: '#101010',
  header: '#44ff75',
  chipBg: '#c7f7da',
  chipText: '#0b0b0b',
  text: '#ffffff',
  sub: '#bdbdbd',
  logout: '#ff3b30', // red
};

const { width } = Dimensions.get('window');
const AVATAR = 84;
const TOP_SPACER = AVATAR / 2 + 74;

type Props = {
  profile: ProfileData;
  // renamed to reflect that this only opens the confirm modal
  onLogoutPress: () => void;
};

export default function ProfileCard({ profile, onLogoutPress }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.headerWrap}>
        <Svg width={width} height={120}>
          <Path d={`M0 0 H${width} V100 L${width / 2} 120 L0 100 Z`} fill={colors.header} />
        </Svg>
        <View style={styles.avatar}>
          <Icons.User size={32} color={colors.sub} />
        </View>
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.infoSection}>
          <InfoChip icon={<Icons.User size={18} color={colors.chipText} />} label="Name"  value={profile.username || '—'} />
          <InfoChip icon={<Icons.Phone size={18} color={colors.chipText} />} label="Phone" value={profile.phone || '—'} />
          <InfoChip icon={<Icons.EnvelopeSimple size={18} color={colors.chipText} />} label="Email" value={profile.email || '—'} />
        </View>

        {/* Logout button positioned at bottom */}
        <View style={styles.logoutSection}>
          <LogoutButton onPress={onLogoutPress} />
        </View>
      </View>
    </View>
  );
}

function InfoChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <View style={styles.chipIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.chipLabel}>{label}</Text>
        <Text style={styles.chipValue}>{value}</Text>
      </View>
    </View>
  );
}

function LogoutButton({ onPress }: { onPress: () => void }) {
  // Some phosphor versions don’t include SignOut; fallback to ArrowRight.
  const SignOutIcon = (Icons as any).SignOut ?? Icons.ArrowRight;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={logoutStyles.wrap}
      accessibilityRole="button"
      accessibilityLabel="Logout"
    >
      <View style={logoutStyles.iconPill}>
        <SignOutIcon size={18} color="#ffffff" weight="bold" />
      </View>
      <Text style={logoutStyles.label}>Logout</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerWrap: { position: 'relative' },
  avatar: {
    position: 'absolute',
    bottom: -AVATAR / 2,
    alignSelf: 'center',
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: '#2a2a2a',
    borderWidth: 4,
    borderColor: colors.header,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
    paddingTop: -150, // Reduced from TOP_SPACER
    paddingHorizontal: 18,
  },
  infoSection: {
    flex: 1,
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.chipBg,
    marginBottom: 12, // Reduced margin
    borderRadius: 20, // Slightly smaller radius
    paddingVertical: 10, // Reduced padding
    paddingHorizontal: 14,
  },
  chipIcon: {
    width: 32, // Slightly smaller
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e8ffee',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  chipLabel: { color: '#3d4b40', fontSize: 11, marginTop: 2 },
  chipValue: { color: colors.chipText, fontSize: 15, fontWeight: '900' }, // Slightly smaller font
  logoutSection: {
    paddingBottom: 20,
    alignItems: 'center',
  },
});

const logoutStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 10,
  },
  iconPill: {
    backgroundColor: colors.logout,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
});
