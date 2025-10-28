import React from "react";
import { View, StyleSheet } from "react-native";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacingY._15 }]}>
      <View style={styles.contentContainer}>
        <View style={styles.titleContainer}>
          <Typo size={32} fontFamily="Candal" style={{ lineHeight: 34, textShadowColor: colors.black, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 4 }}>
            <Typo size={32} fontFamily="Candal" color={colors.primary} style={{ textShadowColor: colors.black, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 4 }}>
              patch
            </Typo>
            <Typo size={32} fontFamily="Candal" color={colors.white} style={{ textShadowColor: colors.black, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 4 }}>
              {" "}up
            </Typo>
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
    minHeight: 80,
  },
  contentContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacingX._20,
    paddingBottom: spacingY._20,
  },
  titleContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
});
