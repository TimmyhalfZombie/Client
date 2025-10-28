// app/patching.tsx
import React, { useEffect } from "react";
import {
  View,
  StyleSheet,
  StatusBar,
  Text,
  StyleProp,
  TextStyle,
} from "react-native";
import Typo from "@/components/Typo";
import { colors, spacingY } from "@/constants/theme";
import { useRouter } from "expo-router";
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withRepeat,
  withDelay,
} from "react-native-reanimated";

type DotProps = {
  delay?: number;
  style?: StyleProp<TextStyle>;
};

const Dot = ({ delay = 0, style }: DotProps) => {
  const y = useSharedValue(0);

  useEffect(() => {
    y.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-8, { duration: 280, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 280, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      )
    );
  }, [delay, y]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));

  return (
    <Animated.Text style={[styles.dot, style, aStyle]}>
      .
    </Animated.Text>
  );
};

export default function Patching() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace("/(main)/(tabs)/home");
    }, 3000); // show for 3 seconds
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View style={styles.container}>
      <StatusBar
        translucent={false}
        backgroundColor={colors.black}
        barStyle="light-content"
      />

      {/* Title block styled per your snippet */}
      <View style={{ gap: spacingY._5, marginBottom: spacingY._15 }}>
        <Typo size={25} style={{ textAlign: "center" }} fontFamily="Candal">
          <Text style={{ color: colors.green }}>patching</Text>
          <Text style={{ color: colors.white }}> up</Text>
        </Typo>

        <Typo
          color={colors.neutral100}
          style={{ textAlign: "center", marginTop: -spacingY._12 }}
          fontFamily="InterLight"
        >
          {/* Subtle animated ellipsis */}
          <Dot delay={0} style={{ color: colors.white}} />
          <Dot delay={120} style={{ color: colors.white}} />
          <Dot delay={240} style={{ color: colors.white}} />
        </Typo>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    fontSize: 28,
    lineHeight: 32,
    // No explicit color/weight so it inherits from the Typo line;
    // pass a style prop to override color when needed.
  },
});