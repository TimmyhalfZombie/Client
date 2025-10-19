import React from "react";
import { View, TouchableOpacity, StyleSheet, Platform, Animated } from "react-native";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY, radius } from "@/constants/theme";
import * as Icons from "phosphor-react-native";
import { verticalScale } from "@/utils/styling";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

// Liquid Glass (SDK 54+)
let GlassView: any, isLiquidGlassAvailable: (() => boolean) | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require("expo-glass-effect");
  GlassView = m.GlassView;
  isLiquidGlassAvailable = m.isLiquidGlassAvailable;
} catch {}

type Props = {
  username?: string;
  address: string;
  locating: boolean;
  onCopy: () => void;
  titleStyle?: "possessive" | "colon";
  showStatus?: boolean;
  statusText?: string;
};

const LocationHeader: React.FC<Props> = ({
  username,
  address,
  locating,
  onCopy,
  titleStyle = "possessive",
  showStatus = false,
  statusText = "Online",
}) => {
  const insets = useSafeAreaInsets();

  // Function to get user initials
  const getUserInitials = (name: string): string => {
    const words = name.trim().split(/\s+/).filter(word => word.length > 0);
    if (words.length === 0) return 'U';
    if (words.length === 1) {
      return words[0]?.charAt(0)?.toUpperCase() ?? 'U';
    } else {
      const firstInitial = words[0]?.charAt(0) ?? '';
      const secondInitial = words[1]?.charAt(0) ?? '';
      const initials = (firstInitial + secondInitial).toUpperCase();
      return initials || 'U';
    }
  };

  const title =
    titleStyle === "colon"
      ? `${username?.trim() || "User"}, current location:`
      : `${(username?.trim() || "User")}'s current location`;

  const canLiquid =
    Platform.OS === "ios" && GlassView && (isLiquidGlassAvailable?.() ?? true);

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacingY._15 }]}>
      {/* Enhanced background with gradient overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.1)']}
        locations={[0, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Glass effect overlay */}
      {canLiquid ? (
        <GlassView
          pointerEvents="none"
          glassEffectStyle="prominent"
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <BlurView
          pointerEvents="none"
          tint="dark"
          intensity={20}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Main content container */}
      <View style={styles.contentContainer}>
        {/* Location section - Now on the left */}
        <View style={styles.locationSection}>
          <View style={styles.locationHeader}>
            <Icons.MapPin 
              color={colors.green} 
              weight="fill" 
              size={verticalScale(16)} 
            />
            <Typo
              color={colors.neutral200}
              size={12}
              fontFamily="InterLight"
              style={{ marginLeft: 6 }}
            >
              Current Location
            </Typo>
          </View>
          
          <Typo
            color={colors.white}
            size={14}
            fontFamily="InterLight"
            textProps={{ numberOfLines: 2 }}
            style={styles.addressText}
          >
            {locating ? "Locating your position..." : address || "Location not available"}
          </Typo>
        </View>

        {/* Copy Button - Standalone */}
        <TouchableOpacity
          onPress={onCopy}
          style={styles.copyButton}
          hitSlop={{ top: 12, left: 12, bottom: 12, right: 12 }}
          accessibilityLabel="Copy current address"
          accessibilityRole="button"
        >
          <Icons.CopySimple color={colors.white} weight="bold" size={verticalScale(18)} />
        </TouchableOpacity>

        {/* User Avatar - Standalone circle C */}
        <View style={styles.userAvatar}>
          <Typo size={16} fontWeight="bold" color={colors.green}>
            {getUserInitials(username?.trim() || "User")}
          </Typo>
        </View>
      </View>
    </View>
  );
};

export default LocationHeader;

const styles = StyleSheet.create({
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
    zIndex: 20,
    minHeight: 120,
  },
  contentContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacingX._20,
    paddingBottom: spacingY._20,
  },
  userSection: {
    alignItems: "flex-start",
 
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacingY._8,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.green,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    position: "absolute",
    top: spacingY._10,
    right: spacingX._20,
  },
  userDetails: {
    flex: 1,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  locationSection: {
    flex: 1,
    maxWidth: '70%',
    marginRight: spacingX._15,
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacingY._4,
  },
  addressText: {
    lineHeight: 18,
    textAlign: "left",
    flexWrap: "nowrap",
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._8,
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    position: "absolute",
    top: spacingY._8,
    left: '80%',
  
  },
});
